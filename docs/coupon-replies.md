# Instant coupon replies

The existing signed Etisalna webhook, forwarded through n8n to `crm-worker?action=whatsapp-events`, now handles incoming public text coupon requests from account 12/inbox 40. No additional n8n workflow or schedule is needed.

Apply `crm-coupon-replies.sql`, then create the merchant settings with the default message and `enabled=false`. Deploy the code and enable the settings to process only messages created after activation. The authenticated dashboard WhatsApp → أكواد الخصم tab provides the enable switch, message editor, last 100 candidate decisions and per-conversation pause controls. `coupon_bot_paused` on an Etisalna conversation also prevents the reply; remove that label separately to resume.

Only `message_created` events count. Incoming messages must be fresh (10 minutes), correctly signed, and have a valid phone/conversation. Claims are atomic per merchant and phone. Re-delivery of one message and new messages within 24 hours of an accepted, pending or uncertain attempt cannot produce duplicate sends. Complaints are logged as `needs_agent`; no automated response is sent. Optouts remain respected. No incoming text is stored by this feature.

Before posting a free-form outgoing message, the handler checks the exact provider conversation, inbox and contact phone. It uses the existing server-side Etisalna API token and the current conversation, not the template campaign endpoint. Accepted means provider acceptance, not confirmed WhatsApp delivery. Timeout, invalid provider response or ambiguous outcome is recorded as `unknown`, never automatically retried. Missing token/storage failures do not break existing optout handling; webhook response contains a bounded coupon status.

The fixed discount rules are LINK10: 10 SAR for a cart strictly above 100; LINK15: 15 SAR from 200 inclusive; LINK20: 20 SAR from 300 inclusive. All products qualify. These rules are communicated by this feature, not recalculated or changed in Salla. Existing cart-recovery workflows remain independent.

Validation: `node --test tests/coupon-replies.test.js tests/etisalna-webhook.test.js`. To verify real delivery, send a new `ابي كود خصم` from a consenting test phone to the store's WhatsApp, then inspect the coupon log and the actual WhatsApp reply. Do not replay old signed events or fabricate signatures.
