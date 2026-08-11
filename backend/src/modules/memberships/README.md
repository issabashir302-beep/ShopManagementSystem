# Memberships / Shopkeepers

Owner-only staff management for the authenticated owner's one shop. The module uses `shop_memberships`; legacy staff tables are never queried.

## Routes

- `POST /api/v1/shopkeepers` — create a confirmed Supabase Auth shopkeeper and active membership. Accepts `email`, `password`, `fullName`, optional `phone`/`username`.
- `GET /api/v1/shopkeepers` — list the owner's shopkeepers.
- `GET /api/v1/shopkeepers/:shopkeeperId` — retrieve one owned shopkeeper.
- `PATCH /api/v1/shopkeepers/:shopkeeperId` — update `fullName`, `phone`, or `username`.
- `PATCH /api/v1/shopkeepers/:shopkeeperId/status` — `{ "isActive": false }` disables shop membership access.
- `POST /api/v1/shopkeepers/:shopkeeperId/reset-password` — asks Supabase to email its supported recovery workflow.

All routes require an owner. Shop IDs and role fields are rejected. Creation sets trusted Auth `app_metadata.user_role=shopkeeper`; the database trigger creates the profile. If profile or membership setup fails, the backend removes any created membership/profile/Auth identity where possible and never reports success.

Deactivation is canonical membership deactivation, not an unsupported claim that the Auth account was banned. RLS helper functions require active membership, so shop operations become inaccessible. Initial passwords and recovery tokens are never returned or logged.

Common errors: `FORBIDDEN`, `SHOP_NOT_FOUND`, `SHOPKEEPER_NOT_FOUND`, `SHOPKEEPER_ACCOUNT_EXISTS`, `VALIDATION_ERROR`.

Run `npm test` from `backend/`.
