# Authentication module

Owns Supabase Auth signup, login, refresh, logout, access-token verification, and concise session identity.

## Endpoints

- `POST /api/v1/auth/signup` — public owner signup. Accepts `email`, `password`, `fullName`, and optional `phone`/`username`. Role fields are rejected.
- `POST /api/v1/auth/login` — email/password login.
- `POST /api/v1/auth/refresh` — exchanges a valid refresh token for a refreshed session.
- `POST /api/v1/auth/logout` — authenticated global Supabase sign-out.
- `GET /api/v1/auth/session` — authenticated identity only; application profile data belongs to Users.

The database Auth trigger creates the owner profile. Signup verifies that profile using the backend-only client and removes the Auth identity as compensation if the profile is missing or has the wrong role.

Supabase global sign-out revokes refresh-token sessions. Already-issued access tokens can remain usable until their expiry, so clients must also remove local tokens.

Run `npm test` from `backend/`.
