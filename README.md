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
