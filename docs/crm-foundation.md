# Link Store dashboard foundation

The new `/dashboard` shares the existing Video Shop backend and admin token. Video Shop and protection tools open inside the dashboard; their original URLs and storefront APIs still work. There is no build step or production package dependency.

## What works in this version

- Arabic RTL responsive dashboard, catalog/video counts and existing management tools.
- Read-only orders, customers and abandoned-cart lists with search and 25-row pagination, plus exact record counts in the overview. Queries use the merchant's supplied schema and always scope by server-configured merchant ID. They never select raw source payloads. Customer spending is not displayed because the current schema has no currency column for that total.
- Authenticated connection metadata, recent event list, automation rule creation/settings and simulation log.
- `/api/salla-webhook`: Token verification, strict merchant allowlist, 512 KiB payload cap, stable deduplication, secret redaction and durable inbox storage before acknowledgment.
- `app.store.authorize` stores credentials encrypted with AES-256-GCM and the documented absolute `data.expires` Unix timestamp. `app.uninstalled` clears credentials. Older delayed lifecycle events cannot override a newer connection state.
- Datetimes without an offset are interpreted as Saudi local time (+03:00); timestamps with an offset retain it. Confirm this assumption against the first real payload. Dashboard dates display in Asia/Riyadh.
- `/api/crm-worker`: atomic inbox processing and matching enabled rules into dry-run records. A separate worker token keeps n8n independent of the dashboard admin session.
- All four new tables have RLS, with direct browser/anon access revoked. RPCs are security invoker and callable only by service_role.

Rules have **only dry_run mode** at the database level. `scheduled_for` records the proposed time; it does not schedule or send a message. Processing an event evaluates the rules as configured at processing time. Events with disabled or nonmatching rules are marked processed with no runs. No messaging, ad accounts, order writes, historical sync, credential refresh, customer segmentation, or campaign attribution are implemented yet.

## Setup in the existing Link Store CRM database

1. Run `crm-foundation.sql` in the **Link Store CRM** Supabase SQL Editor. It is transactional and repeatable; it does not alter or seed the existing store, product, customer, order or Video Shop tables. It adds only `crm_connections`, `crm_event_inbox`, `crm_automation_rules`, `crm_automation_runs`, two RPCs and disabled starter rules.
2. Existing orders, customers and cart columns were verified from the supplied SQL export on 2026-10-06; see `docs/existing-schema.json`. The dashboard now reads those existing tables without a migration. Empty tables show empty states; the app does not seed sample records or imply that Salla sync is complete. The export describes columns only, not foreign keys, uniqueness, indexes or RLS policies; those still need inspection before implementing writes and relationships.
3. Configure server variables from `.env.example`. Existing Supabase variables and `VIDEO_SHOP_ADMIN_TOKEN` are reused. Generate **separate** random webhook/worker secrets and an encryption key. Generate each locally with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`. Never commit `.env` or copy secrets into frontend code. The encryption key must be backed up along with the database.
4. Open `/dashboard` and sign in with the current admin token. Counts are live, not screenshot numbers. Unavailable queries show an explicit warning and a dash.

## VPS runtime (existing n8n can stay as it is)

Use the repository on the VPS, supply `.env`, then run:

```sh
docker compose -f compose.crm.yml up -d --build
```

The service binds only `127.0.0.1:3100`. Route a chosen HTTPS dashboard subdomain through your existing reverse proxy to that address. Do not expose port 3100 publicly. The image contains no environment secrets and runs as an unprivileged user. Alternatively export environment variables and run `npm start`. For local development, `npm run dev` reads `.env` (Node 22 recommended).

`vercel.json` also adds `/dashboard` routing if using the existing deployment. A repository change is not a production rollout; merge/deploy only after the SQL and server variables are prepared. VPS is the recommended home for the expanded commercial dashboard.

## Connect Salla only after the app is activated

Current app is in Easy Mode and Token security strategy. Official docs: [webhooks](https://docs.salla.dev/421119m0) and [app events](https://docs.salla.dev/partner-apis/app-events).

Two supported deployment arrangements:

- Point Salla to `https://YOUR-DASHBOARD/api/salla-webhook`, preserving Token strategy. `SALLA_WEBHOOK_SECRET` must exactly match the Authorization value Salla sends. This endpoint intentionally does not support Signature strategy; do not switch to Signature without adding raw-body verification.
- Keep `https://n8n.picelmedia.online/webhook/salla-app-events`. Have n8n forward the original event body to the dashboard with the exact Authorization secret. The ingress workflow must respond successfully to Salla **only after** the dashboard returns success, so failed storage remains retryable. Do not use the present respond-immediately setup for the final authorization flow. Restrict execution-data retention for authorization events because they contain raw credentials before forwarding.

Do not point a live webhook here until the SQL, shared secret and encryption key are configured. Wrong/missing credentials, wrong merchants and malformed events are rejected. Storage errors return a non-success response; Salla can retry. Identical events (canonical full payload including event timestamp) share a hash key and one inbox row. Metadata exposed by the admin endpoint never contains credentials or customer payloads. Full redacted event payloads remain service-only and should later receive a documented retention policy.

## n8n worker contract

Call at a suitable interval (e.g. once per minute) from an HTTP Request node:

```text
POST https://YOUR-DASHBOARD/api/crm-worker
Authorization: Bearer <CRM_WORKER_TOKEN>
```

It processes at most 20 pending events atomically with `FOR UPDATE SKIP LOCKED`. Repeated worker calls do not duplicate simulation runs. No customer message leaves the system. The dashboard's "اختبار الأحداث المعلقة" button calls the same dry-run database function through an authenticated admin endpoint for manual checks.

## Next implementation order

1. Inspect existing constraints/policies and establish individual Supabase Auth staff accounts + store membership authorization (the existing shared token is a temporary foundation).
2. Enable the actual app, verify authorization delivery, implement refresh-token locking and credentials decryption only in server code, then reconcile the initial catalog/orders/customers/carts within the 10,000/month API budget.
3. Implement event-to-entity upserts and sales metrics with explicit date, cancellation, refund and currency semantics.
4. Add WhatsApp provider, approved templates, consent/opt-out, human handover, cancellation of obsolete reminders, durable due-job claims/retries and outbound idempotency. Only then allow live rules.
5. Implement separate authorized Meta, TikTok and Snapchat adapters; never mark a platform connected based only on a dashboard toggle.

## Validation

`npm ci && npm test` runs handler security/deduplication/error checks and executes the actual SQL against an ephemeral embedded Postgres engine. The SQL tests verify repeatable setup, RLS/privileges, auth/uninstall ordering, transaction rollback and dry-run idempotency. These checks do not connect to or modify production Supabase. End-to-end live Salla delivery remains pending activation and deployment.
