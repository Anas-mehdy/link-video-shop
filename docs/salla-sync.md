# Salla records sync

Run `crm-salla-sync.sql` in the merchant Supabase project before starting sync.
The migration uses the schema supplied on 2026-10-07. It adds source timestamps
and a separate projection timestamp on the durable inbox. It does not repoint
the existing `last_event_id` foreign keys to the new inbox.

The authenticated dashboard Integrations page has a **مزامنة بيانات المتجر**
button. It fetches customers, orders, then carts in sequential pages of 30,
using the encrypted server-side Salla access token. Keep the page open. A failed
or interrupted run can be restarted from page 1 without duplicate records.
Provider next URLs are never fetched: only fixed Salla endpoints and numeric
page increments are accepted. For very large histories use date windows in a
future import job; Salla recommends completing orders pagination within 15 min.

New customer/cart/order events project after durable ingestion. Orders fetch
current details, including status-only events. Projection failures still return
`ok: true, records_pending: true` because the event is durably saved, and can be
retried via the dashboard sync or a server worker:

`POST /api/crm-worker?action=salla`, with the existing server-only
`Authorization: Bearer CRM_WORKER_TOKEN`. Schedule this retry worker in n8n
to recover transient failures without opening the dashboard. Do not put this
credential in browser code. The original worker action remains simulation only.

RPC writes are merchant-scoped, private to service_role, serialized per resource,
and atomic per page/event. UUIDs and local contact fields are preserved. Older
source timestamps cannot replace newer rows, and recovered carts cannot revert
to active. Missing fields do not zero previously known amounts. Source payloads
are recursively redacted. API JSON preserves integer identifiers beyond JS
safe integer range; unsafe identifiers already parsed upstream are rejected.

Customer order counts and spend are recomputed at the end of manual sync from
imported orders; cancelled/refunded orders contribute no spend. This describes
the imported database, not a guarantee of the entire store history. Later order
events refresh affected customers' aggregates in the same database transaction.

This release uses the existing access token and explicitly stops on expiry or
provider rejection. Automatic token refresh is not implemented in this release.
Salla refresh tokens are single-use; a later refresh implementation must use a
database lock and persist rotated credentials before allowing another refresh.
No Salla writes or WhatsApp messages are sent.

Verification: mapping/API fixture tests and SQL execution against the supplied
merchant schema in PGlite. Production Supabase migration and live Salla fetches
must be verified by the merchant, whose project is not available via connector.
