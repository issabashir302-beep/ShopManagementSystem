begin;

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
  constraint sale_returns_type_check check (return_type in ('return','void')),
  constraint sale_returns_status_check check (status in ('completed')),
  constraint sale_returns_reason_not_blank check (btrim(reason) <> ''),
  constraint sale_returns_refund_method_check check (refund_method in ('cash','mpesa','card')),
  constraint sale_returns_refund_status_check check (refund_status in ('completed','pending')),
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
  constraint sale_return_items_return_sale_item_uq unique (return_id,sale_item_id)
);
comment on table public.sale_returns is 'Compensating sale events. Original sales, sale items, and payments remain historical records.';
create unique index sale_returns_one_void_per_sale_uq on public.sale_returns(sale_id) where return_type='void';
create index sale_returns_sale_created_idx on public.sale_returns(sale_id,created_at);
create index sale_returns_shop_created_idx on public.sale_returns(shop_id,created_at desc);
create index sale_return_items_sale_item_idx on public.sale_return_items(sale_item_id);

create or replace function public.void_sale(p_sale_id uuid,p_reason text)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $function$
declare
  v_user_id uuid:=auth.uid(); v_sale public.sales%rowtype; v_return public.sale_returns%rowtype;
  v_item public.sale_items%rowtype; v_payment public.payments%rowtype;
  v_before numeric(14,3); v_refund_status text;
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;
  if nullif(btrim(p_reason),'') is null or length(p_reason)>500 then raise exception 'Void reason must be between 1 and 500 characters'; end if;
  if not exists(select 1 from public.users where id=v_user_id and user_role='owner' and deleted_at is null) then raise exception 'Only the shop owner can void a sale'; end if;
  select * into v_sale from public.sales where id=p_sale_id for update;
  if not found or not public.is_shop_owner(v_sale.shop_id,v_user_id) then raise exception 'Sale was not found'; end if;
  if v_sale.status='voided' then raise exception 'Sale is already voided'; end if;
  if v_sale.status<>'completed' then raise exception 'Sale is not eligible for void'; end if;
  if exists(select 1 from public.sale_returns where sale_id=v_sale.id) then raise exception 'Sale with existing returns is not eligible for void'; end if;
  select * into v_payment from public.payments where sale_id=v_sale.id order by created_at,id limit 1 for update;
  if not found then raise exception 'Sale payment was not found'; end if;
  v_refund_status:=case when v_payment.method='cash' then 'completed' else 'pending' end;
  insert into public.sale_returns(sale_id,shop_id,created_by,return_type,reason,refund_method,refund_status,refund_amount)
  values(v_sale.id,v_sale.shop_id,v_user_id,'void',btrim(p_reason),v_payment.method,v_refund_status,v_sale.total_amount)
  returning * into v_return;
  for v_item in select * from public.sale_items where sale_id=v_sale.id order by product_id,id loop
    if v_item.product_id is null then raise exception 'A sold product no longer exists'; end if;
    select quantity into v_before from public.inventory where product_id=v_item.product_id for update;
    if not found then raise exception 'Inventory balance was not found'; end if;
    insert into public.sale_return_items(return_id,sale_item_id,product_id,quantity,unit_price,refund_amount)
    values(v_return.id,v_item.id,v_item.product_id,v_item.quantity,v_item.unit_price,v_item.subtotal);
    update public.inventory set quantity=v_before+v_item.quantity where product_id=v_item.product_id;
    insert into public.inventory_movements(shop_id,product_id,movement_type,quantity_change,quantity_before,quantity_after,reference_type,reference_id,reason,created_by)
    values(v_sale.shop_id,v_item.product_id,'VOID',v_item.quantity,v_before,v_before+v_item.quantity,'sale_return',v_return.id,btrim(p_reason),v_user_id);
  end loop;
  update public.sales set status='voided',voided_at=now(),voided_by=v_user_id,
    payment_status=case when v_refund_status='completed' then 'refunded' else payment_status end where id=v_sale.id;
  if v_refund_status='completed' then update public.payments set status='refunded' where id=v_payment.id; end if;
  insert into public.audit_logs(shop_id,user_id,action,table_name,record_id,old_values,new_values,metadata)
  values(v_sale.shop_id,v_user_id,'SALE_VOIDED','sales',v_sale.id,
    jsonb_build_object('status',v_sale.status,'payment_status',v_sale.payment_status),
    jsonb_build_object('status','voided','refund_status',v_refund_status),
    jsonb_build_object('return_id',v_return.id,'reason',btrim(p_reason)));
  return jsonb_build_object('sale_id',v_sale.id,'return_id',v_return.id,'status','voided',
    'refund_status',v_refund_status,'refund_amount',v_sale.total_amount);
