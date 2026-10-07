# TikTok advertiser OAuth
Register the exact Advertiser redirect URL:
https://link-video-shop.vercel.app/api/tiktok-callback

Production environment variables: TIKTOK_APP_ID, TIKTOK_APP_SECRET, CRM_ENCRYPTION_KEY (existing 64 hex key), SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY. Never put secrets in public files.

Authenticated dashboard -> integrations -> TikTok start. Start uses POST /api/crm-admin?resource=tiktok&action=start and validates the production origin. Callback receives auth_code and state, checks the signed HttpOnly Secure SameSite=Lax browser cookie, atomically claims state using the existing inbox unique key, exchanges the code server-side, then stores AES-256-GCM credentials bound to provider and merchant. State lasts 10 minutes and is single-use across instances. Cancelled/failed callbacks do not overwrite a connection. Callback redirects with only a fixed result indicator.

GET /api/crm-admin?resource=tiktok returns readiness and missing variable names (never values). GET action=accounts verifies authorized advertisers through /open_api/v1.3/oauth2/advertiser/get/. POST action=select rechecks authorization and uses compare-and-swap to save the selected account with encrypted credentials. No database migration or new serverless function is needed. App ID and advertiser IDs stay strings to avoid numeric rounding.

Token exchange uses the official SDK documented advertiser endpoint /open_api/v1.3/oauth2/access_token/ with JSON app_id, secret, auth_code. If the response provides expires_in it is validated and stored; no undocumented lifetime is invented and no refresh calls are issued. Authenticated reports now use the selected advertiser, current advertiser metadata, BASIC/AUCTION_ADVERTISER daily reporting and fixed numeric pagination. The UI supports TikTok, Snapchat and available-platform aggregates; differing currencies are not summed. Website purchase fields are complete_payment and total_complete_payment_rate. If TikTok rejects the metric parameters with 40002, only spend/impressions/clicks are retried; purchase indicators remain null and the UI explains their absence. Missing days or missing metric values stay null, never invented zero. Date ranges are inclusive, up to 366 days; reports are read-only and do not query Salla. Totals and ratios are recomputed from raw numbers. Native date inputs use lang=en for Latin digits. No campaign/ad modifications are made.

Run npm test. Live consent must be completed by the account holder, with the approved application online and the exact redirect URL registered.
