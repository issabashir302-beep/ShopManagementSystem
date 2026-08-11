# PostgreSQL Migration Plan for ShopManagementSystem

This document outlines a practical plan to replace the current Supabase-based backend with a PostgreSQL-based setup while keeping the project structure and API flow as stable as possible.

## 1. Current migration target

The project currently depends on Supabase in several places:

- [backend/config/supabase.js](backend/config/supabase.js) for the shared client
- [backend/middleware/authMiddleware.js](backend/middleware/authMiddleware.js) for authentication via Supabase Auth
- [backend/controllers/authController.js](backend/controllers/authController.js) for signup/login/logout/profile lookup
- [backend/controllers/inventoryController.js](backend/controllers/inventoryController.js) for inventory CRUD and low-stock queries
- [backend/controllers/salesController.js](backend/controllers/salesController.js) for sales and sales summaries
- [backend/controllers/shopController.js](backend/controllers/shopController.js) for shop and shopkeeper management

The migration should replace Supabase Auth and Supabase query helpers with PostgreSQL access and a custom auth layer.

## 2. Recommended migration strategy

The safest approach is:

1. Keep the existing Express API routes and frontend pages intact.
2. Replace the database layer behind the controllers.
3. Replace Supabase Auth with a PostgreSQL-backed JWT authentication flow.
4. Migrate data from Supabase to PostgreSQL.
5. Cut over the backend to the new PostgreSQL configuration.

This minimizes frontend changes and lets you focus on the backend migration first.

## 3. Phase-by-phase execution plan

### Phase 1: Prepare the PostgreSQL environment

Set up a PostgreSQL database before changing the app code.

Recommended options:
- Local PostgreSQL installation
- Docker container for PostgreSQL
- Managed PostgreSQL service such as Neon, Railway, Render, or AWS RDS

Suggested environment variables:

```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=shop_management
DB_USER=postgres
DB_PASSWORD=your_password
JWT_SECRET=your_super_secret_key
```

Install the PostgreSQL driver in the backend:

```bash
cd backend
npm install pg bcryptjs jsonwebtoken
npm uninstall @supabase/supabase-js
```

### Phase 2: Design the PostgreSQL schema

Create a schema that mirrors the current app model.

Suggested tables:

- users
  - id (uuid or serial)
  - full_name
  - email
  - password_hash
  - phone
  - role
  - created_at
  - updated_at

- shops
  - id
  - owner_id
  - name
  - address
  - phone
  - created_at

- shop_staff
  - id
  - shop_id
  - user_id
  - role
  - created_at

- products
  - id
  - shop_id
  - name
  - sku
  - category
  - quantity
  - unit
  - buying_price
  - selling_price
  - supplier
  - description
  - reorder_level
  - created_at
  - updated_at

- sales
  - id
  - shop_id
  - user_id
  - total_amount
  - payment_method
  - created_at

- sale_items
  - id
  - sale_id
  - product_id
  - quantity
  - unit_price
  - subtotal
  - created_at

Add indexes and constraints for:
- unique emails
- foreign keys between related tables
- non-negative quantities
- positive prices

### Phase 3: Replace the database connection layer

Create a PostgreSQL connection module, for example:

- [backend/config/database.js](backend/config/database.js)

This module should expose a pool object and helper functions for querying the database.

The current [backend/config/supabase.js](backend/config/supabase.js) should be replaced or reworked so that controllers no longer rely on Supabase client methods.

### Phase 4: Replace authentication

The current auth flow depends on Supabase Auth methods like:
- signUp
- signInWithPassword
- getUser
- signOut

Those need to be replaced with a custom PostgreSQL-backed JWT system.

Recommended approach:
- Store password hashes in the users table.
- Use bcryptjs to hash passwords during signup.
- Use jsonwebtoken to issue a JWT on login.
- Verify tokens in middleware and attach the authenticated user to the request object.

You will need to rewrite [backend/middleware/authMiddleware.js](backend/middleware/authMiddleware.js) so it reads the JWT from the Authorization header and validates it against your PostgreSQL user table.

### Phase 5: Migrate controller logic

Each controller will need a PostgreSQL version of its current logic.

#### Auth controller

Update [backend/controllers/authController.js](backend/controllers/authController.js) to:
- create a new user with a hashed password
- verify credentials during login
- return a JWT token
- load the current user profile from PostgreSQL
- support logout by clearing client-side token state if needed

#### Inventory controller

Update [backend/controllers/inventoryController.js](backend/controllers/inventoryController.js) to:
- create, read, update, and delete products using SQL queries
- query low-stock products using PostgreSQL
- enforce shop-level access using the authenticated user and shop membership

#### Sales controller

Update [backend/controllers/salesController.js](backend/controllers/salesController.js) to:
- wrap sale creation and item insertion in a transaction
- reduce stock quantities safely inside the transaction
- ensure the sale is only committed if all steps succeed

This is one of the most important parts because the current Supabase version uses a remote RPC function. PostgreSQL should handle this directly with transaction logic.

#### Shop controller

Update [backend/controllers/shopController.js](backend/controllers/shopController.js) to:
- create shops for owners
- add shopkeepers
- fetch shopkeeper records from PostgreSQL
- manage role checks and shop membership

### Phase 6: Data migration from Supabase

Before switching production traffic, export the existing data from Supabase.

Suggested migration steps:
1. Export data from the current Supabase tables to JSON or CSV.
2. Transform the data to match the PostgreSQL schema.
3. Import it into PostgreSQL.
4. Validate counts and relationships.

Focus especially on:
- users
- shops
- products
- sales and sale_items

### Phase 7: Cut over and test

Once the PostgreSQL version works locally:
- update the backend environment variables
- start the PostgreSQL-backed backend
- test authentication, inventory CRUD, sales flow, and shop management
- verify that the frontend still works without changes

## 4. Suggested implementation order

To reduce risk, follow this order:

1. Set up PostgreSQL and schema
2. Add connection pool and basic SQL helpers
3. Replace auth and middleware
4. Migrate inventory CRUD
5. Migrate sales flow
6. Migrate shop and shopkeeper management
7. Migrate data and test end to end

## 5. Risks to expect

- Authentication behavior will change because Supabase Auth is being removed.
- Row-level security rules from Supabase will not exist in raw PostgreSQL, so you must implement access checks in the backend.
- Sales transactions must be handled carefully to avoid stock inconsistencies.
- Shopkeeper ownership and role checks must be implemented explicitly.

## 6. Recommended first milestone

A good first milestone is:

- get PostgreSQL running
- create the schema
- replace login/signup with JWT-based auth
- verify that the app can create and read users from PostgreSQL

Once that works, move to products and sales.

## 7. Practical next steps

If you want to execute this migration safely, the next concrete actions are:

1. Create the PostgreSQL database and schema
2. Add [backend/config/database.js](backend/config/database.js)
3. Replace [backend/middleware/authMiddleware.js](backend/middleware/authMiddleware.js)
4. Update [backend/controllers/authController.js](backend/controllers/authController.js)
5. Migrate [backend/controllers/inventoryController.js](backend/controllers/inventoryController.js)
6. Migrate [backend/controllers/salesController.js](backend/controllers/salesController.js)
7. Migrate [backend/controllers/shopController.js](backend/controllers/shopController.js)
8. Export/import existing data and test the full flow
