# WhatsApp workspace

## Available now

`/dashboard#whatsapp` includes number/provider setup, editable message drafts and previews, follow-up timing settings, and tag names. Save uses the existing admin-authenticated `/api/crm-admin?resource=whatsapp` GET/PUT endpoint. Settings are scoped to the configured merchant and stored in `crm_whatsapp_workspace`; there is no new Vercel function.

Run `crm-whatsapp.sql` once in the Link Supabase project's SQL Editor. It is repeatable, enables RLS, revokes all public/anon/authenticated access, and grants only select/insert/update to the server service role. Until the table exists, the page displays defaults with storage unavailable and disables Save. Unrelated storage failures produce an error rather than pretending to load defaults.

Settings do not contain API credentials. The mode is enforced as `draft` in the server and database. No sender, scheduler, webhook or n8n call is installed by this change. Internal drafts are not provider-approved WhatsApp templates.

## Planned after provider connection

- Verify the dedicated number and provider credentials on the server.
- Verify incoming webhooks and persist deduplicated messages and delivery statuses.
- Implement inbox, manual replies, contact linking, consent/opt-out, tag assignment, and employee handover.
- Sync provider-approved templates, checking send eligibility before sending.
- Add an idempotent follow-up queue triggered by real cart/order events. Recheck cart conversion, opt-out and order status immediately before sending.
- Trigger post-sale follow-up from confirmed delivery, not order creation; persist delivery/failure and recovery outcomes before showing metrics.

The inbox and WhatsApp contacts currently show honest empty setup states. Existing Salla customers remain in the separate Customers page; they are not silently imported or messaged.

## Verification

Database tests run the SQL twice in PGlite and check RLS, role grants and rejection of live mode. API tests cover authentication before storage, validation, missing-schema handling and merchant-scoped writes without messages. Browser checks cover setup save, template preview/edit/save, timing/tag saves, all tabs on mobile and the missing-table state. Production Supabase SQL execution is manual because this project's database is not accessible through the connected Supabase tools.
