import React, { useState } from 'react';
import { createEnquiry } from '../lib/api';
import { useApp } from '../context/AppContext';
import { Button, Field, Input, Modal, Textarea } from './ui';

export interface EnquiryContext {
  type: 'contact_seller' | 'dealer_offer' | 'callback' | 'general';
  title: string;
  subject: string; // human readable "you are enquiring about…"
  bike_model_id?: string | null;
  used_bike_id?: string | null;
  dealer_offer_id?: string | null;
  to_user_id?: string | null;
  to_dealer_id?: string | null;
}

/**
 * Secure enquiry form. Private seller phone/email is never displayed —
 * enquiries are routed through Supabase and the owner is notified.
 */
export default function EnquiryModal({ ctx, open, onClose }: { ctx: EnquiryContext; open: boolean; onClose: () => void }) {
  const { profile, toast } = useApp();
  const [name, setName] = useState(profile?.full_name || '');
  const [phone, setPhone] = useState(profile?.phone || '');
  const [email, setEmail] = useState(profile?.email || '');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!name.trim()) return setError('Please enter your name.');
    if (!/^[6-9]\d{9}$/.test(phone.replace(/\s/g, ''))) return setError('Enter a valid 10-digit Indian mobile number.');
    if (email && !/^\S+@\S+\.\S+$/.test(email)) return setError('Enter a valid email or leave it blank.');
    setBusy(true);
    try {
      await createEnquiry({
        type: ctx.type,
        bike_model_id: ctx.bike_model_id || null,
        used_bike_id: ctx.used_bike_id || null,
        dealer_offer_id: ctx.dealer_offer_id || null,
        to_user_id: ctx.to_user_id || null,
        to_dealer_id: ctx.to_dealer_id || null,
        from_name: name.trim(),
        from_phone: phone.replace(/\s/g, ''),
        from_email: email.trim() || null,
        message: message.trim() || null,
      });
      setDone(true);
    } catch (err: any) {
      setError(err.message || 'Could not send the enquiry. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const close = () => {
    setDone(false);
    onClose();
  };

  return (
    <Modal open={open} onClose={close} title={ctx.title}>
      {done ? (
        <div className="py-4 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
            <svg className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
          </div>
          <h4 className="text-lg font-bold text-ink-900">Enquiry sent</h4>
          <p className="mx-auto mt-1 max-w-sm text-sm text-ink-500">
            {ctx.subject} The seller/dealer will reach out to you at the number you provided. We never share your number publicly.
          </p>
          <Button className="mt-5" onClick={close}>Done</Button>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <p className="rounded-lg bg-ink-50 p-3 text-sm text-ink-600">
            <strong>{ctx.subject}</strong> — leave your details and the owner will contact you. For privacy, the seller's direct contact is not shown.
          </p>
          <Field label="Your name" required>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" />
          </Field>
          <Field label="Mobile number" required>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="10-digit mobile number" inputMode="tel" />
          </Field>
          <Field label="Email (optional)">
            <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" type="email" />
          </Field>
          <Field label="Message (optional)">
            <Textarea value={message} onChange={(e) => setMessage(e.target.value)} placeholder="e.g. Is the test ride available this weekend?" />
          </Field>
          {error && <p className="text-sm font-semibold text-red-600">{error}</p>}
          <div className="flex gap-2">
            <Button type="submit" loading={busy} className="flex-1">Send enquiry</Button>
            <Button type="button" variant="outline" onClick={close}>Cancel</Button>
          </div>
        </form>
      )}
    </Modal>
  );
}
