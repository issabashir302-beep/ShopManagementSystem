# Backend compatibility status

The modular backend now implements the database contract under `backend/src/`.

Completed compatibility changes:

- `users.user_role` and `shop_memberships` are canonical.
- Product quantity is read from `inventory`; stock writes use `adjust_inventory`.
- Public role/shop/stock/financial fields are rejected.
- Checkout uses only `create_sale_with_items`.
- Direct `sale_items` insertion and legacy `/api/sales/items` are removed.
- Caller-JWT Supabase clients handle RLS operations; the service-role client remains backend-only.
- Cash payments complete; M-Pesa and newly created Stripe card payments remain pending.
- Stripe intent attachment and webhook transitions use trusted database functions and a provider-event idempotency ledger.

The remaining database capability gap is returns/voids: there are no compensating return/refund tables or atomic return/void RPCs. See `backend/src/modules/returns/README.md`.

Frontend code still calls obsolete `/api/*` routes. It must migrate to `/api/v1`; see `backend/BACKEND_CLEANUP_NOTES.md`.
