import { createOrder, issueDevToken } from '../helpers/http-client';
import { waitForSagaTerminal } from '../helpers/wait-for';

/**
 * Prerequisites (never started by this file itself - see
 * jest-e2e.config.ts's docstring):
 *   - docker compose up -d (Kafka, Postgres, Jaeger)
 *   - Kafka topics provisioned (tools/scripts/create-kafka-topics.sh)
 *   - migrations run (npm run --workspace=@saganova/tools migrate:run-all)
 *   - dev data seeded (npm run --workspace=@saganova/tools seed)
 *   - every service built and running (api-gateway, order-service,
 *     payment-service, inventory-service, saga-orchestrator,
 *     notification-service, audit-ledger-service)
 *
 * `tools/scripts/bootstrap.sh` does the first four in one command; the
 * services themselves are started via `npm run dev` or the CI e2e job.
 *
 * No Stripe/SendGrid/Twilio credentials are required - payment-service
 * and notification-service fall back to MockStripeAdapter /
 * MockEmailProvider / MockSmsProvider whenever those env vars are unset,
 * which is exactly what makes the decline path below runnable in CI.
 */
describe('Checkout flow (full stack, e2e)', () => {
  const STANDARD_ITEM = { sku: 'SKU-42', qty: 1, unitPriceCents: 1999 };

  it('happy path: order is created, inventory reserved, payment authorized, order confirmed', async () => {
    const accessToken = await issueDevToken('11111111-0000-0000-0000-000000000001');

    const { orderId } = await createOrder(accessToken, [STANDARD_ITEM]);

    const finalStatus = await waitForSagaTerminal(orderId);

    expect(finalStatus.sagaStatus).toBe('COMPLETED');
    expect(finalStatus.currentStep).toBe('AUTHORIZE_PAYMENT');

    const stepNames = finalStatus.history.map((h) => h.step);
    expect(stepNames).toEqual(['RESERVE_INVENTORY', 'AUTHORIZE_PAYMENT']);

    const outcomes = finalStatus.history.map((h) => h.event);
    expect(outcomes).toEqual(['SUCCEEDED', 'SUCCEEDED']);
  });

  it('payment declined: inventory is reserved then released (compensation), order ends cancelled', async () => {
    // MockStripeAdapter always declines this specific customer id -
    // see apps/payment-service/src/infrastructure/gateways/mock-stripe.adapter.ts
    // and tools/scripts/seed-dev-data.ts, which document the same convention.
    const accessToken = await issueDevToken('cust_DECLINE');

    const { orderId } = await createOrder(accessToken, [STANDARD_ITEM]);

    const finalStatus = await waitForSagaTerminal(orderId);

    expect(finalStatus.sagaStatus).toBe('COMPENSATED');

    const stepOutcomes = finalStatus.history.map((h) => `${h.step}:${h.event}`);
    expect(stepOutcomes).toContain('RESERVE_INVENTORY:SUCCEEDED');
    expect(stepOutcomes).toContain('AUTHORIZE_PAYMENT:FAILED');
  });

  it('insufficient stock: reservation fails immediately, no payment is ever attempted, order cancelled', async () => {
    // Seeded with qtyAvailable=0 specifically to always fail reservation -
    // see tools/scripts/seed-dev-data.ts.
    const accessToken = await issueDevToken('11111111-0000-0000-0000-000000000002');

    const { orderId } = await createOrder(accessToken, [{ sku: 'SKU-DECLINE', qty: 1, unitPriceCents: 500 }]);

    const finalStatus = await waitForSagaTerminal(orderId);

    expect(finalStatus.sagaStatus).toBe('COMPENSATED');

    const stepOutcomes = finalStatus.history.map((h) => `${h.step}:${h.event}`);
    expect(stepOutcomes).toContain('RESERVE_INVENTORY:FAILED');
    // Payment must never have been attempted for an order whose stock
    // reservation never succeeded - the saga has no step 2 history at all.
    expect(stepOutcomes.some((s) => s.startsWith('AUTHORIZE_PAYMENT'))).toBe(false);
  });

  it('two orders for the same scarce SKU: the second either reserves against remaining stock or fails cleanly, never oversells', async () => {
    // Exercises StockRepository's row-level locking under real
    // concurrency, not just sequential logic - see ADR 0001's discussion
    // of why the no-oversell invariant lives in a locked counter table
    // rather than the event-sourced aggregate.
    const accessTokenA = await issueDevToken('11111111-0000-0000-0000-00000000000a');
    const accessTokenB = await issueDevToken('11111111-0000-0000-0000-00000000000b');

    const scarceItem = { sku: 'SKU-45', qty: 10, unitPriceCents: 5000 }; // seeded with qtyAvailable=15

    const [orderA, orderB] = await Promise.all([
      createOrder(accessTokenA, [scarceItem]),
      createOrder(accessTokenB, [scarceItem]),
    ]);

    const [statusA, statusB] = await Promise.all([
      waitForSagaTerminal(orderA.orderId),
      waitForSagaTerminal(orderB.orderId),
    ]);

    // 10 + 10 = 20 requested against 15 available - AT MOST one of these
    // two orders can have successfully reserved inventory. Both
    // succeeding would mean the no-oversell invariant was violated.
    const reservedCount = [statusA, statusB].filter((s) =>
      s.history.some((h) => h.step === 'RESERVE_INVENTORY' && h.event === 'SUCCEEDED'),
    ).length;

    expect(reservedCount).toBeLessThanOrEqual(1);
  });
});
