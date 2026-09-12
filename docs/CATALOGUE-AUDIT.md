# Catalogue audit — product vs variant structure

_Audited: 2026-09-12 against live www.bikepick.in (sitemap + listing + model pages)._
_No production DB write access from this session — data fixes below are admin actions._

## Rule (confirmed correct)

| Level | What it is | Example |
|---|---|---|
| **Product (model page)** | Distinct engine / platform / price band | Xtreme **125R**, Xtreme **160R 4V**, Xtreme **250R** |
| **Variant (trim)** | Same model; price / brake / colour / feature pack differ | Raider 125 → SSE, TFT DD, Drum… |

On each model page:

1. **Full specifications** = shared model-level sheet  
2. **Variant differences** table = only what changes between trims  

**Do not** merge different cc / engine families under one “Xtreme” product.

---

## A. Hero Xtreme line — CORRECT as separate products

| Model | URL | Engine | Price from | Verdict |
|---|---|---|---|---|
| Xtreme 125R | `/bikes/hero-motocorp/hero-xtreme-125r` | ~125 cc | ₹91,500 | ✅ keep separate |
| Xtreme 160R 4V | `/bikes/hero-motocorp/hero-xtreme-160r-4v` | 163 cc 4V | ₹1,30,000 | ✅ keep separate |
| Xtreme 250R | `/bikes/hero-motocorp/hero-xtreme-250r` | 249 cc | ₹1,73,000 | ✅ keep separate |
| **Xtreme 160R (2V)** | — | 163 cc 2V | ~₹1.09–1.14L | ⚠️ **MISSING** — add as its own product |

125R / 160R 4V / 250R must **never** become variants of one “Xtreme”.

---

## B. True duplicate products (same bike twice) — MERGE

These are the same commercial model published twice under different slugs.
**Keep the richer page; unpublish/archive the thinner duplicate.**

| Keep (canonical) | Unpublish (duplicate) | Why keep the first |
|---|---|---|
| `/bikes/tvs/raider-125` — **TVS Raider 125** (7 variants, full gallery, score 67) | `/bikes/tvs/tvs-raider-125` (no variant table, score 65) | Full variant comparison already filled |
| `/bikes/royal-enfield/hunter-350` — **Hunter 350** (3 variants Retro/Metro, score 53) | `/bikes/royal-enfield/royal-enfield-hunter-350` (no variant table) | Variant table present |
| `/bikes/tvs/sport` — **Sport** (2 variants Kick/Self, score 55) | `/bikes/tvs/tvs-sport` (single price, no variants) | Variant table present |
| `/bikes/honda/Shine100` **or** `/bikes/honda/honda-shine-100` | the other | Same Shine 100 base — pick one, fix slug to `shine-100` |

### Admin steps per pair

1. Open both product pages; note which has more variants / better specs / better images.  
2. On the **keep** row: fix `name` to model-only (e.g. `Raider 125`, not `TVS Raider 125`).  
3. On the **drop** row: set status → `unpublished` or `archived` (do not hard-delete — soft-delete is safer for FKs).  
4. If the drop row had unique images/variants, copy them onto the keep row first.  
5. After unpublish, sitemap + listing counts drop automatically on next deploy/cache.

---

## C. Variant wrongly stored as its own product — CONSOLIDATE

| Current separate products | Correct structure |
|---|---|
| Honda **Shine100** / **Shine 100** + Honda **Shine 100 DX** | **One product** `Shine 100` with variants `Standard` + `DX` (DX ≈ ₹72,146 vs base ≈ ₹65k — same 99 cc platform, feature pack) |

**Do not** merge Shine 100 with Shine **125** (different displacement).

### Optional review (usually stay separate)

| Pair | Recommendation |
|---|---|
| Splendor Plus / Splendor Plus XTEC / Splendor+ Flex Fuel | Stay separate (different feature/fuel platform) **or** treat XTEC as variant of Splendor Plus if OEM lists one page |
| HF Deluxe / HF Deluxe Flex Fuel | Stay separate (flex-fuel is a distinct SKU) |
| Burgman Street 125 / Burgman Street EX | Stay separate if OEM markets EX as its own model; else EX = variant |
| iQube / iQube ST | Stay separate (ST is a higher pack / range SKU sold as its own model) |
| Gixxer SF 250 / Gixxer SF 250 Flex Fuel | Stay separate |

