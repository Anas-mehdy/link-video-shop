# Durable shipping choice: implementation checkpoint

The current one-use, in-memory approval in `preorder-before-add.js` is not an order consent ledger. Never infer consent from `mixed_order`, a paid order, allocated inventory, a phone number, or the batch dates saved at first observation.

Implementation and verification notes:

- Dashboard wording marks mixed orders without matched evidence as unrecorded. Combined dispatch dates are conditional on the customer's agreement.
- `preorder-consent-source-check.sql` is a read-only aggregate preflight, tested against Postgres via PGlite. It returns no customer information, raw identifiers or option values. It does not enable a collector or change tracking/schema.

## Required evidence before implementing the bridge

The official SDK exposes `salla.cart.getCurrentCartId()`. An owned empty guest cart returned a 19-digit **string** ID from `/cart/latest`. A real merchant order exposed a string `checkout_id`. These are different observations, not proof that the IDs map through checkout/login/cart merging. The connected merchant order detail also omitted full items. The Link CRM database is not available through the connected Supabase projects and no local runtime credentials are present.

User ran the preflight on 2026-10-16: 722 orders, 235 carts, 223 string checkout IDs, no cart_reference_id, 18 orders whose checkout_id equals a stored cart ID, zero explicit cart→order links. Of 1137 items, 338 expose a recognized product ID, 10 a recognized SKU ID, and 13 have options arrays. “orders_with_full_items” in that report means a nonempty array only; it does NOT mean a complete identifiable snapshot. These findings support the checkout-ID bridge for a subset, not universal coverage or customer consent. No customer/time-derived joins are permitted.

Prepared next prerequisites locally:

- `preorder-consent-storage-setup.sql` creates two entirely new tables with collection disabled. No existing table/function/trigger changes. Anonymous/authenticated access is revoked; service can append evidence, cannot update/delete it or supply its receipt timestamp. The script is intentionally one-time and aborts on duplicate names.
- `lib/preorder-consent.js` supplies pure strict snapshot comparison, not a running reconciler. It requires exact textual checkout ID, finalized affirmative evidence, server receipt before trusted order creation and within 24h, identical full products/options/quantities/SKUs, and identical schedules/revisions supplied by the trusted caller. Missing options are not presumed empty. Ambiguous/customized items need review. Native merchant order option `id` is not the cart product-option ID; merchant comparisons require `product_option_id`.
- Focused tests cover Postgres setup execution, grant checks, RLS, long IDs, incorrect variants/quantities/dates and incomplete evidence. Release tests additionally cover browser/API collection and bulk-add timing.

User confirmed storage_ready_not_active with consent_collection_enabled=false on 2026-10-16. The collector, browser integration and admin evidence reader are now implemented; keep the flag false until the release is deployed and checked. The browser record is labelled as a recorded interaction matched to the order, not authenticated identity.

## Current collection path

- Public handler is a mode on the existing `/api/protection-feed?mode=preorder-consent` route, avoiding a new Vercel serverless function. It returns no ledger rows/customer data. Restricted Origin/CORS is traffic hygiene, not customer authentication. POSTs remain anonymous operational evidence.
- Feed publishes only control state and public policy text/version. Unknown control state requires collection; a failed control read must never silently turn off the required save.
- On an affirmative mixed-shipping choice, save a server-stamped intent with exact original cart/options and server-checked batch dates/revisions. A short-lived HMAC capability binds that intent, checkout ID and allowed incoming products. It uses a domain-separated key derived from the already-server-only CRM encryption key.
- Native Salla addition remains in charge. After its ItemAdded event, read the actual cart with options/attachments and append a finalized snapshot if only approved incoming products were added. No cart add/delete wrappers, checkout interception, local storage or external checkout. Failed saves keep evidence unverified; a failed intent blocks approval. Failed post-add save displays a warning and leaves staff a review state.
- For mixed bulk additions from an empty cart, do not fabricate an intent item to satisfy the installed schema. A signed empty-cart challenge binds the policy/schedule; only the actual successful nonempty cart becomes a record. Abandoned challenges confer no approval.
- On admin load, compare the newest ledger entry to the trusted full order snapshot and all batch schedules. A later unfinished intent invalidates reliance on an older record. Never search older records until one happens to match. Missing identifiers/options/SKUs or changed dates require review. The 24h receipt window is intentionally conservative.
- Admin activity shows the last 20 intent/finalized record summaries without full cart/customer values. It allows testing collection before paying. Only the order table can show a matched approval.
- No historical backfill, automatic customer messages, Salla note writes, payment/order creation or native shipping locks.

