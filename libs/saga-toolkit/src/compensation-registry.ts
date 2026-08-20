import { Logger } from '@nestjs/common';
import { SagaDefinition, SagaInstanceSnapshot, SagaStep } from './saga-step.interface';

type PublishFn = (commandType: string, payload: unknown, correlationId: string) => Promise<void>;

/**
 * Walks a SagaDefinition forward on success events, and BACKWARD through
 * every already-completed step's compensation command on failure. This is
 * the core "undo" engine referenced by every `*.compensator.ts` in
 * saga-orchestrator.
 *
 * Usage:
 *   const engine = new CompensationRegistry(orderFulfillmentSaga, publishFn);
 *   const next = engine.onEvent(snapshot, 'inventory.reservation_failed.v1');
 *   // -> { status: 'COMPENSATING', ... } and already published any needed
 *   //    compensation commands for prior steps.
 */
export class CompensationRegistry<TContext extends Record<string, unknown>> {
  private readonly logger = new Logger(CompensationRegistry.name);

  constructor(
    private readonly definition: SagaDefinition<TContext>,
    private readonly publish: PublishFn,
  ) {}

  async start(sagaId: string, correlationId: string, context: TContext): Promise<SagaInstanceSnapshot<TContext>> {
    const firstStep = this.definition.steps[0];
    await this.publish(firstStep.command, firstStep.buildCommandPayload(context), correlationId);

    return {
      sagaId,
      definitionName: this.definition.name,
      currentStepIndex: 0,
      status: 'IN_PROGRESS',
      context,
      history: [{ step: firstStep.name, event: 'STARTED', at: new Date().toISOString() }],
    };
  }

  async onEvent(
    snapshot: SagaInstanceSnapshot<TContext>,
    eventType: string,
    correlationId: string,
    eventPayload?: Record<string, unknown>,
  ): Promise<SagaInstanceSnapshot<TContext>> {
    const step = this.definition.steps[snapshot.currentStepIndex];
    const mergedContext = { ...snapshot.context, ...(eventPayload ?? {}) } as TContext;

    if (eventType === step.successEvent) {
      return this.advance(snapshot, mergedContext, correlationId);
    }

    if (eventType === step.failureEvent) {
      return this.beginCompensation(snapshot, mergedContext, correlationId);
    }

    this.logger.warn(`Saga ${snapshot.sagaId}: unexpected event "${eventType}" at step "${step.name}", ignoring`);
    return snapshot;
  }

  private async advance(
    snapshot: SagaInstanceSnapshot<TContext>,
    context: TContext,
    correlationId: string,
  ): Promise<SagaInstanceSnapshot<TContext>> {
    const nextIndex = snapshot.currentStepIndex + 1;
    const history = [
      ...snapshot.history,
      { step: this.definition.steps[snapshot.currentStepIndex].name, event: 'SUCCEEDED', at: new Date().toISOString() },
    ];

    if (nextIndex >= this.definition.steps.length) {
      return { ...snapshot, context, status: 'COMPLETED', history };
    }

    const nextStep = this.definition.steps[nextIndex];
    await this.publish(nextStep.command, nextStep.buildCommandPayload(context), correlationId);

    return { ...snapshot, context, currentStepIndex: nextIndex, status: 'IN_PROGRESS', history };
  }

  private async beginCompensation(
    snapshot: SagaInstanceSnapshot<TContext>,
    context: TContext,
    correlationId: string,
  ): Promise<SagaInstanceSnapshot<TContext>> {
    const history = [
      ...snapshot.history,
      { step: this.definition.steps[snapshot.currentStepIndex].name, event: 'FAILED', at: new Date().toISOString() },
    ];

    // Walk backward from the step BEFORE the one that failed - the failed
    // step itself never took effect, so it has nothing to undo.
    const stepsToCompensate: SagaStep<TContext>[] = this.definition.steps
      .slice(0, snapshot.currentStepIndex)
      .filter((s) => !!s.compensationCommand)
      .reverse();

    for (const step of stepsToCompensate) {
      this.logger.log(`Saga ${snapshot.sagaId}: compensating step "${step.name}"`);
      await this.publish(step.compensationCommand as string, step.buildCompensationPayload?.(context), correlationId);
    }

    return {
      ...snapshot,
      context,
      status: stepsToCompensate.length > 0 ? 'COMPENSATING' : 'COMPENSATED',
      history,
    };
  }

  /** Called by the orchestrator once all compensation-confirmation events have arrived. */
  markCompensated(snapshot: SagaInstanceSnapshot<TContext>): SagaInstanceSnapshot<TContext> {
    return { ...snapshot, status: 'COMPENSATED' };
  }
}
