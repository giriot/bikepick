-- ═══════════════════════════════════════════════════════════════════════════
-- CompareBike — 0005_seed.sql
-- Reference data only: brands, the dynamic specification system, site
-- settings, FAQs, generic guides and legal pages.
-- NO bike data, NO fake prices/specs — the catalogue is loaded by the admin.
-- Run last.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── Brands ───────────────────────────────────────────────────────────────
insert into public.brands (name, slug, tagline) values
  ('Hero Moto',            'hero',              'India''s motorcycle pioneer'),
  ('Hero Electric',        'hero-electric',     'Electric two-wheelers by Hero Moto'),
  ('Honda',                'honda',             'Reliable Japanese engineering'),
  ('TVS',                  'tvs',               'India''s second-largest manufacturer'),
  ('Bajaj',                'bajaj',             'The Power of One'),
  ('Yamaha',               'yamaha',            'Creatormove'),
  ('Royal Enfield',        'royal-enfield',     'Big bike heritage since 1901'),
  ('Suzuki',               'suzuki',            'Peace of your mind'),
  ('KTM',                  'ktm',               'Ready to race'),
  ('Kawasaki',             'kawasaki',          'Legends of speed'),
  ('LML',                  'lml',               'Value motorcycles for India'),
  ('Hero Splendor',        'hero-splendor',     'The name that needs no introduction'),
  ('Ather',                'ather',             'Electric motorcycles, engineered in India'),
  ('Ola Electric',         'ola',               'Born electric'),
  ('Simple Energy',        'simple-energy',     'Simple, reliable EVs'),
  ('Revolt',               'revolt',            'Urban electric motorcycles')
on conflict (slug) do nothing;

-- ─── Specification groups ─────────────────────────────────────────────────
insert into public.specification_groups (name, sort_order) values
  ('Engine & Performance', 1),
  ('Dimensions', 2),
  ('Brakes & Safety', 3),
  ('Transmission & Drive', 4),
  ('Suspension', 5),
  ('Fuel & Range', 6),
  ('Battery & Charging', 7),
  ('Electronics & Features', 8),
  ('Comfort & Ergonomics', 9),
  ('Lighting', 10),
  ('Wheels & Tyres', 11),
  ('Weight & Capacity', 12),
  ('Service & Warranty', 13),
  ('Legal & Emission', 14),
  ('Exterior', 15),
  ('Variant Details', 16),
  ('Warranty & Value', 17),
  ('General', 18)
on conflict (name) do nothing;

