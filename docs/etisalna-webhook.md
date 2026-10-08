# Etisalna incoming WhatsApp events

Prerequisites: run `crm-cart-followup.sql`, then `crm-whatsapp-events.sql` in the project's Supabase SQL editor. Add `ETISALNA_WEBHOOK_SECRET` to Vercel Production using the secret returned for Etisalna webhook 20, then deploy. This is not the API access token.

The existing n8n workflow receives POST `/webhook/etisalna-whatsapp-events`. Keep Raw Body enabled. After Webhook add a Code node, Run Once for All Items:

```javascript
const item = $input.first();
const names = Object.keys(item.binary || {});
if (names.length !== 1) throw new Error('Expected one raw request binary; enable Raw Body');
const raw = await this.helpers.getBinaryDataBuffer(0, names[0]);
const h = item.json.headers || {};
return [{ json: {
  raw_body_base64: raw.toString('base64'),
  headers: {
    'x-chatwoot-timestamp': h['x-chatwoot-timestamp'],
    'x-chatwoot-signature': h['x-chatwoot-signature']
  }
} }];
```

Connect an HTTP Request node: POST `https://link-video-shop.vercel.app/api/crm-worker?action=whatsapp-events`, Authentication None, Send Body on, Body Content Type JSON, Specify Body Using JSON, expression `{{ $json }}`. Keep Never Error off. No API access key or worker token is needed; the original signed bytes authenticate the event.

Change the Webhook's Respond setting from Immediately to When Last Node Finishes. Publish the workflow. A failed dashboard request must fail the webhook response so Etisalna can retry; review failed n8n executions instead of acknowledging errors as success. Test with a new ordinary incoming WhatsApp message, then an optout. Signature timestamps have a five-minute tolerance: old captured events cannot be replayed as a fresh test.

Expected response: `{"ok":true,"duplicate":false,"opted_out":false,"cancelled":0}` for ordinary text. Optouts return `opted_out:true`; cancelled counts existing waiting/blocked/simulated followups for that phone. Duplicates return `duplicate:true` without changing data. Inbox 40/account 12 are required. Signature uses HMAC-SHA256 of `timestamp + '.' + raw_body`; never reconstruct raw bytes with JSON.stringify.

Only exact incoming public text `إلغاء الاشتراك` (with normalized Arabic spelling), STOP or unsubscribe opts out. An ordinary reply never restores consent. No message is sent by this receiver. Provider dashboard sends and other systems are outside this optout mechanism. Raw message text and provider tokens are not saved; receipts retain event metadata only. Run receipts retention maintenance when establishing the production retention policy.
