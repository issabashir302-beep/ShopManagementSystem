# Shopwise React frontend

React/Vite replacement for the legacy static Shopwise MiniPOS frontend.

## Run locally

```powershell
Copy-Item .env.example .env
npm install
npm run dev
```

Set `VITE_API_URL=http://localhost:5000/api/v1`. Add only a Stripe test publishable key to `VITE_STRIPE_PUBLISHABLE_KEY` when testing card payments.

## Commands

```powershell
npm run lint
npm test
npm run build
```

## Railway deployment

Create a Railway service with Root Directory `/frontend`. The checked-in `railway.toml` builds the Vite application and starts the production static server. The server binds Railway's `PORT`, exposes `/health`, and supports React Router refreshes.

Set these public build variables on the frontend service:

```text
VITE_API_URL=https://YOUR-BACKEND.up.railway.app/api/v1
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_...
```

Backend and provider secrets must never use `VITE_` variables.
