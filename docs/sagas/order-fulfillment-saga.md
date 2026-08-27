# Order Fulfillment Saga

**Definition file:** `apps/saga-orchestrator/src/orchestrator/order-fulfillment.saga-definition.ts`
**Owning service:** `apps/saga-orchestrator`
**Coordination style:** Orchestration (see [ADR 0002](../adr/0002-orchestration-vs-choreography-saga.md))

## Trigger

The saga starts when `saga-orchestrator`'s `SagaEventConsumer` observes an
`OrderCreated` event (`order.events` topic). `SagaStateMachine.start()` builds the
initial `OrderFulfillmentContext` and creates a new `saga_instance` row keyed by
`orderId`.

```typescript
interface OrderFulfillmentContext {
  orderId: string;
  customerId: string;
  lines: { sku: string; qty: number }[];
  amountCents: number;
  reservationId?: string; // populated once step 1 succeeds
  paymentId?: string;     // populated once step 2 succeeds
}
```

## Step Table

| # | Step name | Command published | Owning service | Success event | Failure event | Compensation command |
|---|---|---|---|---|---|---|
| 1 | `RESERVE_INVENTORY` | `RESERVE_STOCK_COMMAND` (`inventory.reserve_stock.v1`) | inventory-service | `InventoryReserved` (`inventory.reserved.v1`) | `InventoryReservationFailed` (`inventory.reservation_failed.v1`) | *(none - see below)* |
| 2 | `AUTHORIZE_PAYMENT` | `AUTHORIZE_PAYMENT_COMMAND` (`payment.authorize.v1`) | payment-service | `PaymentAuthorized` (`payment.authorized.v1`) | `PaymentDeclined` (`payment.declined.v1`) | `RELEASE_INVENTORY_COMMAND` (`inventory.release.v1`) |

All commands publish to the shared `saga.commands` topic, keyed by `orderId` (see
`infra/kafka-topics/topics.yaml`). All step-outcome events are consumed by
`SagaEventConsumer` across `inventory.events` and `payment.events`.

## Why step 1 has no compensation command

If `RESERVE_INVENTORY` itself fails, nothing was ever reserved - there is nothing to
undo for that step specifically. `CompensationRegistry.beginCompensation()` (in
`libs/saga-toolkit`) walks backward only through steps *before* the one that failed,
so a step-1 failure compensates zero steps and the saga moves directly to `COMPENSATED`.

## Terminal Transitions

Neither `COMPLETED` nor `COMPENSATED` is itself a saga *step* - both are handled by
`SagaStateMachine` after `CompensationRegistry.onEvent()` returns, since the generic
toolkit has no opinion on what "a completed checkout" means for this specific business
process:

| Saga status | Triggered by | Orchestrator action |
|---|---|---|
| `COMPLETED` | Step 2 (`AUTHORIZE_PAYMENT`) succeeds | Publishes `CONFIRM_ORDER_COMMAND` to order-service with `{ orderId, paymentId }` |
| `COMPENSATED` | Step 1 fails (nothing to compensate), **or** step 2 fails and the step-1 compensation command has been published | Publishes `CANCEL_ORDER_COMMAND` to order-service with `{ orderId, reason }` |

See `SagaStateMachine.onSagaCompleted` / `onSagaCompensated`.

## Happy Path

```
OrderCreated
  → ReserveStock          (saga-orchestrator → inventory-service)
  → InventoryReserved     (inventory-service → saga-orchestrator)
  → AuthorizePayment      (saga-orchestrator → payment-service)
  → PaymentAuthorized     (payment-service → saga-orchestrator)
  → ConfirmOrder          (saga-orchestrator → order-service)
  → OrderConfirmed        (order-service → notification-service, audit-ledger-service)
```

See [`../sequence-diagrams/happy-path-checkout.puml`](../sequence-diagrams/happy-path-checkout.puml)
for the full message-level diagram, including the parallel `audit-ledger-service`
wildcard consumption that happens on every step regardless of outcome.

## Failure Path: Inventory Reservation Fails

```
OrderCreated
  → ReserveStock                    (saga-orchestrator → inventory-service)
  → InventoryReservationFailed      (inventory-service → saga-orchestrator)
  → [no compensation - nothing was reserved]
  → CancelOrder                     (saga-orchestrator → order-service)
  → OrderCancelled                  (order-service → notification-service, audit-ledger-service)
```

## Failure Path: Payment Declined (after inventory was reserved)

```
OrderCreated
  → ReserveStock            (saga-orchestrator → inventory-service)
  → InventoryReserved       (inventory-service → saga-orchestrator)
  → AuthorizePayment        (saga-orchestrator → payment-service)
  → PaymentDeclined         (payment-service → saga-orchestrator)
  → ReleaseInventory        (saga-orchestrator → inventory-service)   [compensation]
  → CancelOrder             (saga-orchestrator → order-service)
  → OrderCancelled          (order-service → notification-service, audit-ledger-service)
```

Note that `ReleaseInventory` is fired immediately upon seeing `PaymentDeclined` -
`CompensationRegistry` does not wait for `InventoryReleased` to come back before
transitioning to `COMPENSATED` and publishing `CancelOrder`. This is a deliberate
simplification: with exactly one compensable step in the current graph, there is no
"partial compensation" state to wait out. See `docs/adr/0002` for context on what
would need to change if a third step were added.

## Idempotency Notes

- `SagaStateMachine.start()` checks for an existing `saga_instance` row before creating
  one - a redelivered `OrderCreated` is a no-op.
- `SagaStateMachine.onEvent()` checks whether the saga is already `COMPLETED` or
  `COMPENSATED` before processing further events, so a redelivered step-outcome event
  after the saga has already terminated cannot re-publish `ConfirmOrder`/`CancelOrder`
  a second time.
- Every command handler on the receiving end (`ReserveStockHandler`,
  `AuthorizePaymentHandler`, `ReleaseInventoryHandler`, `ConfirmOrderHandler`,
  `CancelOrderHandler`) has its own independent idempotency guard - the saga
  orchestrator's guards and each service's guards are defense-in-depth, not a
  substitute for one another.

## Testable Locally

`tools/scripts/seed-dev-data.ts` seeds a `cust_DECLINE` customer id that
`MockStripeAdapter` always declines, and a `SKU-DECLINE` line item with zero available
stock, so both failure paths above are exercisable end-to-end without real Stripe
credentials - see the root `README.md`'s Quickstart section.
