begin;

-- Expense dates are business-local dates, while sales are timestamps. Passing the
-- local date boundaries explicitly prevents positive-offset timezones from
-- reporting yesterday's expenses on today's dashboard.
create or replace function public.get_shop_report(
  p_shop_id uuid,
  p_start timestamptz,
  p_end timestamptz,
  p_start_date date,
  p_end_date date
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  v_result jsonb;
  v_operating_expenses numeric(14,2);
  v_expenses_by_category jsonb;
  v_gross_profit numeric(14,2);
begin
  if p_start_date >= p_end_date then raise exception 'Invalid expense report period'; end if;

  v_result := public.get_shop_report(p_shop_id, p_start, p_end);

  select coalesce(sum(amount), 0)::numeric(14,2)
    into v_operating_expenses
  from public.expenses
  where shop_id = p_shop_id
    and deleted_at is null
    and expense_date >= p_start_date
    and expense_date < p_end_date;

  select coalesce(jsonb_agg(jsonb_build_object(
      'category', category,
      'amount', amount,
      'expenses', expenses
    ) order by amount desc), '[]'::jsonb)
    into v_expenses_by_category
  from (
    select category, sum(amount)::numeric(14,2) amount, count(*)::bigint expenses
    from public.expenses
    where shop_id = p_shop_id
      and deleted_at is null
      and expense_date >= p_start_date
      and expense_date < p_end_date
    group by category
  ) category_totals;

  v_gross_profit := coalesce((v_result -> 'totals' ->> 'grossProfit')::numeric, 0);
  v_result := jsonb_set(v_result, '{totals,operatingExpenses}', to_jsonb(v_operating_expenses), true);
  v_result := jsonb_set(v_result, '{totals,netOperatingProfit}', to_jsonb((v_gross_profit - v_operating_expenses)::numeric(14,2)), true);
  return jsonb_set(v_result, '{expensesByCategory}', v_expenses_by_category, true);
end;
$function$;

revoke all on function public.get_shop_report(uuid,timestamptz,timestamptz,date,date) from public, anon, authenticated;
grant execute on function public.get_shop_report(uuid,timestamptz,timestamptz,date,date) to authenticated, service_role;

commit;
