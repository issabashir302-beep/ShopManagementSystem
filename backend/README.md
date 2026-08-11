# Shopwise MiniPOS backend

Node.js/Express API for Shopwise foundation, authentication, profiles, one-shop context, shopkeepers, products, and inventory. The Supabase schema in `../supabase/database.sql` is authoritative.

## Architecture

```text
HTTP route
  → validation
  → verified Supabase access token
  → controller
  → service/business rules
  → repository/request-scoped Supabase client
  → PostgreSQL + RLS
```

```text
src/
├── config/          environment and Supabase clients
├── middleware/      auth, request IDs, logging, security, errors
├── modules/
│   ├── auth/        Supabase Auth operations
│   ├── users/       self-service application profile
│   ├── shops/       current one-shop MiniPOS context
│   ├── memberships/ owner-managed shopkeepers
│   ├── products/    shop-scoped catalog
│   └── inventory/   balances, movements, adjustment RPC
├── errors/          safe application errors
├── utils/           responses, validation, logging
├── dependencies.js  runtime composition
├── app.js           testable Express application
└── server.js        process startup and shutdown
```

Controllers are thin. Services own business decisions. Repositories contain Supabase table queries. Normal data operations use the caller's JWT and RLS. The centralized service-role client is limited to Auth consistency/compensation and dependency readiness.

## Setup

1. Initialize a fresh Supabase project with `../supabase/database.sql`.
2. Copy `.env.example` to `.env`.
3. Supply development-project credentials. Never expose the service-role key to browsers.
4. Install and run:

```bash
npm install
npm run dev
```

Required configuration:

| Variable | Purpose |
|---|---|
| `NODE_ENV` | `development`, `test`, or `production` |
| `PORT` | API port |
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_ANON_KEY` | Normal Auth/RLS client key |
| `SUPABASE_SERVICE_ROLE_KEY` | Backend-only Auth administration/readiness key |
| `CORS_ORIGINS` | Comma-separated exact browser origins |
| `LOG_LEVEL` | `debug`, `info`, `warn`, or `error` |

Startup fails if required values are absent or invalid. Production rejects wildcard CORS.

## Commands

```bash
npm start
npm run dev
npm test
npm run test:coverage
npm run lint
```

Tests set and assert `NODE_ENV=test` inside the harness, use injected fakes, and never load environment configuration or contact Supabase. Future live integration tests must require separate explicitly named test-project credentials; they must never fall back to development credentials.

## API conventions

Base URL: `/api/v1`

Success:

```json
{ "success": true, "data": {}, "requestId": "uuid" }
```

Error:

```json
{
  "success": false,
  "error": { "code": "VALIDATION_ERROR", "message": "Invalid request" },
  "requestId": "uuid"
}
```

Supply protected requests with `Authorization: Bearer <access-token>`. Tokens are verified with Supabase Auth, not merely decoded. API responses use camelCase; repository boundaries map the database's snake_case fields.

## Active API

| Method | Route | Auth | Rule / purpose |
|---|---|---|---|
| GET | `/api/v1/health` | No | Process liveness |
| GET | `/api/v1/readiness` | No | Supabase dependency readiness |
| POST | `/api/v1/auth/signup` | No | Create an owner; role input rejected |
| POST | `/api/v1/auth/login` | No | Email/password session |
| POST | `/api/v1/auth/refresh` | No | Refresh a session with refresh token |
| POST | `/api/v1/auth/logout` | Yes | Global Supabase sign-out |
| GET | `/api/v1/auth/session` | Yes | Concise verified identity |
| GET | `/api/v1/users/me` | Yes | Own application profile |
| PATCH | `/api/v1/users/me` | Yes | Safe self-service profile fields |
| POST | `/api/v1/shops` | Owner | Create the owner's one MiniPOS shop |
| GET | `/api/v1/shops/me` | Yes | Owner or shopkeeper assigned shop |
| PATCH | `/api/v1/shops/me` | Owner | Update safe shop settings |
| POST | `/api/v1/shopkeepers` | Owner | Create Auth shopkeeper and membership |
| GET | `/api/v1/shopkeepers` | Owner | List owned-shop staff |
| GET | `/api/v1/shopkeepers/:shopkeeperId` | Owner | Retrieve owned-shop staff member |
| PATCH | `/api/v1/shopkeepers/:shopkeeperId` | Owner | Update safe staff profile fields |
| PATCH | `/api/v1/shopkeepers/:shopkeeperId/status` | Owner | Activate/deactivate membership |
| POST | `/api/v1/shopkeepers/:shopkeeperId/reset-password` | Owner | Initiate Supabase password recovery |
| POST | `/api/v1/products` | Owner | Create product; inventory starts at zero |
| GET | `/api/v1/products` | Member | Search/filter/paginate shop catalog |
| GET | `/api/v1/products/:productId` | Member | Retrieve scoped product |
| PATCH | `/api/v1/products/:productId` | Owner | Update catalog fields |
| DELETE | `/api/v1/products/:productId` | Owner | Soft-archive product |
| GET | `/api/v1/inventory` | Member | Active product balances |
| GET | `/api/v1/inventory/low-stock` | Member | Persisted low-stock view |
| GET | `/api/v1/products/:productId/inventory` | Member | One product balance |
| GET | `/api/v1/products/:productId/inventory/movements` | Member | Movement history |
| POST | `/api/v1/products/:productId/inventory/adjustments` | Owner | Atomic manual stock movement |

See each module README for accepted fields and important rules.

## Authentication notes

The database trigger on `auth.users` creates `public.users`. Public signup does not insert a profile itself and cannot choose a role. Signup verifies the triggered owner profile; if verification fails, the backend attempts to remove the inconsistent Auth identity and reports failure.

Global logout revokes refresh sessions. Existing access JWTs can remain valid until expiry, so clients must clear local session data too.

## One-shop MiniPOS rule

The API rejects a second owner shop and rejects multiple active memberships. The current database was originally designed for multi-shop ownership and has no unique `shops.owner_id` constraint. Before horizontally scaling shop creation, add a reviewed database uniqueness migration; service validation alone cannot eliminate a simultaneous cross-instance insertion race.

## Catalog and inventory rules

Product requests never accept `shopId`, stock, or quantity. Catalog writes are owner-only; shopkeepers receive active read-only catalog access. Product deletion is archival, preserving financial and movement history.

`inventory.quantity` is the current balance. The only manual write path is `adjust_inventory`, which atomically updates the balance and adds one immutable `inventory_movements` entry plus an audit record. Supported manual API types are `INITIAL_STOCK`, `RESTOCK`, `ADJUSTMENT`, and `DAMAGE`. Checkout-owned movement types remain unavailable.

## Inactive legacy code

The old auth and sales controllers/routes, `middleware/authMiddleware.js`, and `config/supabase.js` remain for user-owned changes or later sales-domain reference. They are not imported or registered by the new entrypoint. Legacy shop and inventory controllers/routes were removed after their replacements were completed. Only routes listed above are active.
