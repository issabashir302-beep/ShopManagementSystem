begin;

create or replace function public.get_shop_report(p_shop_id uuid,p_start timestamptz,p_end timestamptz)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $function$
declare v_result jsonb;
begin
  if p_start>=p_end then raise exception 'Invalid report period'; end if;
  if auth.uid() is not null and not public.is_shop_owner(p_shop_id,auth.uid()) then raise exception 'Owner access required' using errcode='42501'; end if;
  if not exists(select 1 from public.shops where id=p_shop_id and deleted_at is null) then raise exception 'Shop not found'; end if;
  with included_sales as (
    select * from public.sales where shop_id=p_shop_id and status='completed' and created_at>=p_start and created_at<p_end
  ), returned_items as (
    select sri.sale_item_id,sum(sri.quantity)::numeric(14,3) quantity,sum(sri.refund_amount)::numeric(14,2) refund_amount
    from public.sale_return_items sri join public.sale_returns sr on sr.id=sri.return_id
    join included_sales s on s.id=sr.sale_id group by sri.sale_item_id
  ), included_items as (
    select i.*,(i.quantity-coalesce(r.quantity,0))::numeric(14,3) net_quantity,
      (i.subtotal-coalesce(r.refund_amount,0))::numeric(14,2) net_subtotal
    from public.sale_items i join included_sales s on s.id=i.sale_id
    left join returned_items r on r.sale_item_id=i.id where i.quantity-coalesce(r.quantity,0)>0
  ), totals as (
    select count(distinct sale_id)::bigint transactions,coalesce(sum(net_subtotal),0)::numeric(14,2) total_sales,
      coalesce(sum(net_subtotal),0)::numeric(14,2) gross_revenue,0::numeric(14,2) total_discounts,
      0::numeric(14,2) total_tax from included_items
  ), profit as (
    select coalesce(sum(net_subtotal-(net_quantity*unit_cost)),0)::numeric(14,2) gross_profit from included_items
  ), product_rows as (
    select product_id,product_name name,product_sku sku,sum(net_quantity)::numeric(14,3) quantity_sold,
      sum(net_subtotal)::numeric(14,2) sales,sum(net_subtotal-(net_quantity*unit_cost))::numeric(14,2) gross_profit
    from included_items group by product_id,product_name,product_sku order by quantity_sold desc,sales desc limit 20
  ), payment_rows as (
    select p.method,sum(p.amount-coalesce(r.refunded,0))::numeric(14,2) amount,count(*)::bigint payments
    from public.payments p join included_sales s on s.id=p.sale_id
    left join(select sale_id,sum(refund_amount) refunded from public.sale_returns group by sale_id) r on r.sale_id=s.id
    where p.status in ('completed','refunded') group by p.method order by p.method
  ), keeper_rows as (
    select s.sold_by user_id,coalesce(u.full_name,u.email,'Unknown') name,count(distinct s.id)::bigint transactions,
      sum(i.net_subtotal)::numeric(14,2) sales from included_sales s join included_items i on i.sale_id=s.id
    join public.users u on u.id=s.sold_by group by s.sold_by,u.full_name,u.email order by sales desc
  ), inventory_totals as (
    select count(*)::bigint products,coalesce(sum(i.quantity),0)::numeric(14,3) units_on_hand,
      coalesce(sum(i.quantity*p.buying_price),0)::numeric(14,2) cost_value,
      count(*) filter(where i.quantity<=p.low_stock_threshold)::bigint low_stock_count
    from public.products p join public.inventory i on i.product_id=p.id
    where p.shop_id=p_shop_id and p.deleted_at is null and p.is_active
  ), low_rows as (
    select p.id product_id,p.name,p.sku,i.quantity,p.low_stock_threshold threshold
    from public.products p join public.inventory i on i.product_id=p.id
    where p.shop_id=p_shop_id and p.deleted_at is null and p.is_active and i.quantity<=p.low_stock_threshold
    order by(i.quantity-p.low_stock_threshold),p.name limit 50
  )
  select jsonb_build_object(
    'totals',jsonb_build_object('transactions',t.transactions,'totalSales',t.total_sales,'grossRevenue',t.gross_revenue,'totalDiscounts',t.total_discounts,'totalTax',t.total_tax,'grossProfit',pr.gross_profit),
    'topProducts',coalesce((select jsonb_agg(jsonb_build_object('productId',product_id,'name',name,'sku',sku,'quantitySold',quantity_sold,'sales',sales,'grossProfit',gross_profit)) from product_rows),'[]'::jsonb),
    'paymentMethods',coalesce((select jsonb_agg(jsonb_build_object('method',method,'amount',amount,'payments',payments)) from payment_rows),'[]'::jsonb),
    'salesByShopkeeper',coalesce((select jsonb_agg(jsonb_build_object('userId',user_id,'name',name,'transactions',transactions,'sales',sales)) from keeper_rows),'[]'::jsonb),
    'inventory',jsonb_build_object('products',iv.products,'unitsOnHand',iv.units_on_hand,'costValue',iv.cost_value,'lowStockCount',iv.low_stock_count),
    'lowStockProducts',coalesce((select jsonb_agg(jsonb_build_object('productId',product_id,'name',name,'sku',sku,'quantity',quantity,'threshold',threshold)) from low_rows),'[]'::jsonb)
  ) into v_result from totals t cross join profit pr cross join inventory_totals iv;
  return v_result;
end;$function$;

revoke all on function public.get_shop_report(uuid,timestamptz,timestamptz) from public,anon,authenticated;
grant execute on function public.get_shop_report(uuid,timestamptz,timestamptz) to authenticated,service_role;

commit;
