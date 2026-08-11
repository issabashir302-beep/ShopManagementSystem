# Products

Shop-scoped catalog management. Shop IDs are derived from the caller's single active membership and are never accepted from clients.

## Routes

- `POST /api/v1/products` — owner-only create.
- `GET /api/v1/products?search=&category=&status=active&page=1&pageSize=20` — member listing. Search covers name, SKU, and barcode. Shopkeepers may request active products only.
- `GET /api/v1/products/:productId` — member detail; archived products are owner-only.
- `PATCH /api/v1/products/:productId` — owner-only catalog update.
- `DELETE /api/v1/products/:productId` — owner-only archive (`is_active=false`, `deleted_at` set), never physical deletion.

Create/update fields are `name`, `sku`, `barcode`, `category`, `unit`, `buyingPrice`, `sellingPrice`, and `lowStockThreshold`. Prices and thresholds accept exact decimal strings or JSON numbers with the database-supported scale. `shopId`, quantity/stock, identity, lifecycle, and unknown fields are rejected.

Product creation relies on the database trigger to create an inventory balance of zero. SKU and barcode uniqueness is enforced per shop by PostgreSQL and mapped to `PRODUCT_ALREADY_EXISTS`. Product database triggers provide focused product audit entries.

Common errors: `PRODUCT_NOT_FOUND`, `PRODUCT_ALREADY_EXISTS`, `INVALID_PRODUCT`, `FORBIDDEN`, `VALIDATION_ERROR`.

Run `npm test` from `backend/`.
