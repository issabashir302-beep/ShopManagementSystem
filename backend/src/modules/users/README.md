# Users module

Owns the authenticated user's `public.users` application profile.

## Endpoints

- `GET /api/v1/users/me` — returns the caller's safe profile fields.
- `PATCH /api/v1/users/me` — updates `fullName`, `phone`, `username`, and/or `profileCompleted`.

Protected or unknown fields—including `id`, `email`, `userRole`, timestamps, and deletion state—produce `400 VALIDATION_ERROR`. Queries run with the caller's access token, so database RLS and column grants reinforce backend validation.

Run `npm test` from `backend/`.
