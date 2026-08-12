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

The default API URL is `http://localhost:5000/api/v1`. Serve this repository from an origin allowed by backend `CORS_ORIGINS` (the supplied development configuration includes port 5173). Add only a Stripe **test publishable key** to browser configuration; Stripe and Resend secrets remain backend-only.

The production runtime contains no mock product, inventory, sales, payment or report data. Self-service public password recovery is not exposed by the backend; owner-requested shopkeeper recovery uses the supported endpoint.
