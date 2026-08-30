# Data sourcing, licensing and integrity

The commercial risk in a comparison site is not the code — it is the data. These rules
are implemented in the product, not left to good intentions.

---

## 1. Where data comes from

Bikepick.IN does not scrape and does not call undisclosed third-party APIs. Data enters
through exactly two doors, both operated by you:

1. **CSV import** — `/admin/import`
2. **Manual entry** — the admin forms

Every imported product row records a `source_name` in `product_sources`, and every
price point records its source in `price_history`. When a specification is questioned,
you can say where the figure came from.

`/admin/data-sources` registers the sources you rely on, with a trust level and the
last time each was refreshed.

## 2. Missing data stays missing

A blank cell means unknown. It is stored as `null`, rendered as "Not published", and
excluded from scoring — where it reduces that product's reported `coverage` rather than
silently helping or hurting it. Nothing is interpolated, averaged from similar models,
or filled from memory.

## 3. Fail-safe updates

If a data source fails, is unreachable, or returns an empty result, the platform
**keeps the last known good value** and marks the source as stale. An import can never
blank out a populated field: `applyImport` skips `null` values when diffing, so
uploading a partially filled file only adds what it actually contains.

Every product update from an import writes a snapshot to `product_versions`, so a bad
import can be traced and reversed.

## 4. Images and logos

Manufacturer photographs and brand logos are copyrighted. The `product_images` and
`brands` tables carry the source and a licence status field, and the shipped build uses
generated placeholder graphics rather than borrowed imagery.

Before publishing a real image, confirm one of: it is your own photograph, it is
supplied by the manufacturer or dealer with permission, or it carries a licence that
permits commercial use. Record which, in the licence field.

## 5. Paid placement can never move a score

`computeScore()` receives specifications, price and admin weights. It has no parameter
for dealer, subscription, advertising or affiliate data, so there is no code path — not
even an accidental one — by which money changes a rating. This is asserted by a test.

Sponsored offers, featured listings and affiliate links are labelled wherever they
appear, and appear in placements that are separate from ranked results.

## 6. Verification language

The words "verified" and "inspected" are used only where a record exists in
`verification_records` or `inspections` with a passed result. A listing with no checks
scores zero trust and is labelled "Needs verification". Seller-declared facts are
labelled as declared.

## 7. Estimates are labelled as estimates

The used-bike valuation, EMI schedule and EV running-cost comparison are calculations
from stated inputs, shown with their assumptions and a disclaimer. They are not
quotations, offers of finance, or valuation certificates.

## 8. Demo data

Seeded records carry `is_demo = 1` and a visible "Demo" badge, and `/about-demo-data`
explains this to visitors. Remove them in one action from `/admin/settings#demo`;
records you created are never matched by that operation.

## 9. Personal data

Leads contain names and phone numbers. Only the dealer a lead was sent to, and staff
with `lead.read`, can see one. Uploaded documents are stored private. Users can edit
their profile and notification preferences from `/account`. Publish the retention
period you actually apply in `/legal/privacy`, and keep the grievance officer details
in Settings current — Indian intermediary rules require them.
