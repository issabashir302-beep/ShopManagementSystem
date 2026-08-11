# Reports

All routes require an authenticated shop owner. The service derives the shop from the active membership; `shopId` is never accepted. Dates are interpreted in `APP_TIMEZONE`, converted to half-open UTC ranges, and aggregated by PostgreSQL from persisted data.

| Route                                        | Query                         | Result                                           |
| -------------------------------------------- | ----------------------------- | ------------------------------------------------ |
| `GET /api/v1/reports/daily-sales`            | `date=YYYY-MM-DD`             | Daily totals and breakdowns                      |
| `GET /api/v1/reports/monthly-sales`          | `month=YYYY-MM`               | Monthly totals and breakdowns                    |
| `GET /api/v1/reports/products`               | `month=YYYY-MM`               | Product performance                              |
| `GET /api/v1/reports/inventory`              | `month=YYYY-MM`               | Current inventory value and low stock            |
| `GET /api/v1/reports/profit`                 | `month=YYYY-MM`               | Gross revenue and gross profit                   |
| `GET /api/v1/reports/monthly-summary`        | `month=YYYY-MM`               | Email-ready complete summary                     |
| `POST /api/v1/reports/monthly-summary/email` | body `{ "month": "YYYY-MM" }` | Idempotent delivery to the persisted owner email |

Omit a date/month for the current local period. Gross profit uses each sale item's captured `unit_cost`; revenue never uses current catalog prices. Only `sales.status = completed` contributes. Voided and refunded sales are excluded. Payment breakdown includes only persisted `payments.status = completed` belonging to included sales, so refunded payments are not double-counted. Inventory is a current snapshot, even when requested alongside a historical sales month.

The database RPC returns totals, payment methods, shopkeeper sales, top 20 products, inventory totals, and up to 50 low-stock products.
