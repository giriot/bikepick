# Owner's guide — running Bikepick.IN without writing code

Everything below is done from the browser. You never need to edit a file or redeploy
to change how the site behaves.

---

## 1. Your first hour

1. **Sign in** at `/login` with your administrator account.
2. Go to **`/admin`**. The dashboard shows what needs your attention: listings waiting
   for review, dealer applications, pending offers, unmoderated reviews.
3. Open **`/admin/settings`** and set your contact email, tagline and colours.
4. Scroll to **Demo data** on the same page. The site ships with example bikes and
   dealers so nothing looks broken on day one. Every one of them carries a visible
   "Demo" badge. When your real data is in, type `DELETE DEMO` and remove them all.
   Records you added yourself are never touched by this.
5. Change the seeded passwords: `/admin/users` → suspend or edit each seeded account.

## 2. Getting real data in

### Option A — CSV import (fastest for bulk)

`/admin/import`

1. Choose what you are importing: products, prices, dealers or service centres.
2. **Download the CSV template.** It has the exact column names, and the column
   reference explains what each one means.
3. Fill it in. Leave a cell blank when you do not know the value — blank means
   "unknown" and is stored as such. It never overwrites a good value you already have.
4. Upload and press **Preview changes**. Nothing has been written yet. You now see,
   row by row:
   * `create` — a new record
   * `update` — with the exact fields that change, old value → new value
   * `unchanged` — identical to what is stored
   * `error` — with the reason, e.g. "price_min must be a number"
5. Press **Apply**. Rows with errors are skipped; everything else is written and the
   job is logged in `/admin/imports`.

Rows are matched on brand + model name (or business name + city for dealers), so
re-uploading a corrected file **updates** records instead of creating duplicates.

### Option B — one at a time

`/admin/products` → **New**. Same for every other section. Useful for a single
correction or a model you are adding by hand.

## 3. The daily workflow

| Queue | Where | What to do |
|---|---|---|
| Used-bike listings | `/admin/used-bikes` | Approve, reject, ask for more info, or suspend. Rejecting requires a reason of at least five characters, and that reason is shown to the seller. |
| Dealer applications | `/admin/dealers` | Check their documents in `/admin/dealers/{id}`, then verify or reject. |
| Dealer offers | `/admin/offers` | Approve or reject. You can turn on automatic approval for verified dealers in Settings. |
| Reviews | `/admin/reviews` | Publish or reject. Nothing appears on the site unmoderated. |
| Leads | `/admin/leads` | Every enquiry from the site, with the buyer's details and the page it came from. |

Every action you take is written to `/admin/audit-logs` with who did it, when, and
what changed field by field.

## 4. Settings that matter most

`/admin/settings`

* **Bikepick Score weights** — Value, Features, Performance, Safety, Running Cost,
  Comfort, Maintenance. Change them and every score recalculates on next page view.
  They must total more than zero; the editor rejects invalid JSON before saving.
* **Petrol / electricity price** — the defaults used by the EV vs petrol calculator.
  Update these when fuel prices move.
* **Minimum photos for a used listing** and **require inspection** — how strict the
  marketplace is.
* **Offer auto-expiry days** — dealer offers switch off by themselves after this long.
* **Lead price, inspection fee, featured listing price** — your commercial numbers.
* **Ads enabled / AdSense client ID** — ad slots stay invisible until both are set.
* **Affiliate tags** — your affiliate IDs per retailer, applied automatically to
  outbound links.
* **Maintenance mode** — shows a notice on the public site.

## 5. Money

`/admin/revenue` shows only money that was actually recorded: subscriptions, featured
listings, inspections and any manual entries. Nothing is projected.

**If you have no payment gateway yet**, this still works. A dealer who buys a plan
gets a `pending` payment record and instructions to pay you directly. When the money
arrives, open `/admin/payments`, mark it paid, and the subscription activates exactly
as it would have via the gateway. When you are ready, add `RAZORPAY_KEY_ID` and
`RAZORPAY_KEY_SECRET` and checkout goes live with no code change.

## 6. Growing traffic

`/admin/analytics` is counted from your own database — no tracking script required.

The most valuable panel is **"Searches with no results"**. It lists exactly what
visitors typed and found nothing for. That is your import list for next week.

Other useful sections:

* `/admin/articles` — buying guides. Good articles bring search traffic; each one has
  its own SEO title and description.
* `/admin/comparisons` — curated comparison pages such as "MT-15 vs Pulsar NS200".
* `/admin/seo` — per-page titles, descriptions and canonical URLs.
* `/admin/ad-slots` — where ads may appear. All disabled by default.

## 7. Rules the software enforces for you

These are not policies you have to remember — the code will not let them be broken:

* **A payment can never change a Bikepick Score.** The scoring function is given only
  specifications and price. It receives no dealer, subscription or advertising data.
* **Nothing is called "verified" unless a check was recorded.** Trust points come only
  from completed verification records.
* **Unknown data stays unknown.** Blank means `null`, and the page says "Not published"
  rather than inventing a plausible number.
* **Paid placements are labelled** as Sponsored, Featured or Affiliate wherever shown.
* **Rejections require a reason**, and that reason is shown to the person affected.
* **Demo records are labelled** everywhere they appear, until you delete them.

## 8. If something goes wrong

* A page shows an error → check `/admin/audit-logs` and your server logs.
* An import went wrong → `/admin/imports` keeps the full report for each job, and
  every product change is versioned in `product_versions`.
* A data source failed → `/admin/data-sources` records the failure. The platform
  **never deletes existing data because a source failed**; it keeps the last known
  good value and flags the source as stale.
* You need to undo a deletion → most sections soft-delete, so the record is still in
  the database and can be restored by clearing `deleted_at`.