---

## D. Naming / slug hygiene (not structure)

| Issue | Examples | Fix |
|---|---|---|
| Brand repeated in `products.name` | `TVS Raider 125`, `Royal Enfield Hunter 350`, `Yamaha FZ-SFI V4`, `Honda SP 125`, `Ola S1 Pro` | Set `name` = model only (`Raider 125`). UI now strips double-brand via `displayName` / `modelDisplayName` even before data is cleaned. |
| Bad slugs | `Shine100`, `CB125 Hornet` (space), `hornet 180` (space) | Rename slug to `shine-100`, `cb125-hornet`, `hornet-180` + 301 if needed |
| Inconsistent brand prefix in slug | mix of `raider-125` and `tvs-raider-125` | Prefer model-only slug: `{brand_slug}/{model-slug}` without repeating brand in slug |

**Display helpers (shipped in this change):**

- `lib/format.ts` → `displayName(brand, name)` — full “Brand Model” without double brand  
- `lib/format.ts` → `modelDisplayName(brand, name)` — H1 / card title under brand label  
- Used on product page, ProductCard, ComparisonView, search (re-export)

---

## E. Families correctly kept as separate products

These look related by name but are **correctly separate** (different engine / platform):

- **Pulsar** N125 / N160 / N250 / NS125 / NS160 / NS200 / NS400Z / 125 / 150 / 220F / RS200  
- **Apache** RTR 160 4V / RTR 200 4V / RTR 310 / RR 310 / RTX 300  
- **Gixxer** / Gixxer SF / Gixxer 250 / Gixxer SF 250  
- **CB350** / CB350RS / CB350C / H’ness CB350  
- **Hornet** 2.0 / 180 / CB125 Hornet  
- **Xpulse** 200 4V / 210  
- **Xoom** 110 / 125  
- **Activa** 6G / 125 / Activa E (EV)  
- **Duke** 125 / 200 / 250 / 390 · **RC** 200 / 390  
- **Ola S1** Air / Pro / X · **Ather 450** X / S / Apex  
- **Jawa 42** / 42 Bobber / 42 FJ  

---

## F. Good example already on site

**TVS Raider 125** (`/bikes/tvs/raider-125`) is the reference pattern:

- One product  
- 7 variants with side-by-side **Variant differences** (display, seat, brakes, Bluetooth, colours, price)  
- Shared **Full specifications** sheet below  

Mirror this for Xtreme 125R (Disc/Drum etc.), Hunter, Shine 100, SP 125, etc.

---

## G. Counts

| Source | Count |
|---|---|
| Listing `/bikes` | 132 petrol models (11 pages) |
| Listing `/electric` | 19 EV models |
| Sitemap product URLs (unique) | ~151 |
| Exact duplicate pairs found | **4** |
| Missing expected model | Xtreme 160R (2V) |
| Variant-as-product candidates | Shine 100 DX → under Shine 100 |

---

## H. Automated cleanup (shipped)

`lib/catalogue-cleanup.ts` + Postgres runtime job `rt_catalogue_dedupe_2026_09`:

On the **first cold start after deploy** (or via admin API), it will:

1. Unpublish + soft-delete thinner twins: `tvs-raider-125`, `royal-enfield-hunter-350`, `tvs-sport`
2. Consolidate Honda Shine 100 twins; fold **Shine 100 DX** into Shine 100 as a DX variant
3. Strip leading brand from every live `products.name` (display-only; slugs left intact for inbound links)

### Manual trigger (admin, after deploy)

```bash
# Inspect known-dupe rows
curl -b cookies.txt https://www.bikepick.in/api/admin/catalogue-cleanup

# Run cleanup (idempotent). force=true clears the one-shot marker first.
curl -b cookies.txt -X POST -H 'Content-Type: application/json' \
  -d '{"force":true}' https://www.bikepick.in/api/admin/catalogue-cleanup
```

Or sign in as admin → any page that hits the DB once (e.g. `/admin`) triggers the boot job automatically.

### Still manual

1. **Add Hero Xtreme 160R (2V)** as its own product (not under 4V).  
2. **Fix bad slugs** that break routing — `CB125 Hornet`, `hornet 180` (spaces).  
3. **Fill variant tables** on multi-trim models that only show price_min/max (e.g. Xtreme 125R Disc/Drum).
