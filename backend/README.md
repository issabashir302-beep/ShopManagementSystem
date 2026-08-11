# Shopwise MiniPOS backend

Node.js/Express API for authentication, users, one-shop context, shopkeepers, products, inventory, checkout/sales, payments, owner reports, and monthly Resend delivery. `../supabase/database.sql` is authoritative.

## Structure

```text
backend/
├── server.js              package entrypoint; delegates to src/server.js
├── src/
│   ├── app.js             Express composition and route registration
│   ├── server.js          runtime startup and graceful shutdown
│   ├── dependencies.js    dependency composition
│   ├── config/            environment and Supabase clients
│   ├── errors/            AppError
│   ├── middleware/        auth, errors, 404, request ID/logging, rate limits, security
│   ├── jobs/              monthly report scheduling
│   ├── utils/             responses, validation, async handling, logger
│   └── modules/           auth, users, shops, memberships, products,
│                          inventory, sales, payments, reports, notifications,
│                          and returns capability documentation
└── tests/helpers/         focused API test harness
```

Each active feature follows route → validation/auth → controller → service → repository/RPC. Ordinary database work uses a caller-JWT Supabase client and RLS. The centralized service-role client is limited to Auth administration/compensation and readiness.

## Setup and commands

Initialize a fresh Supabase project with `../supabase/database.sql`, copy `.env.example` to `.env`, and supply non-production development credentials.

```bash
cd backend
npm install
npm run dev
npm start
npm test
npm run test:coverage
npm run lint
npm run format:check
```

There is currently no `test:integration` script. Tests use injected fakes and do not contact Supabase.

| Variable                    | Purpose                                                    |
| --------------------------- | ---------------------------------------------------------- |
| `NODE_ENV`                  | `development`, `test`, or `production`                     |
| `PORT`                      | HTTP port                                                  |
| `SUPABASE_URL`              | Supabase project URL                                       |
| `SUPABASE_ANON_KEY`         | Caller-context Auth/RLS client key                         |
| `SUPABASE_SERVICE_ROLE_KEY` | Backend-only Auth administration/readiness key             |
| `STRIPE_SECRET_KEY`         | Backend-only Stripe API key; use test mode locally         |
| `STRIPE_WEBHOOK_SECRET`     | Stripe endpoint signing secret                             |
| `RESEND_API_KEY`            | Backend-only Resend API key                                |
| `RESEND_FROM_EMAIL`         | Verified monthly-report sender                             |
| `APP_TIMEZONE`              | IANA business timezone used for report boundaries and cron |
| `MONTHLY_REPORT_CRON`       | Monthly cron expression; defaults to `0 8 1 * *`           |
| `CORS_ORIGINS`              | Comma-separated exact browser origins                      |
| `LOG_LEVEL`                 | `debug`, `info`, `warn`, or `error`                        |

Startup fails for missing/invalid values. Production rejects wildcard CORS.

## API conventions

Base URL: `/api/v1`. Protected requests require `Authorization: Bearer <access-token>`.

```json
{ "success": true, "data": {}, "requestId": "uuid" }
```

```json
{
  "success": false,
  "error": { "code": "VALIDATION_ERROR", "message": "Invalid request" },
  "requestId": "uuid"
}
```

## Active API

