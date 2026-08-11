# Sales and checkout

`POST /api/v1/checkout` is the only active sale-creation path. Any authenticated owner or active shopkeeper may submit a UUID `clientRequestId`, a `cash`, `mpesa`, or `card` payment method, and 1–100 `{ productId, quantity }` items. Protected price, total, shop, cashier, receipt, status, and payment fields are rejected.

The service derives the current shop and caller, then invokes `create_sale_with_items(sale_data jsonb, items jsonb)`. PostgreSQL aggregates and locks products in deterministic order, uses persisted prices, checks stock, inserts snapshots, deducts inventory, appends `SALE` movements, allocates the receipt, creates the payment and audit record, and commits atomically. The `(shop_id, sold_by, client_request_id)` key plus an advisory transaction lock makes retries idempotent.

| Method | Route | Auth / role | Purpose |
|---|---|---|---|
| POST | `/api/v1/checkout` | Active owner/shopkeeper | Atomic checkout |
| GET | `/api/v1/sales` | Active member | Shop-scoped, filtered history (max 100/page) |
| GET | `/api/v1/sales/:saleId` | Active member | Header, immutable item snapshots, and payments |

Foreign-shop IDs return `SALE_NOT_FOUND`. Typical errors include `VALIDATION_ERROR`, `UNSUPPORTED_PAYMENT_METHOD`, `DUPLICATE_PRODUCT`, `PRODUCT_NOT_FOUND`, `INSUFFICIENT_STOCK`, and `DUPLICATE_REFERENCE`. Run `npm test` from `backend/`.
