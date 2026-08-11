# Inventory

Read-only current balances plus owner-controlled manual stock movements. The module never directly updates `inventory.quantity`; all mutations call the database `adjust_inventory` RPC.

## Routes

- `GET /api/v1/inventory?search=&category=&page=1&pageSize=20` — active catalog balances for owner or shopkeeper.
- `GET /api/v1/inventory/low-stock?page=1&pageSize=20` — RLS-safe `low_stock_alerts` view.
- `GET /api/v1/products/:productId/inventory` — one product balance.
- `GET /api/v1/products/:productId/inventory/movements?page=1&pageSize=20` — reverse-chronological immutable movement history.
- `POST /api/v1/products/:productId/inventory/adjustments` — owner only.

Adjustment example:

```json
{
  "movementType": "RESTOCK",
  "quantityChange": "25.000",
  "reason": "Supplier delivery"
}
```

Manually exposed types are `INITIAL_STOCK`, `RESTOCK`, `ADJUSTMENT`, and `DAMAGE`. `SALE`, `RETURN`, and `VOID` remain reserved for later transactional workflows. Initial stock is allowed once; damage must be negative; restock/initial stock must be positive; all changes require a reason.

The RPC locks inventory, prevents negative balances, updates the current balance, writes one immutable movement, and writes an audit entry in one database transaction. New product balances start at zero through the product trigger. Shopkeepers have read-only inventory access.

Common errors: `PRODUCT_NOT_FOUND`, `INVENTORY_NOT_FOUND`, `INITIAL_STOCK_ALREADY_SET`, `INSUFFICIENT_STOCK`, `INVALID_STOCK_ADJUSTMENT`, `FORBIDDEN`.

Run `npm test` from `backend/`.