## Release and activation

1. Publish the reviewed code with the existing flag still false. Preserve the independently added preorder category in the sidebar.
2. Check the deployment, versioned guard/bootstrap, public catalog control=false, and public POST failure while disabled.
3. User runs `preorder-consent-enable.sql` in Link CRM (updates only the new flag). Reload the storefront, add one ready product then a preorder, explicitly approve and complete the native add.
4. Open `/dashboard#preorders` and refresh. The activity section must show intent then finalized evidence. No purchase is necessary for this collection check. End-to-end matching still requires a real order with a complete trusted item snapshot; do not claim it has been verified from unit tests.
5. Stop immediately by setting enabled=false on the same new control row if native item option shapes prevent recording. Existing orders/automation are unaffected.

Known conservative limits: two-minute addition capability, 40 records/cart/hour application check, max100 items, complete explicit option arrays, no customized notes/attachments or nested options, exact SKU evidence, ambiguous historic duplicate batches need review. Requests still need ordinary platform abuse protection; the per-cart application check is not a distributed global rate limiter.

## Guest-cart initialization fix (2026-10-16)

User reported the before-add “تعذر التحقق من السلة” message on a normal product card while signed out. Twilight 2.14.603's actual `details()` calls `getCurrentCartId(false, ..., false)`, intentionally returning `CartNotCreated` for a guest without a stored ID. The guard previously blocked the native add that would normally initialize that ID.

Guard version 20261016-13 catches only the named `CartNotCreated` case, obtains/initializes the cart ID through the native SDK's default `getCurrentCartId()`, then reads the actual cart by that ID. It never assumes that missing local storage means an empty server cart, asks for login, or adds/removes a product. Other read/initialization failures remain blocked. Native IDs are passed unchanged to native read methods. Unsafe numeric IDs cannot be used as consent evidence; they do not by themselves block ordinary ready-product shopping. Tests cover an empty guest, an existing preorder cart restored for a guest, failed initialization and legacy numeric IDs. Product-card read errors are rendered after the card content rather than wedged beside the add button when the native card wrapper is present.

## Required collector and reconciler behavior

- Record an explicit affirmative action, exact displayed text/version, server receipt time, native cart ID as text, exact whole-cart product/variant/quantity snapshot, and preorder dates/revisions. Never precheck the checkbox.
- Current approval occurs before adding the next item. Capture and validate the actual cart after successful native addition; an intent containing only an incoming product ID is insufficient.
- Reconcile only against trusted order data. Changed quantities/options, schedules, cart ID, incomplete snapshots, late/replayed evidence, or ambiguous matches require review and renewed consent. Do not backfill historical approvals.
- A browser record documents the browser interaction, not authenticated customer identity. CORS/Origin is not authorization. No public read endpoint, service key exposure, arbitrary order-note writes or customer/time matching.
- Keep the ledger private with RLS and service-only privileges. Avoid storing names/phones/IPs unless separately justified. A collector outage must never silently grant approval.
- Show the actual stored choice and evidence in the admin dashboard. Until matched, show “موافقة غير موثقة — يلزم تأكيد العميل”. This is an operational review requirement, not a native Salla shipping lock.
- Do not activate or publish a mandatory collector before its database setup and end-to-end cart → approval → order → dashboard test succeed.

The user, not the agent, executed the storage setup. Collection stays disabled until user activation. Deployment status is recorded separately after release checks.
