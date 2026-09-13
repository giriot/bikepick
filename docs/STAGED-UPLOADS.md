# Staged uploads for used-bike photos

Used-bike photos are **private until a verifier approves the listing**. Before this
change, every seller photo was written straight to the public bucket at upload time —
publicly readable days before (or without) the listing ever being approved — and
uploads that were never submitted could never be reclaimed.

## Lifecycle

1. **Upload** — `POST /api/uploads` with `purpose=used_bike_photo` writes to
   `private-docs/staging/used_bike_photo/{userId}/{uid}.{ext}`. The response carries
   the staged `key` plus a short-lived preview URL (Supabase signed URL, or the
   owner/staff-only `/api/uploads/preview` route locally). No public URL exists.
2. **Submit** — `POST /api/used-bikes` accepts only staged keys that embed the
   submitting user's id (`isOwnStagedKey`). Arbitrary URLs and other users' uploads
   are rejected (previously the endpoint accepted any string as `image_url`).
   Images are stored with `approved = 0`.
3. **Approve** — the admin *Approve & publish* action (or an edit that flips status
   to `approved`) calls `promoteUsedBikeImages` in `lib/media-staging.ts`: each
   staged object is copied to `public-media/used_bike_photo/{listingId}/…`, the row's
   `image_url` is rewritten to the public URL and `approved` set to 1, and the staged
   object is deleted. Idempotent and non-throwing — a storage failure leaves the row
   unapproved (invisible) rather than blocking approval. Public pages already filter
   on `approved = 1`, and this is also what finally sets that flag (it was never set
   anywhere before).
4. **Sweep** — `/api/cron/sweep-staging` runs daily at 02:00 UTC (vercel.json,
   `CRON_SECRET` protected). It lists `private-docs/staging/` and removes objects
   older than `staging_ttl_hours` (default 24, 0 disables) that no listing in a live
   state references — abandoned wizard uploads, and photos of rejected / expired /
   sold / deleted listings. Photos of in-flight listings are kept regardless of age.

## Storage API additions

`StorageProvider` (both Supabase and local implementations) gained:

- `remove(bucket, key)` — delete one object; `false` when it did not exist.
- `list(bucket, prefix)` — enumerate objects under a prefix with ISO `createdAt`.

## Failure modes considered

- Seller takes > 24 h to finish the wizard → staged photos are swept; the submit
  then fails validation with a "please re-upload" message rather than publishing
  broken rows.
- Promotion partially fails → affected rows stay `approved = 0`; re-running the
  approve action (or PATCHing status) retries promotion. Staged objects referenced
  by an approved listing are protected from the sweep.
- Rejecting a listing releases its staged photos to the sweep after the TTL —
  storage is reclaimable instead of orphaned forever.
