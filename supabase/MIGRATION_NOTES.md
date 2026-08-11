# Existing database migration notes

This is a migration plan, not an executable destructive migration. Do not run `database.sql` over the current database and do not drop legacy objects until the converted data has been verified and a tested rollback exists.

## Primary risks

- `shop_users` and `shop_assignments` duplicate membership and may disagree.
- `shops.owner_id` may disagree with either membership table.
- `products.quantity` (`real`) and `inventory.quantity` (`numeric`) may disagree.
- Existing sales may not have `client_request_id`, receipt numbers, statuses, payment status, or exact component totals.
- Existing sale items do not contain product snapshots or buying cost.
- Existing payments have no status or external-reference lifecycle.
- Existing profiles use `user_role`; current application code also sometimes expects `role`.
- Existing RLS, functions, triggers, and grants were not supplied, so their behavior must be exported separately.

## 1. Back up before any work

Create and verify all of the following:

1. Supabase/PostgreSQL logical backup including schema, data, functions, triggers, policies, and grants.
2. CSV or Parquet exports of every public table.
3. Export/count of Auth users using an approved Supabase administrative process.
4. A restore into a separate disposable project.
5. A written rollback/cutover window.

Do not put Auth exports, secrets, tokens, or customer data in Git.

## 2. Profile reconciliation

Validate every profile maps to Auth and every business FK maps to a profile:

```sql
select u.id from public.users u
left join auth.users a on a.id = u.id
where a.id is null;

select a.id, a.email from auth.users a
left join public.users u on u.id = a.id
where u.id is null;

select user_role, count(*) from public.users group by user_role;
```

Only `owner` and `shopkeeper` roles can move automatically. Decide manually how to handle missing profiles, duplicate case-insensitive email/username values, invalid roles, and deleted Auth identities.

## 3. Ownership and membership reconciliation

Create a staging membership dataset by unioning:

- one `owner` membership for every non-deleted `shops.owner_id`;
- valid rows from `shop_users`; and
- valid rows from `shop_assignments`.

Do not blindly union conflicting rows. Inspect:

```sql
select s.id as shop_id, s.owner_id, u.user_role
from public.shops s
left join public.users u on u.id = s.owner_id
where s.owner_id is null or u.id is null or u.user_role <> 'owner';

select shop_id, user_id, count(*)
from (
  select shop_id, user_id from public.shop_users where deleted_at is null
  union all
  select shop_id, user_id from public.shop_assignments
) x
group by shop_id, user_id
having count(*) > 1;
```

For each `(shop_id, user_id)`, determine one role and active/deleted state. Owners must match `shops.owner_id`; all other current members should be `shopkeeper`. After conversion, compare distinct source pairs with active `shop_memberships` pairs.

Only after cutover and verification should `shop_users` and `shop_assignments` be retired.

## 4. Product and inventory reconciliation

Never copy `products.quantity` blindly. Compare both balances:

```sql
select p.id, p.shop_id, p.name,
       p.quantity as product_quantity,
       i.quantity as inventory_quantity
from public.products p
left join public.inventory i on i.product_id = p.id
where i.product_id is null
   or p.quantity is distinct from i.quantity;
```

Resolve discrepancies from physical stock counts, sales records, and operator knowledge. Convert `real` values to `numeric(14,3)` carefully and reject negative balances.

For each migrated product:

1. Copy catalog fields and exact numeric prices.
2. Create one `inventory` balance.
3. Create one `INITIAL_STOCK` movement representing the approved opening balance, with a migration reason and trusted actor where known.

After cutover, `products.quantity` must no longer be written and should eventually be removed.

Validation:

```sql
select product_id, count(*) from public.inventory group by product_id having count(*) <> 1;
select * from public.inventory where quantity < 0;
select * from public.products where buying_price < 0 or selling_price < 0;
```

## 5. Sales and sale items

Existing rows cannot be fully upgraded automatically when historical snapshots are absent. For each old sale item:

