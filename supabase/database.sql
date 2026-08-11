-- Shopwise POS - authoritative Supabase/PostgreSQL bootstrap
-- Target: a FRESH Supabase project. This is intentionally not an in-place migration.
-- Run with a database-owner role (normally through the Supabase SQL editor or CLI).

begin;

-- 1. Extensions
create extension if not exists pgcrypto with schema extensions;

-- 2. Utility functions
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $function$
begin
  new.updated_at := now();
  return new;
end;
$function$;

-- 3. Core tables
create table public.users (
  id uuid primary key references auth.users(id) on delete restrict,
  full_name text,
  email text,
  phone text,
  username text,
  user_role text not null default 'owner',
  profile_completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint users_full_name_not_blank check (full_name is null or btrim(full_name) <> ''),
  constraint users_email_not_blank check (email is null or btrim(email) <> ''),
  constraint users_phone_not_blank check (phone is null or btrim(phone) <> ''),
  constraint users_username_not_blank check (username is null or btrim(username) <> ''),
  constraint users_role_check check (user_role in ('owner', 'shopkeeper'))
);

comment on table public.users is
  'Application profiles for auth.users. Passwords and credentials remain exclusively in Supabase Auth.';
comment on column public.users.email is
  'Read-model copy of auth.users.email for application display/search. Kept synchronized by an auth.users trigger; auth.users remains authoritative.';

create table public.shops (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.users(id) on delete restrict,
  name text not null,
  type text,
  location text,
  address text,
  city text,
  country text,
  currency text not null default 'KES',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint shops_name_not_blank check (btrim(name) <> ''),
  constraint shops_currency_format check (currency ~ '^[A-Z]{3}$')
);

create table public.shop_memberships (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete restrict,
  user_id uuid not null references public.users(id) on delete restrict,
  role text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint shop_memberships_role_check check (role in ('owner', 'shopkeeper'))
);

comment on table public.shop_memberships is
  'The one authoritative shop-access relationship. Owners also have a membership row. shops.owner_id remains the ownership/legal-control field.';

create table public.products (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete restrict,
  name text not null,
  sku text,
  barcode text,
  category text,
  unit text not null,
  buying_price numeric(14,2) not null default 0,
  selling_price numeric(14,2) not null default 0,
  low_stock_threshold numeric(14,3) not null default 5,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint products_name_not_blank check (btrim(name) <> ''),
  constraint products_sku_not_blank check (sku is null or btrim(sku) <> ''),
  constraint products_barcode_not_blank check (barcode is null or btrim(barcode) <> ''),
  constraint products_unit_not_blank check (btrim(unit) <> ''),
  constraint products_buying_price_nonnegative check (buying_price >= 0),
  constraint products_selling_price_nonnegative check (selling_price >= 0),
  constraint products_low_stock_nonnegative check (low_stock_threshold >= 0)
);

create table public.inventory (
  product_id uuid primary key references public.products(id) on delete restrict,
  quantity numeric(14,3) not null default 0,
  updated_at timestamptz not null default now(),
  constraint inventory_quantity_nonnegative check (quantity >= 0)
);

comment on table public.inventory is
  'Authoritative current stock balance. It may only be changed by trusted database functions/service operations that also write inventory_movements.';

create table public.sales (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete restrict,
  sold_by uuid not null references public.users(id) on delete restrict,
  client_request_id uuid not null,
  receipt_number text not null,
  status text not null default 'completed',
  subtotal numeric(14,2) not null default 0,
  discount_amount numeric(14,2) not null default 0,
  tax_amount numeric(14,2) not null default 0,
  total_amount numeric(14,2) not null default 0,
  payment_status text not null default 'unpaid',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  voided_at timestamptz,
  voided_by uuid references public.users(id) on delete restrict,
  constraint sales_receipt_not_blank check (btrim(receipt_number) <> ''),
  constraint sales_status_check check (status in ('completed', 'voided', 'refunded')),
  constraint sales_payment_status_check check (payment_status in ('unpaid', 'pending', 'paid', 'refunded')),
  constraint sales_subtotal_nonnegative check (subtotal >= 0),
  constraint sales_discount_nonnegative check (discount_amount >= 0),
  constraint sales_tax_nonnegative check (tax_amount >= 0),
  constraint sales_total_nonnegative check (total_amount >= 0),
  constraint sales_discount_within_subtotal check (discount_amount <= subtotal),
  constraint sales_total_formula check (total_amount = subtotal - discount_amount + tax_amount),
  constraint sales_void_fields_check check (
    (status = 'voided' and voided_at is not null and voided_by is not null)
    or (status <> 'voided' and voided_at is null and voided_by is null)
  )
);

create table public.sale_items (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references public.sales(id) on delete restrict,
  product_id uuid references public.products(id) on delete set null,
  product_name text not null,
  product_sku text,
  product_barcode text,
  unit text not null,
  quantity numeric(14,3) not null,
  unit_price numeric(14,2) not null,
  unit_cost numeric(14,2) not null,
  discount_amount numeric(14,2) not null default 0,
  tax_amount numeric(14,2) not null default 0,
  subtotal numeric(14,2) not null,
  created_at timestamptz not null default now(),
  constraint sale_items_product_name_not_blank check (btrim(product_name) <> ''),
  constraint sale_items_unit_not_blank check (btrim(unit) <> ''),
  constraint sale_items_quantity_positive check (quantity > 0),
  constraint sale_items_unit_price_nonnegative check (unit_price >= 0),
  constraint sale_items_unit_cost_nonnegative check (unit_cost >= 0),
  constraint sale_items_discount_nonnegative check (discount_amount >= 0),
  constraint sale_items_tax_nonnegative check (tax_amount >= 0),
  constraint sale_items_subtotal_nonnegative check (subtotal >= 0),
  constraint sale_items_discount_within_line check (discount_amount <= round(quantity * unit_price, 2)),
  constraint sale_items_subtotal_formula check (
    subtotal = round(quantity * unit_price, 2) - discount_amount + tax_amount
  )
);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references public.sales(id) on delete restrict,
  method text not null,
  status text not null default 'pending',
  amount numeric(14,2) not null,
  provider_reference text,
  external_reference text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint payments_method_check check (method in ('cash', 'mpesa', 'card')),
  constraint payments_status_check check (status in ('pending', 'completed', 'failed', 'refunded')),
  constraint payments_amount_positive check (amount > 0),
  constraint payments_metadata_object check (jsonb_typeof(metadata) = 'object'),
  constraint payments_provider_reference_not_blank check (provider_reference is null or btrim(provider_reference) <> ''),
  constraint payments_external_reference_not_blank check (external_reference is null or btrim(external_reference) <> '')
);

create table public.payment_provider_events (
  event_id text primary key,
  provider text not null,
  event_type text not null,
  provider_reference text not null,
  processed_at timestamptz not null default now(),
  constraint payment_provider_events_provider_check check (provider in ('stripe')),
  constraint payment_provider_events_values_not_blank check (
    btrim(event_id) <> '' and btrim(event_type) <> '' and btrim(provider_reference) <> ''
  )
);

comment on table public.payment_provider_events is
  'Trusted webhook idempotency ledger. Ordinary clients receive no privileges.';

create table public.sale_returns (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references public.sales(id) on delete restrict,
  shop_id uuid not null references public.shops(id) on delete restrict,
  created_by uuid not null references public.users(id) on delete restrict,
  return_type text not null,
  status text not null default 'completed',
  reason text not null,
  refund_method text not null,
  refund_status text not null,
  refund_amount numeric(14,2) not null,
  created_at timestamptz not null default now(),
  constraint sale_returns_type_check check (return_type in ('return', 'void')),
  constraint sale_returns_status_check check (status in ('completed')),
  constraint sale_returns_reason_not_blank check (btrim(reason) <> ''),
  constraint sale_returns_refund_method_check check (refund_method in ('cash', 'mpesa', 'card')),
  constraint sale_returns_refund_status_check check (refund_status in ('completed', 'pending')),
  constraint sale_returns_refund_amount_positive check (refund_amount > 0)
);

