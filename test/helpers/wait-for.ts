import { getSagaStatus, SagaStatusResponse } from './http-client';

export class TimeoutWaitingForSagaError extends Error {
  constructor(orderId: string, lastStatus: SagaStatusResponse | null, timeoutMs: number) {
    super(
      `Timed out after ${timeoutMs}ms waiting for order ${orderId}'s saga to reach a terminal state. ` +
        `Last observed status: ${lastStatus ? JSON.stringify(lastStatus) : 'saga not found yet'}.`,
    );
    this.name = 'TimeoutWaitingForSagaError';
  }
}

const TERMINAL_STATUSES = new Set(['COMPLETED', 'COMPENSATED', 'FAILED']);

/**
 * Polls saga-orchestrator until the saga for `orderId` reaches a
 * terminal state (COMPLETED or COMPENSATED - see
 * docs/sagas/order-fulfillment-saga.md). Polling, not a webhook or
 * Kafka subscription from the test itself, because the test is
 * deliberately a black-box client of the system exactly like a real
 * caller (api-gateway's own OrdersService.getOrderStatus does the same
 * kind of read) - it has no special access to internals.
 */
export async function waitForSagaTerminal(
  orderId: string,
  { timeoutMs = 20_000, pollIntervalMs = 250 }: { timeoutMs?: number; pollIntervalMs?: number } = {},
): Promise<SagaStatusResponse> {
  const deadline = Date.now() + timeoutMs;
  let lastStatus: SagaStatusResponse | null = null;

  while (Date.now() < deadline) {
    lastStatus = await getSagaStatus(orderId);
    if (lastStatus && TERMINAL_STATUSES.has(lastStatus.sagaStatus)) {
      return lastStatus;
    }
    await sleep(pollIntervalMs);
  }

  throw new TimeoutWaitingForSagaError(orderId, lastStatus, timeoutMs);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
