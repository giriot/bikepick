'use client';
import { useState } from 'react';

const TOPICS = ['Data correction', 'Dealer registration', 'Used-bike listing help', 'Partnership', 'Press', 'Report abuse or fraud', 'Something else'];

export function ContactForm() {
  const [state, setState] = useState<'idle' | 'saving' | 'done'>('idle');
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setState('saving'); setError(null);
    const fd = new FormData(e.currentTarget);
    const res = await fetch('/api/leads', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        lead_type: 'contact_dealer', name: fd.get('name'), phone: fd.get('phone'),
        email: fd.get('email') || '', city: fd.get('city') || '',
        message: fd.get('message'), source: 'contact-page',
        payload: { topic: fd.get('topic') },
      }),
    });
    const json = await res.json();
    if (json.ok) setState('done'); else { setError(json.error || 'Could not send'); setState('idle'); }
  }

  if (state === 'done') {
    return (
      <div className="py-6 text-center">
        <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-emerald-100 text-[22px] text-emerald-700">✓</div>
        <p className="mt-3 text-[16px] font-semibold">Message received</p>
        <p className="mx-auto mt-1 max-w-sm text-[13px] leading-6 text-ink-mute">
          It is in our queue with a reference against your contact details. We reply within two working days.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      {error && <p className="rounded-xl bg-rose-50 px-3 py-2 text-[13px] text-rose-800">{error}</p>}
      <div>
        <label className="label" htmlFor="topic">What is this about?</label>
        <select id="topic" name="topic" className="field" required>{TOPICS.map((t) => <option key={t}>{t}</option>)}</select>
      </div>
      <div className="grid gap-3.5 sm:grid-cols-2">
        <div><label className="label" htmlFor="name">Your name</label><input id="name" name="name" required minLength={2} className="field" /></div>
        <div><label className="label" htmlFor="phone">Phone</label><input id="phone" name="phone" required inputMode="numeric" placeholder="10-digit mobile" className="field" /></div>
        <div><label className="label" htmlFor="email">Email (optional)</label><input id="email" name="email" type="email" className="field" /></div>
        <div><label className="label" htmlFor="city">City (optional)</label><input id="city" name="city" className="field" /></div>
      </div>
      <div>
        <label className="label" htmlFor="message">Your message</label>
        <textarea id="message" name="message" required minLength={10} rows={5} className="field" placeholder="Include the model name and what is wrong, if you are reporting a data error." />
      </div>
      <button className="btn-primary" disabled={state === 'saving'}>{state === 'saving' ? 'Sending…' : 'Send message'}</button>
      <p className="hint">We use your details only to reply. See our privacy policy.</p>
    </form>
  );
}
