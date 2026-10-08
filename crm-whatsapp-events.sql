-- Run after crm-cart-followup.sql. No messages are sent by this migration.
begin;
create table if not exists public.crm_whatsapp_webhook_receipts (
  merchant_id bigint not null,
  event_key text not null check (event_key ~ '^[a-f0-9]{64}$'),
  event_name text not null check (event_name in ('message_created','message_updated')),
  message_id text not null,
  occurred_at timestamptz not null,
  received_at timestamptz not null default now(),
  opted_out boolean not null,
  primary key (merchant_id,event_key)
);
alter table public.crm_whatsapp_webhook_receipts enable row level security;
revoke all on public.crm_whatsapp_webhook_receipts from public,anon,authenticated;
grant select,insert on public.crm_whatsapp_webhook_receipts to service_role;

create or replace function public.crm_receive_whatsapp_event(
  p_merchant_id bigint,p_event_key text,p_event_name text,p_message_id text,
  p_occurred_at timestamptz,p_phone text default null
) returns jsonb language plpgsql security invoker set search_path='' as $$
declare inserted_count integer; cancelled_count integer := 0;
begin
  if p_merchant_id is distinct from 1829345766 or p_event_key is null or p_event_key !~ '^[a-f0-9]{64}$'
     or p_event_name is null or p_event_name not in ('message_created','message_updated')
     or p_message_id is null or p_message_id !~ '^[1-9][0-9]{0,19}$' or p_occurred_at is null
     or (p_phone is not null and p_phone !~ '^[1-9][0-9]{7,14}$') then
    raise exception 'Invalid WhatsApp event';
  end if;
  -- Use the same merchant lock as the followup worker.
  perform 1 from public.crm_cart_followup_settings where merchant_id=p_merchant_id for update;
  insert into public.crm_whatsapp_webhook_receipts(merchant_id,event_key,event_name,message_id,occurred_at,opted_out)
  values(p_merchant_id,p_event_key,p_event_name,p_message_id,p_occurred_at,p_phone is not null)
  on conflict do nothing;
  get diagnostics inserted_count=row_count;
  if inserted_count=0 then return jsonb_build_object('duplicate',true); end if;
  if p_phone is not null then
    insert into public.crm_whatsapp_optouts(merchant_id,phone) values(p_merchant_id,p_phone) on conflict do nothing;
    update public.crm_cart_followups q set status='cancelled',reason='optout',updated_at=now()
    from public.abandoned_carts c
    where q.merchant_id=p_merchant_id and c.merchant_id=p_merchant_id and q.cart_id=c.id
      and q.status in ('waiting','blocked','simulated')
      and regexp_replace(coalesce(nullif(c.normalized_phone,''),c.phone,''),'[^0-9]','','g')=p_phone;
    get diagnostics cancelled_count=row_count;
  end if;
  return jsonb_build_object('duplicate',false,'opted_out',p_phone is not null,'cancelled',cancelled_count);
end;
$$;
revoke all on function public.crm_receive_whatsapp_event(bigint,text,text,text,timestamptz,text) from public,anon,authenticated;
grant execute on function public.crm_receive_whatsapp_event(bigint,text,text,text,timestamptz,text) to service_role;
commit;
