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
