# Supabase database

`database.sql` is the complete fresh-install schema. Existing installations apply `migrations/` in filename order.

The M-Pesa POS integration is introduced by `migrations/20260910_add_shop_mpesa_integrations.sql`. Apply it before enabling the M-Pesa settings page. Set `MPESA_CREDENTIALS_ENCRYPTION_KEY` to a stable 32-byte hex/base64 key and `PUBLIC_API_URL` to the publicly reachable API origin so Daraja callbacks can reach the backend.

Before the one-shop uniqueness migration, run `pre_migration_checks.sql` in read-only mode. Any returned rows require a human decision about the canonical shop or membership; no migration deletes or repairs business data automatically.

The returns migration adds compensating `sale_returns` and `sale_return_items` records plus owner-only transactional RPCs. The following report migration makes current reports subtract returned quantities and refund values. Cash refunds complete locally; M-Pesa and Stripe refunds remain pending until a trusted external refund workflow is added.

Integration tests require a disposable Supabase project initialized to the final schema. Set the `TEST_SUPABASE_*` variables and explicitly set `TEST_SUPABASE_DISPOSABLE=true`. Immutable inventory and audit ledgers deliberately make the suite unsuitable for production or shared staging data.