- preserve its recorded `unit_price`, `quantity`, and `subtotal`;
- snapshot the best available historical product name/SKU/unit;
- use an evidence-backed historical cost if available;
- if no historical cost exists, do not silently claim the current cost was historical—flag it for review or document the chosen fallback;
- retain the product FK when valid, otherwise allow the new nullable `product_id` while preserving snapshot text.

Generate migration-only receipt numbers in a separate, deterministic namespace and ensure uniqueness. Generate a stable UUID `client_request_id` per legacy sale; do not reuse one across multiple sales.

Verify old totals before import:

```sql
select s.id, s.total_amount,
       coalesce(sum(si.subtotal), 0) as item_total
from public.sales s
left join public.sale_items si on si.sale_id = s.id
group by s.id, s.total_amount
having s.total_amount <> coalesce(sum(si.subtotal), 0);
```

Discrepancies may represent discounts/tax not modelled in the old schema and require an explicit migration decision. Do not rewrite financial history merely to make the query balance.

## 6. Payments

Map old methods case-insensitively to `cash` or `mpesa`. Values outside that set need manual mapping. Decide status from actual evidence:

- confirmed cash: `completed`;
- confirmed M-Pesa reference: normally `completed`;
- uncertain payment: `pending` or `failed` after investigation.

Do not invent provider references. Check whether multiple payment rows per sale exist and whether payment totals match sale totals:

```sql
select s.id, s.total_amount, coalesce(sum(p.amount), 0) as payment_total
from public.sales s
left join public.payments p on p.sale_id = s.id
group by s.id, s.total_amount
having s.total_amount <> coalesce(sum(p.amount), 0);
```

## 7. Audit logs

Copy existing logs where their user and record UUIDs remain meaningful. Populate `shop_id` where it can be proven from the affected record. Preserve old data in `metadata` when it does not fit the new `old_values/new_values` structure. Audit rows must not be edited merely to normalize wording.

## 8. Recommended migration order

1. Restore the backup into a disposable migration environment.
2. Export the existing schema/RLS/RPC definitions for comparison.
3. Create a separate target schema or fresh Supabase project with `database.sql`.
4. Reconcile and import profiles.
5. Import shops; verify owner profiles.
6. Build/import canonical memberships.
7. Import products.
8. Import approved inventory balances and opening movements.
9. Import sales and sale-item snapshots.
10. Import payments.
11. Import/audit legacy logs.
12. Run all validation queries and application integration tests.
13. Freeze writes, perform a final delta migration, and recount.
14. Cut over only after backups and rollback have been tested.
15. Retire old relationship tables and `products.quantity` only in a later reviewed migration.

## 9. Row-count and relationship verification

Record counts before and after each entity migration:

```sql
select 'users' entity, count(*) from public.users
union all select 'shops', count(*) from public.shops
union all select 'products', count(*) from public.products
union all select 'sales', count(*) from public.sales
union all select 'sale_items', count(*) from public.sale_items
union all select 'payments', count(*) from public.payments;

select s.id from public.shops s
left join public.users u on u.id = s.owner_id
where u.id is null;

select m.* from public.shop_memberships m
left join public.shops s on s.id = m.shop_id
left join public.users u on u.id = m.user_id
where s.id is null or u.id is null;

select s.id from public.shops s
left join public.shop_memberships m
  on m.shop_id = s.id and m.user_id = s.owner_id
  and m.role = 'owner' and m.is_active and m.deleted_at is null
where s.deleted_at is null and m.id is null;
```

Also test RLS with separate owner/shopkeeper identities from two shops. Prove that cross-shop reads and writes fail, not merely that the normal UI hides them.

## 10. What cannot be safely automatic

- Conflicting membership sources.
- Whether `products.quantity` or `inventory.quantity` is physically correct.
- Historical cost snapshots not stored at sale time.
- Unexplained differences between sale totals, item totals, and payments.
- Whether old M-Pesa rows were actually confirmed.
- The correct treatment of orphaned Auth/profile/business rows.
- Old RLS policy intent without exporting the definitions.

These require explicit business decisions and a retained reconciliation report.
