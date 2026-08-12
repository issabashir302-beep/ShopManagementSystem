begin;

-- Membership creation has a necessary bootstrap step: before the membership
-- exists, the owner cannot yet see the new shopkeeper profile through RLS.
-- This trigger function is not callable by client roles and validates both the
-- trusted shop owner and profile role, so definer execution is appropriate.
alter function public.validate_shop_membership() security definer;

commit;
