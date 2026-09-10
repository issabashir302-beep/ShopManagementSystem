# Expenses

Owner-only operating expense ledger. Inventory acquisition must not be recorded here when it would duplicate cost of goods sold. DELETE soft-voids a record; it does not physically delete financial history.

Routes: `GET/POST /api/v1/expenses`, `GET /api/v1/expenses/summary`, and `PATCH/DELETE /api/v1/expenses/:expenseId`.
