# Link Store Read-only Developer API · v1

Base: `https://link-video-shop.vercel.app/api/crm-admin?resource=developer-api`

A dedicated server-to-server API over Link Store's synchronized database. This is **not Salla API**, and Salla OAuth client credentials or tokens are never shared. Do not embed the developer key in mobile/web client code. Store it as a secret on your backend. No CORS access is provided.

## Authentication

Use `Authorization: Bearer YOUR_DEVELOPER_KEY` on every request. Create the key in `/developer-access.html` while signed in as store admin. The key is visible once, valid for 90 days, and revocable. Only its SHA-256 hash is stored. Key names, scopes, expiry, usage and prefix are visible to admins; raw keys are not retrievable.

## Usage

```js
// Execute on your BACKEND. LINK_DEVELOPER_KEY is a private environment variable.
const url = new URL('https://link-video-shop.vercel.app/api/crm-admin');
url.search = new URLSearchParams({ resource: 'developer-api', dataset: 'products', page: '1', per_page: '50' });
const response = await fetch(url, {
  headers: { Authorization: `Bearer ${process.env.LINK_DEVELOPER_KEY}` }
});
if (!response.ok) throw new Error(`Link API: ${response.status}`);
const result = await response.json();
```

Response: `{ ok, data: [...], page, per_page, has_more, source: "local_snapshot", salla_requests: 0, generated_at, notice }`.

`generated_at` is response time, **not sync time**. Refer to each record's `updated_at` and, where present, `source_updated_at`. This API never fetches Salla automatically. Newly added products appear after the merchant synchronizes them in their existing dashboard. Price/stock may be stale: verify at Salla checkout. Never use these snapshots as guaranteed live availability.

## Datasets and scopes

| dataset/scope | Returned fields |
| --- | --- |
| store | name, domain, timezone, currency |
| products | id (external Salla product ID), name, sku, product_type, status, url, thumbnail_url, main_image_url, currency, price, sale_price, regular_price, quantity, unlimited_quantity, is_available, rating, ratings_count, source_updated_at, updated_at |
| variants | id (external Salla variant ID), sku, currency, price, sale_price, regular_price, stock_quantity, unlimited_quantity, related_option_ids, related_option_value_ids, source_updated_at, updated_at |
| categories | id, name; only categories attached to synchronized products |
| orders | id (external Salla order ID), order_reference, status, status_slug, payment_status, payment_method, currency, total_amount, ordered_at, updated_at |
| customers | id (external Salla customer ID), name, first_name, last_name, phone, email, city, orders_count, total_spent, last_order_at, updated_at |
| carts | id (external Salla cart ID, **keep as string**), customer_name, phone, email, currency, total_amount, items_count, status, abandoned_at, recovered_at, updated_at |

All records are scoped to Link Store on the server. Never convert ID strings to JavaScript numbers. Monetary fields are SAR amounts (not halalas) where currency is SAR; nullable numeric values may be serialized as numbers or decimal strings. Null means unknown, not zero. Returned records do not include product cost, credentials, raw webhooks, private notes or source payloads.

Orders, customers and carts are restricted to the last 30 days, using `ordered_at`, `crm_scope_at`, and `abandoned_at` respectively. Those scopes grant merchant-wide read access to these fields: **they do not authenticate individual shoppers or enforce shopper ownership**. Never forward these datasets directly to an unauthenticated mobile app. Your backend must implement customer authentication/authorization before showing any customer records.

Defaults grant store/products/variants/categories only. Sensitive scopes are explicitly selected by the merchant when creating each key.

## Parameters

- `dataset`: one of the table entries above. Default `products`.
- `page`: 1–1000, default 1.
- `per_page`: 1–100, default 50.
- `id`: external ID, exact match, for products/variants/orders/customers/carts. Numeric string up to 20 digits.
- `product_id`: **required** for variants; external Salla product ID. Example `dataset=variants&product_id=123`.

No arbitrary SQL, filters, upstream URLs, writes, Salla requests, checkout, customer login, or refresh-token endpoints are exposed. Variant IDs/option IDs are provided where already synchronized; this API does not supply a complete Salla storefront/checkout SDK.

## Limits and errors

Each valid key: 60 requests/minute, 3000/day (UTC reset), shared across its scopes. Limits are atomic across all server instances. Response headers: `X-RateLimit-Remaining-Minute`, `X-RateLimit-Remaining-Day`; over limit gives 429 and `Retry-After` seconds. These are local API quotas, separate from Salla's monthly allowance.

400 invalid request; 401 invalid/expired/revoked key; 403 scope not granted; 405 non-GET request; 429 rate limit; 503 temporary backend failure. Retry 429 after `Retry-After`, and use bounded exponential backoff for 503. Never put a key in a query string or log Authorization headers.

## Rotation

Create a new key, update your backend's secret and verify it, then revoke the old key. Revocation applies to subsequent authenticated requests; a request already authorized can finish. Existing automations and Salla credentials remain unchanged.
