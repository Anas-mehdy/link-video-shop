begin;
create table public.crm_cart_human_feedback (
 followup_id uuid primary key references public.crm_cart_human_followups(id),
 merchant_id bigint not null check(merchant_id=1829345766),
 reason text not null check(reason in ('unknown','price','shipping_cost','compatibility','payment','delivery_time','stock','browsing','other')),
 outcome text not null check(outcome in ('awaiting_reply','discussing','resolved','declined','no_reply')),
 note text not null default '' check(char_length(note)<=1000),
 updated_at timestamptz not null default now()
);
alter table public.crm_cart_human_feedback enable row level security;
revoke all on public.crm_cart_human_feedback from public,anon,authenticated;
grant select,insert,update on public.crm_cart_human_feedback to service_role;
commit;
