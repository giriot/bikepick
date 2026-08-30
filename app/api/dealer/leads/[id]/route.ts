import { NextRequest } from 'next/server';
import { z } from 'zod';
import { db, nowIso } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { handleError, ok, fail, readJson } from '@/lib/api';
import { audit } from '@/lib/audit';
import { notify } from '@/lib/notify';

const schema = z.object({
  status: z.enum(['new', 'contacted', 'quoted', 'converted', 'lost', 'invalid']),
  dealer_note: z.string().trim().max(1000).optional().or(z.literal('')),
});

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await requireUser();
    const lead = await db.get<any>(
      `SELECT l.*, d.business_name FROM leads l JOIN dealer_profiles d ON d.id = l.dealer_id
        WHERE l.id = ? AND d.user_id = ?`, [params.id, user.id],
    );
    if (!lead) return fail('Lead not found', 404);

    const body = schema.parse(await readJson(req));
    await db.run(
      `UPDATE leads SET status=?, dealer_note=?, contacted_at=?, closed_at=?, updated_at=? WHERE id=?`,
      [
        body.status, body.dealer_note || null,
        body.status === 'new' ? lead.contacted_at : (lead.contacted_at || nowIso()),
        ['converted', 'lost', 'invalid'].includes(body.status) ? nowIso() : null,
        nowIso(), params.id,
      ],
    );

    if (lead.user_id && body.dealer_note && body.dealer_note !== lead.dealer_note) {
      await notify({
        userId: lead.user_id, event: 'dealer_response',
        title: `${lead.business_name} replied to your enquiry`,
        body: body.dealer_note, link: '/account/enquiries',
      });
    }

    await audit(user, 'lead.update', 'lead', params.id, { status: body.status });
    return ok({ id: params.id }, 'Lead updated');
  } catch (e) {
    return handleError(e);
  }
}
