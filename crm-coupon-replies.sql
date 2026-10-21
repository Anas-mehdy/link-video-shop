begin;
create table if not exists public.crm_coupon_settings (
 merchant_id bigint primary key references public.stores(merchant_id),
 enabled boolean not null default false,
 started_at timestamptz not null default now(),
 message text not null check(char_length(message) between 20 and 2000),
 updated_at timestamptz not null default now()
);
create table if not exists public.crm_coupon_conversations (
 merchant_id bigint not null references public.stores(merchant_id),
 conversation_id text not null check(conversation_id ~ '^[1-9][0-9]{0,15}$'),
 paused boolean not null default false,
 primary key(merchant_id,conversation_id)
);
create table if not exists public.crm_coupon_replies (
 id uuid primary key default gen_random_uuid(),
 merchant_id bigint not null references public.stores(merchant_id),
 incoming_message_id text not null,
 conversation_id text not null,
 phone text not null check(phone ~ '^[1-9][0-9]{7,14}$'),
 status text not null check(status in ('sending','accepted','unknown','skipped')),
 reason text not null,
 provider_message_id text,
 created_at timestamptz not null default now(),
 unique(merchant_id,incoming_message_id)
);
create index if not exists crm_coupon_recent_phone on public.crm_coupon_replies(merchant_id,phone,created_at desc);
alter table public.crm_coupon_settings enable row level security;
alter table public.crm_coupon_conversations enable row level security;
alter table public.crm_coupon_replies enable row level security;
revoke all on public.crm_coupon_settings,public.crm_coupon_conversations,public.crm_coupon_replies from public,anon,authenticated;
grant select,insert,update on public.crm_coupon_settings,public.crm_coupon_conversations,public.crm_coupon_replies to service_role;
create or replace function public.crm_claim_coupon_reply(p_merchant_id bigint,p_message_id text,p_conversation_id text,p_phone text,p_occurred_at timestamptz,p_kind text)
returns jsonb language plpgsql security invoker set search_path=public,pg_temp as $$
declare s public.crm_coupon_settings; r public.crm_coupon_replies; why text;
begin
 if p_message_id !~ '^[1-9][0-9]{0,19}$' or p_conversation_id !~ '^[1-9][0-9]{0,15}$' or p_phone !~ '^[1-9][0-9]{7,14}$' or p_kind not in ('request','problem') then raise exception 'invalid coupon claim'; end if;
 perform pg_advisory_xact_lock(hashtextextended('coupon:'||p_merchant_id||':'||p_phone,0));
 if exists(select 1 from crm_coupon_replies where merchant_id=p_merchant_id and incoming_message_id=p_message_id) then return jsonb_build_object('skip','duplicate'); end if;
 select * into s from crm_coupon_settings where merchant_id=p_merchant_id for share;
 if s.merchant_id is null or not s.enabled then return jsonb_build_object('skip','disabled'); end if;
 if p_occurred_at is null or p_occurred_at<s.started_at or p_occurred_at<now()-interval '10 minutes' or p_occurred_at>now()+interval '1 minute' then return jsonb_build_object('skip','stale'); end if;
 why:=case when p_kind='problem' then 'needs_agent'
 when exists(select 1 from crm_coupon_conversations where merchant_id=p_merchant_id and conversation_id=p_conversation_id and paused) then 'conversation_paused'
 when exists(select 1 from crm_whatsapp_optouts where merchant_id=p_merchant_id and phone=p_phone) then 'optout'
 when exists(select 1 from crm_coupon_replies where merchant_id=p_merchant_id and phone=p_phone and status in ('sending','accepted','unknown') and created_at>now()-interval '24 hours') then 'cooldown'
 else 'provider_request' end;
 insert into crm_coupon_replies(merchant_id,incoming_message_id,conversation_id,phone,status,reason)
 values(p_merchant_id,p_message_id,p_conversation_id,p_phone,case when why='provider_request' then 'sending' else 'skipped' end,why) returning * into r;
 if why<>'provider_request' then return jsonb_build_object('skip',why); end if;
 return jsonb_build_object('id',r.id,'message',s.message);
end $$;
revoke all on function public.crm_claim_coupon_reply(bigint,text,text,text,timestamptz,text) from public,anon,authenticated;
grant execute on function public.crm_claim_coupon_reply(bigint,text,text,text,timestamptz,text) to service_role;
commit;
