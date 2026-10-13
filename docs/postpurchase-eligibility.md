# Eligibility review

The authenticated postpurchase admin resource accepts POST `action: eligibility-review`. It reads stored merchant-scoped orders from the last 30 days and paginates rather than relying on the old preview's 200 delivered-order limit. Data exceeding the existing 6,000-row safety bound fails rather than silently returning a complete report.

Eligibility uses the configured purchase-based delay, delivered status, a single order line, an identified customer and a normalized phone, and the existing opt-out table. Bundles, Fold 8 and products outside protection targeting are excluded. Public-page classification and later-purchase filtering are reused from preloaded datasets to avoid per-order database or Salla requests. Later purchases on another model do not suppress remaining complements. Unknown relevant later purchases block the candidate for review.

The report reads the existing shared stock cache. Every proposed product must have a fresh four-hour check before a candidate is marked stock-ready; when all are unavailable the candidate is excluded. One candidate is selected per phone, prioritizing checked stock and then the earliest due order. Dedupe is a report-level prospective choice, not a durable send ledger.

The UI loads this local report upon opening the postpurchase page and has a refresh button. It displays counts over the full review and the first 200 rows with eligible candidates first. Raw phone numbers are not returned, only their last four digits.

No Salla requests, outbound messages, SQL changes, worker changes or campaign activation occur. A production sender still needs durable claims, cooldown history, batch scheduling and a final live eligibility recheck before provider IO. The older offer preview remains available for test selection and retains its existing behavior.
