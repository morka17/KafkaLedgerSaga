-- One schema per service (Database-per-Service pattern) inside a single
-- local Postgres instance. In staging/prod each service gets its own RDS
-- instance instead (see infra/terraform).
CREATE SCHEMA IF NOT EXISTS order_service;
CREATE SCHEMA IF NOT EXISTS payment_service;
CREATE SCHEMA IF NOT EXISTS inventory_service;
CREATE SCHEMA IF NOT EXISTS saga_orchestrator;
CREATE SCHEMA IF NOT EXISTS audit_ledger;