create table public.sale_return_items (
  id uuid primary key default gen_random_uuid(),
  return_id uuid not null references public.sale_returns(id) on delete restrict,
  sale_item_id uuid not null references public.sale_items(id) on delete restrict,
  product_id uuid not null references public.products(id) on delete restrict,
  quantity numeric(14,3) not null,
  unit_price numeric(14,2) not null,
  refund_amount numeric(14,2) not null,
  created_at timestamptz not null default now(),
  constraint sale_return_items_quantity_positive check (quantity > 0),
  constraint sale_return_items_unit_price_nonnegative check (unit_price >= 0),
  constraint sale_return_items_refund_amount_nonnegative check (refund_amount >= 0),
  constraint sale_return_items_return_sale_item_uq unique (return_id, sale_item_id)
);

comment on table public.sale_returns is
  'Compensating sale events. Original sales, sale items, and payments remain historical records.';

create table public.inventory_movements (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete restrict,
  product_id uuid not null references public.products(id) on delete restrict,
  movement_type text not null,
  quantity_change numeric(14,3) not null,
  quantity_before numeric(14,3) not null,
  quantity_after numeric(14,3) not null,
  reference_type text,
  reference_id uuid,
  reason text,
  created_by uuid references public.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint inventory_movements_type_check check (
    movement_type in ('INITIAL_STOCK', 'SALE', 'RESTOCK', 'RETURN', 'ADJUSTMENT', 'DAMAGE', 'VOID')
  ),
  constraint inventory_movements_nonzero check (quantity_change <> 0),
  constraint inventory_movements_before_nonnegative check (quantity_before >= 0),
  constraint inventory_movements_after_nonnegative check (quantity_after >= 0),
  constraint inventory_movements_balance_check check (quantity_after = quantity_before + quantity_change),
  constraint inventory_movements_reference_type_not_blank check (reference_type is null or btrim(reference_type) <> ''),
  constraint inventory_movements_reason_not_blank check (reason is null or btrim(reason) <> '')
);

comment on table public.inventory_movements is
  'Immutable stock ledger. Ordinary clients receive no INSERT, UPDATE, or DELETE privilege.';

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid references public.shops(id) on delete restrict,
  user_id uuid references public.users(id) on delete restrict,
  action text not null,
  table_name text not null,
  record_id uuid,
  old_values jsonb,
  new_values jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint audit_logs_action_not_blank check (btrim(action) <> ''),
  constraint audit_logs_table_name_not_blank check (btrim(table_name) <> ''),
  constraint audit_logs_old_values_object check (old_values is null or jsonb_typeof(old_values) = 'object'),
  constraint audit_logs_new_values_object check (new_values is null or jsonb_typeof(new_values) = 'object'),
  constraint audit_logs_metadata_object check (jsonb_typeof(metadata) = 'object')
);

create table public.receipt_counters (
  shop_id uuid not null references public.shops(id) on delete restrict,
  receipt_date date not null,
  last_value bigint not null default 0,
  primary key (shop_id, receipt_date),
  constraint receipt_counters_value_positive check (last_value >= 0)
);

create table public.report_deliveries (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete restrict,
  report_type text not null default 'monthly_summary',
  report_month date not null,
  status text not null default 'processing',
  attempts integer not null default 1,
  request_id uuid,
  provider_message_id text,
  last_error text,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint report_deliveries_type_check check (report_type = 'monthly_summary'),
  constraint report_deliveries_month_check check (report_month = date_trunc('month', report_month)::date),
  constraint report_deliveries_status_check check (status in ('processing', 'sent', 'failed')),
  constraint report_deliveries_attempts_positive check (attempts > 0),
  unique (shop_id, report_type, report_month)
);

comment on table public.receipt_counters is
  'Internal shop/day counters used to allocate race-safe receipt numbers. Gaps are acceptable after rolled-back or abandoned transactions.';

-- 4. Indexes
create unique index users_email_active_uq
  on public.users (lower(email))
  where email is not null and deleted_at is null;
create unique index users_username_active_uq
  on public.users (lower(username))
  where username is not null and deleted_at is null;

create index shops_owner_id_idx on public.shops (owner_id) where deleted_at is null;
create unique index shops_one_active_per_owner_uq
  on public.shops (owner_id) where deleted_at is null;

create unique index shop_memberships_active_uq
  on public.shop_memberships (shop_id, user_id)
  where deleted_at is null;
create unique index shop_memberships_one_active_shop_per_user_uq
  on public.shop_memberships (user_id)
  where deleted_at is null and is_active;
create index shop_memberships_user_idx
  on public.shop_memberships (user_id, shop_id)
  where deleted_at is null and is_active;
create index shop_memberships_shop_idx
  on public.shop_memberships (shop_id, role)
  where deleted_at is null and is_active;

create index products_shop_name_idx on public.products (shop_id, lower(name)) where deleted_at is null;
create unique index products_shop_sku_active_uq
  on public.products (shop_id, lower(sku))
  where sku is not null and deleted_at is null;
create unique index products_shop_barcode_active_uq
  on public.products (shop_id, barcode)
  where barcode is not null and deleted_at is null;

create unique index sales_shop_receipt_uq on public.sales (shop_id, receipt_number);
create unique index sales_idempotency_uq on public.sales (shop_id, sold_by, client_request_id);
create index sales_shop_created_idx on public.sales (shop_id, created_at desc);
create index sales_sold_by_created_idx on public.sales (sold_by, created_at desc);

create index sale_items_sale_idx on public.sale_items (sale_id);
create index sale_items_product_idx on public.sale_items (product_id) where product_id is not null;

create index payments_sale_idx on public.payments (sale_id);
create unique index payments_provider_reference_uq
  on public.payments (method, provider_reference)
  where provider_reference is not null;
create unique index payments_external_reference_uq
  on public.payments (external_reference)
  where external_reference is not null;

create unique index sale_returns_one_void_per_sale_uq
  on public.sale_returns (sale_id) where return_type = 'void';
create index sale_returns_sale_created_idx on public.sale_returns (sale_id, created_at);
create index sale_returns_shop_created_idx on public.sale_returns (shop_id, created_at desc);
create index sale_return_items_sale_item_idx on public.sale_return_items (sale_item_id);

create index inventory_movements_shop_created_idx
  on public.inventory_movements (shop_id, created_at desc);
create index inventory_movements_product_created_idx
  on public.inventory_movements (product_id, created_at desc);
create index inventory_movements_reference_idx
  on public.inventory_movements (reference_type, reference_id)
  where reference_id is not null;

create index audit_logs_shop_created_idx on public.audit_logs (shop_id, created_at desc);
create index audit_logs_user_created_idx on public.audit_logs (user_id, created_at desc);
create index audit_logs_record_idx on public.audit_logs (table_name, record_id) where record_id is not null;
create index report_deliveries_status_idx on public.report_deliveries (status, report_month);

-- 5. Authentication/profile synchronization
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  v_role text;
begin
  -- raw_app_meta_data is controlled by trusted Auth administration. Public clients
  -- can edit user_metadata, so user_metadata is intentionally never trusted for roles.
  v_role := case
    when new.raw_app_meta_data ->> 'user_role' = 'shopkeeper' then 'shopkeeper'
    else 'owner'
  end;

  insert into public.users (id, full_name, email, phone, username, user_role, profile_completed)
  values (
    new.id,
    nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''),
    new.email,
    nullif(btrim(new.raw_user_meta_data ->> 'phone'), ''),
    nullif(btrim(new.raw_user_meta_data ->> 'username'), ''),
    v_role,
    false
  )
  on conflict (id) do nothing;

  return new;
end;
$function$;

create or replace function public.sync_auth_user_email()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
begin
  if new.email is distinct from old.email then
    update public.users
      set email = new.email
      where id = new.id;
  end if;
  return new;
end;
$function$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_auth_user();

create trigger on_auth_user_email_changed
after update of email on auth.users
for each row execute function public.sync_auth_user_email();

