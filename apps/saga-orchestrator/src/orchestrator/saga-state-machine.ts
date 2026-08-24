import { Injectable, Logger } from '@nestjs/common';
import { CompensationRegistry, SagaInstanceSnapshot } from '@saganova/saga-toolkit';
import {
  CONFIRM_ORDER_COMMAND,
  ConfirmOrderCommandPayload,
  CANCEL_ORDER_COMMAND,
  CancelOrderCommandPayload,
} from '@saganova/event-contracts';
import { orderFulfillmentSaga, OrderFulfillmentContext, OrderFulfillmentLine } from './order-fulfillment.saga-definition';
import { SagaInstanceRepository } from '../infrastructure/postgres/saga-instance.repository';
import { SagaCommandProducer } from '../kafka/saga-command.producer';

/**
 * The actual orchestration logic, separated from Kafka wiring
 * (SagaEventConsumer just parses envelopes and calls into this). This is
 * where @saganova/saga-toolkit's generic CompensationRegistry gets
 * married to THIS saga's specific "what happens on COMPLETED /
 * COMPENSATED" behavior - the toolkit only knows how to walk the step
 * graph forward/backward, it has no opinion on what "done" means for a
 * checkout specifically.
 */
@Injectable()
export class SagaStateMachine {
  private readonly logger = new Logger(SagaStateMachine.name);
  private readonly registry: CompensationRegistry<OrderFulfillmentContext>;

  constructor(
    private readonly instanceRepository: SagaInstanceRepository,
    private readonly commandProducer: SagaCommandProducer,
  ) {
    this.registry = new CompensationRegistry(orderFulfillmentSaga, (commandType, payload, correlationId) =>
      this.commandProducer.publish(commandType, payload, correlationId),
    );
  }

  /** Called when an OrderCreated event arrives - kicks off a brand-new saga instance. */
  async start(orderId: string, customerId: string, lines: OrderFulfillmentLine[], amountCents: number, correlationId: string): Promise<void> {
    const existing = await this.instanceRepository.findById(orderId);
    if (existing) {
      this.logger.warn(`Saga for order ${orderId} already exists - ignoring duplicate OrderCreated delivery.`);
      return;
    }

    const context: OrderFulfillmentContext = { orderId, customerId, lines, amountCents };
    const snapshot = await this.registry.start(orderId, correlationId, context);
    await this.instanceRepository.save(snapshot, correlationId);
    this.logger.log(`Started saga for order ${orderId}`);
  }

  /**
   * Called for every step-outcome event (InventoryReserved/Failed,
   * PaymentAuthorized/Declined, ...). `orderId` is read from the event
   * PAYLOAD, not the Kafka envelope's aggregateId - payment.events'
   * aggregateId is the paymentId, not the orderId, so the payload is the
   * only reliable place to find which saga this belongs to.
   */
  async onEvent(orderId: string, eventType: string, correlationId: string, eventPayload: Record<string, unknown>): Promise<void> {
    const entity = await this.instanceRepository.findById(orderId);
    if (!entity) {
      this.logger.warn(`Received ${eventType} for order ${orderId} but no saga instance exists - ignoring.`);
      return;
    }

    const snapshot = this.instanceRepository.toSnapshot<OrderFulfillmentContext>(entity);

    // Idempotency: once a saga has reached a terminal state, any further
    // (redelivered) event for it is a no-op - re-running onEvent would
    // otherwise re-publish ConfirmOrder/CancelOrder a second time.
    if (snapshot.status === 'COMPLETED' || snapshot.status === 'COMPENSATED') {
      this.logger.warn(`Saga for order ${orderId} is already ${snapshot.status} - ignoring ${eventType}.`);
      return;
    }

    const updated: SagaInstanceSnapshot<OrderFulfillmentContext> = await this.registry.onEvent(
      snapshot,
      eventType,
      correlationId,
      eventPayload,
    );
    await this.instanceRepository.save(updated, correlationId);

    if (updated.status === 'COMPLETED') {
      await this.onSagaCompleted(updated, correlationId);
    } else if (updated.status === 'COMPENSATED') {
      await this.onSagaCompensated(updated, correlationId);
    }
  }

  /** All forward steps succeeded - tell order-service to move to CONFIRMED. */
  private async onSagaCompleted(snapshot: SagaInstanceSnapshot<OrderFulfillmentContext>, correlationId: string): Promise<void> {
    const payload: ConfirmOrderCommandPayload = {
      orderId: snapshot.context.orderId,
      paymentId: snapshot.context.paymentId as string,
    };
    await this.commandProducer.publish(CONFIRM_ORDER_COMMAND, payload, correlationId);
    this.logger.log(`Saga for order ${snapshot.context.orderId} COMPLETED - ConfirmOrder published.`);
  }

  /** Either a step failed with nothing to compensate, or every compensation command has been fired - tell order-service to move to CANCELLED. */
  private async onSagaCompensated(snapshot: SagaInstanceSnapshot<OrderFulfillmentContext>, correlationId: string): Promise<void> {
    const lastFailedStep = snapshot.history[snapshot.history.length - 1];
    const payload: CancelOrderCommandPayload = {
      orderId: snapshot.context.orderId,
      reason: `Saga failed at step "${lastFailedStep?.step ?? 'unknown'}"`,
    };
    await this.commandProducer.publish(CANCEL_ORDER_COMMAND, payload, correlationId);
    this.logger.log(`Saga for order ${snapshot.context.orderId} COMPENSATED - CancelOrder published.`);
  }
}
