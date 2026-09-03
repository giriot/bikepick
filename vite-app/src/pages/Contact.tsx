import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { createEnquiry } from '../lib/api';
import { Button, Card, ErrorBlock, Field, Input, Textarea } from '../components/ui';
import { useSEO } from '../lib/seo';

/**
 * /contact — real contact form. Submissions are stored in `enquiries`
 * (type "general") and visible in the admin panel; nothing is faked.
 */
export default function ContactPage() {
  const { session, toast, settings } = useApp();
  const [form, setForm] = useState({ name: '', email: '', phone: '', subject: '', message: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const siteName = (settings['brand_name'] as string) || 'CompareBike';

  useSEO({ title: `Contact ${siteName}`, description: 'Questions, corrections, or problems? Send a message — it goes straight to the site team.' });

  const submit = async () => {
    if (!form.name.trim() || !form.message.trim()) {
      setError('Please add your name and a message.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await createEnquiry({
        type: 'general',
        from_name: form.name.trim(),
        from_phone: form.phone.trim(),
        from_email: form.email.trim(),
        from_user_id: session?.user.id || null,
        message: form.message.trim(),
      });
      setSent(true);
      toast('Message sent. The team can see it in the admin panel and will get back to you on the email you gave.', 'success');
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  if (sent)
    return (
      <div className="mx-auto max-w-xl px-4 py-20 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-2xl">✓</div>
        <h1 className="text-2xl font-black text-ink-900">Message received</h1>
        <p className="mt-2 text-sm text-ink-500">
          Thanks, {form.name.split(' ')[0]}. If you left an email or phone number, we'll use it to reply.
        </p>
      </div>
    );

  return (
    <div className="mx-auto max-w-xl px-4 py-10">
      <h1 className="text-3xl font-black text-ink-900">Contact us</h1>
      <p className="mb-8 mt-2 text-sm text-ink-500">
        Wrong spec? Broken link? Want to partner as a dealer? Tell us — every message lands directly with the site team.
      </p>

      {error && <ErrorBlock message={error} />}

      <Card className="p-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Your name" required>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Full name" />
          </Field>
          <Field label="Phone">
            <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+91…" />
          </Field>
        </div>
        <div className="mt-4">
          <Field label="Email">
            <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="you@example.com" />
          </Field>
        </div>
        <div className="mt-4">
          <Field label="Subject">
            <Input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} placeholder="What is this about?" />
          </Field>
        </div>
        <div className="mt-4">
          <Field label="Message" required>
            <Textarea className="min-h-[120px]" value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} placeholder="Write your message…" />
          </Field>
        </div>
        <Button className="mt-5 w-full" loading={busy} onClick={submit}>Send message</Button>
        <p className="mt-3 text-center text-xs text-ink-400">Your details are used only to reply. We never share them with dealers or sellers.</p>
      </Card>
    </div>
  );
}
