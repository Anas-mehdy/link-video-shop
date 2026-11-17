-- Additive upgrade: existing TikTok videos remain unchanged.
alter table public.video_shop_videos alter column tiktok_url drop not null;
alter table public.video_shop_videos alter column tiktok_video_id drop not null;
alter table public.video_shop_videos add column if not exists media_path text;
alter table public.video_shop_videos add column if not exists media_url text;
alter table public.video_shop_videos add column if not exists poster_path text;
alter table public.video_shop_videos add column if not exists cta_url text;
alter table public.video_shop_videos add constraint video_shop_has_playback
  check ((media_path is not null and media_url is not null) or (tiktok_video_id is not null and tiktok_url is not null));
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('video-shop-media','video-shop-media',true,52428800,array['video/mp4','video/webm','image/jpeg','image/webp'])
on conflict(id) do nothing;
-- Public playback only. No anon/authenticated upload, update or delete policies.
-- Uploads use object-specific signed URLs after server-side admin authorization.
