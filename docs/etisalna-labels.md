# Automatic Etisalna conversation labels

Uses the existing server-only `ETISALNA_API_ACCESS_TOKEN` (the same user API token verified in n8n). No new environment variable, SQL migration, or Salla API request is needed.

- `cart_reminder_1`: provider accepted the automatic first reminder and the result was saved.
- `cart_reminder_2`: provider accepted the automatic second reminder and the result was saved.
- `whatsapp_optout`: a signed incoming optout event was durably processed.
- `cart_recovered`: a projected `abandoned.cart.purchased` event identifies a recovered cart with an accepted reminder sent before the purchase. The exact reminder message determines the conversation; unrelated later orders do not qualify.

The sending path searches the exact normalized recipient phone in account 12, inspects inbox 40 conversations, and matches the exact returned provider message ID before adding a reminder label. It never guesses the latest conversation. Authenticated outgoing webhooks also match saved accepted message IDs, providing another opportunity to apply the label.

Etisalna POST labels replaces the entire list. Always GET first, merge the new label with existing staff labels, and verify the POST response. Repeated events do not POST if the label already exists. Concurrent staff label edits between GET and POST cannot be made atomic with this provider endpoint.

Label failure never retries a message, reverses acceptance, or blocks optout persistence. Worker/webhook responses include `labeling.status` (`added`, `already_present`, `pending`, `ignored`, or `skipped`). `pending` means unconfirmed labeling, not a durable retry queue; later matching webhook events attempt the label again. If all attempts fail, investigate provider access and the matching event. This does not backfill historical conversations or send test/customer messages.

Recovery labeling uses the existing authenticated minute worker and existing `crm_event_inbox`. It checks purchase events from the last 30 days, one at a time, after local projections. A recovery job occupies that tick without sending a message; ordinary reminder sending continues on the next tick. Provider failures retry every 15 minutes up to five attempts; completion/retry metadata is appended to the existing event payload without changing its original data. Missing cart evidence or absence of a prior accepted reminder is recorded as ignored. Recovery is a confirmed cart purchase, not proof that WhatsApp caused it. No Salla polling, new migration, or new secret is introduced.
