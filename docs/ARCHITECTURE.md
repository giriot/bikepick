# Architecture

Next.js 14 App Router · TypeScript (strict) · Tailwind · SQLite in development,
Postgres/Supabase in production · Vitest.

---

## Layout

```
app/                    routes — public pages, /account, /dealer, /admin, /api
components/             UI; components/admin/* is the admin toolkit
lib/                    pure logic and data access (the interesting part)
services/               external-world abstractions: email, sms, storage, payments, affiliate, pipeline
scripts/                CLI: migrate, seed, seed-legal, create-admin, sync-settings
database/migrations/    numbered .sql files, applied in order, tracked in schema_migrations
tests/                  Vitest suite
```

## The data layer

`lib/db.ts` exposes one interface — `db.get`, `db.all`, `db.run`, plus `insert` and
`update` helpers — over two drivers chosen at runtime by the presence of
`DATABASE_URL`. Placeholders, booleans and timestamps are normalised so the same query
runs on both. No ORM: the schema is SQL, and it is the source of truth.

Conventions across every table: text `id` with a typed prefix (`prd_`, `dlr_`),
ISO-8601 `created_at` / `updated_at`, soft delete via `deleted_at` where recovery
matters, and `is_demo` on anything the seed creates.

The schema is **category-agnostic on purpose**. `categories`, `products` and the
`*_specs` tables already accommodate mobiles and electronics; this build simply does
not surface them. Enabling a category later is data entry, not a migration.

## Business logic worth knowing

| Module | Responsibility |
|---|---|
| `lib/score.ts` | Bikepick Score. Pure function of specs + price + admin weights. Pillars with no data are dropped and remaining weights re-normalised, and `coverage` reports how complete the evidence was. It has no parameter through which commercial data could arrive. |
| `lib/compare.ts` | Comparison engine. Each attribute declares its own better-direction (`higher`, `lower`, `band`, `custom`), so lower price and lower kerb weight win while higher power wins, and qualitative fields like ABS type are ranked rather than compared as text. |
| `lib/trust.ts` | Used-bike trust score. Points only for verification records whose result is `passed`. |
| `lib/calculators.ts` | EV vs petrol, EMI, used-bike valuation. Every result carries its assumptions. |
| `lib/search.ts` + `lib/slug.ts` | Normalisation (`MT15` = `MT 15` = `MT-15`), tokenisation, edit-distance typo tolerance, grouped results. |
| `lib/importer.ts` | Two-phase CSV import: `planImport` diffs without writing, `applyImport` executes. |
| `lib/settings.ts` | Runtime configuration read from the `settings` table; defaults in `lib/settings-defaults.ts` (kept free of `server-only` so CLI scripts can use it). |
| `lib/rbac.ts` | Permission strings per role, `can()` / `requirePermission()`. |
| `lib/audit.ts` | `audit()` for staff actions, `track()` for anonymous product analytics. |

## The admin panel is configuration, not 28 pages

`lib/admin-config.ts` declares every managed resource: table, columns, filters,
searchable fields, form fields with types and help text, workflow actions, required
permission. Three generic routes render all of it:

* `app/admin/[resource]/page.tsx` — list, search, filter, paginate
* `app/admin/[resource]/[id]/page.tsx` — create and edit
* `app/api/admin/[resource]/...` — create, update, delete, and workflow actions

Adding a section is one entry in that file. Workflow actions declare
`set` (with `$now` / `$user` substitution), an optional `reasonColumn` that forces a
justification shown to the affected user, and an optional `notify` payload.

Bespoke screens exist only where a table editor genuinely is not the right tool:
the dashboard, settings, CSV import, revenue and analytics.

## Security

* Sessions are signed HTTP-only cookies; passwords hashed with scrypt.
* `requirePermission()` guards every admin route and API, server-side. Hiding a link is never the control.
* All input passes Zod schemas (`lib/validation.ts`); errors return `422` with a per-field map.
* Rate limits on registration, login, leads, dealer registration and uploads.
* `lib/api.ts` translates database constraint violations into readable messages and never leaks SQL to the client.
* Uploaded documents are stored private and served through an authorised route.
* Audit log records actor, action, entity and a field-level diff.

## Design system

Tokens live in `tailwind.config.ts` (`brand`, `accent`, `ink`, `line`, `surface`) and
component classes in `app/globals.css` (`.btn-*`, `.card`, `.field`, `.chip`,
`.badge-*`). Layout is mobile-first; interactive elements meet 44px touch targets;
focus rings are never removed; charts are inline SVG with `<title>` so they work
without JavaScript and without a charting dependency.

## Testing

`npm test` runs 92 tests covering scoring, comparison direction logic, trust scoring,
calculators, search normalisation, validation, CSV parsing, RBAC, admin-config
integrity, and an integration test that runs the real import planner against the real
database and asserts that planning writes nothing.