-- ─── Standard specifications ──────────────────────────────────────────────
-- score_key links a spec into the CompareBike Score (see /admin/scores).
insert into public.specifications (group_id, name, unit, data_type, is_compare, score_key, sort_order)
select g.id, v.name, v.unit, v.data_type, v.is_compare, v.score_key, v.sort
from (values
  ('Engine & Performance', 'Engine Displacement', 'cc',    'number',  true,  'performance', 1),
  ('Engine & Performance', 'Power', 'ps',         'number',  true,  'performance', 2),
  ('Engine & Performance', 'Torque', 'Nm',        'number',  true,  'performance', 3),
  ('Engine & Performance', 'Top Speed', 'kmph',   'number',  true,  'performance', 4),
  ('Engine & Performance', 'Cylinders', '',       'text',    true,  null,          5),
  ('Engine & Performance', 'Cooling', '',         'text',    true,  null,          6),
  ('Engine & Performance', 'Bore × Stroke', 'mm',  'text',    false, null,          7),
  ('Dimensions', 'Length', 'mm',      'number',  true,  null, 1),
  ('Dimensions', 'Width', 'mm',       'number',  true,  null, 2),
  ('Dimensions', 'Height', 'mm',      'number',  true,  null, 3),
  ('Dimensions', 'Wheelbase', 'mm',   'number',  true,  null, 4),
  ('Dimensions', 'Seat Height', 'mm', 'number',  true,  'comfort', 5),
  ('Brakes & Safety', 'Front Brake', '',        'text',    true,  null, 1),
  ('Brakes & Safety', 'Rear Brake', '',         'text',    true,  null, 2),
  ('Brakes & Safety', 'ABS', '',           'boolean', true,  'safety',  3),
  ('Brakes & Safety', 'Braking System Type', '', 'text',   true,  'safety', 4),
  ('Transmission & Drive', 'Transmission', '',  'text',    true,  null, 1),
  ('Transmission & Drive', 'Gears', '',         'text',    true,  null, 2),
  ('Transmission & Drive', 'Final Drive', '',   'text',    true,  null, 3),
  ('Suspension', 'Front Suspension', '',        'text',    true,  null, 1),
  ('Suspension', 'Rear Suspension', '',         'text',    true,  null, 2),
  ('Fuel & Range', 'Mileage (Claimed)', 'kmpl', 'number',  true,  'mileage', 1),
  ('Fuel & Range', 'Fuel Tank Capacity', 'L',   'number',  true,  null, 2),
  ('Fuel & Range', 'Fuel Type', '',           'text',    true,  null, 3),
  ('Battery & Charging', 'Battery Capacity', 'kWh', 'number', true, 'ev_range', 1),
  ('Battery & Charging', 'Range (Claimed)', 'km',    'number', true, 'ev_range', 2),
  ('Battery & Charging', 'Charging Time (Full)', 'hrs', 'text', true, 'ev_range', 3),
  ('Battery & Charging', 'Charging Port', '',       'text', false, null,       4),
  ('Electronics & Features', 'Instrument Cluster', '', 'text',  true,  'features', 1),
  ('Electronics & Features', 'Connected Features', '', 'text',  true,  'features', 2),
  ('Electronics & Features', 'Side Stand Cutoff', '', 'boolean', true, 'safety',  3),
  ('Electronics & Features', 'Anti-Theft System', '',  'boolean', true, 'safety',  4),
  ('Comfort & Ergonomics', 'Seat Type', '',          'text',   true, 'comfort', 1),
  ('Comfort & Ergonomics', 'Riding Modes', '',       'text',   true, 'features', 2),
  ('Comfort & Ergonomics', 'Handlebar Type', '',     'text',   false, null,      3),
  ('Lighting', 'Headlamp', '',           'text',    true,  'features', 1),
  ('Lighting', 'Tail Lamp', '',          'text',    true,  null,          2),
  ('Lighting', 'Turn Indicators', '',    'text',    false, null,          3),
  ('Wheels & Tyres', 'Wheel Type', '',   'text',    true,  null, 1),
  ('Wheels & Tyres', 'Front Tyre', '',   'text',    true,  null, 2),
  ('Wheels & Tyres', 'Rear Tyre', '',    'text',    true,  null, 3),
  ('Wheels & Tyres', 'Tubeless Option', '', 'boolean', false, null,      4),
  ('Weight & Capacity', 'Kerb Weight', 'kg',    'number', true,  'value', 1),
  ('Weight & Capacity', 'Payload Capacity', 'kg', 'number', true, null, 2),
  ('Service & Warranty', 'Service Interval', 'km', 'text',  true, 'value', 1),
  ('Service & Warranty', 'Warranty Period', '', 'text',  true,  'value', 2),
  ('Legal & Emission', 'Emission Standard', '', 'text', true,  null, 1),
  ('Legal & Emission', 'Pollution Certificate', '', 'text', false, null, 2),
  ('Exterior', 'Body Colour Options', '', 'text', false, null, 1),
  ('Variant Details', 'Variant Name', '',      'text', false, null, 1),
  ('Variant Details', 'Ex-Showroom Price', 'INR', 'number', true, 'price', 2),
  ('Warranty & Value', 'On-Road Price', 'INR',   'number', true, 'price', 1),
  ('General', 'Launch Date', '',      'text',   true,  null, 1),
  ('General', 'Assembled In', '',     'text',   false, null, 2),
  ('General', 'Warranty Support', '', 'text',   false, null, 3)
) as v(group, name, unit, data_type, is_compare, score_key, sort)
join public.specification_groups g on g.name = v.group
on conflict do nothing;

-- ─── Site settings ────────────────────────────────────────────────────────
insert into public.site_settings (key, value) values
  ('brand_name',    '"CompareBike"'),
  ('tagline',       '"Find, compare and choose India''s perfect bike."'),
  ('score_weights', '{"performance":25,"mileage":20,"safety":15,"features":15,"comfort":10,"value":10,"price":5,"ev_range":0}'),
  ('footer_about',  '"CompareBike is an independent comparison and marketplace for motorcycles in India. We compare only published specifications and never fabricate prices, mileage or launch dates."')
