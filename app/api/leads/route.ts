import { NextRequest } from 'next/server';
import { db, insert, nowIso, uid } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { leadSchema } from '@/lib/validation';
import { handleError, ok, fail, readJson } from '@/lib/api';
import { rateLimit } from '@/lib/ratelimit';
import { notify } from '@/lib/notify';
import { getSetting } from '@/lib/settings';
import { track } from '@/lib/audit';

const REVENUE_STREAM: Record<string, string> = {
  best_price: 'dealer_lead', contact_dealer: 'dealer_lead', request_offer: 'dealer_lead',
  whatsapp: 'dealer_lead', call: 'dealer_lead', test_ride: 'test_ride',
  finance: 'finance_lead', insurance: 'insurance_lead', service: 'service_lead',
  inspection: 'inspection', bulk_purchase: 'dealer_lead', used_bike_enquiry: 'dealer_lead',
};

/**
 * Creates a REAL lead: stored, routed to a dealer where applicable, notified,
 * and recorded as a revenue event priced from admin settings.
 */
export async function POST(req: NextRequest) {
  try {
    const limited = await rateLimit('lead', { limit: 12, windowSeconds: 600 });
    if (!limited.ok) return fail(`Too many enquiries from this device. Try again in ${limited.retryAfter}s.`, 429);

    const body = leadSchema.parse(await readJson(req));
    const user = await getCurrentUser();

    let dealerId = body.dealer_id || null;

    // Route product enquiries to a verified dealer in the buyer's city when possible.
    if (!dealerId && body.product_id && ['best_price', 'test_ride', 'request_offer'].includes(body.lead_type)) {
      const match = await db.get<any>(
        `SELECT d.id FROM dealer_profiles d
           LEFT JOIN dealer_offers o ON o.dealer_id = d.id AND o.product_id = ?
          WHERE d.status = 'verified' AND d.deleted_at IS NULL
            AND (? = '' OR LOWER(d.city) = LOWER(?))
          ORDER BY (o.id IS NOT NULL) DESC, d.featured DESC LIMIT 1`,
        [body.product_id, body.city || '', body.city || ''],
      );
      dealerId = match?.id || null;
    }

    // Enforce the dealer's plan lead limit before attaching the lead.
    if (dealerId) {
      const sub = await db.get<any>(
        `SELECT s.*, p.lead_limit FROM subscriptions s JOIN subscription_plans p ON p.id = s.plan_id
          WHERE s.dealer_id = ? AND s.status='active' ORDER BY s.ends_at DESC LIMIT 1`,
        [dealerId],
      );
      if (sub && sub.leads_used >= sub.lead_limit) {
        const fallback = await db.get<any>(
          `SELECT id FROM dealer_profiles WHERE status='verified' AND deleted_at IS NULL AND id <> ? LIMIT 1`,
          [dealerId],
        );
        dealerId = fallback?.id || dealerId;
      } else if (sub) {
        await db.run('UPDATE subscriptions SET leads_used = leads_used + 1, updated_at = ? WHERE id = ?', [nowIso(), sub.id]);
      }
    }

    const leadId = await insert('leads', {
      id: uid('lead'),
      lead_type: body.lead_type,
      user_id: user?.id || null,
      name: body.name,
      phone: body.phone,
      email: body.email || null,
      product_id: body.product_id || null,
      variant_id: body.variant_id || null,
      used_bike_id: body.used_bike_id || null,
      dealer_id: dealerId,
      offer_id: body.offer_id || null,
      city: body.city || null,
      source: body.source || null,
      campaign: body.campaign || null,
      message: body.message || null,
      payload: body.payload ? JSON.stringify(body.payload) : null,
      status: 'new',
    });

    // Inspection enquiries open a real inspection workflow record.
    if (body.lead_type === 'inspection' && body.used_bike_id) {
      await insert('inspections', {
        id: uid('insp'), used_bike_id: body.used_bike_id, requested_by: user?.id || null,
        city: body.city || null, preferred_date: (body.payload as any)?.preferred_date || null, status: 'requested',
      });
    }

    // Revenue event, priced from admin settings.
    const stream = REVENUE_STREAM[body.lead_type];
    if (stream) {
      const price = Number((await getSetting('lead_price_default')) || 0);
      if (price > 0) {
        await insert('revenue_events', {
          id: uid('rev'), stream, amount: price, currency: 'INR',
          reference_type: 'lead', reference_id: leadId, dealer_id: dealerId,
          user_id: user?.id || null, occurred_at: nowIso(),
        });
      }
    }

    let dealerNotified = false;
    if (dealerId) {
      const dealer = await db.get<any>('SELECT user_id, email, phone, business_name FROM dealer_profiles WHERE id = ?', [dealerId]);
      if (dealer) {
        await notify({
          userId: dealer.user_id, event: 'new_lead',
          title: `New ${body.lead_type.replace(/_/g, ' ')} enquiry`,
          body: `${body.name} (${body.phone})${body.city ? ` from ${body.city}` : ''} submitted an enquiry.`,
          link: '/dealer/leads', email: dealer.email, phone: dealer.phone,
        });
        dealerNotified = true;
      }
    }

    // Unrouted enquiries (e.g. contact-page messages) still create a
    // notification so the owner copy fan-out in notify() emails the site
    // owner — every message sent through the website reaches them.
    if (!dealerNotified) {
      await notify({
        userId: user?.id || null, event: 'new_lead',
        title: `New ${body.lead_type.replace(/_/g, ' ')} enquiry`,
        body: [
          `${body.name} · ${body.phone}${body.city ? ` · ${body.city}` : ''}${body.email ? ` · ${body.email}` : ''}`,
          (body as any).message ? `Message: ${(body as any).message}` : null,
        ].filter(Boolean).join('\n'),
        link: '/admin/leads', email: body.email || null, phone: body.phone,
      });
    }

    await track('lead_created', { entity_type: 'lead', entity_id: leadId, user_id: user?.id, meta: { type: body.lead_type } });
    return ok({ id: leadId, routed: Boolean(dealerId) }, 'Enquiry recorded');
  } catch (e) {
    return handleError(e);
  }
}
