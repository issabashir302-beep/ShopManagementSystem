begin;

-- MiniPOS intentionally supports one active shop per owner and per shopkeeper.
-- These partial unique indexes close races that service-level prechecks cannot.
create unique index if not exists shops_one_active_per_owner_uq
  on public.shops (owner_id)
  where deleted_at is null;

create unique index if not exists shop_memberships_one_active_shop_per_user_uq
  on public.shop_memberships (user_id)
  where deleted_at is null and is_active;

commit;
