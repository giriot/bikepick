/**
 * Seeds the legal + policy pages as editable articles (category = 'legal') so the
 * owner can rewrite them from the Admin panel without touching code.
 * Safe to re-run: existing slugs are left untouched.
 */
import 'dotenv/config';
import { db, insert, nowIso, uid } from '../lib/db';

const SITE = 'Bikepick.IN';
const EMAIL = 'support@bikepick.in';

const PAGES: { slug: string; title: string; excerpt: string; content: string }[] = [
  {
    slug: 'terms',
    title: 'Terms of Use',
    excerpt: `The rules for using ${SITE}, written in plain language.`,
    content: `## 1. Who we are

${SITE} is an independent two-wheeler comparison and marketplace platform for India. We publish specifications, prices, scores, dealer offers and classified listings for new and used bikes, EV bikes and EV scooters.

We are not a manufacturer, a dealer, a broker or a lender. We do not sell vehicles.

## 2. Accepting these terms

By using this website you accept these terms. If you do not accept them, please do not use the site.

## 3. Accuracy of information

We work hard to keep specifications and prices accurate, but we cannot guarantee them.

- Prices shown are indicative ex-showroom or on-road figures and change frequently.
- Specifications come from manufacturer material, partner feeds and admin-verified entries. Where a figure is unknown we leave it blank rather than guess.
- Dealer offers are submitted by dealers and approved by our team. They remain the dealer's commitment, not ours.
- Always confirm price, availability and specification with the dealer before you pay anything.

## 4. Your account

You are responsible for keeping your password confidential and for activity under your account. Tell us immediately if you suspect unauthorised use.

You must give accurate information. We may suspend accounts that submit false listings, fake reviews or abusive content.

## 5. Used-bike listings

Sellers are responsible for the accuracy of their listings and for the legality of the sale. Our verification checks reduce risk but do not transfer ownership risk to us. See the used-bike marketplace terms for detail.

## 6. Reviews and user content

You keep ownership of what you write. By posting, you grant us a non-exclusive licence to display and moderate it. Every review is moderated before publication. We remove content that is defamatory, fake, paid-for, or that reveals someone else's personal information.

## 7. Leads and third parties

When you request a price, a test ride, finance, insurance, servicing or an inspection, we pass your contact details to the relevant partner or dealer so they can respond. Any contract you sign is between you and them.

## 8. Intellectual property

The ${SITE} name, logo, scoring methodology, design and database structure belong to us. Brand names and model names belong to their respective owners and are used for identification only.

## 9. Limitation of liability

To the extent permitted by Indian law, we are not liable for indirect or consequential loss arising from your use of the site, from inaccurate third-party data, or from any transaction with a dealer or seller.

## 10. Governing law

These terms are governed by the laws of India. Courts in India have exclusive jurisdiction.

## 11. Contact

Questions about these terms: ${EMAIL}`,
  },
  {
    slug: 'privacy',
    title: 'Privacy Policy',
    excerpt: 'What data we collect, why we collect it, and the control you have over it.',
    content: `## What we collect

**When you browse.** Pages viewed and basic device information, used to understand which content is useful. We do not sell this data.

**When you create an account.** Name, email, and optionally phone and city.

**When you submit an enquiry.** Name, phone, optional email and city, plus the model or listing concerned.

**When you list a used bike.** Vehicle details, photos, city, and — for verification — identity and ownership documents.

## Why we collect it

- To run the service you asked for: alerts, comparisons, listings, enquiries.
- To connect you with dealers or partners when you explicitly request contact.
- To verify used-bike sellers so buyers are safer.
- To detect fraud, spam and abuse.
- To measure aggregate site usage.

## Documents and private storage

Identity and ownership documents are stored in private storage, never in a public folder, and are visible only to authorised verification staff. They are not shown on your public listing and are not shared with buyers.

## Sharing

We share your contact details with a dealer or partner only when you submit an enquiry that is addressed to them. We do not sell personal data to advertisers or data brokers.

We use service providers for hosting, email, SMS and payments. They process data on our instructions only.

## Advertising

We may display advertising, including Google AdSense. Ad networks may use cookies to serve relevant ads. You can manage this through your browser and through Google's ad settings. Advertising never influences the Bikepick Score or editorial content.

## Cookies

We use a strictly necessary cookie to keep you signed in. Analytics and advertising cookies are only set where enabled by the site operator.

## Retention

Account data is retained while your account is open. Verification documents are retained only as long as needed for the verification record and any legal obligation, then deleted.

## Your rights

You can access, correct, export or delete your data. Email ${EMAIL} and we will respond within 30 days. Deleting your account removes your personal data; anonymised aggregate statistics may remain.

## Children

The service is not intended for anyone under 18.

## Changes

We will post any material change to this policy on this page with a new effective date.`,
  },
  {
    slug: 'disclaimer',
    title: 'Disclaimer',
    excerpt: 'The limits of what our data, scores and calculators can tell you.',
    content: `## Information only

Everything on ${SITE} is published for general information. It is not professional, financial, legal or mechanical advice.

## Prices

Prices are indicative and change without notice. Ex-showroom prices exclude insurance, registration and accessories. On-road prices vary by city, dealer and time. Confirm the final figure with the dealer in writing.

## Specifications

Specifications are collected from manufacturer material, partner feeds and admin-verified entries. Manufacturers change specifications without notice. Where we do not have a verified figure, the field is left blank — we never fill gaps with estimates.

## The Bikepick Score

The Bikepick Score is our own opinion, calculated from published specifications using transparent, admin-configurable weights. It is not a safety rating, a reliability prediction or an endorsement. Advertising, dealer subscriptions and affiliate relationships have no effect on it, by design.

## Calculators

The EV vs petrol, EMI and used-price tools are estimates built from the inputs you provide. They exclude many real costs and are not quotations, valuations or loan approvals.

## Used-bike listings

Listings are created by sellers. Verification checks confirm what they say about identity and paperwork; they are not a mechanical warranty. Always inspect a vehicle and verify documents with the RTO before paying.

## Third-party links

We link to dealers, retailers and partners. We do not control their content or their conduct.`,
  },
  {
    slug: 'editorial-policy',
    title: 'Editorial & Scoring Policy',
    excerpt: 'How we decide what to publish, and why money cannot buy a better score.',
    content: `## Independence

No advertiser, dealer or manufacturer can pay to change editorial content, rankings, or the Bikepick Score. Anyone who asks is declined.

## How the Bikepick Score works

Each model is scored out of 100 across seven dimensions, using published specifications only:

- Value for money
- Features
- Performance
- Safety
- Running cost
- Comfort
- Maintenance

The weight of each dimension is set in the Admin panel and shown publicly on every score breakdown. When a specification is missing, the dimension is excluded and the remaining weights are renormalised — and we publish the resulting coverage percentage so you know how complete the score is.

The score never reads a dealer's subscription tier, an ad placement or an affiliate commission. Those fields are not available to the scoring function at all.

## Labelling paid placement

- **Sponsored** — a dealer or brand paid for that placement.
- **Featured** — a paid or editorially selected highlight, always marked.
- **Affiliate** — we may earn a commission if you buy after clicking. It does not change the price you pay.

Paid items never displace an organically ranked result without a label.

## Corrections

If we publish something wrong, we fix it and note the change. Report errors to ${EMAIL}.

## Reviews

Owner reviews are moderated before publication. We reject reviews that are paid for, written by a competitor or a dealer, abusive, or that contain personal information. We do not delete negative reviews at a brand's request.

## Demo data

While the platform is being set up, some records are marked "Demo data". These are clearly labelled everywhere they appear and can be removed by the site owner in one click.`,
  },
  {
    slug: 'affiliate-disclosure',
    title: 'Affiliate Disclosure',
    excerpt: 'How affiliate links work here and what they mean for you.',
    content: `## The short version

Some links to accessories, gear and retailer pages are affiliate links. If you buy after clicking one, we may earn a small commission. **You never pay more because of it.**

## What we will not do

- We will not change a Bikepick Score because a product has an affiliate link.
- We will not recommend a worse product because it pays a higher commission.
- We will not hide the fact that a link is an affiliate link.

## How to spot them

Every affiliate link is marked with an "Affiliate" label and carries the appropriate no-follow attributes. Clicking one takes you through our redirect so we can count the click, then straight to the retailer.

## Why we do it

Affiliate commission and advertising let us keep the comparison tools, database and calculators free to use, without charging readers or letting dealers buy better rankings.

Questions: ${EMAIL}`,
  },
  {
    slug: 'used-bike-terms',
    title: 'Used-Bike Marketplace Terms',
    excerpt: 'Rules for sellers and buyers on the Bikepick used-bike marketplace.',
    content: `## For sellers

- You must be the legal owner, or hold written authority from the owner, to sell the vehicle.
- Everything you declare — kilometres, owners, accident history, loan status, insurance — must be true. Odometer tampering is a criminal offence.
- Photos must be of the actual vehicle, taken recently. Stock or borrowed images are removed.
- You must disclose any running loan or hypothecation, and any major accident repair.
- Your listing is not public until it passes verification and is approved by our team.
- We may reject, suspend or remove a listing at any time if information appears false or the paperwork is incomplete.
- Listing is free. Optional paid promotion is clearly priced and never affects trust scores.

## For buyers

- Bikepick does not own, inspect by default, warrant or sell any listed vehicle.
- The trust score reflects completed verification checks and listing completeness. It is not a mechanical warranty and not a guarantee of the seller's conduct.
- Always: inspect the bike in person, verify the chassis number against the RC, confirm there is no outstanding loan, and check pending challans before paying.
- Never pay a deposit or full amount before you have seen the vehicle and the original documents.
- Transfer of ownership must be completed with the RTO. Until it is, the vehicle remains legally the seller's.

## Payments

Bikepick does not handle payment for vehicles. Any money changes hands directly between buyer and seller. Treat any request to pay Bikepick for a vehicle as fraud and report it to ${EMAIL}.

## Prohibited listings

Stolen vehicles, vehicles without valid documents, vehicles under an unclosed loan without disclosure, and vehicles the seller does not possess.`,
  },
  {
    slug: 'verification-terms',
    title: 'Verification Terms',
    excerpt: 'What our verification checks actually cover — and what they do not.',
    content: `## What we check

Depending on what the seller supplies, our team may complete these checks:

- **Seller identity** — a government photo ID matched to the account holder.
- **Ownership declaration** — a signed declaration that the seller owns the vehicle.
- **RC verification** — registration certificate details matched to the listing.
- **Insurance verification** — policy status and validity date.
- **Loan / hypothecation status** — whether a lender's interest is recorded.
- **Service history** — records supplied by the seller.
- **Photo authenticity** — that photos show the actual vehicle described.
- **Physical inspection** — only when explicitly booked and marked as such.

Each check is recorded as passed, failed, unavailable or not checked. We publish the result honestly, including "not checked".

## What verification is not

Verification is a documents-and-identity process. Unless a physical inspection was booked and its report is attached, verification says **nothing** about engine condition, frame damage, electrical health or remaining battery life.

A high trust score means the paperwork checks out and the listing is complete. It does not mean the bike is mechanically sound.

## Your documents

Documents you upload for verification are stored privately, are visible only to authorised verification staff, and are never shown on your public listing or shared with buyers.

## Withdrawal

We may withdraw a verification badge if new information contradicts an earlier check. Sellers are notified when this happens.`,
  },
  {
    slug: 'cookie-policy',
    title: 'Cookie Policy',
    excerpt: 'The small number of cookies this site uses.',
    content: `## Strictly necessary

**Session cookie.** Keeps you signed in. It stores an opaque token — never your password. Removing it signs you out.

## Preferences stored on your device

We keep two items in your browser's local storage, not in a cookie:

- your chosen category, so the site opens where you left off
- your comparison shortlist, so it survives a page reload

Clearing your browser data removes both.

## Analytics

Basic page-view counting happens on our own server. No third-party analytics cookie is set unless the site operator enables one.

## Advertising

If advertising is enabled, ad networks such as Google AdSense may set their own cookies to limit repetition and measure performance. Manage these through your browser settings and Google's ad preferences.

## Your control

Every modern browser lets you block or delete cookies. Blocking the session cookie will prevent you from signing in.`,
  },
  {
    slug: 'refund-policy',
    title: 'Refund & Cancellation Policy',
    excerpt: 'For dealer subscriptions, promotions and paid inspections.',
    content: `## What is paid on this platform

Browsing, comparing, listing a used bike and sending enquiries are free for buyers and private sellers.

Paid services are limited to: dealer subscription plans, promoted or featured placements, and booked physical inspections.

## Dealer subscriptions

- Plans are billed for the stated period in advance.
- You may cancel at any time; the plan runs to the end of the paid period and does not auto-renew after cancellation.
- Partial refunds are not offered once leads have been delivered under the plan.
- If we fail to deliver the service — for example, the dashboard is unavailable for an extended period — contact us and we will extend the plan or refund the affected period.

## Promotions and featured placement

Refundable pro-rata only if the placement did not run for the period purchased.

## Inspections

- Cancel at least 24 hours before the scheduled slot for a full refund.
- Cancellations inside 24 hours, or a no-show at the location, are non-refundable.
- If our inspector cannot complete the inspection for a reason within our control, you get a full refund.

## How refunds are processed

Approved refunds are returned to the original payment method within 7–10 working days. Payment gateway charges may be deducted where the gateway does not return them.

## Contact

Raise any refund request from your dashboard or email ${EMAIL} with the payment reference.`,
  },
  {
    slug: 'about',
    title: 'About Bikepick.IN',
    excerpt: 'Why we built an Indian two-wheeler comparison platform that cannot be bought.',
    content: `## The problem

Buying a two-wheeler in India means juggling half-truths. Prices differ by dealer. Specification sheets contradict each other. "Top 10" lists are quietly paid for. Used-bike ads hide the odometer story.

## What we do differently

**Blank beats guessed.** If we do not have a verified figure, the field stays empty. You will never see an invented mileage number on this site.

**Scores you can audit.** Every Bikepick Score shows its weights, its inputs and how complete the data was. If a model is missing specs, we tell you the coverage percentage instead of pretending.

**Money cannot move rankings.** Advertising, dealer subscriptions and affiliate links are all labelled, and none of them are visible to the scoring code.

**Verification with honest labels.** A used listing shows exactly which checks passed, which failed and which were never done.

## What we cover

New bikes, electric bikes and electric scooters, plus a verified used-bike marketplace. Our database is built to be category-agnostic, so the owner can switch on more categories later from the Admin panel.

## How we make money

Dealer subscriptions and leads, clearly labelled promotions, advertising, and affiliate commission on accessories. None of it changes a score or an editorial verdict.

## Talk to us

Corrections, data partnerships, dealer enquiries and press: ${EMAIL}`,
  },
];

async function main() {
  let created = 0, skipped = 0;
  for (const p of PAGES) {
    const existing = await db.get<any>('SELECT id FROM articles WHERE slug = ?', [p.slug]);
    if (existing) { skipped++; continue; }
    await insert('articles', {
      id: uid('art'),
      title: p.title,
      slug: p.slug,
      excerpt: p.excerpt,
      content: p.content,
      category: 'legal',
      author_name: 'Bikepick Team',
      reading_minutes: Math.max(2, Math.round(p.content.split(/\s+/).length / 220)),
      published: 1,
      published_at: nowIso(),
    });
    created++;
  }
  console.log(`Legal pages: ${created} created, ${skipped} already present.`);
}

main().catch((e) => { console.error(e); process.exit(1); });
