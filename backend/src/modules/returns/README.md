# Returns and voids — database-blocked

No HTTP return or void endpoint is registered. The authoritative schema has status/void columns and `RETURN`/`VOID` inventory movement values, but no return, return-item, or refund tables and no transactional return/void RPC.

A safe implementation requires reviewed database functions that atomically validate owner/shop/status and cumulative returned quantities, preserve original sale/items/payments, restore inventory exactly once, append compensating movements, create refund records, and audit the actor. Separate Data API calls could leave partial financial and inventory state, so they are intentionally refused.

Planned routes after database support exists are owner-only `POST /api/v1/sales/:saleId/void` and `POST /api/v1/sales/:saleId/returns`.
