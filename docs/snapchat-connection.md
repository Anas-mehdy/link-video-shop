# Snapchat connection setup

Register this exact Snap Redirect URI in the Snapchat app:

https://link-video-shop.vercel.app/api/snapchat-callback

Set SNAPCHAT_CLIENT_ID, SNAPCHAT_CLIENT_SECRET and SNAPCHAT_REDIRECT_URI in
Vercel Production. Also retain the existing CRM_ENCRYPTION_KEY (64 hex characters),
SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY. Never replace an existing encryption key:
that would make previously stored credentials unreadable. If no key exists, generate
one locally with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`.
Keep a private backup and set it as a sensitive Vercel variable.

Open /dashboard#integrations and select Connect Snapchat. /api/snapchat-connect
requires the existing admin bearer token, checks Production Origin on POST and
sets a Secure, HttpOnly, SameSite=Lax host-only cookie. Consent requests only
snapchat-marketing-api; this platform scope includes read/write even though our
application only implements authorization and token refresh, not campaign writes.

Callback state is random, signed, browser-bound and expires after ten minutes.
A hash-only audit entry in crm_event_inbox atomically consumes state using the
existing unique (merchant_id,event_key) constraint. Replays/concurrent callbacks
cannot exchange tokens twice. This entry is marked processed and does not trigger
automation rules. No new SQL is required after crm-foundation.sql.

Tokens are exchanged server-side and stored with AES-256-GCM in crm_connections,
using snapchat:merchant_id as authenticated context. Failures redirect with a
generic result, never raw codes, tokens, state or provider/database error details.
Do not log incoming callback URLs in custom request logging.

The authenticated refresh action renews expired/nearly expired tokens using the
saved refresh token; conditional updates avoid overwriting a newer connection.
Reporting and account discovery refresh tokens on demand. There is no background schedule.

Connected means OAuth credentials were durably saved. Click Choose advertiser account
on the integrations page, choose the Link Store account and save. The backend checks
permission via GET /v1/adaccounts/{id} before saving an allowlisted account object
inside the encrypted credential blob using a conditional update. Refresh preserves it.

Reporting uses GET /v1/adaccounts/{id}/stats with DAY granularity and no campaign/ad
breakdown. It requests spend, impressions, swipes, conversion_purchases and
conversion_purchases_value. All monetary values are converted from microcurrency
by dividing by 1,000,000 exactly once. Dates include both endpoints using the
account's local midnight; end_time is next-day midnight, including DST offsets.
Ranges are validated and limited to 366 days per request. Missing days/fields
remain unavailable rather than silently becoming zero. CTR/CPC/CPM/ROAS use
period totals; a zero denominator produces an unavailable ratio.

Attribution is explicit: 28-day swipe-up, 1-day view, conversion reporting time.
The UI labels it and identifies swipes as Snapchat clicks. Reports are fetched
on page load/filter change and cached only in the admin tab for 60 seconds per
period. The refresh button clears that cache. Nothing is aggregated with other
unconnected platforms; all-platform totals are explicitly Snapchat-only for now.
There is no scheduled n8n sync or persisted reporting table yet. No SQL is needed.

Official API references:
- https://developers.snap.com/marketing-api/Ads-API/organizations
- https://developers.snap.com/marketing-api/Ads-API/ad-accounts
- https://developers.snap.com/marketing-api/Ads-API/measurement
The setup endpoint reports missing variable names only to an authenticated admin.

Reporting requests use `breakdown=campaign`: account-level stats alone support spend only. Nested campaign DAY metrics are summed server-side; campaign IDs and details never reach the dashboard. Safe provider pagination is consumed before returning totals.