on conflict (key) do update set value = excluded.value;

-- ─── FAQs ─────────────────────────────────────────────────────────────────
insert into public.faqs (question, answer, category, sort_order) values
  ('What is the CompareBike Score?',
   'The CompareBike Score is an estimate from 0 to 100 built only from published specifications, blended across six weighted categories: performance, mileage, safety, features, comfort and value. If a bike is missing data, it scores on the available categories only and is labelled as an estimate. Weights are transparent and can be seen on the Compare page.',
   'Score & Comparison', 1),
  ('Are the prices on the site official?',
   'Prices shown are what the manufacturer or the publishing dealer published. Ex-showroom prices vary by city and change over time, so treat them as a guide and confirm with your local dealer before buying. We never invent a price — if we do not have one, it shows as N/A.',
   'Pricing', 2),
  ('How are used bikes verified?',
   'Every used listing goes through an approval workflow before it is public. Sellers upload proof documents (RC, insurance) to private storage that only they and site admins can see. A listing is marked "Verified" only after an admin has reviewed the documents and the listing.',
   'Marketplace', 3),
  ('How do I become a dealer on CompareBike?',
   'Register a free account, go to "Dealer Registration", submit your business details and proof documents (GST, business proof). Once an admin verifies your application, you can post offers on the bikes you represent. Every offer is approved individually before it goes live.',
   'Dealers', 4),
  ('Can I compare electric bikes with petrol bikes?',
   'Yes — the comparison tool works across fuels. Missing categories simply show N/A for that bike, and the Score adapts to the data available. For electric bikes, battery capacity, range and charging time are compared in their own category.',
   'Score & Comparison', 5),
  ('How do I report a fake listing or wrong information?',
   'Every listing, offer and review has a "Report" option. Reports go straight to the moderation team. If something is clearly fake or unsafe, it can be hidden immediately while it is reviewed.',
   'Safety', 6),
  ('Is my contact information shared with sellers or dealers?',
   'When you send an enquiry, the name/phone/email you provide is shared with that specific recipient so they can respond. We never sell or share contact details more broadly, and you can see everything you have sent in your account area.',
   'Privacy', 7),
  ('Where does the bike data come from?',
   'Bike specifications are entered by the site team from manufacturer-published data. Anything we cannot confirm is left blank (N/A) rather than guessed. You can report corrections via the report button or the contact page.',
   'Data', 8)
on conflict do nothing;

-- ─── Guides (generic, honest — no invented statistics) ────────────────────
insert into public.articles (slug, title, subtitle, body, category, is_published, is_featured, seo_title, seo_description) values
('petrol-vs-electric-2026',
 'Petrol vs Electric Bike: How to Decide',
 'A practical framework for choosing between a petrol bike and an electric bike in India.',
 '# Petrol vs Electric: decide on three numbers

Before anything else, write down three numbers: your **daily distance**, your **home charging situation**, and your **total budget including charging infrastructure**.

## Where electric bikes are strong

- Running cost per km is far lower than petrol.
- No service visits for oil, filters or spark plugs.
- Smooth, instant low-end torque is excellent for city traffic.
- Many models offer fast battery swap or home charging options.

## Where petrol bikes are strong

- Range per "fill" is far higher — a tank lasts days where a battery lasts a day or two.
- Charging infrastructure is not something you plan around.
- Resale markets are deep and predictable.
- Service network reaches small towns.

## A simple decision rule

If 90% of your riding is under 60 km a day and you can charge at home, shortlist electric models and compare them on the Compare page using the range and charging-time specs. If you regularly ride 100+ km a day, or you live where charging is inconvenient, shortlist petrol models and compare on mileage and ownership cost.

This guide deliberately avoids made-up savings numbers — your real savings depend on your distance and electricity rates. Use the specs on each bike page to calculate your own.',
 'guide', true, true,
 'Petrol vs Electric Bike in India — Honest Buying Guide',
 'A practical, no-hype framework for choosing between a petrol and an electric bike: daily distance, charging access and total cost.'),
