# Current multi-date preorder flow — 15 October 2026

This section supersedes the single-product classifications in the implementation history below. Native Video Shop/accessory testing remains deferred by merchant until transition to the main theme; no main-theme publication is performed here.

- `mode=preorders&catalog=1` returns a complete sanitized catalog of open/paused dedicated preorder products from the existing CRM batch table. Draft/received/closed records are excluded. No quantities, customers, reservations, credentials or internal batch IDs are public. More than 200 active records, duplicate active product IDs, unsupported variant-level batches or incomplete/malformed responses fail closed rather than silently treating missing preorder products as ready. Keep one standalone Salla product per preorder color/model for this implementation.
- Live classification never uses a hardcoded preorder product ID. The historical constant remains solely for the existing original-product Burgundy bridge/demo compatibility. The product date card accepts the configured product ID from the loader and uses generic product copy.
- A dispatch group is the tuple of expected arrival, ship-from and ship-by dates; all ready products form one ready group. One group needs no shipping-choice dialog. Adding across groups prompts in either order, including preorder + preorder with different dates. Several products with the same arrival/dispatch window can be grouped without an additional choice.
- The dialog lists every affected preorder's arrival and dispatch window. Combined dispatch uses **maximum ship-from and maximum ship-by independently** across all included preorders, so overlapping windows never understate the latest bound. A ready item waits for that window. Separate fulfillment still requires separate native orders; no cart splitting or flat shipping fee.
- The cart consent signature includes the complete catalog metadata/revisions as well as cart quantities/options. The fresh approval read invalidates consent if dates/status/revision/cart contents changed. Catalog failures cause an inline retry error, never an empty-cart shipping-choice dialog. This is a browser snapshot, not a backend consent record or an atomic cross-session checkout constraint.
- The admin API reads all reservation lines for the orders on the visible page, regardless of batch filter/pagination, and calculates each order's current combined window. A late batch changes that window and adds a staff warning while preserving the original per-line promise. An early allocated reservation never implies all preorder lines are allocated. Missing metadata, failed/truncated reads and review states must not release an order for dispatch. These projections do not enforce a native Salla shipping lock and do not automatically notify customers.
- Public and admin changes are read-only against existing tables; no SQL migration, reservation/state mutation, payment, shipment, order-status write or customer message was enabled.

Validation: full automated suite passed (225 tests), including new catalog safety, same-window products, 20/30-day-equivalent fixture windows in both orders, combined-window maxima, schedule/revision change on approval, dynamic product disclosure and full-order readiness/delay projections. No second live preorder product or real order was created for testing. Native browser verification of the expanded flow is still required before launch.

---

## Earlier implementation notes

# Current test-theme flow: choice before adding a mixed product

The withdrawn cart-splitting experiment below is historical and remains disabled on native cart/checkout pages. The existing test-theme loader now delegates to `preorder-before-add.js` on other storefront routes. Do not install on the live theme until native verification is complete.

## Current behavior

Captures native `salla-add-product-button` clicks before native handlers. Actual Twilight 2.14.600 only calls its documented validate hook when product options exist, and omits ctx.productId; the initial hook-only implementation did not cover simple products and was replaced. No hook-only enforcement is claimed. Reads cart through `salla.cart.details()`. Product `318533359` is the only configured preorder; every other catalog product is classified as ready for this pilot. Update this classification before adding any other preorder SKU.

- Empty cart, ready + ready, preorder + preorder: no shipping choice.
- Ready cart + adding preorder OR preorder cart + adding ready: block that addition and show an unselected choice dialog.
- Combined: show public dispatch dates; customer explicitly agrees that ready stock waits. Fresh cart read before granting one-use permission bound to product and unchanged cart. Customer presses the original Salla add button again. No programmatic add, submit or cart mutation on approval; mixed-cart approval requires a fresh customer press.
- Separate: open the native store-scoped cart in a new tab; finish the products already there first, then return to buy the other type as a second order. Salla calculates regional shipping independently for each order. No flat surcharge or automatic split.
- Already mixed cart: explicitly request manual native cart review to make independent orders; never imply the script separated it.
- Cart changes invalidate permission. The initial unknown cart is checked silently; its blocked gesture resumes exactly once only after a confirmed homogeneous result, via the original native click target and native validation. Repeated presses while waiting are blocked. Cart-read errors show an inline retry error, never a shipping-choice dialog. Schedule lookup does not gate homogeneous carts; the native preorder campaign controls sale availability. If a cart becomes homogeneous, any open shipping-choice dialog closes. Native validators that already failed stay failed. No persistent browser storage or checkout interception.
- Existing marketing/date card is reused without its old competing checkbox/DOM click guard.

