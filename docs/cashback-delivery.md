# Cashback on delivery

The CRM uses the existing verified Salla webhook inbox, with no n8n workflow change.
Only projected `order.status.updated` events for delivered orders from the last
seven days appear in **ما بعد البيع → الكاش باك بعد التوصيل**. The nested order
ID is used, not the event's own data ID. Duplicate events appear once per order.

Install `crm-cashback-delivery.sql` after the existing CRM schemas and deploy.
Sending is initially paused. Salla Partners order/customer responses do not prove
a wallet credit. An admin matches the order to a positive cashback deposit in Salla's
wallet report and records the movement ID and expiry. Do not approve refund or
manual credit rows. WhatsApp consent and opt-outs use the existing CRM ledgers.
No wallet write or supplemental Salla API stock call is made.

The approved Arabic Marketing template is `link_cashback_delivered_ar`:
one name in the body, unsubscribe quick reply at index 0, dynamic URL at index 1
with the prefix `https://linkstore-sa.com/`. Use dashboard link preview before
enabling; the active Salla theme must support the existing personal-page loader.
Personal recommendations require fresh saved stock; otherwise the button uses a
known exact model category or the accessories category.

The authenticated WhatsApp worker checks cashback on even UTC minutes only.
Claims are unique per order and wallet movement. Up to 10 provider attempts per
rolling hour. A stored send claim is never replayed after an ambiguous result.
The existing aftermarket sender and the cashback sender share order-level
exclusion; a provider acceptance is not a WhatsApp delivery receipt.
