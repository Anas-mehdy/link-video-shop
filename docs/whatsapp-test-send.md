# One cart / one phone WhatsApp test

Run `crm-whatsapp-test-send.sql`. Add Production variables in Vercel:
- `ETISALNA_API_ACCESS_TOKEN`: provider profile API access token (not webhook secret).
- `WHATSAPP_TEST_PHONE`: your own test phone in international digits without `+`, e.g. `966500000001`.

Redeploy after changing variables. Leave incoming events workflow published. No schedule or customer-wide sending is enabled. The default followup queue still simulates reminders.

Create a real cart with your own test number, leave it incomplete and wait until its Salla event appears in the dashboard. Find its database UUID with this read-only Supabase query:

```sql
select id, external_cart_id, customer_name, phone, abandoned_at, status
from public.abandoned_carts
where merchant_id=1829345766 and greatest(abandoned_at,crm_source_at)>=now()-interval '24 hours'
order by abandoned_at desc limit 20;
```

In a separate manual n8n workflow add an HTTP Request: POST `https://link-video-shop.vercel.app/api/crm-worker?action=whatsapp-test`, authentication header `Authorization: Bearer <CRM_WORKER_TOKEN>` using the existing private worker credential. Send JSON:

```json
{"cart_id":"YOUR_DATABASE_CART_UUID","confirm_test":true}
```

Only the server-configured test phone is accepted; do not use a customer's cart or overwrite its phone. The endpoint checks persisted optout, latest local order/cart projection, creation or latest source update within 24h, active state and supported mtjr.at checkout URL. No Salla API request is made. It reserves a single attempt per cart atomically, then calls Etisalna synchronously. `accepted` means provider API success, not recipient delivery. Provider failures/timeouts produce `unknown`, with no automatic retry. Never delete attempt rows to force a retry before verifying the provider conversation; it can duplicate a message. A fresh test cart has its own attempt.

The test bypasses reminder delay/quiet hours because it is an explicit manual send to your own number. Incoming optouts/purchases that commit before claim are checked. An external send cannot share a database transaction: a later optout or purchase can race with the already started provider request. General automatic sending needs a production queue and delivery tracking before enabling it.

`optout` blocks an unsubscribed test number. Do not silently clear it. Use another number you own or explicitly request to restore consent for your test number. Ordinary replies do not restore consent. `already_attempted` blocks duplicate/manual concurrent sends. `phone_mismatch` protects customer/cart identity.
