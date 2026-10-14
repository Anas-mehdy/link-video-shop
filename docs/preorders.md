# Preorder batches — stage 1

Adds `/dashboard#preorders` to the existing Link dashboard. The feature tracks a dedicated Salla preorder product (optionally an exact SKU), confirmed incoming capacity, paid reservations, schedule changes and FIFO allocation after inspected receipt.

## Activation

Run [preorder-preflight.sql](./preorder-preflight.sql) first and review its live metadata report before installing the migration. It runs in a read-only transaction and reads no customer/order rows, function bodies or trigger arguments. Inspect current order writers and delete/retention flows: the invoker trigger can block a writer without access to preorder tables, and default foreign keys can prevent deleting enrolled orders. Passing local tests is not a guarantee of compatibility with the live project's policies and triggers.

1. Run `crm-preorders.sql` **in the existing Link Store CRM Supabase project**, after `crm-salla-sync.sql`. Do not run it in Massar/phone repair ERP. It creates five private RLS-enabled tables, service-only RPCs and one order-update queue trigger. It is transactional and repeatable. No batches, customer records, storefront stock or sample data are seeded.
2. Deploy this branch's backend and static dashboard assets using the existing runtime. All routes reuse `/api/crm-admin` and `/api/crm-worker`; no additional Vercel Function or dependency is required. Without the migration, the dashboard displays setup pending and existing order ingress continues working.
3. Create the separate preorder product and native campaign in Salla. For the burgundy frame, use its **new preorder product ID**, not the existing mixed ready-stock frame product ID `981596666`. Set the sellable reservation limit, dates and customer-facing disclosure in Salla, and verify checkout. The dashboard does not create/update a Salla campaign, inventory, shipping fees or checkout consent.
4. Create a draft batch with confirmed quantities and dates. Enter expected warehouse arrival separately from the customer's shipping window. If tracking a variant, enter Salla's SKU ID, not the color option-value ID. Leave it empty for a dedicated single-color product.
5. Set the batch to open immediately before opening the Salla campaign. Only orders with `ordered_at >= opened_at` can enroll. Draft/paused/closed batches do not enroll new reservations. Existing enrolled orders still update.
6. Confirm the app subscribes to `order.created`, `order.updated`, `order.status.updated`, `order.payment.updated`, `order.products.updated`, `order.cancelled` and `order.refunded`. The app's existing normal projection stores trusted order snapshots first. PostgreSQL queues relevant changes atomically with that write. Webhook handling attempts a bounded reconcile after ingress; failed reconciliation remains queued.
7. Configure the existing n8n worker to retry the queue on a regular interval using either its current `action=salla` call (now also reconciles preorders), or:

```text
POST https://YOUR-DASHBOARD/api/crm-worker?action=preorders
Authorization: Bearer <existing CRM_WORKER_TOKEN>
```

The dashboard's “تحديث الحجوزات” processes one 20-order batch. It does not call Salla or send messages. Already enrolled orders older than the existing 30-day dashboard window are still projected, so 30–45 day reservations do not lose cancellation/shipping updates. Normal archive scope remains unchanged.

## Operations

- Pending payment never confirms or allocates stock. Only explicit `paid` / `completed` payment statuses qualify. Priority is the timestamp of the first observed paid source snapshot, not inferred original order creation. Validate the actual payment payload at activation.
- Orders must have item IDs and full item arrays. Missing/ambiguous identifiers stay in the durable error queue; no fabricated lines are confirmed. Changes to item identity, quantity, partial payments/refunds and unexpected shipping states enter review.
- Every reservation preserves the batch shipping window at its first observation. `promise_evidence=batch_at_first_observation` is **not** proof of customer acceptance or checkout text. Actual checkout disclosure/consent capture belongs to the storefront integration, still pending.
- Schedule edits retain original windows and create review-only customer-update records. Internal schedule updates do not update Salla's campaign date. Both need to stay aligned.
- A merchant-scoped advisory transaction lock serializes reservation capacity checks, receipt and FIFO allocation. Over-capacity paid orders enter review instead of getting an automatic confirmation. The dashboard cannot prevent overselling at Salla checkout; the native product's quantity is the source of selling capacity.
- “اعتماد الاستلام” requires an explicit inspection checkbox and a **cumulative** count of verified good pieces. Repeated same count is a no-op; later partial delivery uses a larger total. It cannot exceed the confirmed incoming count or decrease previously approved quantity. Pending order-sync failures block receipt.
- Allocation fulfills the earliest confirmed paid reservation in full. If too few pieces remain for that reservation, later reservations are not allowed to jump the queue. Paid capacity-review orders are never allocated automatically.
- Cancellation before shipping releases allocated units to the next confirmed reservation. A refund/cancellation after shipment does **not** release stock; physical return must be checked. Review states remain blocked rather than silently resetting after a replay.
- Mixed orders are identified in the dashboard. Their shipping policy must be disclosed/configured in Salla; this module does not split orders or collect a second shipping fee.
- Shipment/delivery states follow Salla order status only after the reservation has been allocated. Staff still update Salla and generate shipping labels normally. The module does not automatically change order status or mark an entire mixed order delivered.
- Confirmation, changed-schedule and ready notices are persisted with unique reservation/kind/revision keys. They have only `review` / `dismissed` status: **no outbound sender is implemented or activated**. Cancellation and review dismiss obsolete notices.
- No automatic refunds are performed. Refund reviews, shortages, changed lines, unknown payment status and missing snapshots require staff handling in Salla, followed by reconciliation.
- The existing postpurchase message sender is unchanged. It already relies on an observed delivered transition; verify mixed-order policy before native status changes.

## Access and validation

All admin operations use the existing merchant-member authentication and mutation Origin protections. Worker calls require the independent worker secret. Merchant ID is supplied by server configuration, never by browser input. Tables/RPCs are revoked from PUBLIC, anon and authenticated; only server service_role has access. No raw order payloads or provider keys are returned by preorder endpoints.

`node --test tests/preorders.test.js` executes the actual SQL in ephemeral PostgreSQL against the existing merchant schema and projection. It covers payment transitions, duplicate snapshots, stale events, merchant isolation, immutable original dates, oversubscription review, FIFO shortages, repeated/partial receipts, cancellation and return inventory, draft inactivity, durable malformed-snapshot errors, RLS and execution privileges. `npm test` also checks existing features. No production database or customer messages are used.

Before launch: inspect the five new tables and RPC privileges in the target database, run Supabase security advisors, test one real Salla order snapshot and payment transition, and verify the storefront's date/consent/quantity behavior. This is the internal management phase, not a completed public preorder rollout.
