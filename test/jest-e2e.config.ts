import type { Config } from 'jest';

/**
 * Full-stack e2e tests assume the entire system is ALREADY running -
 * they never spin up docker-compose themselves. That orchestration
 * belongs to the caller: locally that's `tools/scripts/bootstrap.sh`
 * (or `npm run dev` after `npm run up`), in CI it's the explicit
 * sequence of steps in .github/workflows/ci.yml's `e2e` job (compose up
 * -> wait for infra -> provision topics -> migrate -> seed -> build ->
 * THEN run this suite). Baking stack startup into the test config itself
 * would mean every test run pays the ~30s cold-start cost even when
 * iterating on a single assertion against an already-warm stack.
 */
const config: Config = {
  displayName: 'e2e',
  rootDir: '.',
  testMatch: ['<rootDir>/e2e/**/*.e2e-spec.ts'],
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.json' }],
  },
  testEnvironment: 'node',
  setupFiles: ['reflect-metadata'],
  moduleNameMapper: {
    '^@saganova/event-contracts$': '<rootDir>/../libs/event-contracts/src/index.ts',
  },
  // Saga completion isn't instantaneous - each step round-trips through
  // Kafka, the outbox relay's poll interval (500ms), and (for payment)
  // a real or mocked Stripe call. 30s per test gives comfortable margin
  // without letting a genuinely stuck saga hang CI indefinitely.
  testTimeout: 30_000,
  maxWorkers: 1, // e2e specs share the same running stack - avoid two suites racing to create/poll the same kind of resources
};

export default config;
