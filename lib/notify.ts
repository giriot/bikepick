import 'server-only';
import { insert, uid } from './db';
import { getSettings, isOn } from './settings';
import { emailService } from '@/services/email';
import { smsService } from '@/services/sms';

export type NotificationEvent =
  | 'price_drop' | 'used_bike_approved' | 'used_bike_rejected' | 'used_bike_info_required'
  | 'dealer_response' | 'dealer_verified' | 'dealer_rejected' | 'offer_expiring'
  | 'offer_approved' | 'new_matching_bike' | 'verification_result' | 'new_lead'
  | 'review_published' | 'payment_received';

export interface NotifyInput {
  userId: string | null;
  event: NotificationEvent;
  title: string;
  body?: string;
  link?: string;
  email?: string | null;
  phone?: string | null;
}

/**
 * Fan-out to in-app (always), email and SMS/WhatsApp (only when the admin has
 * enabled them AND a provider key exists). Providers are abstractions — with no
 * key configured they record the intent instead of failing.
 */
export async function notify(input: NotifyInput): Promise<void> {
  const settings = await getSettings();

  await insert('notifications', {
    id: uid('ntf'),
    user_id: input.userId,
    channel: 'in_app',
    event_type: input.event,
    title: input.title,
    body: input.body || null,
    link: input.link || null,
    delivery_status: 'delivered',
  });

  if (isOn(settings.notifications_email_enabled) && input.email) {
    const res = await emailService.send({
      to: input.email,
      subject: input.title,
      text: `${input.body || ''}\n\n${input.link ? `https://bikepick.in${input.link}` : ''}`.trim(),
    });
    await insert('notifications', {
      id: uid('ntf'), user_id: input.userId, channel: 'email', event_type: input.event,
      title: input.title, body: input.body || null, link: input.link || null,
      delivery_status: res.delivered ? 'sent' : res.reason || 'skipped',
    });
  }

  if (isOn(settings.notifications_sms_enabled) && input.phone) {
    const res = await smsService.send({ to: input.phone, message: `${input.title}. ${input.body || ''}`.slice(0, 300) });
    await insert('notifications', {
      id: uid('ntf'), user_id: input.userId, channel: 'sms', event_type: input.event,
      title: input.title, body: input.body || null, link: input.link || null,
      delivery_status: res.delivered ? 'sent' : res.reason || 'skipped',
    });
  }

  // Owner copy: the site owner receives every site event by email (new dealer
  // applications, new listings, new leads, contact messages…) so nothing
  // waiting for a decision is missed. Independent of the user-facing
  // notifications_email_enabled switch — that one only controls buyer/seller
  // notification emails.
  const owner = settings.owner_email;
  if (owner && owner.toLowerCase() !== (input.email || '').toLowerCase()) {
    const ownerMsg = {
      to: owner,
      subject: `[Bikepick.IN] ${input.title}`,
      text: [
        input.body || '',
        '',
        `Event: ${input.event}`,
        `From: ${input.email || 'guest'}`,
        input.phone ? `Phone: ${input.phone}` : null,
        input.link ? `Link: https://bikepick.in${input.link}` : null,
      ].filter(Boolean).join('\n'),
    };
    let ores = await emailService.send(ownerMsg);
    if (!ores.delivered && ores.reason === 'not_configured') {
      // Fallback until SMTP is configured: forward through FormSubmit (free,
      // zero keys). Fire-and-forget — never blocks or fails the request.
      try {
        await fetch('https://formsubmit.co/ajax/bikepick@outlook.com', {
          method: 'POST',
          headers: { 'content-type': 'application/json', accept: 'application/json' },
          body: JSON.stringify({
            _subject: ownerMsg.subject,
            message: ownerMsg.text,
            from: 'Bikepick.IN website notification',
          }),
        });
        ores = { delivered: true, provider: 'formsubmit' };
      } catch {
        ores = { delivered: false, provider: 'formsubmit', reason: 'formsubmit_error' };
      }
    }
    await insert('notifications', {
      id: uid('ntf'), user_id: input.userId, channel: 'email', event_type: `${input.event}_owner_copy`,
      title: ownerMsg.subject, body: ownerMsg.text, link: input.link || null,
      delivery_status: ores.delivered ? 'sent' : ores.reason || 'skipped',
    });
  }
}
