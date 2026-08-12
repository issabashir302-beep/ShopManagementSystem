begin;

-- INSERT ... RETURNING applies the SELECT policy while the owner-membership
-- AFTER INSERT trigger is still completing. The immutable owner_id is already
-- sufficient authority for the owner to read the newly created shop.
drop policy if exists shops_select_member on public.shops;
create policy shops_select_member on public.shops
for select to authenticated
using (
  owner_id = auth.uid()
  or public.is_shop_member(id, auth.uid())
);

-- The validate_shop_owner trigger is the authoritative active-owner check.
-- Keeping the RLS predicate to identity ownership avoids a nested users-policy
-- evaluation during INSERT while still preventing caller-controlled ownership.
drop policy if exists shops_insert_owner on public.shops;
create policy shops_insert_owner on public.shops
for insert to authenticated
with check (owner_id = auth.uid());

commit;
