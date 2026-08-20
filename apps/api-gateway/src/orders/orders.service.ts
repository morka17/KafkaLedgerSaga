import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { randomUUID } from 'crypto';
import { firstValueFrom } from 'rxjs';
import { AxiosError } from 'axios';
import { KafkaProducerService } from '@saganova/kafka-client';
import {
  CREATE_ORDER_COMMAND,
  CreateOrderCommandPayload,
  SAGA_COMMANDS_TOPIC,
  makeCommand,
} from '@saganova/event-contracts';
import { CreateOrderDto } from './dto/create-order.dto';

export interface CreateOrderResult {
  orderId: string;
  correlationId: string;
  status: 'ACCEPTED';
}

export interface OrderStatusResult {
  orderId: string;
  sagaStatus: string;
  currentStep: string;
  history: { step: string; event: string; at: string }[];
}

/**
 * The gateway never touches Postgres and never talks to order-service
 * over HTTP for writes - it only translates an authenticated HTTP
 * request into a well-formed Kafka command. order-service (via the saga
 * orchestrator) owns everything that happens after this point.
 *
 * Reads (order status) are the one place the gateway calls another
 * service synchronously over HTTP, since polling Kafka client-side isn't
 * practical - it proxies to saga-orchestrator's internal read API.
 */
@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);
  private readonly sagaOrchestratorUrl = process.env.SAGA_ORCHESTRATOR_URL ?? 'http://saga-orchestrator:3004';

  constructor(
    private readonly kafkaProducer: KafkaProducerService,
    private readonly http: HttpService,
  ) {}

  async createOrder(customerId: string, dto: CreateOrderDto, correlationId: string): Promise<CreateOrderResult> {
    const orderId = randomUUID();

    const payload: CreateOrderCommandPayload = {
      orderId,
      customerId,
      items: dto.items,
    };

    const command = makeCommand({
      type: CREATE_ORDER_COMMAND,
      correlationId,
      payload,
    });

    await this.kafkaProducer.publish(SAGA_COMMANDS_TOPIC, command, {
      key: orderId, // keeps every command/event for this order on one partition, preserving order
      headers: { 'x-customer-id': customerId },
    });

    this.logger.log(`CreateOrder accepted: orderId=${orderId} customerId=${customerId} correlationId=${correlationId}`);

    return { orderId, correlationId, status: 'ACCEPTED' };
  }

  async getOrderStatus(orderId: string, correlationId: string): Promise<OrderStatusResult> {
    try {
      const response = await firstValueFrom(
        this.http.get<OrderStatusResult>(`${this.sagaOrchestratorUrl}/sagas/${orderId}`, {
          headers: { 'x-correlation-id': correlationId },
          timeout: 5_000,
        }),
      );
      return response.data;
    } catch (err) {
      const axiosErr = err as AxiosError;
      if (axiosErr.response?.status === 404) {
        throw new NotFoundException(`No order found with id ${orderId}`);
      }
      this.logger.error(`Failed to fetch saga status for order ${orderId}: ${axiosErr.message}`);
      throw err;
    }
  }
}