## Limits and launch checks

This is a test-theme frontend guard, not a backend checkout rule. Direct SDK additions, quick buy, other storefront channels, JS disabled, and stale changes from another session may bypass native-button click capture. Consent is not persisted server-side; backend and Supabase are unchanged. Before launch verify actual Malak native-button clicks are captured, both addition orders, quantities, cancellation, existing mixed carts, two regional shipping addresses and both native checkouts. Confirm the native preorder campaign holds the complete combined order and operations do not dispatch ready stock early. No real payment or dispatch has been tested automatically.

If `window.LinkPreorderBeforeAddStatus.ready` is false, the SDK has not initialized and the guard must not be represented as active. The retired cart experiment stays disabled independently.

Official hook documentation: https://docs.salla.dev/twilight-engine/component-hooks

---

## Historical withdrawn experiment

# Preorder shipping choice — isolated trial, 15 October 2026

**WITHDRAWN FROM NATIVE STOREFRONT at merchant request.** `start()` now returns before native cart initialization. The installed trial loader no longer reads or changes native cart contents, guards checkout, or inserts the recovery banner. The isolated demo still runs local fixtures. Existing browser recovery journals are retained; nothing is automatically re-added or deleted. Product-page marketing disclosure continues through the legacy product widget.

The native recovery link incorrectly used `/cart` on the path-based `salla.sa/linkstore122` preview, landing at `salla.sa/cart` and its unrelated closed-store page. This did not demonstrate that Link Store itself was closed. Rather than extend the rejected custom cart flow, native behavior has been disabled. Do not install the trial loader on the live theme.

Scope: dedicated preorder product `318533359` only. The user chose to support both one combined delayed shipment and separate ready/preorder purchases. No fixed shipping surcharge: native Salla checkout calculates each order's regional shipping, discounts, carrier charges and taxes.

## Delivered flow

`/preorder-shipping-preview.html` is an interactive simulation with local cart, storage and schedule fixtures. Its payment button only clears simulated cart items. It never accesses a real cart or places orders. Region A/B and all amounts in the demo are explicitly examples.

`/preorder-shipping-trial.js` is opt-in: it does nothing without `data-shipping-trial="1"`. It is not loaded by the existing loader or the live theme. The only change to the legacy widget is a conditional cart handoff when this trial flag has already been activated. Product/bridge disclosure is reused.

Mixed cart has no default choice:

* Together: explicit checkbox, current schedule, and fresh cart read before releasing the native checkout control. The customer buys one order and the native preorder campaign's all-later policy applies.
* Separate: fixed sequence **ready first, preorder second**, two checkout/payment operations and separate regional shipping quotes. Persist the preorder quantity in a verified browser journal; remove only its original cart-line ID; re-read and verify ready items/quantities/options remain unchanged. Do not automatically open checkout or place an order. The customer can cancel separation before buying ready items.
* After the ready cart becomes empty, the customer explicitly confirms that they completed the first purchase, then restores the saved preorder quantity for the second checkout. Empty cart is **not** proof of payment; neither the UI nor the backend marks an order paid from it. A recovery link appears on other store pages while a saved journal exists.
* Preorder-only cart: acknowledgement only, no separate-shipment choice or surcharge. Ready-only cart: no schedule feed request or preorder notice.

## Storage and failure handling

Journal key `link.preorder.split.trial.v1` is local to the store origin and this browser. It contains only version, fixed product ID, quantity, stage, timestamps, and SHA-256 hashes of cart state (no raw ready-product selections, customer data, address, payment details or credentials). It does not reserve stock, freeze price, transfer across devices, or prove consent on the server. Journal recovery is read-only and never retries add/delete blindly.

