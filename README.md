# ShopManagementSystem

ShopManagementSystem is a simple web-based shop management and POS-style system designed to help shop owners and shopkeepers track products, monitor stock, record sales, and manage shop operations more easily.

## Overview

I find it had tracking the prices for my shop back at home so i built this system to help me track it.
This project was built to solve the problem of manually tracking prices, inventory, and sales in a small shop. It provides a basic digital workflow for:

- managing inventory
- updating product details and stock levels
- viewing low-stock items
- recording sales
- managing shop and shopkeeper accounts

## Features

- User authentication with signup, login, and logout
- Role-based access for owners and shopkeepers
- Product management for adding, updating, and deleting items
- Inventory tracking with quantity and pricing information
- Low-stock alert support
- Sales creation and daily sales summary
- Shop management and shopkeeper management

## Tech Stack

- Frontend: HTML, CSS, and JavaScript
- Backend: Node.js with Express
- Database/Auth: Supabase
- Other libraries: CORS, dotenv, morgan

## Project Structure

- `backend/` - Express API, jobs, and backend tests
- `supabase/` - canonical database schema and migrations
- `assets/` and `pages/` - static frontend source
- `scripts/build-frontend.js` - safe frontend-only production build
- `dist/` - generated static deployment output (not committed)

## Setup Instructions

1. Install backend dependencies:

   ```bash
   cd backend
   npm install
   ```

2. Create a .env file inside the backend folder with your Supabase configuration:

   ```env
   SUPABASE_URL=your_supabase_url
   SUPABASE_ANON_KEY=your_supabase_anon_key
   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
   ```

3. Start the backend server:

   ```bash
   npm run dev
   ```

4. Serve the repository root with a static server and open `/`. The root page redirects to the login screen.

## Commands

Run these from the repository root:

```powershell
npm run dev              # backend development server
npm test                 # backend unit tests
npm run lint             # backend lint
npm run test:integration # disposable Supabase integration suite
npm run build            # frontend-only dist/ artifact
```

## Deployment

- Railway backend service root: `backend`
- Railway start command: `npm start`
- Railway health endpoint: `/api/v1/health`
- Cloudflare Pages build command: `npm run build`
- Cloudflare Pages output directory: `dist`

The frontend production build defaults to `https://brilliant-mercy-production-c94f.up.railway.app/api/v1`. Set the public Cloudflare build variable `STRIPE_PUBLISHABLE_KEY` to enable card entry. Set the backend Railway `CORS_ORIGINS` to the exact deployed frontend origin.

Provider secrets (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, and `RESEND_API_KEY`) belong only in Railway. See [backend/README.md](backend/README.md) and [frontend.md](frontend.md) for the full production checklist.

## Usage

- Register or log in as a user
- Create or manage your shop
- Add products to inventory
- Update stock and prices
- Record sales and monitor daily performance

## Notes

This project is a practical starting point for a small shop management system and can be expanded with features such as receipts, reports, invoices, and payment integration.
