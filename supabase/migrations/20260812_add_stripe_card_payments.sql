begin;

alter table public.payments drop constraint payments_method_check;
alter table public.payments add constraint payments_method_check check (method in ('cash', 'mpesa', 'card'));

create table public.payment_provider_events (
  event_id text primary key,
  provider text not null check (provider in ('stripe')),
  event_type text not null,
  provider_reference text not null,
  processed_at timestamptz not null default now(),
  constraint payment_provider_events_values_not_blank check (
    btrim(event_id) <> '' and btrim(event_type) <> '' and btrim(provider_reference) <> ''
  )
);
comment on table public.payment_provider_events is 'Trusted webhook idempotency ledger. Ordinary clients receive no privileges.';
alter table public.payment_provider_events enable row level security;
revoke all on public.payment_provider_events from anon, authenticated;

-- Preserve the installed checkout body while extending its exact method guard.
-- Abort instead of committing a partial migration if the expected definition differs.
do $migration$
declare v_definition text;
begin
  select pg_get_functiondef('public.create_sale_with_items(jsonb,jsonb)'::regprocedure) into v_definition;
  if strpos(v_definition, $needle$v_payment_method not in ('cash', 'mpesa')$needle$) = 0 then
    raise exception 'Unexpected create_sale_with_items definition; apply the reviewed database.sql definition manually';
  end if;
  v_definition := replace(v_definition,
    $needle$v_payment_method not in ('cash', 'mpesa')$needle$,
    $replacement$v_payment_method not in ('cash', 'mpesa', 'card')$replacement$);
  execute v_definition;
end;
$migration$;

create or replace function public.attach_stripe_payment_intent(p_payment_id uuid, p_provider_reference text)
returns public.payments language plpgsql security definer set search_path = pg_catalog, public as $function$
declare v_user_id uuid := auth.uid(); v_payment public.payments%rowtype; v_shop_id uuid;
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;
  if nullif(btrim(p_provider_reference), '') is null then raise exception 'Stripe PaymentIntent reference is required'; end if;
  select p, s.shop_id into v_payment, v_shop_id from public.payments p join public.sales s on s.id=p.sale_id
    where p.id=p_payment_id for update of p;
  if not found or not public.is_shop_member(v_shop_id,v_user_id) then raise exception 'Card payment was not found'; end if;
  if v_payment.method <> 'card' then raise exception 'Payment method is not card'; end if;
  if v_payment.status not in ('pending','failed') then raise exception 'Payment is not eligible for Stripe'; end if;
  if v_payment.provider_reference is not null and v_payment.provider_reference <> p_provider_reference then
    raise exception 'A different Stripe PaymentIntent is already attached';
  end if;
  update public.payments set provider_reference=p_provider_reference,
    metadata=metadata||jsonb_build_object('provider','stripe') where id=p_payment_id returning * into v_payment;
  return v_payment;
end;$function$;

create or replace function public.process_stripe_payment_event(p_event_id text,p_provider_reference text,p_payment_status text,p_amount_minor bigint,p_currency text)
returns jsonb language plpgsql security definer set search_path = pg_catalog, public as $function$
declare v_payment public.payments%rowtype; v_sale public.sales%rowtype; v_currency text; v_expected_minor bigint;
begin
  if nullif(btrim(p_event_id),'') is null or nullif(btrim(p_provider_reference),'') is null then raise exception 'Stripe event identifiers are required'; end if;
  if p_payment_status not in ('completed','failed') then raise exception 'Unsupported Stripe payment transition'; end if;
  insert into public.payment_provider_events(event_id,provider,event_type,provider_reference)
    values(p_event_id,'stripe',p_payment_status,p_provider_reference) on conflict(event_id) do nothing;
  if not found then return jsonb_build_object('duplicate',true); end if;
  select p,s into v_payment,v_sale from public.payments p join public.sales s on s.id=p.sale_id
    where p.method='card' and p.provider_reference=p_provider_reference for update of p,s;
  if not found then raise exception 'Stripe payment reference was not found'; end if;
  select upper(currency) into v_currency from public.shops where id=v_sale.shop_id;
  v_expected_minor:=case when v_currency in ('BIF','CLP','DJF','GNF','JPY','KMF','KRW','MGA','PYG','RWF','UGX','VND','VUV','XAF','XOF','XPF') then round(v_payment.amount)::bigint
    when v_currency in ('BHD','JOD','KWD','OMR','TND') then round(v_payment.amount*1000)::bigint else round(v_payment.amount*100)::bigint end;
  if lower(v_currency)<>lower(p_currency) or v_expected_minor<>p_amount_minor then raise exception 'Stripe payment amount or currency does not match'; end if;
  if v_payment.status='completed' and p_payment_status='failed' then
    return jsonb_build_object('duplicate',false,'ignored',true,'payment_id',v_payment.id,'sale_id',v_sale.id);
  end if;
  update public.payments set status=p_payment_status where id=v_payment.id;
  update public.sales set payment_status=case when p_payment_status='completed' then 'paid' else 'unpaid' end where id=v_sale.id;
  insert into public.audit_logs(shop_id,user_id,action,table_name,record_id,new_values,metadata)
    values(v_sale.shop_id,null,case when p_payment_status='completed' then 'PAYMENT_COMPLETED' else 'PAYMENT_FAILED' end,
      'payments',v_payment.id,jsonb_build_object('status',p_payment_status),jsonb_build_object('provider','stripe','event_id',p_event_id,'provider_reference',p_provider_reference));
  return jsonb_build_object('duplicate',false,'payment_id',v_payment.id,'sale_id',v_sale.id);
end;$function$;

revoke all on function public.attach_stripe_payment_intent(uuid,text), public.process_stripe_payment_event(text,text,text,bigint,text) from public,anon,authenticated;
grant execute on function public.attach_stripe_payment_intent(uuid,text) to authenticated;
grant execute on function public.process_stripe_payment_event(text,text,text,bigint,text) to service_role;

commit;
