# Shopwise MiniPOS frontend

Shopwise is an HTML, CSS and vanilla JavaScript client for the Shopwise MiniPOS API. Runtime data is loaded from the backend; financial and inventory state is never generated in the browser.

## View locally

Serve the repository root with any static server, then open `pages/auth/login.html`. For example:

```powershell
npx serve .
```

The owner demo is at `pages/admin/owner.html`; the canonical counter UI is at `pages/shop/shopkeeper.html`.

## Structure

```text
assets/
├── css/
│   ├── variables.css   Design tokens
│   ├── base.css        Reset, type and accessibility baseline
│   ├── app.css         Shared shell and UI components
│   ├── auth.css        Authentication layouts
│   └── pos.css         Counter-specific layout
└── js/
    ├── api/               Runtime configuration, API client, endpoint facade
    ├── auth/session.js    Token refresh, identity and role guards
    ├── ui/ui.js          Modal, toast and display helpers
    └── pages/
        ├── auth.js
        ├── owner.js
        └── pos.js
pages/
├── auth/       Login, signup and recovery
├── admin/      Owner workspace and legacy route redirects
└── shop/       Canonical POS and shopkeeper profile
```

## UI model

The owner workspace uses hash routes inside one consistent app shell: Overview, Products, Inventory, Sales, Shopkeepers, Payments, Reports, Shop Settings and Profile. Sale detail, product editing, stock adjustment and confirmations use accessible modal dialogs. The POS uses a persistent desktop cart, large search field and explicit Cash, M-Pesa and Card states. Its card state is a reserved integration surface, not a fake card form.

Design tokens live in `variables.css`. Shared buttons, forms, tables, statuses, empty states, toasts, modals and receipt print rules live in `app.css`. The restrained green brand color is paired with warm neutral surfaces and semantic colors used only for state.

## API and session integration

`assets/js/api/config.js` contains public browser configuration. `apiClient.js` handles the response envelope, Bearer tokens, one-time refresh retries, request IDs and shared errors. `shopwiseApi.js` is the canonical endpoint facade. `auth/session.js` derives roles from `/users/me`, guards workspaces and clears sessions safely.

The frontend uses the deployed Railway API by default, including when opened through a local static server. To target another API, set `SHOPWISE_API_BASE_URL` when creating the production build. Add only a Stripe **publishable** key to the frontend build; Stripe and Resend secret keys remain backend-only.

## Production build

Build the safe static deployment artifact from the repository root:

```powershell
$env:STRIPE_PUBLISHABLE_KEY="pk_test_..."
npm run build
```

The optional public build variables are:

- `SHOPWISE_API_BASE_URL` overrides the default Railway API URL.
- `STRIPE_PUBLISHABLE_KEY` enables Stripe Elements. Use `pk_test_...` while testing and `pk_live_...` only when the backend is also in live mode.

The build creates `dist/` containing only `index.html`, `assets/`, and `pages/`. Configure Cloudflare Pages with build command `npm run build` and output directory `dist`. Never publish the repository root.

After Cloudflare assigns a domain, add its exact HTTPS origin to the backend `CORS_ORIGINS` Railway variable and redeploy the backend.

### Google Search Console verification

For HTML-file verification, download the unique `google*.html` file from Search Console and place it in the repository root without changing its name or contents. The frontend build copies matching verification files directly into `dist/`, making the file available at `https://your-domain/google....html`. Commit and redeploy before clicking **Verify** in Search Console.

The production runtime contains no mock product, inventory, sales, payment or report data. Self-service public password recovery is not exposed by the backend; owner-requested shopkeeper recovery uses the supported endpoint.