end;$function$;

create or replace function public.create_sale_return(p_sale_id uuid,p_items jsonb,p_reason text)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $function$
declare
  v_user_id uuid:=auth.uid(); v_sale public.sales%rowtype; v_return public.sale_returns%rowtype;
  v_payment public.payments%rowtype; v_line record; v_item public.sale_items%rowtype;
  v_before numeric(14,3); v_returned numeric(14,3); v_refunded_amount numeric(14,2); v_amount numeric(14,2):=0;
  v_line_amount numeric(14,2); v_refund_status text; v_fully_returned boolean;
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;
  if nullif(btrim(p_reason),'') is null or length(p_reason)>500 then raise exception 'Return reason must be between 1 and 500 characters'; end if;
  if p_items is null or jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items)=0 then raise exception 'Return items must be a non-empty array'; end if;
  if not exists(select 1 from public.users where id=v_user_id and user_role='owner' and deleted_at is null) then raise exception 'Only the shop owner can return a sale'; end if;
  select * into v_sale from public.sales where id=p_sale_id for update;
  if not found or not public.is_shop_owner(v_sale.shop_id,v_user_id) then raise exception 'Sale was not found'; end if;
  if v_sale.status<>'completed' then raise exception 'Sale is not eligible for return'; end if;
  select * into v_payment from public.payments where sale_id=v_sale.id order by created_at,id limit 1 for update;
  if not found then raise exception 'Sale payment was not found'; end if;
  v_refund_status:=case when v_payment.method='cash' then 'completed' else 'pending' end;
  create temporary table return_lines(sale_item_id uuid primary key,quantity numeric(14,3) not null) on commit drop;
  begin
    insert into return_lines select (entry->>'sale_item_id')::uuid,sum((entry->>'quantity')::numeric)::numeric(14,3)
    from jsonb_array_elements(p_items) entry group by (entry->>'sale_item_id')::uuid;
  exception when invalid_text_representation then raise exception 'Every return item requires a valid sale item ID and numeric quantity'; end;
  if exists(select 1 from return_lines where quantity<=0) then raise exception 'Every return quantity must be positive'; end if;
  for v_line in select * from return_lines order by sale_item_id loop
    select * into v_item from public.sale_items where id=v_line.sale_item_id and sale_id=v_sale.id for update;
    if not found or v_item.product_id is null then raise exception 'Return sale item was not found'; end if;
    select coalesce(sum(sri.quantity),0),coalesce(sum(sri.refund_amount),0) into v_returned,v_refunded_amount from public.sale_return_items sri
      join public.sale_returns sr on sr.id=sri.return_id where sr.sale_id=v_sale.id and sri.sale_item_id=v_item.id;
    if v_returned+v_line.quantity>v_item.quantity then raise exception 'Return quantity exceeds quantity sold for sale item %',v_item.id; end if;
    v_line_amount:=case when v_returned+v_line.quantity=v_item.quantity then v_item.subtotal-v_refunded_amount
      else round((v_item.subtotal/v_item.quantity)*v_line.quantity,2) end;
    v_amount:=v_amount+v_line_amount;
  end loop;
  if v_amount<=0 then raise exception 'Return amount must be positive'; end if;
  insert into public.sale_returns(sale_id,shop_id,created_by,return_type,reason,refund_method,refund_status,refund_amount)
  values(v_sale.id,v_sale.shop_id,v_user_id,'return',btrim(p_reason),v_payment.method,v_refund_status,v_amount) returning * into v_return;
  for v_line in select * from return_lines order by sale_item_id loop
    select * into v_item from public.sale_items where id=v_line.sale_item_id;
    select quantity into v_before from public.inventory where product_id=v_item.product_id for update;
    if not found then raise exception 'Inventory balance was not found'; end if;
    select coalesce(sum(sri.quantity),0),coalesce(sum(sri.refund_amount),0) into v_returned,v_refunded_amount
      from public.sale_return_items sri join public.sale_returns sr on sr.id=sri.return_id
      where sr.sale_id=v_sale.id and sri.sale_item_id=v_item.id;
    v_line_amount:=case when v_returned+v_line.quantity=v_item.quantity then v_item.subtotal-v_refunded_amount
      else round((v_item.subtotal/v_item.quantity)*v_line.quantity,2) end;
    insert into public.sale_return_items(return_id,sale_item_id,product_id,quantity,unit_price,refund_amount)
    values(v_return.id,v_item.id,v_item.product_id,v_line.quantity,v_item.unit_price,v_line_amount);
    update public.inventory set quantity=v_before+v_line.quantity where product_id=v_item.product_id;
    insert into public.inventory_movements(shop_id,product_id,movement_type,quantity_change,quantity_before,quantity_after,reference_type,reference_id,reason,created_by)
    values(v_sale.shop_id,v_item.product_id,'RETURN',v_line.quantity,v_before,v_before+v_line.quantity,'sale_return',v_return.id,btrim(p_reason),v_user_id);
  end loop;
  select not exists(select 1 from public.sale_items si where si.sale_id=v_sale.id and
    coalesce((select sum(sri.quantity) from public.sale_return_items sri join public.sale_returns sr on sr.id=sri.return_id
      where sr.sale_id=v_sale.id and sri.sale_item_id=si.id),0)<si.quantity) into v_fully_returned;
  if v_fully_returned then
    update public.sales set status='refunded',payment_status=case when v_refund_status='completed' then 'refunded' else payment_status end where id=v_sale.id;
    if v_refund_status='completed' then update public.payments set status='refunded' where id=v_payment.id; end if;
  end if;
  insert into public.audit_logs(shop_id,user_id,action,table_name,record_id,new_values,metadata)
  values(v_sale.shop_id,v_user_id,'SALE_RETURNED','sale_returns',v_return.id,
    jsonb_build_object('refund_status',v_refund_status,'refund_amount',v_amount),
    jsonb_build_object('sale_id',v_sale.id,'full_return',v_fully_returned,'reason',btrim(p_reason)));
  return jsonb_build_object('sale_id',v_sale.id,'return_id',v_return.id,
    'sale_status',case when v_fully_returned then 'refunded' else 'completed' end,
    'refund_status',v_refund_status,'refund_amount',v_amount);
end;$function$;

alter table public.sale_returns enable row level security;
alter table public.sale_return_items enable row level security;
create policy sale_returns_select_owner on public.sale_returns for select to authenticated
using(public.is_shop_owner(shop_id,auth.uid()));
create policy sale_return_items_select_owner on public.sale_return_items for select to authenticated
using(exists(select 1 from public.sale_returns sr where sr.id=sale_return_items.return_id and public.is_shop_owner(sr.shop_id,auth.uid())));
revoke all on public.sale_returns,public.sale_return_items from anon,authenticated;
grant select on public.sale_returns,public.sale_return_items to authenticated;
revoke all on function public.void_sale(uuid,text),public.create_sale_return(uuid,jsonb,text) from public,anon,authenticated;
grant execute on function public.void_sale(uuid,text),public.create_sale_return(uuid,jsonb,text) to authenticated;

commit;
