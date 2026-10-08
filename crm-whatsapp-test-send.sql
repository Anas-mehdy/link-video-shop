-- Test sending only. Run after crm-whatsapp-events.sql.
begin;
create table if not exists public.crm_whatsapp_test_sends (
 id uuid primary key default gen_random_uuid(),
 merchant_id bigint not null,
 cart_id uuid not null references public.abandoned_carts(id),
 status text not null default 'sending' check(status in ('sending','accepted','unknown')),
 provider_message_id text,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(merchant_id,cart_id)
);
alter table public.crm_whatsapp_test_sends enable row level security;
revoke all on public.crm_whatsapp_test_sends from public,anon,authenticated;
grant select,insert,update on public.crm_whatsapp_test_sends to service_role;
create or replace function public.crm_claim_whatsapp_test(p_merchant_id bigint,p_cart_id uuid,p_test_phone text)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare c public.abandoned_carts; send_id uuid;
begin
 if p_merchant_id is distinct from 1829345766 or p_test_phone is null or p_test_phone !~ '^[1-9][0-9]{7,14}$' then raise exception 'Invalid test scope'; end if;
 perform 1 from public.crm_cart_followup_settings where merchant_id=p_merchant_id for update;
 select * into c from public.abandoned_carts where merchant_id=p_merchant_id and id=p_cart_id for update;
 if not found then return jsonb_build_object('blocked','cart_not_found'); end if;
 if regexp_replace(coalesce(nullif(c.normalized_phone,''),c.phone,''),'[^0-9]','','g')<>p_test_phone then return jsonb_build_object('blocked','phone_mismatch'); end if;
 if exists(select 1 from public.crm_whatsapp_optouts where merchant_id=p_merchant_id and phone=p_test_phone) then return jsonb_build_object('blocked','optout'); end if;
 if c.recovered_at is not null or coalesce(c.status,'') not in ('active','contacted') or exists(
  select 1 from public.orders o where o.merchant_id=p_merchant_id and o.customer_id=c.customer_id and o.ordered_at>=c.abandoned_at and coalesce(o.status_slug,'') not in ('canceled','cancelled','refunded')
 ) then return jsonb_build_object('blocked','purchased_or_inactive'); end if;
 -- Salla can reuse a cart created weeks ago; a recent source update qualifies
 -- for this explicit own-number test without changing its creation date.
 if greatest(c.abandoned_at,c.crm_source_at) is null or greatest(c.abandoned_at,c.crm_source_at)<now()-interval '24 hours' or greatest(c.abandoned_at,c.crm_source_at)>now() then return jsonb_build_object('blocked','cart_not_recent'); end if;
 if c.checkout_url is null or c.checkout_url !~ '^https://mtjr[.]at/[A-Za-z0-9_-]+$' then return jsonb_build_object('blocked','unsupported_url'); end if;
 insert into public.crm_whatsapp_test_sends(merchant_id,cart_id) values(p_merchant_id,p_cart_id) on conflict do nothing returning id into send_id;
 if send_id is null then return jsonb_build_object('blocked','already_attempted'); end if;
 return jsonb_build_object('id',send_id,'phone',p_test_phone,'customer_name',coalesce(nullif(c.customer_name,''),'عميل لنك'),'checkout_url',c.checkout_url);
end; $$;
revoke all on function public.crm_claim_whatsapp_test(bigint,uuid,text) from public,anon,authenticated;
grant execute on function public.crm_claim_whatsapp_test(bigint,uuid,text) to service_role;
notify pgrst,'reload schema';
commit;
