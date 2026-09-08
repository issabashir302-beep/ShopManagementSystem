-- Shopwise barcode support
--
-- The current schema already contains products.barcode and this unique index.
-- This idempotent statement is supplied so existing deployments can safely
-- verify/create the required per-shop uniqueness rule before enabling scanning.

create unique index if not exists products_shop_barcode_active_uq
  on public.products (shop_id, barcode)
  where barcode is not null and deleted_at is null;
