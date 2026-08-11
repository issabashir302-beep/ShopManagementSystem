# Backend changes required after database adoption

This document records future backend impact only. No backend files were changed during the database phase.

## Compatibility map

| Old expectation | New canonical equivalent |
|---|---|
| `users.role` | `users.user_role` |
| `users.shop_id` | `shop_memberships` lookup |
| `shop_staff` | `shop_memberships` |
| `shop_users` | `shop_memberships` |
| `shop_assignments` | `shop_memberships` |
| `products.quantity` / request `stock` | `inventory.quantity`; use `adjust_inventory` to change stock |
| `products.reorder_level` | `products.low_stock_threshold` |
| direct `sale_items` insertion | removed as an application workflow; use `create_sale_with_items` |
| unstructured sale payload/totals | server/database RPC contract with `shop_id`, `client_request_id`, payment fields, and product quantities only |
| RPC returning only a UUID | RPC returns a JSON result containing sale ID, receipt, totals, status, and replay flag |

## Exact modules affected

### `backend/controllers/authController.js`

- `signup()` currently accepts `role` from the public request and inserts directly into `public.users`. Stop doing both. The Auth trigger creates the profile and never trusts user metadata for role assignment.
- Public signup should be owner-only by product policy.
- `getMe()` selects `role`; change it to `user_role` (or explicitly alias it during a compatibility period).
- Profile creation errors must no longer be ignored.

### `backend/controllers/shopController.js`

- `getShopDetails()` incorrectly queries `shops.id = user.id` and expects `profile.shop_id`. Resolve access through `shop_memberships` or ownership through `shops.owner_id`.
- `addShopkeeper()` must create the Auth user through the service-role backend with trusted `app_metadata.user_role = 'shopkeeper'`, then insert one `shop_memberships` row. Remove all `users.shop_id`, `shop_staff`, and fallback logic.
- Identity creation plus membership creation spans Auth and PostgreSQL and cannot be one ordinary database transaction. Implement compensating cleanup/retry and make the operation idempotent.
- `getShopkeepers()`, `updateShopkeeper()`, `toggleShopkeeperStatus()`, and `resetShopkeeperPassword()` must use `shop_memberships`. Remove the global-role fallback completely.
- Do not permit arbitrary membership/profile role mutation from request bodies.
- `inviteShopkeeper()` needs an explicit owner authorization check before any service-role action.

### `backend/controllers/inventoryController.js`

- `mapProductPayload()` must stop putting quantity on `products`.
- Map `reorder_level` to `low_stock_threshold`.
- Product creation should insert catalog data first, then call `adjust_inventory(..., 'INITIAL_STOCK', ...)` if an initial quantity was supplied.
- The backend must derive/authorize `shop_id`; it must not trust a caller-selected shop.
- `getProducts()` must join or separately query `inventory` to return current quantity.
- Persisted restock/damage/adjustment actions must call `adjust_inventory`.
- `updateProduct()` and `deleteProduct()` are currently not routed. Future delete behavior should archive through `is_active=false, deleted_at=now()` rather than hard-delete.
- `lowStock()` should use the authenticated request-scoped client. The new `low_stock_alerts` view is RLS-safe through its underlying tables.

### `backend/controllers/salesController.js`

- `createSale()` must build the new contract:

```json
{
  "sale": {
    "shop_id": "uuid",
    "client_request_id": "uuid",
    "payment_method": "cash",
    "provider_reference": null,
    "external_reference": null,
    "payment_metadata": {}
  },
  "items": [
    { "product_id": "uuid", "quantity": 1.000 }
  ]
}
```

- Never send or trust client prices, subtotals, total amount, sold-by identity, or receipt number.
- Return the RPC JSON object directly; it is no longer a bare sale UUID.
- Remove or disable `addSaleItems()` and the `POST /api/sales/items` route. The database intentionally grants no direct financial insert access to authenticated clients.
- `dailySales()` must use `req.supabase`, not the shared anon client.
- Treat an idempotent replay as success and return the existing receipt.
- M-Pesa checkout currently creates a pending payment. A later trusted backend integration must update payment/sale status after provider confirmation; do not let the browser mark it completed.

### `backend/routes/*`

- Add explicit role/shop authorization middleware in addition to `requireAuth`.
- Add inventory adjustment routes that call the RPC; do not expose raw balance updates.
- Remove `/api/sales/items`.
- Add product archive/update routes only after their authorization and validation are defined.

### `backend/config/supabase.js`

- Continue using request-scoped JWT clients for ordinary RLS-protected reads and RPCs.
- Keep service role backend-only and limited to Auth administration/controlled repair operations.
- Fail startup when required environment variables are absent.

## Frontend impact for the later phase

- Login redirects currently read `profile.role`; consume `user_role` or a temporary backend alias.
- Product displays must obtain quantity from the inventory join/API response.
- Initial stock and restocking require dedicated backend operations.
- POS checkout must generate one UUID `client_request_id` per user checkout attempt and reuse it for retries.
- The cashier must display the database receipt number and totals returned by the RPC.
- A pending M-Pesa payment must not be displayed as confirmed.
- Sales/history pages must use persisted `sales`, `sale_items`, and `payments`, not in-memory mock data.

## Required tests before integration

- Owner and shopkeeper can read only their shop.
- A shopkeeper cannot manage products, memberships, or raw inventory.
- An owner cannot access another owner's shop.
- Concurrent sales of the last unit result in one success and one rollback.
- Reusing a client request ID returns one sale.
- Invalid/missing product rolls back sale, items, payment, inventory, movements, and audit entry.
- Database prices override manipulated browser prices/totals.
- Product archival does not change historical sale items.
- Cash produces paid/completed state; M-Pesa produces pending state until trusted confirmation.
