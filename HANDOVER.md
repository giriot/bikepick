# BIKEPICK.IN — HANDOVER / STATUS NOTES
_Last updated: 2026-09-01. Read this file at the start of a new chat to continue work._

## What this is
Next.js (App Router, Turbopack) motorcycle catalogue site **www.bikepick.in**, deployed on Vercel.
Source (CANONICAL, not git): **/home/user/bikepick-fixed**. Supabase project `fcqznkvftybzjygjfvwa` (Postgres via DATABASE_URL; RLS on; `private-documents` bucket must stay non-public).

## Deploy recipe (node_modules + vcli wipe between sessions — always re-check)
```
cd /home/user/bikepick-fixed && ([ -d node_modules ] || npm ci --no-audit --no-fund)
npx next build
cd /home/user/vcli && ([ -f node_modules/.bin/vercel ] || npm i vercel --no-audit --no-fund)
/home/user/vcli/node_modules/.bin/vercel deploy --prod --token "$VERCEL_TOKEN" --yes
```
Admin login for API tests: giriot@zohomail.in / Prasadd2@ → GET /admin/login (csrf) → POST /api/auth/login (cookie jar /tmp/oeck2).

## Recently changed (this session) — all DEPLOYED & VERIFIED
1. **Public bike page (app/bikes/[brand]/[slug]/page.tsx)**
   - Full specifications grid: compact rows (py-1.5, 12.5px), **2 cols → 3 cols on ≥1400px screens** (user asked for 3 columns, less space).
   - Pros & cons live **inside the "Price & model" spec card** (always visible): tinted `✓ Works —` (emerald) / `! Consider —` (rose) chip rows; if none saved: "Not recorded yet — the admin saves them from the AI template on the spec sheet."
   - Hero left column: gallery → compact "Why this scores N/100" (id=score). No standalone pros section under the gallery.
2. **/bikes + /electric listing (lib/queries.ts)** — scores computed LIVE (computeScore + admin weights + per-category median, same as model page) and shown on cards; "Bikepick Score" sort ranks in JS. Verified: SP 125 = 65 on both card and model page.
3. **AI template panel (components/admin/AiTemplatePanel.tsx)**
   - Generate → if ≤1 variant returned, **auto-detect runs automatically** (POST /api/admin/products/[id]/ai-variants) and merges extra variants into the "Add variant + comparison" list.
   - Amber note when 1 (or 0) variant: manual cross-check hint. Manual "Add this variant" box (name/price/colours) in the panel; the Variant specifications grid also has an always-available "+ Add variant" row (no AI needed).
   - "Re-run … (manual trigger)" button after generation.
4. **AI engine (lib/oem-ai.ts, lib/ai-template.ts, lib/oem-images.ts, lib/ai-keys.ts)** — the important bits:
   - **Gemini key pool**: `GEMINI_API_KEY`, `GEMINI_API_KEY_2`, `GEMINI_API_KEY_3` — 429 on a key auto-fails-over to the next (text + image). ← **user must add the 2nd key as Vercel env `GEMINI_API_KEY_2`** (their other working key).
   - Google Search grounding (`tools:[{google_search:{}}]`) attached to template + sweep calls; prompt only MENTIONS the search tool when the tool is attached (mentioning it without the tool → MALFORMED_FUNCTION_CALL → empty response). Degrades gracefully: search 429/empty → plain call.
   - `thinkingConfig.thinkingBudget: 4096` cap (gen-3 models burn output budget thinking → empty responses); template maxOutputTokens 16384, sweep 8192.
   - Image gen: `GEMINI_IMAGE_MODEL || 'gemini-2.5-flash-image'` (model exists, verified 429-not-404); 404 now reports "model not found — set GEMINI_IMAGE_MODEL".
