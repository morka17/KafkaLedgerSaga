/**
 * Explicit list of every service that owns Postgres migrations, in the
 * order they should run. Order rarely matters for genuinely independent
 * schemas, but keeping it explicit (rather than `fs.readdirSync('apps')`)
 * means adding a new stateful service is a deliberate one-line change,
 * not something that silently starts running migrations because a folder
 * happened to exist.
 */
export interface MigratableService {
  appDir: string;
  schema: string;
}

export const MIGRATABLE_SERVICES: MigratableService[] = [
  { appDir: 'order-service', schema: 'order_service' },
  { appDir: 'inventory-service', schema: 'inventory_service' },
  { appDir: 'payment-service', schema: 'payment_service' },
  { appDir: 'saga-orchestrator', schema: 'saga_orchestrator' },
  { appDir: 'audit-ledger-service', schema: 'audit_ledger' },
];
