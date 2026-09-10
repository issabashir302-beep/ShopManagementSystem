-- Per-shop M-Pesa configuration and provider attempts. Secrets are encrypted by
-- the API before storage and are never exposed through PostgREST policies.
create table if not exists public.shop_payment_integrations (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete restrict,
  provider text not null default 'mpesa_daraja',
  preference text not null default 'not_selected',
  environment text not null default 'sandbox',
  shortcode_type text,
  shortcode text,
  store_number text,
  business_name text,
  payment_instructions text,
  consumer_key_encrypted text,
  consumer_secret_encrypted text,
  passkey_encrypted text,
  status text not null default 'not_started',
  last_verified_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (shop_id, provider),
  constraint shop_payment_integrations_provider_check check (provider = 'mpesa_daraja'),
  constraint shop_payment_integrations_preference_check check (preference in ('not_selected','manual','integrated','not_using')),
  constraint shop_payment_integrations_environment_check check (environment in ('sandbox','production')),
  constraint shop_payment_integrations_shortcode_type_check check (shortcode_type is null or shortcode_type in ('till','paybill')),
  constraint shop_payment_integrations_status_check check (status in ('not_started','manual_enabled','credentials_entered','verification_failed','verified','active','disabled'))
);

create table if not exists public.payment_attempts (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete restrict,
  sale_id uuid not null references public.sales(id) on delete restrict,
  payment_id uuid not null references public.payments(id) on delete restrict,
  provider text not null default 'mpesa_daraja',
  amount numeric(14,2) not null,
  phone_number text not null,
  status text not null default 'pending',
  idempotency_key uuid not null,
  merchant_request_id text,
  checkout_request_id text,
  provider_receipt_number text,
  failure_code text,
  failure_message text,
  raw_callback jsonb,
  requested_at timestamptz not null default now(),
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (shop_id, idempotency_key),
  unique (checkout_request_id),
  constraint payment_attempts_provider_check check (provider = 'mpesa_daraja'),
  constraint payment_attempts_status_check check (status in ('pending','processing','completed','failed','cancelled','timed_out')),
  constraint payment_attempts_amount_positive check (amount > 0)
);

create index if not exists payment_attempts_shop_requested_idx on public.payment_attempts(shop_id, requested_at desc);
create index if not exists payment_attempts_sale_idx on public.payment_attempts(sale_id, requested_at desc);

alter table public.shop_payment_integrations enable row level security;
alter table public.payment_attempts enable row level security;
revoke all on public.shop_payment_integrations from anon, authenticated;
revoke all on public.payment_attempts from anon, authenticated;

create or replace function public.process_mpesa_payment_result(
  p_checkout_request_id text,
  p_status text,
  p_receipt_number text,
  p_failure_code text,
  p_failure_message text,
  p_raw_callback jsonb
) returns jsonb language plpgsql security definer set search_path = pg_catalog, public as $function$
declare v_attempt public.payment_attempts%rowtype;
begin
  if p_status not in ('completed','failed','cancelled','timed_out') then raise exception 'Unsupported M-Pesa result'; end if;
  select * into v_attempt from public.payment_attempts where checkout_request_id = p_checkout_request_id for update;
  if not found then return jsonb_build_object('ignored', true, 'reason', 'attempt_not_found'); end if;
  if v_attempt.status in ('completed','failed','cancelled','timed_out') then return jsonb_build_object('duplicate', true, 'attempt_id', v_attempt.id); end if;
  update public.payment_attempts set status=p_status,provider_receipt_number=nullif(p_receipt_number,''),failure_code=nullif(p_failure_code,''),failure_message=nullif(p_failure_message,''),raw_callback=coalesce(p_raw_callback,'{}'::jsonb),completed_at=now(),updated_at=now() where id=v_attempt.id;
  update public.payments set status=case when p_status='completed' then 'completed' else 'failed' end,provider_reference=coalesce(nullif(p_receipt_number,''),provider_reference),metadata=metadata || jsonb_build_object('provider','mpesa_daraja','confirmation','provider'),updated_at=now() where id=v_attempt.payment_id and status='pending';
  update public.sales set payment_status=case when p_status='completed' then 'paid' else 'unpaid' end,updated_at=now() where id=v_attempt.sale_id and payment_status='pending';
  return jsonb_build_object('attempt_id',v_attempt.id,'sale_id',v_attempt.sale_id,'status',p_status);
end;$function$;
revoke all on function public.process_mpesa_payment_result(text,text,text,text,text,jsonb) from public, anon, authenticated;
grant execute on function public.process_mpesa_payment_result(text,text,text,text,text,jsonb) to service_role;

create or replace function public.confirm_manual_mpesa_payment(p_payment_id uuid,p_receipt_number text)
returns jsonb language plpgsql security definer set search_path = pg_catalog, public as $function$
declare v_payment public.payments%rowtype; v_sale public.sales%rowtype;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if nullif(btrim(p_receipt_number),'') is null then raise exception 'Receipt number is required'; end if;
  select p.* into v_payment from public.payments p join public.sales s on s.id=p.sale_id where p.id=p_payment_id and p.method='mpesa' and public.is_shop_member(s.shop_id,auth.uid()) for update of p;
  if not found then raise exception 'Eligible M-Pesa payment was not found'; end if;
  if v_payment.status='completed' then return jsonb_build_object('duplicate',true,'payment_id',v_payment.id); end if;
  update public.payments set status='completed',external_reference=btrim(p_receipt_number),metadata=metadata || jsonb_build_object('confirmation','manual'),updated_at=now() where id=v_payment.id;
  update public.sales set payment_status='paid',updated_at=now() where id=v_payment.sale_id returning * into v_sale;
  return jsonb_build_object('payment_id',v_payment.id,'sale_id',v_sale.id,'status','completed');
end;$function$;
revoke all on function public.confirm_manual_mpesa_payment(uuid,text) from public, anon;
grant execute on function public.confirm_manual_mpesa_payment(uuid,text) to authenticated;
