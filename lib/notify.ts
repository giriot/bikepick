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
}