* Persist and verify the journal before the one deletion. Re-read before mutation and after it. Storage failure means no deletion.
* Web Locks prevent concurrent operations through this trial in multiple tabs; native cart controls in the current page are temporarily inert during the operation. Browsers without Web Locks cannot split via this trial.
* Salla does not provide a documented atomic cart compare-and-swap in the SDK used here. Native cart changes from another device/tab are outside the lock. This trial is **not a backend checkout rule or a guarantee against all concurrent modifications**. Detect observable changes and retain the journal for review.
* Resolve network ambiguity by reading the cart. An add that timed out but is visible is not repeated. Partial adds, stock failures, unsupported customizations, or unresolvable states retain the saved quantity for manual review.
* Only a single simple dedicated preorder line is reconstructed, with its quantity (up to the batch's 400). Preorder custom fields/files/options are refused before deletion; ready items stay in place and are never reconstructed. There is no artificial one-piece limit.
* Do not automatically expire/delete the recovery journal. Closing/reopening the browser retains recovery. Manual browser-data deletion can still lose it.

## Test theme installation (not performed through connector)

The Salla connector does not expose theme custom JavaScript. `docs/preorder-shipping-trial-loader.js` is the exact replacement for the preorder loader on **ملاك تجارب**, version `1409940314`. Preserve the existing protection/sidebar loaders. Do not publish the whole test theme or install this trial in active theme `603175051`.

Before saving any native "order option", confirm that no required unconfigured shipping field or fixed fee has been activated. This trial does not depend on the unsaved form the user inspected.

## Outstanding native verification before launch

1. Install only in the test theme; verify SDK `details`, `deleteItem(cartLineId)`, `addItem({id,quantity})` against the actual Malak cart response. Unsupported responses fail without mutating.
2. Verify mobile/desktop checkout control detection, custom web components/shadow paths, back/forward navigation, bfcache, coupons, native price recalculation, and real regional shipping totals for both orders.
3. Choose together; acknowledge; change a quantity; confirm choice resets. Remove preorder; confirm choice disappears. Change schedule; confirm acknowledgement resets.
4. Separate several preorder units; verify ready colors/options/files unchanged. Return without finishing ready checkout; cancel separation. Repeat; finish first purchase; restore once; refresh and verify no duplicates. Simulate blocked storage/network/stock change.
5. A real payment, order-webhook enrollment and carrier dispatch have **not** been tested by the agent. No billable test orders or shipments are created automatically.
6. Together-choice server consent/automation enrollment remains a separate follow-up. Existing SQL and Supabase have not been changed in this trial. Combined orders need operational holding of their ready stock. The frontend checkbox does not create a server-side dispatch hold.
7. This theme UI cannot guarantee coverage of quick-buy, externally hosted/native checkout, JS-disabled paths, the store app or محلي. Native order options can help persist consent but their official limitations also exclude quick-buy and product landing-page flows. Do not call this a production-wide hard checkout enforcement.

## Evidence consulted

* https://docs.salla.dev/422629m0 — SDK addItem.
* https://docs.salla.dev/twilight-sdk/cart-delete-item — removal by cart item ID, deletion event.
* https://docs.salla.dev/twilight-sdk/cart-details — cart items and optional option/attachment fields.
* https://help.salla.sa/article/إعداد-خيارات-الطلب-في-السلة/pxpzpi5ujxdglq2ex62sk2qa — native order-option availability and channel limits.

Automated checks: core mutation/recovery tests plus DOM interaction tests, including a local simulation execution check. These do not replace native Salla browser/payment testing.

## Native startup follow-up

The first native screenshot showed no trial card. Exact cause is not established from a screenshot alone. Startup now supports store-prefixed `/cart` paths, callback/Promise SDK readiness, late SDK availability, and a bounded fallback for an already-fired readiness callback. A loading card appears immediately on recognized cart routes. Cart reads time out without retry; a visible `PO-SDK` or `PO-MAP` code distinguishes missing SDK from a native preorder link whose API product ID could not be matched. No deletion is inferred from product names or diagnostic DOM links.

The next native screenshot confirmed successful startup on `salla.sa/linkstore122/cart`, but showed broken positioning. The previous `summary.before(root)` / body-prepend placement could introduce a grid sibling or shift the theme header. Placement now inserts a block `div` **inside** the native checkout summary card. It discovers that card through its checkout control/heading and never prepends to body. If no native anchor exists yet, wait for its DOM render rather than altering page structure. Structural regressions cover a header + two-column cart + coupon + summary fixture, including late native rendering. Native visual verification still requires the user's preview session.

## Additional storefront paths — 15 October follow-up

`LinkPreorderCheckItems(items)` is an explicit async preflight, enabled only when the test-theme loader has started. Our protection-widget, bundle-upsells, drip-upsells, four product-videos custom landing purchase queues, and complete-storefront bulk selection call it before adding. No SDK method is replaced. Approval resumes the selected bulk operation; cancel resolves false before its first cart mutation. Price/stock validation and existing uncertain-add handling remain with each caller. Independent legacy automatic add-ons after the main item may require another confirmation; no promise of one atomic multi-item cart transaction is made.

Video Shop component 107949473 on version 1409940314 uses native Salla buttons (covered by click capture) and an explicit form-submit handler. The minimal replacement form handler is in `docs/preorder-video-submit.js`; it checks before calling the existing Salla form API and prevents simultaneous form submissions. Only that test component's handler is changed.

On product/storefront pages, quick purchase widgets and the observed Twilight 2.14.600 buy-now button are hidden while the cart is unverified, contains preorder, or the viewed product is the configured preorder. Known quick-purchase clicks are blocked in that context too. Native checkout/payment pages are excluded entirely, so Apple Pay there is not disabled by this module. Homogeneous ready carts regain their shortcuts after a successful cart read. This is not proof that every theme-specific or external checkout control is covered.

The dashboard now marks mixed waiting/review reservations as **wait for the entire order** and reminds staff to review the full order after allocation. It explicitly discloses that this does not lock carrier-label creation in Salla. Existing SQL detects a shipment before allocation and routes it to review; it does not prevent that shipment. No automatic shipping, status updates, label creation, outbound notices or database schema changes were enabled. `docs/preorder-dispatch-audit.sql` provides a read-only aggregate check for the actual Link CRM project; no live database execution is claimed.

Launch remains conditional on native mobile/desktop tests: video add, accessory selection, cancellation, cart edits, simple/variable products, quick buy visibility, regular checkout and Apple Pay availability there. Store app, محلي, direct checkout links, JS-disabled paths and independently modified SDK callers remain outside this theme guard. Browser consent is not a server-side consent record.

## iPhone 18 Pro Max original product color cards

Product 981596666 now uses a responsive four-card bridge instead of the old Burgundy-only text notice. `public/preorder-frame-colors.json` maps actual native option IDs, public color images and swatches. Each card is shown only while the original product's native `salla-product-options` data reports that exact option out of stock (`details[].is_out`). The SDK is a fallback only when that attribute is absent. This contract was checked against the public product HTML; its option projection is saved in `tests/fixtures/frame-native-options.json`, including four unavailable colors and available white. Unknown inventory shows an error without actionable booking links; available options are omitted before mounting to prevent redraw loops. Native ready-color selectors and add controls are unchanged.

Burgundy links to the existing open booking product 318533359. Silver, sky blue and black are announced as upcoming with disabled "booking opens soon" buttons, because separate booking products/quantities/campaigns were not supplied. To enable each: configure its native campaign and independent CRM batch, then set its booking_id in the mapping. Never create fictitious quantities. The merchant said all four colors arrive with the Burgundy shipment; the common displayed dates come from its existing batch (arrival 3 November, dispatch 4–6 November), not a rolling Date.now()+20 calculation. No new products, quantities, campaigns or batches were created by this UI task. The cards remain loaded through the test-theme loader; main-theme publication is deferred.


### Added color products (15 October)
The merchant created Silver 1229565720, sky blue 1962143002 and black 1013934438 in Salla, each with quantity 400, price SAR 89, no options, and preorder category 12775313. The mapping now points to these real products. Buttons still require an open CRM batch from the public feed; creating a Salla product alone does not mark it as preorder in the automation catalog.

`docs/preorder-frame-colors-activate.sql` prepares the three batches through the installed save RPC, using the confirmed Burgundy dates and each Salla product's entered 400-unit limit. It must be run manually in the Link CRM project, which is not exposed by the current Supabase connector. It does not change schema, tracking triggers, order records, or the existing Burgundy batch. The transaction aborts on changed source dates or conflicting batches, and a repeat with the same configuration makes no edits. Local PostgreSQL tests verify creation, unchanged source, idempotency, and atomic rollback. Live execution is pending. Native Salla campaigns are separate and are not created by this SQL. The copied descriptions still refer to Burgundy in the introductory sentence; no Salla product content was changed in this task.


### External product-card preorder disclosure
`preorder-before-add.js` now intercepts native `salla-add-product-button` card clicks when the added preorder differs from the current product-page ID. A homogeneous external add shows product/color, its individual arrival/dispatch dates and a required checkbox; approval rereads the cart/catalog and resumes the original unprocessed native click once. It never calls a cart mutation API directly. A mixed external add uses the existing shipping-choice dialog, with the dates and waiting consent together; its explicit approval can resume the same external native control once. Existing product-page mixed shipping choice still requires a second press of the original button. Product-page homogeneous adds do not get the new modal; an unavailable native product-page add is blocked with an inline notice instead. Our opt-in bulk callers also show the external disclosure where applicable.

The frame manifest supplements the catalog with pending entries for dedicated booking IDs not yet returned by the open/paused CRM feed. These entries never authorize an add: cards, product-page buttons and opt-in bulk adds are blocked while any involved batch is pending, paused, expired or undated. They use the known common shipment dates as tentative information only. This prevents the three new color products being classified as ready on the opted-in theme before manual batch activation. A failed manifest read fails the guard closed; no invented open batch is created.

Local tests cover empty carts, normal products, both shipping modes, individual dates, cancellation, delayed reads, schedule changes, one native resume, pending colors and bulk preflights. The current Malak product-card script was inspected and uses the exact native custom element and product-id attribute captured here. No live browser cart action or paid order was executed. This remains opt-in to Malak Trials: it does not protect the primary theme unless its loader is installed there, and does not restrict apps, direct checkout, or clients with the script disabled. Main-theme deployment still needs the previously deferred native end-to-end tests.


## Main theme rollout — merchant authorized 15 October
The merchant approved moving the tested preorder features to the primary Malak version 603175051. The primary theme is kept active; no test-theme publication or setting/layout replacement is involved. Its already-installed `link-sidebar.js` entry point now includes the independently maintained `preorder-bootstrap.js`, which loads the same opt-in before-add guard and its product disclosure/cards. Run `python scripts/build-sidebar-preorder-bootstrap.py` after changing the bootstrap to keep the embedded copy current. Sidebar navigation content and event handlers are otherwise preserved. The bootstrap is limited to the Link domain and its Salla-prefixed preview; native cart and checkout routes are excluded.

The bootstrap queues opt-in custom preflights and blocks early native add/quick-buy gestures until the actual guard is installed. A loading/failure message replaces silent bypass. It does not intercept merchant API, apps, disabled-JS clients or standalone code that does not use the guard.

Live homepage video component 956769247 on primary version 603175051 was updated in place: only its form submit handler was replaced by `docs/preorder-video-submit.js`, including a form preflight marker. Readback matched the proposed code exactly. A short-lived, single-use approval bound to that exact form, cart/catalog snapshot and input state prevents a second modal when a captured native button subsequently submits the same video form. Form calls without such a fresh matching approval run the full preflight. Native Salla availability and option validation still run.

The existing accessory/product-video/bundle/drip integrations already invoke the shared preflight. No batch was opened, SQL executed, native campaign changed or stock modified during this rollout. The three newly mapped colors remain blocked as pending until their batches are explicitly opened later; Burgundy keeps its existing open batch. Full native payment or shipment testing is not claimed. Tests cover bootstrap scoping/failure, pending booking blocking, video consent handoff, external disclosure, mixed carts and prior storefront behavior. Rollback: remove only the marked bootstrap prefix from sidebar and restore the previous video submit handler; do not republish the test theme.
