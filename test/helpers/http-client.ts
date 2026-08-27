/**
 * Minimal HTTP helper for e2e specs - uses Node's built-in global
 * `fetch` (available since Node 18) so the test/ package needs no HTTP
 * client dependency of its own.
 */

const API_GATEWAY_URL = process.env.E2E_API_GATEWAY_URL ?? 'http://localhost:3000';
const SAGA_ORCHESTRATOR_URL = process.env.E2E_SAGA_ORCHESTRATOR_URL ?? 'http://localhost:3004';

export interface DevTokenResponse {
  accessToken: string;
}

/**
 * Uses api-gateway's dev-only /auth/dev-token endpoint (see
 * DevTokenController) - refuses to run in production by design, which
 * makes it exactly right for e2e tests and nothing else.
 */
export async function issueDevToken(customerId: string, email = 'e2e@saganova.example'): Promise<string> {
  const res = await fetch(`${API_GATEWAY_URL}/api/v1/auth/dev-token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ customerId, email }),
  });
  if (!res.ok) {
    throw new Error(`Failed to issue dev token: ${res.status} ${await res.text()}`);
  }
  const body = (await res.json()) as DevTokenResponse;
  return body.accessToken;
}

export interface CreateOrderItem {
  sku: string;
  qty: number;
  unitPriceCents: number;
}

export interface CreateOrderResponse {
  orderId: string;
  correlationId: string;
  status: 'ACCEPTED';
}

export async function createOrder(accessToken: string, items: CreateOrderItem[]): Promise<CreateOrderResponse> {
  const res = await fetch(`${API_GATEWAY_URL}/api/v1/orders`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ items }),
  });
  if (res.status !== 202) {
    throw new Error(`Expected 202 Accepted from POST /orders, got ${res.status}: ${await res.text()}`);
  }
  return res.json() as Promise<CreateOrderResponse>;
}

export interface SagaStatusResponse {
  orderId: string;
  sagaStatus: 'STARTED' | 'IN_PROGRESS' | 'COMPLETED' | 'COMPENSATING' | 'COMPENSATED' | 'FAILED';
  currentStep: string;
  history: { step: string; event: string; at: string }[];
}

/** Hits saga-orchestrator directly rather than proxying through the gateway - fewer moving parts to fail in a test helper. */
export async function getSagaStatus(orderId: string): Promise<SagaStatusResponse | null> {
  const res = await fetch(`${SAGA_ORCHESTRATOR_URL}/sagas/${orderId}`);
  if (res.status === 404) return null;
  if (!res.ok) {
    throw new Error(`Failed to fetch saga status for ${orderId}: ${res.status} ${await res.text()}`);
  }
  return res.json() as Promise<SagaStatusResponse>;
}
