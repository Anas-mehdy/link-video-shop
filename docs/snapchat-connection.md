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
There is no scheduled refresh until reporting ingestion is implemented.

Connected means OAuth credentials were durably saved. Advertiser account selection,
reporting ingestion and dashboard statistics are the next step and are not enabled.
The setup endpoint reports missing variable names only to an authenticated admin.
