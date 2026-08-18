<div align="center">

# ⚡ Saganova

### Event-Driven E-Commerce Transaction Engine

**Distributed Saga orchestration for payment processing & inventory reservation, built on event sourcing.**

[![NestJS](https://img.shields.io/badge/NestJS-E0234E?style=flat&logo=nestjs&logoColor=white)](https://nestjs.com/)
[![Kafka](https://img.shields.io/badge/Apache_Kafka-231F20?style=flat&logo=apachekafka&logoColor=white)](https://kafka.apache.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1?style=flat&logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Docker](https://img.shields.io/badge/Docker-2496ED?style=flat&logo=docker&logoColor=white)](https://www.docker.com/)
[![Kubernetes](https://img.shields.io/badge/Kubernetes-326CE5?style=flat&logo=kubernetes&logoColor=white)](https://kubernetes.io/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)

[Architecture](#-architecture) · [Quickstart](#-quickstart) · [Saga Flow](#-the-saga-in-motion) · [Structure](./structure.md) · [ADRs](./docs/adr)

</div>

---

## Why this exists

Checkout is the hardest transaction in e-commerce: it touches money, stock, and customer trust, spread across services that don't share a database and can't share an ACID transaction. Naive REST-to-REST calls fail silently, oversell inventory, or double-charge cards the moment one service is slow or down.

**Saganova solves this properly** — not with 2-phase commit, not with distributed locks, but with the pattern real payment platforms use: **event sourcing + the Saga pattern**, where every state change is an immutable fact, every multi-step transaction is explicitly compensable, and every failure has a defined undo path.

This repo is a complete, runnable reference implementation — not a toy diagram. Clone it, run one command, and watch an order get created, stock reserved, a payment authorized, and a full compensating rollback fire when a payment is declined — all traceable end-to-end in Jaeger.

---

## What it demonstrates

| Concept | Where |
|---|---|
| **Event Sourcing** — append-only event store per aggregate, no mutable "current state" row | `order-service`, `payment-service`, `inventory-service` |
| **Saga Orchestration** — central FSM coordinating a multi-service transaction | `saga-orchestrator` |
| **Compensating Transactions** — explicit undo logic, not rollback-by-magic | `libs/saga-toolkit`, `*.compensator.ts` |
| **Transactional Outbox** — no dual-write problem between Postgres and Kafka | `infrastructure/outbox/*` in every service |
| **CQRS** — commands mutate aggregates, queries read denormalized projections | `application/commands`, `application/queries` |
| **Database-per-Service** — zero cross-service SQL joins, ever | one Postgres schema per service |
| **Schema-Governed Events** — Avro contracts + Schema Registry prevent silent breakage | `libs/event-contracts` |
| **Idempotent Consumers** — safe under Kafka's at-least-once delivery | every `*-consumer.controller.ts` |
| **Distributed Tracing** — one `correlationId` follows a checkout across 6 services | `libs/observability`, OpenTelemetry → Jaeger |
| **Full Observability** — structured logs, Prometheus metrics, health probes | `libs/observability`, `/health` per service |

---

## 🏗 Architecture

```
Client
  │  POST /orders
  ▼
API Gateway  ──────────────► Kafka: saga.commands
                                    │
                       ┌────────────┴────────────┐
                       ▼                          ▼
              Order Service                Saga Orchestrator ◄──── owns the FSM
           (event store + outbox)          (order-fulfillment.saga)
                       │                          │
                       │        Kafka: order.events / payment.events / inventory.events
                       │                          │
        ┌──────────────┼──────────┬───────────────┼───────────────┐
        ▼              ▼          ▼               ▼               ▼
  Inventory Svc   Payment Svc  Notification Svc            Audit/Ledger Svc
  (reserve stock) (authorize $) (email / sms)               (immutable log,
                                                               consumes all topics)
```

Every service owns its own PostgreSQL schema. Nothing is queried cross-service — state travels only as events on Kafka. Full breakdown of every folder and file: **[`structure.md`](./structure.md)**.

---

## 🔁 The saga in motion

**Happy path:**

```
OrderCreated → ReserveStock → InventoryReserved → AuthorizePayment → PaymentAuthorized → ConfirmOrder ✅
```

**Failure path (payment declined after stock was already reserved):**

```
OrderCreated → ReserveStock → InventoryReserved → AuthorizePayment → PaymentDeclined
                                                                          │
                                                          ┌───────────────┘
                                                          ▼
                                              ReleaseInventory (compensation)
                                                          │
                                                          ▼
                                                    CancelOrder ❌
```

No service ever assumes the transaction succeeded just because its own step did. The orchestrator is the single source of truth for "where is this checkout right now," persisted in `saga_instance` so a crashed orchestrator resumes exactly where it left off.

---

## 🧰 Tech Stack

- **Runtime:** NestJS (TypeScript), Node.js 20
- **Messaging:** Apache Kafka + Confluent Schema Registry (Avro)
- **Storage:** PostgreSQL 16 (one schema per service), TypeORM
- **Orchestration:** Custom Saga FSM (swappable for XState)
- **Infra:** Docker Compose (local), Kubernetes + Kustomize (staging/prod), Terraform (AWS: EKS/RDS/MSK)
- **Observability:** OpenTelemetry, Jaeger, Prometheus, Pino
- **Testing:** Jest (unit), Pact (consumer-driven contracts), k6 (load), Testcontainers (e2e)

---

## 🚀 Quickstart

```bash
git clone https://github.com/morka17/KafkaLedgerSaga.git
cd KafkaLedgerSaga
npm install

# Spin up Kafka, Postgres, Schema Registry, Jaeger, and all six services
docker compose up -d

# Run migrations for every service
npm run migrate:all

# Fire a test checkout through the full saga
curl -X POST http://localhost:3000/orders \
  -H "Content-Type: application/json" \
  -d '{"customerId": "cust_123", "items": [{"sku": "SKU-42", "qty": 2}]}'
```

Watch it happen live:
- **Kafka UI** → `http://localhost:8080` — every event as it's published
- **Jaeger** → `http://localhost:16686` — the full distributed trace for that one order
- **Saga state** → `GET http://localhost:3000/sagas/{orderId}` — current step, history, compensation status

Force the failure path to see compensation fire:

```bash
curl -X POST http://localhost:3000/orders \
  -H "Content-Type: application/json" \
  -d '{"customerId": "cust_DECLINE", "items": [{"sku": "SKU-42", "qty": 2}]}'
```

---

## 📁 Project Structure

The full production-standard folder tree — every app, every shared lib, every infra file, and what talks to what — is documented in **[`structure.md`](./structure.md)**.

```
apps/        → api-gateway, order-service, payment-service, inventory-service,
                saga-orchestrator, notification-service, audit-ledger-service
libs/        → event-contracts, kafka-client, event-sourcing-core,
                saga-toolkit, common, database, observability
infra/       → docker, kafka-topics, k8s (base + overlays), terraform
docs/        → ADRs, saga specs, sequence diagrams
test/        → contract, e2e, load
```

---

## 🧪 Testing

```bash
npm run test              # unit tests, per service, via Nx affected graph
npm run test:contract     # Pact contract tests against event-contracts
npm run test:e2e          # full docker-compose stack + real Kafka saga run
npm run test:load         # k6 checkout load test
```

CI (`.github/workflows/ci.yml`) runs lint → unit → contract tests scoped to only the services affected by a change, then builds and pushes per-service Docker images on merge to `main`.

---

## 📐 Design Decisions

Every non-obvious architectural choice is written down, not just implemented:

- [`0001-event-sourcing-per-aggregate.md`](./docs/adr/0001-event-sourcing-per-aggregate.md)
- [`0002-orchestration-vs-choreography-saga.md`](./docs/adr/0002-orchestration-vs-choreography-saga.md)
- [`0003-transactional-outbox-pattern.md`](./docs/adr/0003-transactional-outbox-pattern.md)

---

## 🗺 Roadmap

- [ ] Idempotency key deduplication table with TTL cleanup job
- [ ] Saga timeout handling (auto-compensate stuck instances)
- [ ] GraphQL subscriptions on the gateway for live order-status updates
- [ ] Chaos testing suite (kill services mid-saga, assert eventual consistency)

---

## 🤝 Contributing

PRs welcome. Please open an issue first for anything beyond a small fix, and keep new domain events registered in `libs/event-contracts` with an Avro schema — the CI pipeline will reject any event published without one.

## 📄 License

MIT — see [`LICENSE`](./LICENSE).

---

<div align="center">
<sub>Built to show how real payment infrastructure actually stays consistent when everything is distributed and nothing can be trusted to succeed on the first try.</sub>
</div>
