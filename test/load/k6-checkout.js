import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend, Rate } from 'k6/metrics';

/**
 * Load-tests the one endpoint that matters most for checkout throughput:
 * POST /orders. This intentionally does NOT wait for the saga to reach a
 * terminal state per request - that would measure end-to-end saga
 * latency (dominated by the outbox relay's ~500ms poll interval three
 * times over, plus a Stripe round-trip), not gateway/Kafka-ingest
 * throughput, which is the thing worth load-testing under concurrency.
 * Run test/load/k6-saga-latency.js (not included here) if p99 saga
 * completion time is what you're measuring instead.
 *
 * Usage:
 *   k6 run test/load/k6-checkout.js
 *   k6 run -e API_GATEWAY_URL=https://staging.saganova.example test/load/k6-checkout.js
 */

const API_GATEWAY_URL = __ENV.API_GATEWAY_URL || 'http://localhost:3000';

const orderLatency = new Trend('order_creation_duration_ms', true);
const acceptedRate = new Rate('order_accepted_rate');

export const options = {
  scenarios: {
    steady_load: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: 20 }, // ramp up
        { duration: '2m', target: 20 }, // hold
        { duration: '30s', target: 0 }, // ramp down
      ],
    },
  },
  thresholds: {
    // p95 under 500ms for what should be "validate + publish one Kafka
    // message" - the gateway does no synchronous work beyond that.
    order_creation_duration_ms: ['p(95)<500'],
    order_accepted_rate: ['rate>0.99'], // fewer than 1% of requests should fail to be accepted
    http_req_failed: ['rate<0.01'],
  },
};

// One dev token issued once per VU (in setup, not per-iteration) - this
// load test measures order-creation throughput, not JWT-issuance
// throughput, which is a different (and uninteresting) bottleneck to
// mix into the same numbers.
export function setup() {
  const customerId = '99999999-0000-0000-0000-000000000000';
  const res = http.post(
    `${API_GATEWAY_URL}/api/v1/auth/dev-token`,
    JSON.stringify({ customerId, email: 'load-test@saganova.example' }),
    { headers: { 'Content-Type': 'application/json' } },
  );
  check(res, { 'dev token issued': (r) => r.status === 200 });
  return { accessToken: res.json('accessToken') };
}

export default function (data) {
  const payload = JSON.stringify({
    items: [{ sku: 'SKU-42', qty: 1, unitPriceCents: 1999 }],
  });

  const res = http.post(`${API_GATEWAY_URL}/api/v1/orders`, payload, {
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${data.accessToken}`,
    },
  });

  orderLatency.add(res.timings.duration);
  const accepted = res.status === 202;
  acceptedRate.add(accepted);

  check(res, {
    'status is 202 Accepted': () => accepted,
    'response has an orderId': (r) => !!r.json('orderId'),
  });

  sleep(1);
}
