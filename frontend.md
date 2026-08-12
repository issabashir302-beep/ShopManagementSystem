# Frontend cutover notice

The canonical Shopwise frontend is now the React/Vite application in [`frontend/`](frontend/).

Run it from the repository root:

```powershell
npm run dev:frontend
```

Open `http://localhost:5174/` for the product landing page. Public routes include `/login`, `/signup`, `/about`, `/privacy`, `/terms`, and `/contact`. Owner routes live under `/app`; POS routes live under `/pos`.

The older root `assets/`, `pages/`, and `index.html` implementation is retained temporarily as a rollback copy. It is not the active build target. Remove it only after manual owner, shopkeeper, payment, responsive, console, and network acceptance checks pass.
