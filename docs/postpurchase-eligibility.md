# Eligibility review

The authenticated postpurchase admin resource accepts POST `action: eligibility-review`. It reads stored merchant-scoped orders from the last 30 days and paginates rather than relying on the old preview's 200 delivered-order limit. Data exceeding the existing 6,000-row safety bound fails rather than silently returning a complete report.

Eligibility uses the configured purchase-based delay, delivered status, a single order line, an identified customer and a normalized phone, and the existing opt-out table. Bundles, Fold 8 and products outside protection targeting are excluded. Public-page classification and later-purchase filtering are reused from preloaded datasets to avoid per-order database or Salla requests. Later purchases on another model do not suppress remaining complements. Unknown relevant later purchases block the candidate for review.

The report reads the existing shared stock cache. Every proposed product must have a fresh four-hour check before a candidate is marked stock-ready; when all are unavailable the candidate is excluded. One candidate is selected per phone, prioritizing checked stock and then the earliest due order. Dedupe is a report-level prospective choice, not a durable send ledger.

The UI loads this local report upon opening the postpurchase page and has a refresh button. It displays counts over the full review and the first 200 rows with eligible candidates first. Raw phone numbers are not returned, only their last four digits.

Reviewing eligibility does not call Salla or a message provider. The older offer preview remains available for test selection.

## Targeted offers

The same review shows one targeted result per verified phone from delivered, single-item orders in its 30-day window. A verified Slim purchase maps to the standalone camera flat for the same model. A screen protector or camera flat purchase maps to Slim for the same model. The four models are iPhone 17 Pro, 17 Pro Max, 18 Pro and 18 Pro Max. Orders in the review window, including bundles and multi-item orders, are considered when checking what the customer already bought. The standard Slim is preferred when its stock is confirmed alongside MagSafe; MagSafe is a fallback when it has the better stock state.

`CRM_POSTPURCHASE_TARGETED_MODE=hold` removes qualifying phones from the current automated dispatch before candidate selection, including other orders for the same number. It reserves the audience even while an offer is delayed, unavailable or requires review. With the variable unset, the new journey is visible in the review while current dispatch stays in its existing mode. This version only previews targeted offers. Any later targeted sender should require marketing consent, use the existing durable delivery and stock checks, and reserve the audience before choosing a message.

The existing `link_postpurchase_complement_ar` product template in `lib/postpurchase-test-send.js` already accepts the customer name, purchased product, recommended product, image and product URL suffix. Confirm its status in Etisalna before reuse. Both product names can include the exact model, so one template can cover all four models and both offers. If separate wording is wanted, one marketing template per offer type is enough with the model in a body variable.