-- 6. Membership and inventory invariants
create or replace function public.validate_shop_owner()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $function$
begin
  if tg_op = 'UPDATE' and new.owner_id <> old.owner_id then
    raise exception 'Shop ownership cannot be reassigned by an ordinary row update';
  end if;

  if not exists (
    select 1 from public.users u
    where u.id = new.owner_id
      and u.user_role = 'owner'
      and u.deleted_at is null
  ) then
    raise exception 'Shop owner must be an active owner profile';
  end if;

  return new;
end;
$function$;

create trigger validate_shop_owner_before_write
before insert or update of owner_id on public.shops
for each row execute function public.validate_shop_owner();

create or replace function public.validate_shop_membership()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $function$
declare
  v_owner_id uuid;
  v_profile_role text;
begin
  select s.owner_id into v_owner_id
  from public.shops s
  where s.id = new.shop_id and s.deleted_at is null;

  if v_owner_id is null then
    raise exception 'Shop does not exist or is archived';
  end if;

  select u.user_role into v_profile_role
  from public.users u
  where u.id = new.user_id and u.deleted_at is null;

  if v_profile_role is null then
    raise exception 'User profile does not exist or is archived';
  end if;

  if new.role <> v_profile_role then
    raise exception 'Membership role must match the user profile role';
  end if;

  if new.role = 'owner' and new.user_id <> v_owner_id then
    raise exception 'Only shops.owner_id may hold the owner membership';
  end if;

  if new.user_id = v_owner_id and new.role <> 'owner' then
    raise exception 'The shop owner membership must use role owner';
  end if;

  if new.user_id = v_owner_id and (not new.is_active or new.deleted_at is not null) then
    raise exception 'The shop owner membership must remain active';
  end if;

  return new;
end;
$function$;

create trigger validate_shop_membership_before_write
before insert or update on public.shop_memberships
for each row execute function public.validate_shop_membership();

create or replace function public.create_owner_membership()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
begin
  insert into public.shop_memberships (shop_id, user_id, role, is_active)
  values (new.id, new.owner_id, 'owner', true);
  return new;
end;
$function$;

create trigger create_owner_membership_after_shop
after insert on public.shops
for each row execute function public.create_owner_membership();

create or replace function public.create_inventory_balance()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
begin
  insert into public.inventory (product_id, quantity) values (new.id, 0);
  return new;
end;
$function$;

create trigger create_inventory_after_product
after insert on public.products
for each row execute function public.create_inventory_balance();

create or replace function public.prevent_product_shop_change()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $function$
begin
  if new.shop_id <> old.shop_id then
    raise exception 'A product cannot be moved between shops';
  end if;
  return new;
end;
$function$;

create trigger prevent_product_shop_change_before_update
before update of shop_id on public.products
for each row execute function public.prevent_product_shop_change();

create or replace function public.prevent_immutable_ledger_change()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $function$
begin
  raise exception '% is append-only', tg_table_name;
end;
$function$;

create trigger inventory_movements_are_immutable
before update or delete on public.inventory_movements
for each row execute function public.prevent_immutable_ledger_change();

create trigger audit_logs_are_immutable
before update or delete on public.audit_logs
for each row execute function public.prevent_immutable_ledger_change();

-- 7. Updated-at triggers
create trigger users_set_updated_at before update on public.users
for each row execute function public.set_updated_at();
create trigger shops_set_updated_at before update on public.shops
for each row execute function public.set_updated_at();
create trigger shop_memberships_set_updated_at before update on public.shop_memberships
for each row execute function public.set_updated_at();
create trigger products_set_updated_at before update on public.products
for each row execute function public.set_updated_at();
create trigger inventory_set_updated_at before update on public.inventory
for each row execute function public.set_updated_at();
create trigger sales_set_updated_at before update on public.sales
for each row execute function public.set_updated_at();
create trigger payments_set_updated_at before update on public.payments
for each row execute function public.set_updated_at();
create trigger report_deliveries_set_updated_at before update on public.report_deliveries
for each row execute function public.set_updated_at();

