# Salla records sync

Run `crm-salla-sync.sql` in the merchant Supabase project before starting sync.
The migration uses the schema supplied on 2026-10-07. It adds source timestamps
and a separate projection timestamp on the durable inbox. It does not repoint
the existing `last_event_id` foreign keys to the new inbox.

The authenticated dashboard Integrations page has a **مزامنة آخر 30 يومًا**
button. It fetches recent customers and orders in sequential pages of 30,
using the encrypted server-side Salla access token and documented date filters.
The window is 30 Saudi calendar days including today. Embedded customers of
recent orders are included even if their account was created earlier. Historical
cart API crawling is disabled because no date filter is documented. Recent carts
are populated from received webhooks only; this is not a complete historical
cart backfill. The dashboard lists/counts and customer spend use the same recent
window. Previously imported customers stay stored but are hidden unless a new
scoped import or a recent order links them to the window. Re-run the updated SQL
to add crm_scope_at and update the private RPCs before this release is used.
The read-only crm_salla_sync_ready RPC validates this before any paginated Salla
fetch. Missing or outdated SQL fails without spending a Salla API request.
Keep the page open. A failed
or interrupted run can resume from the failed resource/page saved in tab session
storage. Resource and page controls also allow manual recovery. Only an explicit
selection of customers/page 1 starts a full reimport. Provider status and retry
timing are displayed without exposing raw provider responses. Transient connection/server errors
are retried at most twice. HTTP 429 stops immediately; long provider Retry-After values require a later manual
resume instead of hammering the endpoint. Closing the tab clears the checkpoint. A new checkpoint namespace discards
checkpoints from the old all-history import.
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

### Unsafe identifiers in stored webhook events
Events with identifiers already rounded by a JSON parser cannot be repaired by converting the number to a string. Replay retains their payload, annotates `_crm_projection_error: unsafe_identifier`, leaves `records_synced_at` null and excludes them from subsequent projection batches. Other events continue. Completion reports the skipped count for that run; webhook acknowledgement reports `records_pending: true` for a quarantined event. No provider request is made when the order identifier itself is unsafe. Database/provider failures are never quarantined. To repair an event, obtain the exact original identifier, correct the retained payload and remove the annotation before replay. No schema change is required.