('first-bike-checklist',
 'First Bike? This Checklist Keeps You Safe',
 'The essentials to check before you buy and ride your first motorcycle.',
 '# Buying your first bike: a checklist

Your first bike should be **forgiving, light and cheap to run** — not the most powerful one you can imagine.

## Before you buy

- Choose a 100–125 cc commuter class first. They are lighter, cheaper to fuel, and easier to handle at low speeds.
- Sit on the bike: both feet should reach the ground comfortably.
- Confirm the **seat height**, **kerb weight** and **mileage** from the specs page — all three matter more for a beginner than power.
- Budget for the first year: insurance, PUC, a good helmet and gloves.

## Before the first ride

- Wear a certified helmet (ISI marked), closed shoes and full-sleeve clothing.
- Learn to brake with both brakes smoothly — that is 90% of safe riding.
- Practise in an empty lot before touching traffic: slow turns, stopping distances, U-turns.
- Keep both hands on the bar at stops; never rest a foot on the ground while the engine is running at a traffic light.

## After the first month

- Check tyre pressure weekly and the chain after every fill-up.
- Book the first service on time — it is usually free and it trains you to maintain the machine.
- If anything feels wrong (pulling to one side, hesitation), stop and get it checked. A well-maintained slow bike is safer than a fast one that needs repair.',
 'guide', true, false,
 'First Bike Checklist — Buy and Ride Safely',
 'What to check before buying and riding your first motorcycle: size, weight, safety gear and the first-month habits that keep you safe.'),
('used-bike-buying-tips',
 'Buying a Used Bike? Verify Before You Pay',
 'How to inspect a used motorcycle and what the documents should prove.',
 '# Buying a used bike: verify before you pay

A used bike can be a great value — if the documents and the machine agree with each other.

## Documents first, machine second

- The RC (registration certificate) name should match the seller''s ID, or there must be a valid transfer.
- Check the insurance is active and in whose name.
- Ask for the service history — even one service record tells you a lot.
- On CompareBike, verified listings have had their documents checked by an admin before going live. Look for the Verified badge, but still inspect in person.

## The 20-minute physical check

- Cold start: ask for a start from cold. Rough idle or long cranking is a sign.
- Look under the seat and around the engine for fresh oil or fuel leaks.
- Tyres: even wear, no cracks, pressure consistent both sides.
- Brakes: firm levers, no grinding, discs not deeply grooved.
- Frame: look along the spines for kinks; check the steering head for play.
- Test ride: check gears engage cleanly, no unusual noise at speed, no pulling.

## Pricing yourself

- Compare the model''s current new price, then subtract realistic depreciation for age and kilometres — use the mileage in the listing, not the seller''s memory.
- Get the asking price in writing and confirm what is included (insurance transfer, spares, accessories).
- If the price is dramatically below comparable listings, assume there is a reason and investigate before paying.

Never pay before seeing the bike and the documents together.',
 'guide', true, false,
 'Used Bike Buying Tips — Verify Before You Pay',
 'A practical used-motorcycle inspection checklist: documents, a 20-minute physical check, and how to judge a fair price.')
on conflict (slug) do nothing;

