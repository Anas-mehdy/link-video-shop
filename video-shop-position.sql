begin;
lock table public.video_shop_videos in share row exclusive mode;

-- Preserve the existing ascending order. Resolve old ties by recency and ID.
with positions as (
 select id,row_number() over(partition by merchant_id,is_active order by sort_order,created_at desc,id)::integer as position
 from public.video_shop_videos
)
update public.video_shop_videos v set sort_order=p.position
from positions p where p.id=v.id and v.sort_order is distinct from p.position;

-- Lock before touching rows, so two admin saves cannot shift each other's rows.
create or replace function public.video_shop_position_lock()
returns trigger language plpgsql set search_path='' as $$
begin
 perform pg_catalog.pg_advisory_xact_lock(1829345766,1401);
 return null;
end $$;

create or replace function public.video_shop_position_apply()
returns trigger language plpgsql set search_path='' as $$
declare slot integer; group_size integer; same_group boolean:=false;
begin
 if pg_catalog.pg_trigger_depth()>1 then
  if tg_op='DELETE' then return old; end if;
  return new;
 end if;

 if tg_op='DELETE' then
  update public.video_shop_videos set sort_order=sort_order-1
   where merchant_id=old.merchant_id and is_active=old.is_active and sort_order>old.sort_order;
  return old;
 end if;

 slot:=new.sort_order;
 if tg_op='UPDATE' then
  same_group:=new.is_active=old.is_active and new.merchant_id=old.merchant_id;
  if same_group and new.sort_order=old.sort_order then return new; end if;
  if not same_group then
   update public.video_shop_videos set sort_order=sort_order-1
    where merchant_id=old.merchant_id and is_active=old.is_active and sort_order>old.sort_order;
   if new.sort_order=old.sort_order then slot:=0; end if; -- toggling visibility appends to the destination
  end if;
 end if;

 select count(*)::integer into group_size from public.video_shop_videos
  where merchant_id=new.merchant_id and is_active=new.is_active and id<>new.id;
 slot:=case when slot>0 then least(slot,group_size+1) else group_size+1 end;

 if same_group then
  if slot<old.sort_order then
   update public.video_shop_videos set sort_order=sort_order+1
    where merchant_id=new.merchant_id and is_active=new.is_active and sort_order>=slot and sort_order<old.sort_order;
  elsif slot>old.sort_order then
   update public.video_shop_videos set sort_order=sort_order-1
    where merchant_id=new.merchant_id and is_active=new.is_active and sort_order<=slot and sort_order>old.sort_order;
  end if;
 else
  update public.video_shop_videos set sort_order=sort_order+1
   where merchant_id=new.merchant_id and is_active=new.is_active and sort_order>=slot;
 end if;
 new.sort_order:=slot;
 return new;
end $$;

drop trigger if exists video_shop_position_lock on public.video_shop_videos;
create trigger video_shop_position_lock before insert or update of sort_order,is_active,merchant_id or delete
 on public.video_shop_videos for each statement execute function public.video_shop_position_lock();
drop trigger if exists video_shop_position_apply on public.video_shop_videos;
create trigger video_shop_position_apply before insert or update of sort_order,is_active,merchant_id or delete
 on public.video_shop_videos for each row execute function public.video_shop_position_apply();

revoke all on function public.video_shop_position_lock(),public.video_shop_position_apply() from public,anon,authenticated;
commit;
