# Deployment

Target stack: **GitHub → Vercel → Supabase**. All three have free tiers sufficient to
launch. The application also runs on any Node 20 host.

---

## 1. Push to GitHub

```bash
git init
git add .
git commit -m "Bikepick.IN"
git branch -M main
git remote add origin git@github.com:YOUR-USER/bikepick.git
git push -u origin main
```

`.gitignore` already excludes `.env*`, `node_modules`, `.next` and `data/*.db`.
Never commit a real secret; `.env.example` is the template.

The included workflow `.github/workflows/ci.yml` runs lint, typecheck, tests and a
production build on every push and pull request.

## 2. Create the database (Supabase)

1. Create a Supabase project. Copy the **connection string** (Settings → Database →
   Connection string → URI, session mode).
2. Run the migrations against it from your machine:

```bash
DATABASE_URL="postgres://...supabase..." npm run db:migrate
DATABASE_URL="postgres://...supabase..." npm run seed:legal
DATABASE_URL="postgres://...supabase..." npm run sync:settings
DATABASE_URL="postgres://...supabase..." npm run create-admin
```

Do **not** run `db:seed` against production unless you want the demo catalogue — and
if you do, remember you can remove it later from `/admin/settings#demo`.

The data layer in `lib/db.ts` selects the driver from `DATABASE_URL`: a Postgres pool
when it is set, the local SQLite file when it is not. Application code is identical.

## 3. Deploy to Vercel

1. Import the GitHub repository at vercel.com.
2. Framework preset: **Next.js**. No build command changes needed.
3. Add environment variables (Project → Settings → Environment Variables):

| Variable | Required | Notes |
|---|---|---|
| `DATABASE_URL` | yes | Supabase Postgres URI |
| `AUTH_SECRET` | yes | `openssl rand -base64 48` |
| `NEXT_PUBLIC_SITE_URL` | yes | `https://yourdomain.in` — drives canonical URLs, sitemap and OG tags |
| `CRON_SECRET` | yes | `openssl rand -hex 32`. Cron endpoints refuse to run without it |
| `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` | no | Checkout stays in manual mode until set |
| `EMAIL_API_KEY` / `SMS_API_KEY` | no | Notifications stay in-app only until set |
| `ADSENSE_CLIENT_ID` | no | Ads also require the `ads_enabled` setting |
| `SUPABASE_*` | no | Only if you use Supabase storage for private documents |

4. Deploy, then add your custom domain and let Vercel issue the certificate.

## 4. Scheduled jobs

Three jobs keep the site honest:

| Endpoint | Does |
|---|---|
| `/api/cron/expire-offers` | Expires dealer offers past their end date, warns three days ahead |
| `/api/cron/expire-listings` | Expires used listings older than the configured window |
| `/api/cron/price-alerts` | Notifies users whose target price has been reached |

Each requires `Authorization: Bearer $CRON_SECRET` (or `?key=`).

**On Vercel** — `vercel.json` already declares the schedules. Vercel sends the
`Authorization: Bearer $CRON_SECRET` header automatically when that variable is set.

**Anywhere else (free)** — `.github/workflows/cron.yml` calls the same endpoints daily.
Add two repository secrets: `SITE_URL` and `CRON_SECRET`. Trigger it manually once from
the Actions tab to confirm it works.

## 5. Storage for private documents

Dealer documents and used-bike paperwork must never be publicly readable.
`services/storage.ts` writes them with a `private` flag and serves them only through an
authenticated route. In development they live on disk under `data/uploads`. In
production use a private Supabase Storage bucket (or S3) and set the Supabase keys —
the interface does not change.

## 6. Before you announce the site

* [ ] `npm run verify` passes locally and in CI
* [ ] Seeded passwords changed or accounts suspended
* [ ] `AUTH_SECRET` and `CRON_SECRET` are long random values, not the examples
* [ ] `NEXT_PUBLIC_SITE_URL` is your real domain
* [ ] Demo data removed, or deliberately kept and clearly badged
* [ ] Legal pages reviewed: `/legal/terms`, `/legal/privacy`, `/legal/disclaimer`,
      `/legal/affiliate-disclosure`, `/legal/refund-policy`
* [ ] Grievance officer name and contact email set in Settings (required in India)
* [ ] `/sitemap.xml` and `/robots.txt` load and reference the right domain
* [ ] Cron workflow run manually at least once
* [ ] A test lead, a test used-bike submission and a test dealer registration all
      completed end to end

## 7. Backups

Supabase takes daily backups on paid plans. On the free plan, schedule your own:

```bash
pg_dump "$DATABASE_URL" | gzip > backup-$(date +%F).sql.gz
```

Your database is the entire product — the code can be rebuilt, the data cannot.