| Method | Route                                               | Auth             | Purpose                                   |
| ------ | --------------------------------------------------- | ---------------- | ----------------------------------------- |
| GET    | `/api/v1/health`                                    | No               | Liveness                                  |
| GET    | `/api/v1/readiness`                                 | No               | Supabase readiness                        |
| POST   | `/api/v1/auth/signup`                               | No               | Owner signup; role input rejected         |
| POST   | `/api/v1/auth/login`                                | No               | Login                                     |
| POST   | `/api/v1/auth/refresh`                              | No               | Refresh session                           |
| POST   | `/api/v1/auth/logout`                               | Yes              | Global sign-out                           |
| GET    | `/api/v1/auth/session`                              | Yes              | Verified identity                         |
| GET    | `/api/v1/users/me`                                  | Yes              | Own profile                               |
| PATCH  | `/api/v1/users/me`                                  | Yes              | Safe profile update                       |
| POST   | `/api/v1/shops`                                     | Owner            | Create the owner's shop                   |
| GET    | `/api/v1/shops/me`                                  | Member           | Current shop                              |
| PATCH  | `/api/v1/shops/me`                                  | Owner            | Shop settings                             |
| POST   | `/api/v1/shopkeepers`                               | Owner            | Create shopkeeper/membership              |
| GET    | `/api/v1/shopkeepers`                               | Owner            | List staff                                |
| GET    | `/api/v1/shopkeepers/:shopkeeperId`                 | Owner            | Staff detail                              |
| PATCH  | `/api/v1/shopkeepers/:shopkeeperId`                 | Owner            | Safe staff update                         |
| PATCH  | `/api/v1/shopkeepers/:shopkeeperId/status`          | Owner            | Activate/deactivate membership            |
| POST   | `/api/v1/shopkeepers/:shopkeeperId/reset-password`  | Owner            | Password recovery                         |
| POST   | `/api/v1/products`                                  | Owner            | Create catalog product                    |
| GET    | `/api/v1/products`                                  | Member           | Paginated catalog                         |
| GET    | `/api/v1/products/:productId`                       | Member           | Product detail                            |
| PATCH  | `/api/v1/products/:productId`                       | Owner            | Catalog update                            |
| DELETE | `/api/v1/products/:productId`                       | Owner            | Soft archive                              |
| GET    | `/api/v1/inventory`                                 | Member           | Inventory balances                        |
| GET    | `/api/v1/inventory/low-stock`                       | Member           | Low-stock view                            |
| GET    | `/api/v1/products/:productId/inventory`             | Member           | Product balance                           |
| GET    | `/api/v1/products/:productId/inventory/movements`   | Member           | Movement history                          |
| POST   | `/api/v1/products/:productId/inventory/adjustments` | Owner            | Atomic adjustment RPC                     |
| POST   | `/api/v1/checkout`                                  | Member           | Atomic, idempotent checkout RPC           |
| GET    | `/api/v1/sales`                                     | Member           | Paginated current-shop sales              |
| GET    | `/api/v1/sales/:saleId`                             | Member           | Sale/items/payments                       |
| GET    | `/api/v1/sales/:saleId/payments`                    | Member           | Sale payments                             |
| GET    | `/api/v1/payments/:paymentId`                       | Member           | Payment detail                            |
| POST   | `/api/v1/payments/stripe/create-intent`             | Member           | Create/reuse pending card PaymentIntent   |
| POST   | `/api/v1/payments/stripe/webhook`                   | Stripe signature | Trusted payment status transition         |
| GET    | `/api/v1/reports/daily-sales`                       | Owner            | Local-day sales report                    |
| GET    | `/api/v1/reports/monthly-sales`                     | Owner            | Calendar-month sales report               |
| GET    | `/api/v1/reports/products`                          | Owner            | Product performance                       |
| GET    | `/api/v1/reports/inventory`                         | Owner            | Inventory and low-stock summary           |
| GET    | `/api/v1/reports/profit`                            | Owner            | Historical gross profit                   |
| GET    | `/api/v1/reports/monthly-summary`                   | Owner            | Complete monthly summary                  |
| POST   | `/api/v1/reports/monthly-summary/email`             | Owner            | Idempotent email to own persisted address |

Module-specific contracts are documented in each `src/modules/*/README.md`.

## Important boundaries

- Public signup cannot choose a role; the database Auth trigger creates the owner profile.
- Shop access comes from one active `shop_memberships` row.
- Products do not store quantity. `inventory.quantity` changes through trusted RPCs.
- `adjust_inventory` is the only manual inventory write path.
- `create_sale_with_items` is the only sale write path; it owns pricing, stock locking, receipt, payment, movement, audit, and idempotency.
- Cash completes immediately; M-Pesa remains pending. Card remains pending until a signature-verified Stripe webhook. No browser-controlled payment mutation route exists.
- Returns/voids are inactive because the schema lacks compensating tables and atomic RPCs; see `src/modules/returns/README.md`.
- Reports count only completed sales and completed payments. Existing voided/refunded rows are excluded; profit uses sale-time cost snapshots.
- At 08:00 local time on day 1, the scheduler sends the previous month. `report_deliveries` plus a Resend idempotency key protects retries and multiple instances.

## Canonical runtime and compatibility

`backend/server.js` is the single package entrypoint and delegates to `src/server.js`. All active implementation code lives under `src/`. Superseded root-level controllers, routes, middleware, and Supabase configuration were removed.

Legacy frontend `/api/*` calls are documented in `BACKEND_CLEANUP_NOTES.md`; frontend files were not modified.
