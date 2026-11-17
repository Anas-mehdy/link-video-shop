# Video Shop direct uploads

Implemented in the existing /video-shop-admin, embedded by the dashboard.

## Behavior

- An administrator selects an MP4/WebM, previews it, and saves. 50 MiB maximum; H.264/AAC MP4 is recommended. Unsupported browser playback blocks upload with an explanation.
- The browser generates a JPEG cover; optional JPG/WebP cover override, 2 MiB maximum.
- Admin authentication is required before issuing each object-specific upload grant.
- Bytes upload directly to Supabase Storage with progress, never through Vercel functions.
- The save endpoint verifies object metadata and merchant path before storing its public playback URL.
- Replacement retains the video ID and product links. Cancel and failed uploads leave the saved record intact.
- A fully uploaded pending object is reused if saving fails and the administrator retries.
- Existing TikTok records stay compatible. New uploads do not require a TikTok link.
- Optional HTTPS linkstore-sa.com campaign URL supports the bundle video without linking unrelated products.
- File upload alone does not publish a record: save is required. As before, new saved videos are active.
- Previous/orphaned media is retained intentionally; no automatic destructive storage cleanup. Review unused files before deleting them.

## Database

video-shop-media.sql was applied to Link Store CRM. It creates a 50 MiB public playback bucket without anonymous upload/update/delete policies, plus additive media fields. Storage uses existing server-side SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY; no keys go into the frontend.

## Storefront installation (after deploying this branch)

Product pages use the updated product-videos.js.

The homepage HTML lives in Salla's custom component, outside this repository. Keep its markup/product purchase behavior and add this one script after its existing code:

    <script src="https://link-video-shop.vercel.app/video-shop-media.js?v=20261117"></script>

The add-on uses existing video IDs and modal, plays media directly, and stops it on close or navigation. It makes no Salla API requests. Do not deploy a database feed containing native-only records to a storefront without the add-on installed.

The demonstration bundle file is not committed to Git, uploaded, or published by this implementation. Add it using the new upload control once deployed. Files in the previous downloadable prototype are unrelated to production storage.

## Validation

npm test includes upload authorization, merchant path isolation, type/size enforcement, grant scope, and replacement preserving product associations. Live signed upload / CORS / Range playback still requires a deployed preview; no live customer actions are executed by tests. Test iOS Safari/Android before general rollout.

Validation result: all 16 focused upload/auth/storefront tests pass. The complete suite has 9 pre-existing preorder failures, reproduced on unmodified origin/main (311/320 passing). This change does not modify those preorder files. Browser playback and a real signed upload have not been verified in a deployed preview.
