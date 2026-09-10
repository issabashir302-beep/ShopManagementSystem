begin;

create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete restrict,
  category text not null,
  description text not null,
  amount numeric(14,2) not null,
  expense_date date not null,
  payment_method text not null,
  reference text,
  notes text,
  recorded_by uuid not null references public.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint expenses_category_check check (category in ('rent','utilities','transport','salaries','supplies','maintenance','marketing','taxes','other')),
  constraint expenses_description_not_blank check (btrim(description) <> ''),
  constraint expenses_amount_positive check (amount > 0),
  constraint expenses_payment_method_check check (payment_method in ('cash','mpesa','card','bank','other')),
  constraint expenses_reference_not_blank check (reference is null or btrim(reference) <> ''),
  constraint expenses_notes_not_blank check (notes is null or btrim(notes) <> '')
);
comment on table public.expenses is 'Owner-managed operating costs. Inventory purchases should not be duplicated here when already represented by cost of goods sold.';
create index expenses_shop_date_idx on public.expenses(shop_id, expense_date desc) where deleted_at is null;
create trigger expenses_set_updated_at before update on public.expenses for each row execute function public.set_updated_at();
alter table public.expenses enable row level security;
create policy expenses_select_owner on public.expenses for select to authenticated using (public.is_shop_owner(shop_id, auth.uid()));
create policy expenses_insert_owner on public.expenses for insert to authenticated with check (public.is_shop_owner(shop_id, auth.uid()) and recorded_by = auth.uid());
create policy expenses_update_owner on public.expenses for update to authenticated using (public.is_shop_owner(shop_id, auth.uid())) with check (public.is_shop_owner(shop_id, auth.uid()) and recorded_by = auth.uid());
grant select, insert, update on public.expenses to authenticated;

create or replace function public.audit_expense_change()
returns trigger language plpgsql security definer set search_path=pg_catalog,public as $function$
begin
  insert into public.audit_logs(shop_id,user_id,action,table_name,record_id,old_values,new_values)
  values(coalesce(new.shop_id,old.shop_id),auth.uid(),case when tg_op='INSERT' then 'EXPENSE_CREATED' when new.deleted_at is not null and old.deleted_at is null then 'EXPENSE_VOIDED' else 'EXPENSE_UPDATED' end,'expenses',coalesce(new.id,old.id),case when tg_op='UPDATE' then to_jsonb(old) end,to_jsonb(new));
  return new;
end;$function$;
create trigger expenses_audit after insert or update on public.expenses for each row execute function public.audit_expense_change();

