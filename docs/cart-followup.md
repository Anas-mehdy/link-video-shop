# Abandoned cart followup dry run

Run `crm-cart-followup.sql` once in the Link Store Supabase SQL Editor. No Salla requests are made by this feature. All tables and RPCs are private to service_role; authenticated dashboard access is enforced by crm-admin.

Open Dashboard → Automations → Cart followup experiment. Enable the experiment (default delay 60 minutes). Its start time is fixed at the first enable; historical carts with abandonment before that time never enter the queue. Cart projections create one row per merchant/cart atomically; repeated updates do not create extra reminders. Delay changes affect new reminders only.

Purchase/cart recovery events cancel reminders immediately. A subsequent noncancelled order for the same customer also cancels them conservatively; this is not proof of a direct cart/order attribution. Phone optouts are merchant scoped and stop every reminder for that number. The UI records optouts manually until a provider webhook exists.

Refresh Simulation reconciles saved records and marks due eligible reminders as simulated only between 09:00 and 21:00 Asia/Riyadh. Due reminders outside those hours move to the next 09:00. Missing phones/HTTPS checkout links and unknown cart statuses are blocked. Unprocessed reminders older than 24 hours are cancelled. Pause prevents new queue rows and simulations; purchase/optout cancellation still applies. Simulated reminders never run twice and cannot send.

The message preview uses the current WhatsApp cart draft; no provider template has been approved and no actual sending is available. Consent must be verified before any future live sending. Buttons depend on the provider and are not currently rendered as approved templates.

For unattended simulation, configure n8n to POST every five minutes to `/api/crm-worker?action=cart-followup` with the existing `Authorization: Bearer <CRM_WORKER_TOKEN>` credential. Do not place this secret in a browser or workflow export. This schedule is not installed by the code change. Without it, use Refresh Simulation manually. There is no cron or live sender in this feature.

The list shows the latest 100 reminders. Dates and numbers use Latin digits; all schedules are Saudi local time.
