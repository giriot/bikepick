'use client';

import { useState } from 'react';

/**
 * "Is a specification missing or wrong?" — visitor textbox at the bottom of
 * the spec section. Submissions go to the admin review queue; nothing is
 * published without admin verification.
 */
export function SpecSuggestionForm({ productId, productName }: { productId: string; productName: string }) {
  const [message, setMessage] = useState('');
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/spec-suggestions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ product_id: productId, message: message.trim(), email: email.trim() }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.ok) throw new Error(json.error || 'Something went wrong — please try again.');
      setDone(true);
      setMessage('');
      setEmail('');
    } catch (err: any) {
      setError(err.message || 'Something went wrong — please try again.');
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
        <p className="text-[14px] font-semibold text-emerald-800">Thank you — suggestion received.</p>
        <p className="mt-1 text-[12.5px] leading-5 text-emerald-700">
          Our team verifies every suggestion against official sources before publishing. If it is correct, the
          {` ${productName}`} page will be updated.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="mt-6 rounded-2xl border border-line bg-white p-5">
      <p className="text-[14px] font-semibold">Is a specification missing or wrong?</p>
      <p className="mt-0.5 text-[12px] leading-5 text-ink-mute">
        Tell us what you think should be listed here. We verify every suggestion before publishing — nothing is added
        without checking.
      </p>
      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        required
        minLength={5}
        maxLength={300}
        rows={3}
        placeholder="e.g. Kerb weight should be 107 kg, or &quot;Fast charging&quot; is missing from the list"
        className="mt-3 w-full rounded-xl border border-line bg-white px-3.5 py-2.5 text-[13px] outline-none focus:border-brand-500"
      />
      <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          maxLength={120}
          placeholder="Your email (optional, for follow-up)"
          className="min-w-0 flex-1 basis-64 rounded-xl border border-line bg-white px-3.5 py-2 text-[13px] outline-none focus:border-brand-500"
        />
        <button
          type="submit"
          disabled={busy || message.trim().length < 5}
          className="rounded-xl bg-ink px-5 py-2 text-[13px] font-semibold text-white disabled:opacity-50"
        >
          {busy ? 'Sending…' : 'Submit suggestion'}
        </button>
      </div>
      {error && <p className="mt-2 text-[12.5px] font-medium text-rose-600">{error}</p>}
      <p className="mt-2 text-[11px] text-ink-mute">We only use this to improve the specifications. No spam, ever.</p>
    </form>
  );
}
