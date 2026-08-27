import type { Config } from 'jest';

/**
 * Contract tests validate that hand-built sample payloads for every
 * event/command in @saganova/event-contracts satisfy that contract's own
 * class-validator decorators. They run on every CI push regardless of
 * which service changed (see .github/workflows/ci.yml's contract-tests
 * job) because a breaking change to a shared contract isn't something
 * Nx's affected-graph reliably catches - Nx tracks code imports, not
 * "which services deserialize this Kafka topic at runtime."
 *
 * These do NOT require Kafka, Postgres, or any running service - they
 * are pure, fast, in-process assertions against the contract classes
 * themselves.
 */
const config: Config = {
  displayName: 'contract',
  rootDir: '.',
  testMatch: ['<rootDir>/contract/**/*.spec.ts'],
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.json' }],
  },
  testEnvironment: 'node',
  setupFiles: ['reflect-metadata'],
  moduleNameMapper: {
    '^@saganova/event-contracts$': '<rootDir>/../libs/event-contracts/src/index.ts',
    '^@saganova/kafka-client$': '<rootDir>/../libs/kafka-client/src/index.ts',
  },
  testTimeout: 10_000,
};

export default config;