-- ─── Legal / policy pages (editable from the admin panel) ─────────────────
insert into public.seo_pages (slug, title, meta_title, meta_description, body) values
('privacy-policy', 'Privacy Policy', 'Privacy Policy | CompareBike', 'How CompareBike collects, uses and protects your personal data.',
 'We collect the information you give us when you create an account (name, email, phone), when you post a used bike (listing details and optional proof documents) or when you send an enquiry (contact details you choose to share with a specific recipient).

Proof documents you upload (RC, insurance, identity) are stored in a private bucket. Only you and approved site administrators can access them. We do not publish them and we do not use them for any purpose other than verifying your listing or dealer application.

We use your email to send account notifications (approval status, enquiries) and the contact details you provide in an enquiry are shared only with the specific seller or dealer you are contacting.

We do not sell personal data. We may process data as required to operate the marketplace, handle reports, and comply with the law. You can request access to or deletion of your data by contacting us.

Security: data is stored in Supabase with row-level security enabled on every table. Transfers happen over TLS. Despite this, no method of transmission is 100% secure.'),
('terms-of-service', 'Terms of Service', 'Terms of Service | CompareBike', 'The rules for using the CompareBike marketplace.',
 'CompareBike is a comparison and marketplace platform. We do not sell bikes, we do not handle payments, and we are not a party to transactions between buyers and sellers or between buyers and dealers.

By using the site you agree to: provide accurate information; not post false, misleading or illegal listings; not impersonate another person or business; respect the intellectual property of others; and not attempt to gain unauthorized access to any part of the system.

Listings and offers are subject to approval. We may reject, suspend or remove any listing, offer, review or account that violates these terms, and we will give a reason where possible.

Pricing: all prices and specifications shown are based on published information. We work to keep them accurate but make no warranty about completeness or timeliness. Missing data is shown as N/A and is never estimated silently.'),
('cookie-policy', 'Cookie Policy', 'Cookie Policy | CompareBike', 'What CompareBike stores in your browser and why.',
 'This site uses only the minimum browser storage needed to work:

1. Your Supabase session — so you stay signed in on this device. Stored when you log in; removed when you log out.
2. Your saved bikes and comparison list — so they survive a page refresh. Stored locally in your browser; not sent to a server unless you are signed in, in which case they are also saved to your account.
3. Your site connection (if you connected a project from the setup screen) — stored locally in your browser only.

We do not use third-party advertising cookies. Analytics, if any, are processed without personal identifiers. You can clear these at any time via your browser settings; the site will simply ask you to sign in again.'),
('disclaimer', 'Disclaimer', 'Disclaimer | CompareBike', 'Important notes about the data on this site.',
 'All specifications, prices, mileage figures and launch dates shown on this site are based on manufacturer-published data or dealer-published offers, as made available to us. We verify what we can, but we do not warrant that every figure is complete, current or error-free.

The CompareBike Score is an estimate generated from published specifications using transparent weights. It is a comparison aid, not a recommendation, and it does not account for your personal circumstances, local pricing, or the condition of a specific unit.

Always confirm prices, availability and specifications with the official manufacturer or your local dealer before making a purchase decision. For used bikes, inspect the vehicle and documents in person before paying.'),
('affiliate-disclosure', 'Affiliate Disclosure', 'Affiliate Disclosure | CompareBike', 'How CompareBike is (or is not) monetized.',
 'At present CompareBike does not run affiliate programs: links on the site go to manufacturer and dealer pages without commission arrangements that influence placement or content.

If we ever introduce sponsored placements or affiliate links, they will be clearly labelled as "Sponsored" at the point of display. Our editorial content, comparisons and the CompareBike Score will never be altered to favour a paying party.'),
('refund-policy', 'Refund Policy', 'Refund Policy | CompareBike', 'Refunds for transactions made through the marketplace.',
 'CompareBike does not process payments for vehicles, so we do not issue refunds for vehicle purchases. All transactions happen directly between buyer and seller (or buyer and dealer), and any refund is governed by the agreement between those two parties.

If you paid a deposit to a seller or dealer and the deal falls through, resolve it directly with them; you can report the dispute to us via the contact page, and we will help by providing the communication records we hold.

For any future paid services we may offer (for example featured listings for dealers), refund terms will be stated before payment is taken.'),
('shipping-policy', 'Shipping Policy', 'Shipping Policy | CompareBike', 'How vehicles move between parties on the marketplace.',
 'CompareBike is a digital marketplace: we do not ship bikes.

When a buyer and a seller (or dealer) agree, the physical handover or transport is arranged between them. For long-distance purchases we recommend: using a registered two-wheeler transport service, verifying the transport booking in writing, and completing the transfer of ownership at the RTO only after physical inspection and payment.

Dealer offers state their own pickup or delivery terms in the offer details — those terms are between you and that dealer.'),
('ip-policy', 'Intellectual Property Policy', 'Intellectual Property Policy | CompareBike', 'Ownership of content and our copyright policy.',
 'The CompareBike name, logo, code and original editorial content are owned by the site operator. Brand names, model names, logos and official specifications belong to their respective manufacturers; they are used here for identification and comparison purposes only.

Content you post (listings, photos, reviews) remains yours. By posting it you grant us a licence to display it on the platform in connection with your listing or account, and to remove it when requested or when your account is deleted.

If you believe any content on the site infringes your rights, contact us with details and we will review and act promptly, including removing the content where appropriate.')
on conflict (slug) do update set title = excluded.title, meta_title = excluded.meta_title, meta_description = excluded.meta_description, body = excluded.body, updated_at = now();

-- ═══════════════════════════════════════════════════════════════════════════
-- Done. To create the first admin, run:
--   select public.grant_role('admin', 'you@example.com');
-- (as the project owner, from the SQL editor — after signing up on the site)
-- ═══════════════════════════════════════════════════════════════════════════
