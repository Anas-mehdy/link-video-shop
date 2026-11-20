# Cashback on delivery

The CRM uses the existing verified Salla webhook inbox, with no n8n workflow change.
Only projected `order.status.updated` events for delivered orders from the last
seven days appear in **ما بعد البيع → الكاش باك بعد التوصيل**. The nested order
ID is used, not the event's own data ID. Duplicate events appear once per order.

Install the base CRM schemas and `crm-cashback-auto-delivered.sql`, and set the
automatic start date after deploying. No n8n workflow change is required.
This store uses a newly delivered event as its configured cashback trigger;
the payload does not contain an independent wallet credit. Orders are queued
without manual approval, but only with recorded WhatsApp opt-in and no opt-out.
Events before the automatic start time are excluded. No wallet writes are made.

The approved Arabic Marketing template is `link_cashback_delivered_ar`:
one name in the body, unsubscribe quick reply at index 0, dynamic URL at index 1
with the prefix `https://linkstore-sa.com/`. Use dashboard link preview before
enabling; the active Salla theme must support the existing personal-page loader.
The button always opens the cashback page using an encrypted cashback-purpose
token. The banner links to the sign-in-protected wallet and does not show a balance.
The page shows complements first and all available products from Salla's
accessories, accessory subcategories and accessory-bundle categories underneath.
Catalog cards open the native product page. The model or accessories
category stays available as a browse link. Preview tokens show the same shopping layout with neutral wallet copy and
do not assert a deposit. Old protection links keep their original view.

The verified Salla webhook attempts the new order immediately after projection.
The scheduled WhatsApp worker recovers pending work on even UTC minutes.
Claims are unique per order and delivery event. Up to 10 provider attempts per
rolling hour. A stored send claim is never replayed after an ambiguous result.
The existing aftermarket sender and the cashback sender share order-level
exclusion; a provider acceptance is not a WhatsApp delivery receipt.
