# `tools/`

Dev/CI tooling — never deployed, never imported by a service at runtime.

```
tools/
├── scripts/              # Local environment orchestration (bash)
│   ├── bootstrap.sh       # One-command setup: install → docker up → wait → topics → migrate → seed
│   ├── wait-for-postgres.sh
│   ├── wait-for-kafka.sh
│   ├── create-kafka-topics.sh
│   ├── seed-dev-data.ts
│   └── clean.sh
├── migration-runner/      # Cross-service Postgres migration orchestration
│   ├── service-registry.ts   # Explicit, ordered list of every schema-owning service
│   ├── run-all-migrations.ts
│   └── migration-status.ts
└── codegen/               # Scaffolders that keep new code on-convention
    ├── generate-event.ts      # New event contract -> libs/event-contracts
    ├── generate-saga-step.ts  # New SagaStep -> apps/saga-orchestrator
    └── templates/
```

## Quickstart

```bash
npm run --workspace=@saganova/tools bootstrap   # fresh machine -> running stack
npm run --workspace=@saganova/tools migrate:status
npm run --workspace=@saganova/tools gen:event -- --domain=shipping --name=ShipmentDispatched --aggregate=shipmentId
npm run --workspace=@saganova/tools gen:saga-step -- --name=ChargeLoyaltyPoints --command=CHARGE_LOYALTY_POINTS_COMMAND --success=loyalty.points_charged.v1 --failure=loyalty.charge_failed.v1
```

## Design notes

- **`service-registry.ts` is explicit, not `fs.readdirSync`.** Adding a new stateful service to migrations is a deliberate one-line PR, not something that silently starts happening because a folder exists under `apps/`.
- **`run-all-migrations.ts` runs sequentially, not in parallel.** Keeps failures attributable to one service and avoids N services competing for Postgres connections in constrained CI runners.
- **Codegen appends, never overwrites.** Running `gen:event` twice against the same domain (e.g. two events in `shipping.events.ts`) adds to the file; it doesn't clobber a teammate's in-progress edit.
- **Codegen never auto-wires a saga step into the step graph.** Step *order* is a business decision — the generator removes boilerplate, not judgment.