5. **Admin product PATCH (app/api/admin/[resource]/[id]/route.ts)** — explicitly accepts `pros`/`cons` for products (the form boxes were removed, but the AI panel's "Save pros & cons" must really save — it was a silent no-op before).
6. **Uploads (components/admin/ProductImagesPanel.tsx)** — 4 MB pre-check + safe parse of non-JSON (Vercel "Request Entity Too Large" 413) → friendly message instead of "Unexpected token 'R'".
7. **Price auto-sync**: any variant create/update/delete re-derives product price_min/max (lib/pricing-sync.ts). Live-tested.
8. **Green-dot feature markers (lib/spec-dots.ts + page.tsx)** — Full specifications table: spec values that are class-leading/genuinely useful get a green dot; hover (desktop) or long-press (mobile) shows a dark tooltip explaining the advantage. Legend row above the table. Rules: TCS/ABS/CBS, disc brake (label-scoped), LED, digital cluster (label-scoped), alloy, tubeless, USB, ARAI 5.9/6, regen braking, long service interval (≥16000), under-seat storage; context thresholds: fuel tank ≥11 L, seat height ≤780 mm, kerb weight ≤110 kg, top speed ≥100, mileage ≥50, EV range ≥100 km (3 sub-rules: claimed / Bikepick estimate / generic), fast charge (0-80 ≤60 min), full charge ≤300 min (unit-aware toMin). Tooltip text = general knowledge only (no fabricated numbers). Column-aware tooltip anchoring (6th column anchors right, avoids card overflow-hidden clipping). Verified: FZ SFI V4 = 13 dots, Ola S1 Pro EV = 6 dots.
9. **Layout trims (user-directed, all live)** —
   - "Running cost" / "Price history" / "Source information" / "Frequently asked questions" sections all REMOVED from the bike page.
   - **Hero below the bike image now has (in order): Cost per km row → Similar models (compact list, 4 items + Compare link) → Pros & cons (tinted rows or placeholder) → Suitable for (chips from product.best_for or placeholder).**
   - **"Why this scores N/100" (id=score) sits BELOW Full specifications — pillars only, 2-col grid on sm+.**
   - Bottom "Similar + Used" section is now **Used <model> only** (full width).
   - **Green-dot fix:** `featureAdvantage` gates NEGATIVE values (—/-/N/A/No/None/not recorded…) → no dot on missing/negative specs (verified: FZ 13 dots, 0 bad).
   - **EV vs Petrol tool REBUILT (components/EvCalculator.tsx + app/tools/ev-vs-petrol/page.tsx):** two vehicle sides, each with Fuel (Petrol / Electric / Hybrid CNG+Petrol) × Type (Bikes+scooters / Bikes / Scooters) × Model picker. Hybrid per-km = user-entered ₹/km (never invented; DB has no hybrid products yet — group auto-fills when fuel_type hybrid/cng added). 5-year table adds **Battery replacement (year ~5)** row: pre-filled from ev_specs.est_battery_replacement_cost when recorded (the "AI can get it" path), else textbox; **tick-mark checkbox** includes it in the total. Generic break-even ("does the higher price pay for itself") works for any fuel pair.
   - **Front page:** Used Bikes category card REMOVED (2-col grid now); AI-generated studio photos `public/media/cat-bikes.jpg` + `cat-electric.jpg` (CategoryCard `cover` prop → object-cover).
   - **"Suitable for" from AI:** products.best_for (existing column, no migration) — ai-template.ts prompt now outputs `best_for` (2–4 phrases ≤6 words); AiTemplatePanel shows a "Suitable for" band + chip row in the Excel grid; "Save pros, cons & suitable for" button persists all three (PATCH route special case accepts pros/cons/best_for). SP 125 already had best_for saved → live chip "Regular city ride".
10. **Layout trims (older, still live)** — `Metric` helper deleted; faqJsonLd removed from bike page.

## AI key / quota situation (2026-09-01)
- Gemini key in Vercel (`AQ.Ab••••` — project 276198221443) is **sustained-429** today on ALL calls (text + image + search). Direct API tests: `gemini-2.5-flash` text = "no longer available to new users" (use gemini-3.6-flash etc.); `gemini-3.6-flash` works when quota allows; `gemini-2.5-flash-image` = 429 (exists).
- User has a **Gemini API Pro subscription** and a SECOND key that works (tested manually). → **Action for user:** add it to Vercel as `GEMINI_API_KEY_2` (Dashboard → bikepick → Settings → Environment Variables → Production). Failover is already coded + deployed.
- HF router: dead for text (402/404); image 404. OPENAI_API_KEY not set.

## Live data state
- 25 published products, 10 brands; live EVs = 2. Honda Shine100 `pro_483555076f5a4166addcaf3d77d7ffaf` = DRAFT (unpublished) — 1 variant (Standard ₹64,900); **DX variant not added yet** (researched: ex ₹72,146 BikeDekho Aug 2026, range 69,694–74,959 across sources — user to verify; add via "+ Add variant" or AI panel manual box).
- SP 125 `prd_a10000000006` (3 variants 86,017/90,017/90,567; score 65). Soft-deleted, restorable: Activa 6G `prd_a10000000001`, Unicorn 160 `prd_a10000000009`.

## Standing rules (user-directed — never break)
- No fake functionality; every button must really work. No secrets in frontend/GitHub. RLS everywhere; public sees only published data. Admin at /admin, AI features admin-surface only.
- Never alter uploaded photos; AI-GENERATED images may re-render (model name + colour printed).
- Never fabricate prices/specs/reviews — researched seeding OK, mark estimates ("Estimated"/"approx"); unknowns = N/A.
- Manual add/edit always available alongside AI. Slow think before action.

## Open items
1. User to add 2nd Gemini key (`GEMINI_API_KEY_2`) to Vercel → quota failover activates.
2. Save Shine100 pros/cons from AI template (works now) + add DX variant + Publish Shine100.
3. Restore Activa 6G / Unicorn 160? (soft-deleted). 4. AdSense units not created yet. 5. SMTP_PASS missing.