create or replace function public.get_shop_report(p_shop_id uuid,p_start timestamptz,p_end timestamptz)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $function$
declare v_result jsonb;
begin
  if p_start>=p_end then raise exception 'Invalid report period'; end if;
  if auth.uid() is not null and not public.is_shop_owner(p_shop_id,auth.uid()) then raise exception 'Owner access required' using errcode='42501'; end if;
  with included_sales as (select * from public.sales where shop_id=p_shop_id and status='completed' and created_at>=p_start and created_at<p_end),
  returned_items as (select sri.sale_item_id,sum(sri.quantity)::numeric(14,3) quantity,sum(sri.refund_amount)::numeric(14,2) refund_amount from public.sale_return_items sri join public.sale_returns sr on sr.id=sri.return_id join included_sales s on s.id=sr.sale_id group by sri.sale_item_id),
  included_items as (select i.*,(i.quantity-coalesce(r.quantity,0))::numeric(14,3) net_quantity,(i.subtotal-coalesce(r.refund_amount,0))::numeric(14,2) net_subtotal from public.sale_items i join included_sales s on s.id=i.sale_id left join returned_items r on r.sale_item_id=i.id where i.quantity-coalesce(r.quantity,0)>0),
  totals as (select count(distinct sale_id)::bigint transactions,coalesce(sum(net_subtotal),0)::numeric(14,2) total_sales,coalesce(sum(net_subtotal),0)::numeric(14,2) gross_revenue,0::numeric(14,2) total_discounts,0::numeric(14,2) total_tax from included_items),
  profit as (select coalesce(sum(net_subtotal-(net_quantity*unit_cost)),0)::numeric(14,2) gross_profit from included_items),
  expense_totals as (select coalesce(sum(amount),0)::numeric(14,2) operating_expenses from public.expenses where shop_id=p_shop_id and deleted_at is null and expense_date >= (p_start at time zone 'UTC')::date and expense_date < (p_end at time zone 'UTC')::date),
  expense_rows as (select category,sum(amount)::numeric(14,2) amount,count(*)::bigint expenses from public.expenses where shop_id=p_shop_id and deleted_at is null and expense_date >= (p_start at time zone 'UTC')::date and expense_date < (p_end at time zone 'UTC')::date group by category order by amount desc),
  product_rows as (select product_id,product_name name,product_sku sku,sum(net_quantity)::numeric(14,3) quantity_sold,sum(net_subtotal)::numeric(14,2) sales,sum(net_subtotal-(net_quantity*unit_cost))::numeric(14,2) gross_profit from included_items group by product_id,product_name,product_sku order by quantity_sold desc,sales desc limit 20),
  payment_rows as (select p.method,sum(p.amount-coalesce(r.refunded,0))::numeric(14,2) amount,count(*)::bigint payments from public.payments p join included_sales s on s.id=p.sale_id left join(select sale_id,sum(refund_amount) refunded from public.sale_returns group by sale_id) r on r.sale_id=s.id where p.status in ('completed','refunded') group by p.method order by p.method),
  keeper_rows as (select s.sold_by user_id,coalesce(u.full_name,u.email,'Unknown') name,count(distinct s.id)::bigint transactions,sum(i.net_subtotal)::numeric(14,2) sales from included_sales s join included_items i on i.sale_id=s.id join public.users u on u.id=s.sold_by group by s.sold_by,u.full_name,u.email order by sales desc),
  inventory_totals as (select count(*)::bigint products,coalesce(sum(i.quantity),0)::numeric(14,3) units_on_hand,coalesce(sum(i.quantity*p.buying_price),0)::numeric(14,2) cost_value,count(*) filter(where i.quantity<=p.low_stock_threshold)::bigint low_stock_count from public.products p join public.inventory i on i.product_id=p.id where p.shop_id=p_shop_id and p.deleted_at is null and p.is_active),
  low_rows as (select p.id product_id,p.name,p.sku,i.quantity,p.low_stock_threshold threshold from public.products p join public.inventory i on i.product_id=p.id where p.shop_id=p_shop_id and p.deleted_at is null and p.is_active and i.quantity<=p.low_stock_threshold order by(i.quantity-p.low_stock_threshold),p.name limit 50)
  select jsonb_build_object(
    'totals',jsonb_build_object('transactions',t.transactions,'totalSales',t.total_sales,'grossRevenue',t.gross_revenue,'totalDiscounts',t.total_discounts,'totalTax',t.total_tax,'grossProfit',pr.gross_profit,'operatingExpenses',et.operating_expenses,'netOperatingProfit',(pr.gross_profit-et.operating_expenses)::numeric(14,2)),
    'expensesByCategory',coalesce((select jsonb_agg(jsonb_build_object('category',category,'amount',amount,'expenses',expenses)) from expense_rows),'[]'::jsonb),
    'topProducts',coalesce((select jsonb_agg(jsonb_build_object('productId',product_id,'name',name,'sku',sku,'quantitySold',quantity_sold,'sales',sales,'grossProfit',gross_profit)) from product_rows),'[]'::jsonb),
    'paymentMethods',coalesce((select jsonb_agg(jsonb_build_object('method',method,'amount',amount,'payments',payments)) from payment_rows),'[]'::jsonb),
    'salesByShopkeeper',coalesce((select jsonb_agg(jsonb_build_object('userId',user_id,'name',name,'transactions',transactions,'sales',sales)) from keeper_rows),'[]'::jsonb),
    'inventory',jsonb_build_object('products',iv.products,'unitsOnHand',iv.units_on_hand,'costValue',iv.cost_value,'lowStockCount',iv.low_stock_count),
    'lowStockProducts',coalesce((select jsonb_agg(jsonb_build_object('productId',product_id,'name',name,'sku',sku,'quantity',quantity,'threshold',threshold)) from low_rows),'[]'::jsonb)
  ) into v_result from totals t cross join profit pr cross join expense_totals et cross join inventory_totals iv;
  return v_result;
end;$function$;
revoke all on function public.get_shop_report(uuid,timestamptz,timestamptz) from public,anon,authenticated;
grant execute on function public.get_shop_report(uuid,timestamptz,timestamptz) to authenticated,service_role;
commit;
