# Shopwise Supabase database

This directory is the authoritative database definition for a fresh Shopwise Supabase project. `database.sql` creates the schema, constraints, indexes, triggers, RPCs, views, RLS policies, and grants. It does not modify the existing application code or migrate an existing live database.

## Architecture

```text
auth.users
    │ 1:1
    ▼
public.users
    │
    ├── owns ───────────────┐
    │                       ▼
    │                    shops
    │                       │
    └── shop_memberships ◄──┤
                            ├── products
                            │      ├── inventory (current balance)
                            │      └── inventory_movements (immutable ledger)
                            │
                            └── sales
                                   ├── sale_items (historical snapshots)
                                   └── payments
```

### Identity and membership

- Supabase `auth.users` is the identity and credential source.
- `public.users` stores the application profile. It never stores passwords.
- Public signup creates an `owner` profile. A trusted Auth administration request can create a shopkeeper by setting `app_metadata.user_role = shopkeeper`; user-editable metadata is never trusted for roles.
- `shop_memberships` replaces both `shop_users` and `shop_assignments`.
- Owners also have a membership row. `shops.owner_id` remains the definitive ownership field, while membership is the uniform access path.
- An owner may own multiple shops.

The profile email is duplicated as a read-model field for UI/search convenience. An Auth trigger synchronizes changes from `auth.users`; Auth remains authoritative.

### Products and inventory

- Products contain catalog/pricing data but no stock quantity.
- `inventory` contains exactly one authoritative balance per product.
- A product trigger creates its zero balance.
- `adjust_inventory` is the owner-only RPC for initial stock, restocking, returns, damage, and corrections.
- Every balance change writes an immutable `inventory_movements` row in the same transaction.
- Ordinary authenticated clients have no direct inventory write privilege.

### Checkout

`create_sale_with_items(sale_data jsonb, items jsonb)` is the only normal POS write path. It:

1. Uses `auth.uid()` and verifies active shop membership.
2. serializes identical idempotency keys;
3. aggregates duplicate product lines;
4. locks product and inventory rows in deterministic UUID order;
5. verifies shop ownership, active products, and sufficient stock;
6. obtains selling price and cost from the database;
7. calculates totals without trusting browser totals;
8. creates the sale and sale-item snapshots;
9. deducts inventory and writes ledger entries;
10. records a cash or M-Pesa payment record;
11. writes a focused audit entry; and
12. returns the persisted sale result.

Any exception rolls back the entire PostgreSQL transaction. Repeating the same `(shop_id, sold_by, client_request_id)` returns the original sale.

Cash is recorded completed/paid. M-Pesa is recorded pending because no provider integration exists yet; a future trusted backend workflow must confirm or fail it.

### Receipt numbers

`receipt_counters` uses an atomic upsert for one counter per shop and calendar date. Receipt numbers have the form:

```text
ABC123-20260811-000001
```

The first part is derived from the shop UUID. `(shop_id, receipt_number)` is unique. Counter gaps are valid and preferable to duplicate receipts.

### Historical records

`sale_items` snapshots name, SKU, barcode, unit, selling price, and buying cost. Archiving or changing a product therefore cannot rewrite historical receipts or profit calculations. Business entities are designed for soft deletion; financial records are protected from cascading deletion.

The schema provides future-safe sale states and movement types for voids/refunds, but deliberately does not implement a complex returns subsystem yet.

### RLS

- Users can read and update allowed fields on their own profile; owners can read members of their shops.
- Members can read their shops, products, inventory, sales, sale items, payments, and movements.
- Only owners can create/update products and manage shopkeeper memberships.
- Inventory and financial writes are RPC-only.
- Only owners can read shop audit logs.
- Security-definer helper functions avoid recursive membership policies and use a fixed `search_path`.
- Views use `security_invoker`, so underlying table RLS remains effective.
- The service-role key remains backend-only and is not required for ordinary checkout.

## Fresh project initialization

1. Create a fresh Supabase project.
2. Back up and retain the project database credentials securely.
3. Open the Supabase SQL editor as the database owner.
4. Run `database.sql` once against the empty project.
5. Confirm all tables, functions, views, triggers, policies, and grants exist.
6. Configure backend `SUPABASE_URL`, anon key, and backend-only service-role key.
7. Review the backend compatibility status in `BACKEND_CHANGES_REQUIRED.md`.
8. Run authorization, concurrency, and transaction tests in a non-production project.

The bootstrap targets a fresh database. It intentionally contains no `DROP TABLE`, data rewrite, or automatic conversion of the current development schema.

## Existing database migration

Use `MIGRATION_NOTES.md`. Do not run the bootstrap over the existing schema: many names overlap, and data must be reconciled before legacy tables/columns can be retired.

No `seed.sql` is provided. Test records require real `auth.users.id` values. Create test identities through Supabase Auth, then use their generated UUIDs through normal application/RPC paths; never commit passwords, tokens, or keys.

## Important backend assumptions

- Product stock is no longer accepted in a product insert.
- A new product starts at zero; call `adjust_inventory` for initial stock.
- Checkout requires `shop_id`, a UUID `client_request_id`, `payment_method`, and item `{product_id, quantity}` objects.
- The checkout RPC returns a JSON object, not only a sale UUID.
- `user_role` is canonical; old code currently expects `role`.
- Old `shop_staff`, `shop_users`, and `shop_assignments` names are replaced by `shop_memberships`.

See `BACKEND_CHANGES_REQUIRED.md` for current compatibility status and remaining gaps.
