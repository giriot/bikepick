# AI spec-fill queue

Fills the gaps in each model's specification sheet using the existing AI template
generator — as a **durable queue**, so a provider quota limit pauses the work
instead of losing it.

Admin UI: **`/admin/ai-spec-queue`** (requires `product.write`).

## Why a queue and not a loop

The Gemini keys on this project are on a free tier that returns `429` for hours at
a time. An in-request batch would abort on the first refusal and lose every model
after it. So each model gets a row in `ai_spec_jobs` and the run is resumable:

```
queued ──▶ running ──▶ applied
              │
              ├───────▶ deferred   AI quota hit → next_run_at += backoff, retry later
              ├───────▶ skipped    nothing we were allowed to write (may hold suggestions)
              └───────▶ failed     non-quota error, after max_attempts (8)
```

* **Quota refusals do not consume the attempt budget.** Backoff is exponential:
  10m → 20m → 40m → … capped at 12h (`backoffMinutes()`).
* **`claim_token`** gates the row, so the cron route and an admin clicking *Run
  batch* cannot both apply the same model.
* Any later tick (cron, or the page's Run button) picks up whatever is due.

## What it writes — and what it refuses

* Only fields that are **currently NULL**. Curated specs are never overwritten, so
  a hallucinated answer cannot destroy a checked figure.
* `SPEC_WRITE_DENY` in `lib/ai-spec-queue.ts` lists columns only an OEM sheet can
  vouch for — `est_service_cost`, `service_interval_km`, `accessories`, `colours`,
  `warranty`, `battery_warranty`, `est_battery_replacement_cost`,
  `running_cost_per_km`. The model's answer for those is **kept as a suggestion**
  in `ai_spec_jobs.suggested_keys` and shown in the UI as “held for review”, never
  published on the AI's say-so. An empty “Not recorded yet” is honest; a plausible
  wrong number is not.
* Every apply is written to `audit_logs` (`ai_spec.fill`) with the exact keys, and
  the job stores `filled_keys` / `previous_values`, so a batch is attributable and
  reversible. **Undo last AI values** nulls exactly what the queue wrote.

Values that *are* applied are still AI-derived. Spot-check them on the model's
edit page before treating them as verified.

## Running it

| | |
|---|---|
| Admin UI | `/admin/ai-spec-queue` → Scan / Run batch (3) / Run larger (10) / Force deferred / Undo / Clear finished |
| HTTP | `GET /api/cron/ai-spec-queue` with `Authorization: Bearer $CRON_SECRET` |
| Options | `?enqueue=1` re-scan first · `&statuses=draft,published` · `&maxJobs=6` · `&budgetMs=45000` |
| API | `POST /api/admin/ai-spec-queue` `{action: enqueue\|run\|retry-now\|revert\|clear-finished}` |

Each run is bounded by `budgetMs` (default 50s, max 120s) so it finishes inside
the serverless function limit; unfinished jobs simply stay queued.

## Scheduling — read this before adding a cron entry

There is deliberately **no `crons` entry** for this route in `vercel.json`. The
project is on Vercel **Hobby**, which caps cron at 2 jobs and **rejects any
schedule more frequent than once per day** — a `*/20` entry fails the whole
deployment. (You currently ship 3 daily crons, so the count is already past the
Hobby number; the schedules are the part Vercel enforces.)

A daily tick also cannot honour a 10–20 minute quota backoff. If the project
moves to Pro, add:

```json
{ "path": "/api/cron/ai-spec-queue", "schedule": "15 2 * * *" }
```

Until then, the practical drivers are the admin button and a daily run — the queue
remembers where it got to either way.

## Single-sheet CSV

`GET /api/admin/export/spec-sheet?status=all&onlygaps=1` — one row per model, every
spec column, plus `missing_count` and `missing_fields`, for checking against OEM
data offline. Also linked from the queue panel. Cells are RFC 4180 quoted and
formula-quarantined (`=`, `+`, `-`, `@` prefixed with `'`) so the file is safe to
open in a spreadsheet.

## Files

| File | Role |
|---|---|
| `database/migrations/005_ai_spec_jobs.sql` | schema (also bundled in `lib/runtime-migrations.ts` as `008_ai_spec_jobs.sql`, so SQLite dev and Supabase stay identical) |
| `lib/ai-spec-queue.ts` | enqueue / claim / run / apply / revert, `SPEC_WRITE_DENY`, backoff |
| `app/api/admin/ai-spec-queue/route.ts` | admin API |
| `app/admin/ai-spec-queue/page.tsx` + `components/admin/AiSpecQueuePanel.tsx` | UI |
| `app/api/cron/ai-spec-queue/route.ts` | headless driver (`CRON_SECRET`) |
| `app/api/admin/export/spec-sheet/route.ts` | single-sheet CSV |
