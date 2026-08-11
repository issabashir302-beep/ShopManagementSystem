# Shops module

Owns the single current MiniPOS shop context.

## Endpoints

- `POST /api/v1/shops` — owner-only creation. The backend derives `owner_id` from the verified token.
- `GET /api/v1/shops/me` — returns the one shop represented by the caller's active `shop_memberships` row.
- `PATCH /api/v1/shops/me` — owner-only update of safe shop settings.

The application rejects a second owned shop and rejects users with multiple active memberships because this MiniPOS release has no shop-switching workflow. The canonical relationship is `shop_memberships`; no legacy fallback tables are queried.

The current authoritative database permits multiple shops per owner. Application validation prevents ordinary duplicate creation, but a future database migration adding a unique active `shops.owner_id` constraint is required to close concurrent multi-instance creation races completely.

No shop deletion endpoint is provided.

Run `npm test` from `backend/`.
