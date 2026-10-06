# Link Store Video Shop — Vercel Backend v1

This is a dependency-free Vercel Functions project.

## What it contains
- `/api/video-shop-feed` — public storefront feed, cached 5 minutes.
- `/api/video-shop-event` — lightweight analytics receiver.
- `/api/video-shop-admin` — protected CRUD for videos.
- `/api/video-shop-products` — protected product search from the existing `products` table.
- `/video-shop-admin` — Arabic management dashboard.

## 1. Supabase
Run `schema.sql` once in Supabase SQL Editor.

## 2. Deploy to Vercel
Create a new Vercel project from these files, then set:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `LINK_STORE_MERCHANT_ID=1829345766`
- `VIDEO_SHOP_ADMIN_TOKEN` = a long random secret

Never expose the Service Role key in Salla or browser code.

## 3. Test
Open:

`https://YOUR-VERCEL-DOMAIN.vercel.app/api/video-shop-feed`

Expected:
```json
{"ok":true,"merchant_id":1829345766,"videos":[...]}
```

Then open:

`https://YOUR-VERCEL-DOMAIN.vercel.app/video-shop-admin`

Enter the value of `VIDEO_SHOP_ADMIN_TOKEN`.

## 4. After the Feed URL works
Send the deployed Vercel URL back to ChatGPT.

The Salla test section can then be switched from hard-coded videos to the feed, while retaining the current design as a fallback if the API is temporarily unavailable.


## Protection Builder (experimental)

The existing `/video-shop-admin` page now links to `/protection-admin`. Both pages use the same `VIDEO_SHOP_ADMIN_TOKEN`. The new page maps products to a device/model, protection role, appearance, and ordered recommendations. The source catalog is a 28 September 2026 export; review options and synchronize new products before enabling recommendations for them.

1. Run [`protection-schema.sql`](./protection-schema.sql) **once** in the **same Supabase project used by this Vercel deployment**. It adds two RLS-enabled tables with no browser access and seeds one iPhone 18 Pro Max lens rule. The global switch is off by default. Existing Video Shop tables are unchanged.
2. Open `/protection-admin` using the current admin token. Review the seeded rule, confirm the destination products, and then switch the feature on for the test theme.
3. In Salla's **test theme custom JavaScript**, replace the old inline protection widget with this one-time loader:

```js
(function () {
  if (document.getElementById('link-protection-loader')) return;
  var s = document.createElement('script');
  s.id = 'link-protection-loader';
  s.src = 'https://link-video-shop.vercel.app/protection-widget.js';
  s.async = true;
  document.head.appendChild(s);
})();
```

The loader fetches `/api/protection-feed?id=<current product>` without credentials. The feed checks the global switch, per-product mode, current catalog row and availability, and returns only storefront-public recommendation data. Products with model/color choices link to their product pages for selection; they are not added blindly. Do not enable the global default for the full catalog until model rules and product options are reviewed.

If `/api/protection-admin` reports that setup is missing, run the SQL in the correct Supabase project. The public feed stays off when the table is missing or the database fails.

## CRM dashboard foundation

The unified Arabic dashboard is available at `/dashboard`. Setup, VPS deployment, Salla ingress and the dry-run n8n worker contract are documented in [docs/crm-foundation.md](docs/crm-foundation.md). Run `crm-foundation.sql` in the existing Link Store CRM project, and use `docs/inspect-existing-schema.sql` to prepare the next entity mapping stage. Existing Video Shop and protection routes remain available.
