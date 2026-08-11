# Returns and voids

Owner-only compensating workflows for completed sales. Original sales, sale items, and payment rows are retained.

## Endpoints

- `POST /api/v1/sales/:saleId/void` with `{ "reason": "..." }`
- `POST /api/v1/sales/:saleId/returns` with sale-item IDs, positive quantities, and a reason

Both operations call one PostgreSQL RPC. `void_sale` restores every sold item exactly once. `create_sale_return` locks the sale and validates cumulative returned quantities before restoring inventory. Each operation creates `sale_returns`, `sale_return_items`, inventory movements, and an audit entry in the same transaction.

Cash refunds are recorded as completed. M-Pesa and card refunds remain pending for a future trusted provider/manual workflow; no external refund is faked. The browser cannot provide refund amounts or statuses.

Run unit/API tests with `npm test`. Live transaction tests require an explicitly disposable Supabase project and run with `npm run test:integration`.
