-- Read-only checks to run before applying uniqueness and return/void migrations.
-- Any returned row requires a manual decision. This script never modifies data.

-- Owners with more than one active shop.
select owner_id, count(*) as active_shop_count, array_agg(id order by created_at) as shop_ids
from public.shops
where deleted_at is null
group by owner_id
having count(*) > 1;

-- Users with more than one active, non-deleted membership.
select user_id, count(*) as active_membership_count,
  array_agg(id order by created_at) as membership_ids,
  array_agg(shop_id order by created_at) as shop_ids
from public.shop_memberships
where deleted_at is null and is_active
group by user_id
having count(*) > 1;

-- Broken references. Foreign keys normally make these empty, but legacy imports may differ.
select 'shop_owner' as reference_type, s.id as source_id, s.owner_id as missing_id
from public.shops s left join public.users u on u.id = s.owner_id
where u.id is null
union all
select 'membership_user', m.id, m.user_id
from public.shop_memberships m left join public.users u on u.id = m.user_id
where u.id is null
union all
select 'membership_shop', m.id, m.shop_id
from public.shop_memberships m left join public.shops s on s.id = m.shop_id
where s.id is null;

-- Duplicate membership rows, including inactive/deleted historical records.
select shop_id, user_id, count(*) as membership_count,
  array_agg(id order by created_at) as membership_ids
from public.shop_memberships
group by shop_id, user_id
having count(*) > 1;

-- Exact rows that would conflict with the one-active-shop-per-owner index.
select s.*
from public.shops s
join (
  select owner_id from public.shops where deleted_at is null
  group by owner_id having count(*) > 1
) conflicts using (owner_id)
where s.deleted_at is null
order by s.owner_id, s.created_at;

-- Exact rows that would conflict with the one-active-membership-per-user index.
select m.*
from public.shop_memberships m
join (
  select user_id from public.shop_memberships
  where deleted_at is null and is_active
  group by user_id having count(*) > 1
) conflicts using (user_id)
where m.deleted_at is null and m.is_active
order by m.user_id, m.created_at;
