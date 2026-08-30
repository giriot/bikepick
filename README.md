# Bikepick.IN

Structured two-wheeler comparison & buying platform for India — Next.js 14 (App Router) + Supabase Postgres.

Public: catalogue with dynamic specs, 2–4 bike comparison, find-my-bike wizard, used-bike marketplace, dealer offers, reviews, tools (EMI / EV-vs-petrol / used-bike price), guides, SEO.
Private: user accounts, dealer console, and a role-based admin console (admin / moderator / verifier / dealer / user — permission matrix in `lib/rbac.ts`).

## Architecture (important)

- **One database, two drivers** (`lib/db.ts`):
  - `DATABASE_URL` set → **Postgres** via `pg` (production — use your Supabase project).
  - not set → **SQLite** (`better-sqlite3`) for zero-config local dev (`data/bikepick.db`, auto-migrated at boot).
- **Auth** is the app's own: users table + scrypt password hashes + signed cookie sessions (`lib/auth.ts`, needs `AUTH_SECRET`). Roles are rows in `users.role`; every API checks permissions server-side via `lib/rbac.ts`.
- **No fabricated data**: the runtime seeds **no products and no accounts**. A fresh database is empty; the UI shows honest empty states. Catalogue data comes from the admin console or CSV import.
- `vite-app/` is a separate earlier prototype (Vite + Supabase JS client). It is **not** part of the deployed Next.js app and is not built by Vercel.

## Local development

```bash
npm install
npm run dev        # http://localhost:3000  (uses local SQLite automatically)
```

Create your first account on `/register`, then promote it locally:

```bash
sqlite3 data/bikepick.db "UPDATE users SET role='admin' WHERE email='you@example.com';"
```

## Production deployment (Vercel)

### 1 · Supabase project

1. Create a project at supabase.com (free tier is fine).
2. Open **SQL Editor** and run, in order:
   ```
   database/migrations/001_init.sql
   database/migrations/002_user_prefs.sql
   database/migrations/003_user_suspension_reason.sql
   ```
   (All statements are idempotent — safe to re-run.)
3. Copy the connection string: **Project Settings → Database → Connection string → Session pooler** (port 5432, user `postgres`).

### 2 · Vercel environment variables

Project → Settings → Environment Variables (add to **Production, Preview, Development**):

| Variable | Required | Notes |
|---|---|---|
| `DATABASE_URL` | **yes** | `postgres://postgres.<ref>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres` |
| `AUTH_SECRET` | **yes** | Long random string: `openssl rand -hex 32`. If missing, sessions fail closed (nobody can stay logged in). |
| `NEXT_PUBLIC_SITE_URL` | recommended | `https://bikepick.in` (SEO canonicals) |
| `SUPABASE_SERVICE_ROLE_KEY` | optional | Only if you enable the Supabase compat layer; **never** `NEXT_PUBLIC_` |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | optional | Compat layer is a safe no-op when unset |
| `RAZORPAY_KEY_ID/SECRET`, `EMAIL_*`, `SMS_*`, `CRON_SECRET`, `ADSENSE_CLIENT_ID` | optional | Feature toggles; unset = feature off |
| `ADMIN_USERNAME`, `ADMIN_PASSWORD`, `ADMIN_SESSION_SECRET` | optional | Only for the **legacy** admin console (`/admin` cookie login). The main way to admin is a user account with `role='admin'`. Fails closed when unset. |

### 3 · Create the first admin

1. Register a normal account on the site (`/register`).
2. In Supabase **SQL Editor**:
   ```sql
   update users set role = 'admin' where email = 'you@example.com';
   ```
3. Log out and back in → `/admin` opens the admin console.

### 4 · Cron jobs

`vercel.json` schedules three cron routes (expire offers/listings, price alerts). Vercel runs them automatically; they 401 without `CRON_SECRET` matching if you enable secret checking.

## Security notes

- **No hardcoded credentials anywhere** — passwords, session secrets and the legacy admin login all come from env vars and fail closed when missing.
- The SQLite dev driver seeds **only roles and settings** on first boot (no demo users, no demo bikes).
- `.gitignore` blocks `.env*`, local databases and build output. Never commit `.env.local`.
- The legacy `/api/products` JSON catalog (`data/products.json`, used only by the old admin pages) is read from the repo file; if you don't use the legacy console you can delete those routes.

## Layout

```
app/            Next.js App Router (pages + API routes)
lib/            db driver, auth, RBAC, queries, seo, csv, admin helpers
components/     React UI (server + client)
services/       payments, notifications
database/       Supabase/Postgres migrations (portable SQL)
types/          shared TS types
vite-app/       earlier Vite prototype (not deployed)
```