-- 8. RLS helper functions. They are SECURITY DEFINER to avoid recursive policies.
create or replace function public.is_shop_owner(p_shop_id uuid, p_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $function$
  select exists (
    select 1
    from public.shops s
    join public.users u on u.id = s.owner_id
    where s.id = p_shop_id
      and s.owner_id = p_user_id
      and s.deleted_at is null
      and u.deleted_at is null
      and u.user_role = 'owner'
  );
$function$;

create or replace function public.is_shop_member(p_shop_id uuid, p_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $function$
  select exists (
    select 1
    from public.shop_memberships m
    join public.users u on u.id = m.user_id
    join public.shops s on s.id = m.shop_id
    where m.shop_id = p_shop_id
      and m.user_id = p_user_id
      and m.is_active
      and m.deleted_at is null
      and u.deleted_at is null
      and s.deleted_at is null
      and m.role = u.user_role
  );
$function$;

create or replace function public.owner_can_access_user(p_target_user_id uuid, p_owner_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $function$
  select exists (
    select 1
    from public.shops s
    join public.shop_memberships m on m.shop_id = s.id
    where s.owner_id = p_owner_id
      and s.deleted_at is null
      and m.user_id = p_target_user_id
      and m.is_active
      and m.deleted_at is null
  );
$function$;

-- 9. Receipt allocation
create or replace function public.next_receipt_number(p_shop_id uuid, p_receipt_date date default current_date)
returns text
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  v_number bigint;
  v_shop_code text;
begin
  if not exists (select 1 from public.shops where id = p_shop_id and deleted_at is null) then
    raise exception 'Shop does not exist or is archived';
  end if;

  insert into public.receipt_counters (shop_id, receipt_date, last_value)
  values (p_shop_id, p_receipt_date, 1)
  on conflict (shop_id, receipt_date)
  do update set last_value = public.receipt_counters.last_value + 1
  returning last_value into v_number;

  v_shop_code := upper(substr(replace(p_shop_id::text, '-', ''), 1, 6));
  return v_shop_code || '-' || to_char(p_receipt_date, 'YYYYMMDD') || '-' || lpad(v_number::text, 6, '0');
end;
$function$;

-- 10. Owner-controlled stock adjustment RPC
create or replace function public.adjust_inventory(
  p_product_id uuid,
  p_quantity_change numeric,
  p_movement_type text,
  p_reason text,
  p_reference_id uuid default null
)
returns public.inventory
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  v_user_id uuid := auth.uid();
  v_shop_id uuid;
  v_before numeric(14,3);
  v_after numeric(14,3);
  v_result public.inventory%rowtype;
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;
  if p_quantity_change is null or p_quantity_change = 0 then raise exception 'Quantity change must be non-zero'; end if;
  if p_movement_type not in ('INITIAL_STOCK', 'RESTOCK', 'RETURN', 'ADJUSTMENT', 'DAMAGE') then
    raise exception 'Unsupported manual movement type';
  end if;
  if p_movement_type in ('INITIAL_STOCK', 'RESTOCK', 'RETURN') and p_quantity_change <= 0 then
    raise exception '% requires a positive quantity change', p_movement_type;
  end if;
  if p_movement_type = 'DAMAGE' and p_quantity_change >= 0 then
    raise exception 'DAMAGE requires a negative quantity change';
  end if;

  select p.shop_id, i.quantity
    into v_shop_id, v_before
  from public.products p
  join public.inventory i on i.product_id = p.id
  where p.id = p_product_id and p.is_active and p.deleted_at is null
  for update of p, i;

  if not found then raise exception 'Product or inventory balance not found'; end if;
  if not public.is_shop_owner(v_shop_id, v_user_id) then raise exception 'Owner access required'; end if;

  if p_movement_type = 'INITIAL_STOCK' and exists (
    select 1 from public.inventory_movements
    where product_id = p_product_id and movement_type = 'INITIAL_STOCK'
  ) then
    raise exception 'Initial stock has already been recorded';
  end if;

  v_after := v_before + p_quantity_change;
  if v_after < 0 then raise exception 'Insufficient stock: balance cannot become negative'; end if;

  update public.inventory set quantity = v_after where product_id = p_product_id
  returning * into v_result;

  insert into public.inventory_movements (
    shop_id, product_id, movement_type, quantity_change, quantity_before,
    quantity_after, reference_type, reference_id, reason, created_by
  ) values (
    v_shop_id, p_product_id, p_movement_type, p_quantity_change, v_before,
    v_after, 'manual_adjustment', p_reference_id, p_reason, v_user_id
  );

  insert into public.audit_logs (shop_id, user_id, action, table_name, record_id, old_values, new_values)
  values (
    v_shop_id, v_user_id, 'INVENTORY_' || p_movement_type, 'inventory', p_product_id,
    jsonb_build_object('quantity', v_before), jsonb_build_object('quantity', v_after)
  );

  return v_result;
end;
$function$;

-- 11. Transactional returns and voids
create or replace function public.void_sale(p_sale_id uuid, p_reason text)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  v_user_id uuid := auth.uid();
  v_sale public.sales%rowtype;
  v_return public.sale_returns%rowtype;
  v_item public.sale_items%rowtype;
  v_payment public.payments%rowtype;
  v_before numeric(14,3);
  v_refund_status text;
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;
  if nullif(btrim(p_reason), '') is null or length(p_reason) > 500 then
    raise exception 'Void reason must be between 1 and 500 characters';
  end if;
  if not exists (
    select 1 from public.users where id = v_user_id and user_role = 'owner' and deleted_at is null
  ) then raise exception 'Only the shop owner can void a sale'; end if;

  select * into v_sale from public.sales where id = p_sale_id for update;
  if not found or not public.is_shop_owner(v_sale.shop_id, v_user_id) then
    raise exception 'Sale was not found';
  end if;
  if v_sale.status = 'voided' then raise exception 'Sale is already voided'; end if;
  if v_sale.status <> 'completed' then raise exception 'Sale is not eligible for void'; end if;
  if exists (select 1 from public.sale_returns where sale_id = v_sale.id) then
    raise exception 'Sale with existing returns is not eligible for void';
  end if;

  select * into v_payment
  from public.payments where sale_id = v_sale.id order by created_at, id limit 1 for update;
  if not found then raise exception 'Sale payment was not found'; end if;
  v_refund_status := case when v_payment.method = 'cash' then 'completed' else 'pending' end;

  insert into public.sale_returns (
    sale_id, shop_id, created_by, return_type, reason, refund_method, refund_status, refund_amount
  ) values (
    v_sale.id, v_sale.shop_id, v_user_id, 'void', btrim(p_reason), v_payment.method,
    v_refund_status, v_sale.total_amount
  ) returning * into v_return;

  for v_item in
    select * from public.sale_items where sale_id = v_sale.id order by product_id, id
  loop
    if v_item.product_id is null then raise exception 'A sold product no longer exists'; end if;
    select quantity into v_before from public.inventory
    where product_id = v_item.product_id for update;
    if not found then raise exception 'Inventory balance was not found'; end if;

    insert into public.sale_return_items (
      return_id, sale_item_id, product_id, quantity, unit_price, refund_amount
    ) values (
      v_return.id, v_item.id, v_item.product_id, v_item.quantity, v_item.unit_price, v_item.subtotal
    );
    update public.inventory set quantity = v_before + v_item.quantity
    where product_id = v_item.product_id;
    insert into public.inventory_movements (
      shop_id, product_id, movement_type, quantity_change, quantity_before, quantity_after,
      reference_type, reference_id, reason, created_by
    ) values (
      v_sale.shop_id, v_item.product_id, 'VOID', v_item.quantity, v_before,
      v_before + v_item.quantity, 'sale_return', v_return.id, btrim(p_reason), v_user_id
    );
  end loop;

  update public.sales set status = 'voided', voided_at = now(), voided_by = v_user_id,
    payment_status = case when v_refund_status = 'completed' then 'refunded' else payment_status end
  where id = v_sale.id;
  if v_refund_status = 'completed' then
    update public.payments set status = 'refunded' where id = v_payment.id;
  end if;
  insert into public.audit_logs (
    shop_id, user_id, action, table_name, record_id, old_values, new_values, metadata
  ) values (
    v_sale.shop_id, v_user_id, 'SALE_VOIDED', 'sales', v_sale.id,
    jsonb_build_object('status', v_sale.status, 'payment_status', v_sale.payment_status),
    jsonb_build_object('status', 'voided', 'refund_status', v_refund_status),
    jsonb_build_object('return_id', v_return.id, 'reason', btrim(p_reason))
  );
  return jsonb_build_object('sale_id', v_sale.id, 'return_id', v_return.id,
    'status', 'voided', 'refund_status', v_refund_status, 'refund_amount', v_sale.total_amount);
end;
$function$;

create or replace function public.create_sale_return(p_sale_id uuid, p_items jsonb, p_reason text)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  v_user_id uuid := auth.uid();
  v_sale public.sales%rowtype;
  v_return public.sale_returns%rowtype;
  v_payment public.payments%rowtype;
  v_line record;
  v_item public.sale_items%rowtype;
  v_before numeric(14,3);
  v_returned numeric(14,3);
  v_refunded_amount numeric(14,2);
  v_amount numeric(14,2) := 0;
  v_line_amount numeric(14,2);
  v_refund_status text;
  v_fully_returned boolean;
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;
  if nullif(btrim(p_reason), '') is null or length(p_reason) > 500 then
    raise exception 'Return reason must be between 1 and 500 characters';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Return items must be a non-empty array';
  end if;
  if not exists (
    select 1 from public.users where id = v_user_id and user_role = 'owner' and deleted_at is null
  ) then raise exception 'Only the shop owner can return a sale'; end if;

  select * into v_sale from public.sales where id = p_sale_id for update;
  if not found or not public.is_shop_owner(v_sale.shop_id, v_user_id) then
    raise exception 'Sale was not found';
  end if;
  if v_sale.status <> 'completed' then raise exception 'Sale is not eligible for return'; end if;

  select * into v_payment
  from public.payments where sale_id = v_sale.id order by created_at, id limit 1 for update;
  if not found then raise exception 'Sale payment was not found'; end if;
  v_refund_status := case when v_payment.method = 'cash' then 'completed' else 'pending' end;

  create temporary table return_lines (
    sale_item_id uuid primary key,
    quantity numeric(14,3) not null
  ) on commit drop;
  begin
    insert into return_lines
    select (entry ->> 'sale_item_id')::uuid, sum((entry ->> 'quantity')::numeric)::numeric(14,3)
    from jsonb_array_elements(p_items) entry
    group by (entry ->> 'sale_item_id')::uuid;
  exception when invalid_text_representation then
    raise exception 'Every return item requires a valid sale item ID and numeric quantity';
  end;
  if exists (select 1 from return_lines where quantity <= 0) then
    raise exception 'Every return quantity must be positive';
  end if;

  for v_line in select * from return_lines order by sale_item_id loop
    select * into v_item from public.sale_items
    where id = v_line.sale_item_id and sale_id = v_sale.id for update;
    if not found or v_item.product_id is null then raise exception 'Return sale item was not found'; end if;
    select coalesce(sum(sri.quantity), 0), coalesce(sum(sri.refund_amount), 0)
      into v_returned, v_refunded_amount
    from public.sale_return_items sri join public.sale_returns sr on sr.id = sri.return_id
    where sr.sale_id = v_sale.id and sri.sale_item_id = v_item.id;
    if v_returned + v_line.quantity > v_item.quantity then
      raise exception 'Return quantity exceeds quantity sold for sale item %', v_item.id;
    end if;
    v_line_amount := case when v_returned + v_line.quantity = v_item.quantity
      then v_item.subtotal - v_refunded_amount
      else round((v_item.subtotal / v_item.quantity) * v_line.quantity, 2) end;
    v_amount := v_amount + v_line_amount;
  end loop;
  if v_amount <= 0 then raise exception 'Return amount must be positive'; end if;

  insert into public.sale_returns (
    sale_id, shop_id, created_by, return_type, reason, refund_method, refund_status, refund_amount
  ) values (
    v_sale.id, v_sale.shop_id, v_user_id, 'return', btrim(p_reason), v_payment.method,
    v_refund_status, v_amount
  ) returning * into v_return;

  for v_line in select * from return_lines order by sale_item_id loop
    select * into v_item from public.sale_items where id = v_line.sale_item_id;
    select quantity into v_before from public.inventory where product_id = v_item.product_id for update;
    if not found then raise exception 'Inventory balance was not found'; end if;
    select coalesce(sum(sri.quantity), 0), coalesce(sum(sri.refund_amount), 0)
      into v_returned, v_refunded_amount
    from public.sale_return_items sri join public.sale_returns sr on sr.id = sri.return_id
    where sr.sale_id = v_sale.id and sri.sale_item_id = v_item.id;
    v_line_amount := case when v_returned + v_line.quantity = v_item.quantity
      then v_item.subtotal - v_refunded_amount
      else round((v_item.subtotal / v_item.quantity) * v_line.quantity, 2) end;
    insert into public.sale_return_items (
      return_id, sale_item_id, product_id, quantity, unit_price, refund_amount
    ) values (
      v_return.id, v_item.id, v_item.product_id, v_line.quantity, v_item.unit_price, v_line_amount
    );
    update public.inventory set quantity = v_before + v_line.quantity where product_id = v_item.product_id;
    insert into public.inventory_movements (
      shop_id, product_id, movement_type, quantity_change, quantity_before, quantity_after,
      reference_type, reference_id, reason, created_by
    ) values (
      v_sale.shop_id, v_item.product_id, 'RETURN', v_line.quantity, v_before,
      v_before + v_line.quantity, 'sale_return', v_return.id, btrim(p_reason), v_user_id
    );
  end loop;

  select not exists (
    select 1 from public.sale_items si where si.sale_id = v_sale.id and
      coalesce((select sum(sri.quantity) from public.sale_return_items sri
        join public.sale_returns sr on sr.id = sri.return_id
        where sr.sale_id = v_sale.id and sri.sale_item_id = si.id), 0) < si.quantity
  ) into v_fully_returned;
  if v_fully_returned then
    update public.sales set status = 'refunded',
      payment_status = case when v_refund_status = 'completed' then 'refunded' else payment_status end
    where id = v_sale.id;
    if v_refund_status = 'completed' then
      update public.payments set status = 'refunded' where id = v_payment.id;
    end if;
  end if;
  insert into public.audit_logs (
    shop_id, user_id, action, table_name, record_id, new_values, metadata
  ) values (
    v_sale.shop_id, v_user_id, 'SALE_RETURNED', 'sale_returns', v_return.id,
    jsonb_build_object('refund_status', v_refund_status, 'refund_amount', v_amount),
    jsonb_build_object('sale_id', v_sale.id, 'full_return', v_fully_returned, 'reason', btrim(p_reason))
  );
  return jsonb_build_object('sale_id', v_sale.id, 'return_id', v_return.id,
    'sale_status', case when v_fully_returned then 'refunded' else 'completed' end,
    'refund_status', v_refund_status, 'refund_amount', v_amount);
end;
$function$;

-- 11a. Atomic and idempotent checkout RPC
-- Contract:
-- sale_data = {
--   "shop_id": "uuid", "client_request_id": "uuid",
--   "payment_method": "cash|mpesa|card", "provider_reference": null|string,
--   "external_reference": null|string, "payment_metadata": {}
-- }
-- items = [{"product_id":"uuid", "quantity":1.000}, ...]
create or replace function public.create_sale_with_items(sale_data jsonb, items jsonb)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  v_user_id uuid := auth.uid();
  v_shop_id uuid;
  v_client_request_id uuid;
  v_payment_method text;
  v_provider_reference text;
  v_external_reference text;
  v_payment_metadata jsonb;
  v_existing public.sales%rowtype;
  v_sale public.sales%rowtype;
  v_receipt_number text;
  v_subtotal numeric(14,2) := 0;
  v_total numeric(14,2) := 0;
  v_line record;
  v_product_name text;
  v_product_sku text;
  v_product_barcode text;
  v_product_unit text;
  v_unit_cost numeric(14,2);
  v_unit_price numeric(14,2);
  v_before numeric(14,3);
  v_after numeric(14,3);
  v_line_subtotal numeric(14,2);
  v_payment_status text;
  v_sale_payment_status text;
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;
  if sale_data is null or jsonb_typeof(sale_data) <> 'object' then raise exception 'sale_data must be a JSON object'; end if;
  if items is null or jsonb_typeof(items) <> 'array' or jsonb_array_length(items) = 0 then
    raise exception 'items must be a non-empty JSON array';
  end if;

  begin
    v_shop_id := (sale_data ->> 'shop_id')::uuid;
    v_client_request_id := (sale_data ->> 'client_request_id')::uuid;
  exception when invalid_text_representation then
    raise exception 'shop_id and client_request_id must be valid UUIDs';
  end;

  if v_shop_id is null then raise exception 'shop_id is required'; end if;
  if v_client_request_id is null then raise exception 'client_request_id is required for idempotency'; end if;
  if not public.is_shop_member(v_shop_id, v_user_id) then raise exception 'Active shop membership required'; end if;

  v_payment_method := lower(coalesce(nullif(btrim(sale_data ->> 'payment_method'), ''), 'cash'));
  if v_payment_method not in ('cash', 'mpesa', 'card') then raise exception 'Unsupported payment method'; end if;
  v_provider_reference := nullif(btrim(sale_data ->> 'provider_reference'), '');
  v_external_reference := nullif(btrim(sale_data ->> 'external_reference'), '');
  v_payment_metadata := coalesce(sale_data -> 'payment_metadata', '{}'::jsonb);
  if jsonb_typeof(v_payment_metadata) <> 'object' then raise exception 'payment_metadata must be a JSON object'; end if;

  if exists (
    select 1
    from jsonb_array_elements(items) as entry
    where jsonb_typeof(entry) <> 'object'
       or nullif(entry ->> 'product_id', '') is null
       or nullif(entry ->> 'quantity', '') is null
       or (entry ->> 'quantity')::numeric <= 0
  ) then
    raise exception 'Every raw sale item requires a product_id and positive quantity';
  end if;

  -- Serialize retries for the same idempotency key before checking/inserting.
  perform pg_advisory_xact_lock(
    hashtextextended(v_shop_id::text || ':' || v_user_id::text || ':' || v_client_request_id::text, 0)
  );

  select * into v_existing
  from public.sales
  where shop_id = v_shop_id
    and sold_by = v_user_id
    and client_request_id = v_client_request_id;

  if found then
    return jsonb_build_object(
      'sale_id', v_existing.id,
      'receipt_number', v_existing.receipt_number,
      'status', v_existing.status,
      'payment_status', v_existing.payment_status,
      'total_amount', v_existing.total_amount,
      'idempotent_replay', true
    );
  end if;

  -- Lock products and balances in deterministic product-id order. Duplicate item
  -- rows are aggregated before validation, preventing double deduction ambiguity.
  for v_line in
    select (entry ->> 'product_id')::uuid as product_id,
           sum((entry ->> 'quantity')::numeric)::numeric(14,3) as quantity
    from jsonb_array_elements(items) as entry
    group by (entry ->> 'product_id')::uuid
    order by (entry ->> 'product_id')::uuid
  loop
    if v_line.product_id is null or v_line.quantity is null or v_line.quantity <= 0 then
      raise exception 'Every sale item requires a product_id and positive quantity';
    end if;

    select p.name, p.sku, p.barcode, p.unit, p.buying_price, p.selling_price, i.quantity
      into v_product_name, v_product_sku, v_product_barcode, v_product_unit,
           v_unit_cost, v_unit_price, v_before
    from public.products p
    join public.inventory i on i.product_id = p.id
    where p.id = v_line.product_id
      and p.shop_id = v_shop_id
      and p.is_active
      and p.deleted_at is null
    for update of p, i;

    if not found then raise exception 'Product % is unavailable for this shop', v_line.product_id; end if;
    if v_before < v_line.quantity then
      raise exception 'Insufficient stock for product % (available %, requested %)',
        v_product_name, v_before, v_line.quantity;
    end if;

    v_line_subtotal := round(v_line.quantity * v_unit_price, 2);
    v_subtotal := v_subtotal + v_line_subtotal;
  end loop;

  v_total := v_subtotal; -- Discounts/taxes remain zero until authoritative rules are introduced.
  if v_total <= 0 then raise exception 'Sale total must be positive'; end if;

  v_receipt_number := public.next_receipt_number(v_shop_id, current_date);
  v_payment_status := case when v_payment_method = 'cash' then 'completed' else 'pending' end;
  v_sale_payment_status := case when v_payment_method = 'cash' then 'paid' else 'pending' end;

  insert into public.sales (
    shop_id, sold_by, client_request_id, receipt_number, status,
    subtotal, discount_amount, tax_amount, total_amount, payment_status
  ) values (
    v_shop_id, v_user_id, v_client_request_id, v_receipt_number, 'completed',
    v_subtotal, 0, 0, v_total, v_sale_payment_status
  ) returning * into v_sale;

  for v_line in
    select (entry ->> 'product_id')::uuid as product_id,
           sum((entry ->> 'quantity')::numeric)::numeric(14,3) as quantity
    from jsonb_array_elements(items) as entry
    group by (entry ->> 'product_id')::uuid
    order by (entry ->> 'product_id')::uuid
  loop
    select p.name, p.sku, p.barcode, p.unit, p.buying_price, p.selling_price, i.quantity
      into v_product_name, v_product_sku, v_product_barcode, v_product_unit,
           v_unit_cost, v_unit_price, v_before
    from public.products p
    join public.inventory i on i.product_id = p.id
    where p.id = v_line.product_id;

    v_after := v_before - v_line.quantity;
    v_line_subtotal := round(v_line.quantity * v_unit_price, 2);

    insert into public.sale_items (
      sale_id, product_id, product_name, product_sku, product_barcode, unit,
      quantity, unit_price, unit_cost, discount_amount, tax_amount, subtotal
    ) values (
      v_sale.id, v_line.product_id, v_product_name, v_product_sku, v_product_barcode,
      v_product_unit, v_line.quantity, v_unit_price, v_unit_cost, 0, 0, v_line_subtotal
    );

    update public.inventory set quantity = v_after where product_id = v_line.product_id;

    insert into public.inventory_movements (
      shop_id, product_id, movement_type, quantity_change, quantity_before,
      quantity_after, reference_type, reference_id, reason, created_by
    ) values (
      v_shop_id, v_line.product_id, 'SALE', -v_line.quantity, v_before,
      v_after, 'sale', v_sale.id, 'POS checkout', v_user_id
    );
  end loop;

  insert into public.payments (
    sale_id, method, status, amount, provider_reference,
    external_reference, metadata
  ) values (
    v_sale.id, v_payment_method, v_payment_status, v_total, v_provider_reference,
    v_external_reference, v_payment_metadata
  );

  insert into public.audit_logs (shop_id, user_id, action, table_name, record_id, new_values)
  values (
    v_shop_id, v_user_id, 'SALE_COMPLETED', 'sales', v_sale.id,
    jsonb_build_object(
      'receipt_number', v_sale.receipt_number,
      'total_amount', v_sale.total_amount,
      'payment_method', v_payment_method,
      'payment_status', v_sale.payment_status
    )
  );

  return jsonb_build_object(
    'sale_id', v_sale.id,
    'receipt_number', v_sale.receipt_number,
    'status', v_sale.status,
    'payment_status', v_sale.payment_status,
    'subtotal', v_sale.subtotal,
    'discount_amount', v_sale.discount_amount,
    'tax_amount', v_sale.tax_amount,
    'total_amount', v_sale.total_amount,
    'idempotent_replay', false
  );
exception
  when invalid_text_representation then
    raise exception 'Each product_id must be a UUID and each quantity must be numeric';
end;
$function$;

comment on function public.create_sale_with_items(jsonb, jsonb) is
  'Atomic POS checkout. Locks product/inventory rows, derives database prices, prevents overselling, snapshots items, records payment and ledger movements, and supports idempotent retries.';

-- 11a. Stripe intent attachment and trusted webhook transitions
create or replace function public.attach_stripe_payment_intent(
  p_payment_id uuid,
  p_provider_reference text
)
returns public.payments
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  v_user_id uuid := auth.uid();
  v_payment public.payments%rowtype;
  v_shop_id uuid;
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;
  if nullif(btrim(p_provider_reference), '') is null then raise exception 'Stripe PaymentIntent reference is required'; end if;

  select p.* into v_payment
  from public.payments p
  where p.id = p_payment_id
  for update;

  if not found then raise exception 'Card payment was not found'; end if;
  select s.shop_id into v_shop_id from public.sales s where s.id = v_payment.sale_id;
  if not found or not public.is_shop_member(v_shop_id, v_user_id) then
    raise exception 'Card payment was not found';
  end if;
  if v_payment.method <> 'card' then raise exception 'Payment method is not card'; end if;
  if v_payment.status not in ('pending', 'failed') then raise exception 'Payment is not eligible for Stripe'; end if;
  if v_payment.provider_reference is not null and v_payment.provider_reference <> p_provider_reference then
    raise exception 'A different Stripe PaymentIntent is already attached';
  end if;

  update public.payments
    set provider_reference = p_provider_reference,
        metadata = metadata || jsonb_build_object('provider', 'stripe')
    where id = p_payment_id
    returning * into v_payment;
  return v_payment;
end;
$function$;

create or replace function public.process_stripe_payment_event(
  p_event_id text,
  p_provider_reference text,
  p_payment_status text,
  p_amount_minor bigint,
  p_currency text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  v_payment public.payments%rowtype;
  v_sale public.sales%rowtype;
  v_currency text;
  v_expected_minor bigint;
begin
  if nullif(btrim(p_event_id), '') is null or nullif(btrim(p_provider_reference), '') is null then
    raise exception 'Stripe event identifiers are required';
  end if;
  if p_payment_status not in ('completed', 'failed') then raise exception 'Unsupported Stripe payment transition'; end if;

  insert into public.payment_provider_events (event_id, provider, event_type, provider_reference)
  values (p_event_id, 'stripe', p_payment_status, p_provider_reference)
  on conflict (event_id) do nothing;
  if not found then return jsonb_build_object('duplicate', true); end if;

  select p.* into v_payment
  from public.payments p
  where p.method = 'card' and p.provider_reference = p_provider_reference
  for update;
  if not found then raise exception 'Stripe payment reference was not found'; end if;

  select s.* into v_sale from public.sales s where s.id = v_payment.sale_id for update;
  if not found then raise exception 'Stripe sale was not found'; end if;

  select upper(currency) into v_currency from public.shops where id = v_sale.shop_id;
  v_expected_minor := case
    when v_currency in ('BIF','CLP','DJF','GNF','JPY','KMF','KRW','MGA','PYG','RWF','UGX','VND','VUV','XAF','XOF','XPF')
      then round(v_payment.amount)::bigint
    when v_currency in ('BHD','JOD','KWD','OMR','TND')
      then round(v_payment.amount * 1000)::bigint
    else round(v_payment.amount * 100)::bigint
  end;
  if lower(v_currency) <> lower(p_currency) or v_expected_minor <> p_amount_minor then
    raise exception 'Stripe payment amount or currency does not match';
  end if;

  -- Stripe does not guarantee webhook delivery order. Never let a late failure
  -- event downgrade a payment that a verified success event already completed.
  if v_payment.status = 'completed' and p_payment_status = 'failed' then
    return jsonb_build_object('duplicate', false, 'ignored', true,
      'payment_id', v_payment.id, 'sale_id', v_sale.id);
  end if;

  update public.payments set status = p_payment_status where id = v_payment.id;
  update public.sales set payment_status = case when p_payment_status = 'completed' then 'paid' else 'unpaid' end
    where id = v_sale.id;
  insert into public.audit_logs (shop_id, user_id, action, table_name, record_id, new_values, metadata)
  values (v_sale.shop_id, null,
    case when p_payment_status = 'completed' then 'PAYMENT_COMPLETED' else 'PAYMENT_FAILED' end,
    'payments', v_payment.id, jsonb_build_object('status', p_payment_status),
    jsonb_build_object('provider', 'stripe', 'event_id', p_event_id, 'provider_reference', p_provider_reference));
  return jsonb_build_object('duplicate', false, 'payment_id', v_payment.id, 'sale_id', v_sale.id);
end;
$function$;

-- 12. Focused audit triggers
create or replace function public.audit_product_change()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  v_action text;
begin
  v_action := case when tg_op = 'INSERT' then 'PRODUCT_CREATED' else 'PRODUCT_UPDATED' end;
  insert into public.audit_logs (shop_id, user_id, action, table_name, record_id, old_values, new_values)
  values (
    new.shop_id, auth.uid(), v_action, 'products', new.id,
    case when tg_op = 'UPDATE' then to_jsonb(old) else null end,
    to_jsonb(new)
  );
  return new;
end;
$function$;

create trigger audit_products_after_write
after insert or update on public.products
for each row execute function public.audit_product_change();

create or replace function public.audit_membership_change()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  v_row public.shop_memberships%rowtype;
begin
  if tg_op = 'DELETE' then
    v_row := old;
  else
    v_row := new;
  end if;
  insert into public.audit_logs (shop_id, user_id, action, table_name, record_id, old_values, new_values)
  values (
    v_row.shop_id,
    auth.uid(),
    'SHOP_MEMBERSHIP_' || tg_op,
    'shop_memberships',
    v_row.id,
    case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) else null end,
    case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) else null end
  );
  return v_row;
end;
$function$;

create trigger audit_memberships_after_write
after insert or update or delete on public.shop_memberships
for each row execute function public.audit_membership_change();

-- 13. Shop-safe views. security_invoker makes underlying RLS apply to the caller.
create view public.low_stock_alerts
with (security_invoker = true)
as
select
  p.shop_id,
  p.id as product_id,
  p.name,
  p.sku,
  p.barcode,
  p.unit,
  i.quantity,
  p.low_stock_threshold,
  i.updated_at
from public.products p
join public.inventory i on i.product_id = p.id
where p.is_active
  and p.deleted_at is null
  and i.quantity <= p.low_stock_threshold;

create view public.daily_sales_summary
with (security_invoker = true)
as
select
  s.shop_id,
  (s.created_at at time zone 'UTC')::date as sale_date,
  count(*) filter (where s.status = 'completed')::bigint as sales_count,
  coalesce(sum(s.subtotal) filter (where s.status = 'completed'), 0)::numeric(14,2) as gross_sales,
  coalesce(sum(s.discount_amount) filter (where s.status = 'completed'), 0)::numeric(14,2) as discounts,
  coalesce(sum(s.tax_amount) filter (where s.status = 'completed'), 0)::numeric(14,2) as tax,
  coalesce(sum(s.total_amount) filter (where s.status = 'completed'), 0)::numeric(14,2) as net_sales
from public.sales s
group by s.shop_id, (s.created_at at time zone 'UTC')::date;

comment on view public.daily_sales_summary is
  'UTC daily aggregation of persisted completed sales. The application may apply the shop timezone in a later reporting layer.';

create or replace function public.get_shop_report(p_shop_id uuid, p_start timestamptz, p_end timestamptz)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare v_result jsonb;
begin
  if p_start >= p_end then raise exception 'Invalid report period'; end if;
  if auth.uid() is not null and not public.is_shop_owner(p_shop_id, auth.uid()) then raise exception 'Owner access required' using errcode = '42501'; end if;
  if not exists (select 1 from public.shops where id = p_shop_id and deleted_at is null) then raise exception 'Shop not found'; end if;
  with included_sales as (
    select * from public.sales where shop_id = p_shop_id and status = 'completed' and created_at >= p_start and created_at < p_end
  ), returned_items as (
    select sri.sale_item_id, sum(sri.quantity)::numeric(14,3) quantity,
      sum(sri.refund_amount)::numeric(14,2) refund_amount
    from public.sale_return_items sri join public.sale_returns sr on sr.id=sri.return_id
    join included_sales s on s.id=sr.sale_id group by sri.sale_item_id
  ), included_items as (
    select i.*, (i.quantity-coalesce(r.quantity,0))::numeric(14,3) net_quantity,
      (i.subtotal-coalesce(r.refund_amount,0))::numeric(14,2) net_subtotal
    from public.sale_items i join included_sales s on s.id=i.sale_id
    left join returned_items r on r.sale_item_id=i.id
    where i.quantity-coalesce(r.quantity,0)>0
  ), totals as (
    select count(distinct sale_id)::bigint transactions,
      coalesce(sum(net_subtotal),0)::numeric(14,2) total_sales,
      coalesce(sum(net_subtotal),0)::numeric(14,2) gross_revenue,
      0::numeric(14,2) total_discounts, 0::numeric(14,2) total_tax from included_items
  ), profit as (
    select coalesce(sum(net_subtotal - (net_quantity * unit_cost)),0)::numeric(14,2) gross_profit from included_items
  ), product_rows as (
    select product_id, product_name name, product_sku sku, sum(net_quantity)::numeric(14,3) quantity_sold,
      sum(net_subtotal)::numeric(14,2) sales, sum(net_subtotal - (net_quantity * unit_cost))::numeric(14,2) gross_profit
    from included_items group by product_id, product_name, product_sku order by quantity_sold desc, sales desc limit 20
  ), payment_rows as (
    select p.method, sum(p.amount-coalesce(r.refunded,0))::numeric(14,2) amount, count(*)::bigint payments
    from public.payments p join included_sales s on s.id=p.sale_id
    left join (select sale_id,sum(refund_amount) refunded from public.sale_returns group by sale_id) r on r.sale_id=s.id
    where p.status in ('completed','refunded') group by p.method order by p.method
  ), keeper_rows as (
    select s.sold_by user_id, coalesce(u.full_name,u.email,'Unknown') name,
      count(distinct s.id)::bigint transactions, sum(i.net_subtotal)::numeric(14,2) sales
    from included_sales s join included_items i on i.sale_id=s.id join public.users u on u.id=s.sold_by
    group by s.sold_by,u.full_name,u.email order by sales desc
  ), inventory_totals as (
    select count(*)::bigint products, coalesce(sum(i.quantity),0)::numeric(14,3) units_on_hand,
      coalesce(sum(i.quantity*p.buying_price),0)::numeric(14,2) cost_value,
      count(*) filter (where i.quantity <= p.low_stock_threshold)::bigint low_stock_count
    from public.products p join public.inventory i on i.product_id=p.id where p.shop_id=p_shop_id and p.deleted_at is null and p.is_active
  ), low_rows as (
    select p.id product_id,p.name,p.sku,i.quantity,p.low_stock_threshold threshold
    from public.products p join public.inventory i on i.product_id=p.id where p.shop_id=p_shop_id and p.deleted_at is null and p.is_active and i.quantity <= p.low_stock_threshold
    order by (i.quantity-p.low_stock_threshold),p.name limit 50
  )
  select jsonb_build_object(
    'totals', jsonb_build_object('transactions',t.transactions,'totalSales',t.total_sales,'grossRevenue',t.gross_revenue,'totalDiscounts',t.total_discounts,'totalTax',t.total_tax,'grossProfit',pr.gross_profit),
    'topProducts',coalesce((select jsonb_agg(jsonb_build_object('productId',product_id,'name',name,'sku',sku,'quantitySold',quantity_sold,'sales',sales,'grossProfit',gross_profit)) from product_rows),'[]'::jsonb),
    'paymentMethods',coalesce((select jsonb_agg(jsonb_build_object('method',method,'amount',amount,'payments',payments)) from payment_rows),'[]'::jsonb),
    'salesByShopkeeper',coalesce((select jsonb_agg(jsonb_build_object('userId',user_id,'name',name,'transactions',transactions,'sales',sales)) from keeper_rows),'[]'::jsonb),
    'inventory',jsonb_build_object('products',iv.products,'unitsOnHand',iv.units_on_hand,'costValue',iv.cost_value,'lowStockCount',iv.low_stock_count),
    'lowStockProducts',coalesce((select jsonb_agg(jsonb_build_object('productId',product_id,'name',name,'sku',sku,'quantity',quantity,'threshold',threshold)) from low_rows),'[]'::jsonb)
  ) into v_result from totals t cross join profit pr cross join inventory_totals iv;
  return v_result;
end;
$function$;

create or replace function public.claim_report_delivery(p_shop_id uuid, p_report_month date, p_request_id uuid)
returns setof public.report_deliveries
language plpgsql security definer set search_path = pg_catalog, public
as $function$
begin
  return query insert into public.report_deliveries(shop_id,report_month,request_id) values(p_shop_id,date_trunc('month',p_report_month)::date,p_request_id)
  on conflict (shop_id,report_type,report_month) do update set status='processing',attempts=report_deliveries.attempts+1,request_id=excluded.request_id,last_error=null
  where report_deliveries.status='failed'
     or (report_deliveries.status='processing' and report_deliveries.updated_at < now() - interval '30 minutes')
  returning *;
end;
$function$;

-- 14. Row-level security
alter table public.users enable row level security;
alter table public.shops enable row level security;
alter table public.shop_memberships enable row level security;
alter table public.products enable row level security;
alter table public.inventory enable row level security;
alter table public.sales enable row level security;
alter table public.sale_items enable row level security;
alter table public.payments enable row level security;
alter table public.payment_provider_events enable row level security;
alter table public.sale_returns enable row level security;
alter table public.sale_return_items enable row level security;
alter table public.inventory_movements enable row level security;
alter table public.report_deliveries enable row level security;
alter table public.audit_logs enable row level security;
alter table public.receipt_counters enable row level security;

create policy users_select_self_or_owned_staff on public.users
for select to authenticated
using (id = auth.uid() or public.owner_can_access_user(id, auth.uid()));

create policy users_update_self on public.users
for update to authenticated
using (id = auth.uid() and deleted_at is null)
with check (id = auth.uid() and deleted_at is null);

create policy shops_select_member on public.shops
for select to authenticated
using (public.is_shop_member(id, auth.uid()));
create policy shops_insert_owner on public.shops
for insert to authenticated
with check (owner_id = auth.uid() and exists (
  select 1 from public.users u
  where u.id = auth.uid() and u.user_role = 'owner' and u.deleted_at is null
));
create policy shops_update_owner on public.shops
for update to authenticated
using (public.is_shop_owner(id, auth.uid()))
with check (public.is_shop_owner(id, auth.uid()) and owner_id = auth.uid());

create policy memberships_select_shop_member on public.shop_memberships
for select to authenticated
using (public.is_shop_member(shop_id, auth.uid()));
create policy memberships_insert_owner on public.shop_memberships
for insert to authenticated
with check (public.is_shop_owner(shop_id, auth.uid()) and role = 'shopkeeper');
create policy memberships_update_owner on public.shop_memberships
for update to authenticated
using (public.is_shop_owner(shop_id, auth.uid()) and role = 'shopkeeper')
with check (public.is_shop_owner(shop_id, auth.uid()) and role = 'shopkeeper');
create policy memberships_delete_owner on public.shop_memberships
for delete to authenticated
using (public.is_shop_owner(shop_id, auth.uid()) and role = 'shopkeeper');

create policy products_select_member on public.products
for select to authenticated
using (public.is_shop_member(shop_id, auth.uid()));
create policy products_insert_owner on public.products
for insert to authenticated
with check (public.is_shop_owner(shop_id, auth.uid()));
create policy products_update_owner on public.products
for update to authenticated
using (public.is_shop_owner(shop_id, auth.uid()))
with check (public.is_shop_owner(shop_id, auth.uid()));

create policy inventory_select_member on public.inventory
for select to authenticated
using (exists (
  select 1 from public.products p
  where p.id = inventory.product_id and public.is_shop_member(p.shop_id, auth.uid())
));

create policy sales_select_member on public.sales
for select to authenticated
using (public.is_shop_member(shop_id, auth.uid()));

create policy sale_items_select_member on public.sale_items
for select to authenticated
using (exists (
  select 1 from public.sales s
  where s.id = sale_items.sale_id and public.is_shop_member(s.shop_id, auth.uid())
));

create policy payments_select_member on public.payments
for select to authenticated
using (exists (
  select 1 from public.sales s
  where s.id = payments.sale_id and public.is_shop_member(s.shop_id, auth.uid())
));

create policy sale_returns_select_owner on public.sale_returns
for select to authenticated
using (public.is_shop_owner(shop_id, auth.uid()));

create policy sale_return_items_select_owner on public.sale_return_items
for select to authenticated
using (exists (
  select 1 from public.sale_returns sr
  where sr.id = sale_return_items.return_id and public.is_shop_owner(sr.shop_id, auth.uid())
));

create policy inventory_movements_select_member on public.inventory_movements
for select to authenticated
using (public.is_shop_member(shop_id, auth.uid()));

create policy audit_logs_select_owner on public.audit_logs
for select to authenticated
using (shop_id is not null and public.is_shop_owner(shop_id, auth.uid()));

-- No authenticated policies are intentionally defined for direct inventory writes,
-- financial writes, audit-log writes, or receipt counters. Trusted RPCs perform them.

-- 15. Explicit grants
revoke all on table public.users, public.shops, public.shop_memberships,
  public.products, public.inventory, public.sales, public.sale_items,
  public.payments, public.payment_provider_events, public.sale_returns, public.sale_return_items,
  public.inventory_movements, public.audit_logs,
  public.receipt_counters, public.low_stock_alerts, public.daily_sales_summary
  , public.report_deliveries
  from anon, authenticated;

revoke all on function public.set_updated_at(),
  public.handle_new_auth_user(), public.sync_auth_user_email(),
  public.validate_shop_owner(), public.validate_shop_membership(), public.create_owner_membership(),
  public.create_inventory_balance(), public.prevent_product_shop_change(),
  public.prevent_immutable_ledger_change(), public.is_shop_owner(uuid, uuid),
  public.is_shop_member(uuid, uuid), public.owner_can_access_user(uuid, uuid),
  public.next_receipt_number(uuid, date),
  public.adjust_inventory(uuid, numeric, text, text, uuid),
  public.void_sale(uuid, text), public.create_sale_return(uuid, jsonb, text),
  public.create_sale_with_items(jsonb, jsonb),
  public.attach_stripe_payment_intent(uuid, text),
  public.process_stripe_payment_event(text, text, text, bigint, text), public.audit_product_change(),
  public.audit_membership_change(), public.get_shop_report(uuid,timestamptz,timestamptz),
  public.claim_report_delivery(uuid,date,uuid)
  from public, anon, authenticated;

grant select on public.users, public.shops, public.shop_memberships, public.products,
  public.inventory, public.sales, public.sale_items, public.payments,
  public.sale_returns, public.sale_return_items, public.inventory_movements, public.audit_logs
  to authenticated;
grant insert, update on public.shops to authenticated;
grant insert, update, delete on public.shop_memberships to authenticated;
grant insert, update on public.products to authenticated;

-- Column-level profile updates prevent a user from changing user_role, email,
-- identity, or lifecycle columns through the Data API.
grant update (full_name, phone, username, profile_completed) on public.users to authenticated;

grant select on public.low_stock_alerts, public.daily_sales_summary to authenticated;
grant execute on function public.get_shop_report(uuid,timestamptz,timestamptz) to authenticated, service_role;
grant execute on function public.claim_report_delivery(uuid,date,uuid) to service_role;

grant execute on function public.is_shop_owner(uuid, uuid) to authenticated;
grant execute on function public.is_shop_member(uuid, uuid) to authenticated;
grant execute on function public.owner_can_access_user(uuid, uuid) to authenticated;
grant execute on function public.adjust_inventory(uuid, numeric, text, text, uuid) to authenticated;
grant execute on function public.create_sale_with_items(jsonb, jsonb) to authenticated;
grant execute on function public.void_sale(uuid, text) to authenticated;
grant execute on function public.create_sale_return(uuid, jsonb, text) to authenticated;
grant execute on function public.attach_stripe_payment_intent(uuid, text) to authenticated;
grant execute on function public.process_stripe_payment_event(text, text, text, bigint, text) to service_role;

-- Internal functions are deliberately not granted to client roles.

commit;
