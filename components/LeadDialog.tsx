'use client';

import { useState } from 'react';

export type LeadType =
  | 'best_price' | 'contact_dealer' | 'whatsapp' | 'call' | 'request_offer' | 'test_ride'
  | 'finance' | 'insurance' | 'service' | 'inspection' | 'used_bike_enquiry' | 'bulk_purchase';

interface Props {
  leadType: LeadType;
  label: string;
  title: string;
  description: string;
  productId?: string;
  variantId?: string;
  dealerId?: string;
  offerId?: string;
  usedBikeId?: string;
  city?: string;
  source: string;
  className?: string;
  extraFields?: { name: string; label: string; type?: string; required?: boolean; options?: string[] }[];
  defaults?: { name?: string; phone?: string; email?: string; city?: string };
}

/**
 * Every lead button on the platform creates a REAL database lead through
 * /api/leads, which routes it to the dealer dashboard and records a revenue
 * event. Nothing here is decorative.
 */
export function LeadDialog(props: Props) {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<'idle' | 'saving' | 'done'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setState('saving');
    setError(null);
    const form = new FormData(e.currentTarget);
    const payload: Record<string, string> = {};
    for (const f of props.extraFields || []) payload[f.name] = String(form.get(f.name) || '');

    const res = await fetch('/api/leads', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        lead_type: props.leadType,
        name: form.get('name'),
        phone: form.get('phone'),
        email: form.get('email') || '',
        city: form.get('city') || props.city || '',
        message: form.get('message') || '',
        product_id: props.productId || '',
        variant_id: props.variantId || '',
        dealer_id: props.dealerId || '',
        offer_id: props.offerId || '',
        used_bike_id: props.usedBikeId || '',
        source: props.source,
        payload,
      }),
    });
    const json = await res.json();
    if (json.ok) setState('done');
    else { setState('idle'); setError(json.error || 'Could not submit. Please try again.'); }
  };

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={props.className || 'btn-primary'}>
        {props.label}
      </button>

      {open && (
        <div role="dialog" aria-modal="true" aria-labelledby="lead-title" className="fixed inset-0 z-[70] flex items-end justify-center bg-ink/45 p-0 backdrop-blur-sm sm:items-center sm:p-6" onClick={(e) => e.target === e.currentTarget && setOpen(false)}>
          <div className="animate-fade-up w-full max-w-md rounded-t-3xl border border-line bg-white p-6 shadow-pop sm:rounded-3xl">
            {state === 'done' ? (
              <div className="text-center">
                <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-accent-soft text-accent-dark" aria-hidden="true">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="m5 13 4 4L19 7" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
                </div>
                <h2 className="mt-4 text-lg font-semibold">Enquiry sent</h2>
                <p className="mt-2 text-sm text-ink-mute">
                  Your details have been recorded and passed to the dealer. Prices quoted by dealers must be confirmed
                  directly with them before purchase.
                </p>
                <button type="button" onClick={() => { setOpen(false); setState('idle'); }} className="btn-primary mt-5 w-full">Done</button>
              </div>
            ) : (
              <form onSubmit={submit}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 id="lead-title" className="text-lg font-semibold">{props.title}</h2>
                    <p className="mt-1 text-[13px] leading-6 text-ink-mute">{props.description}</p>
                  </div>
                  <button type="button" onClick={() => setOpen(false)} aria-label="Close" className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-line text-ink-mute hover:bg-surface">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" /></svg>
                  </button>
                </div>

                <div className="mt-4 space-y-3">
                  <div>
                    <label htmlFor="lead-name" className="label">Your name</label>
                    <input id="lead-name" name="name" required minLength={2} defaultValue={props.defaults?.name} className="field" />
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <label htmlFor="lead-phone" className="label">Mobile number</label>
                      <input id="lead-phone" name="phone" required inputMode="tel" pattern="^(\+91[- ]?)?[6-9]\d{9}$" placeholder="10-digit mobile" defaultValue={props.defaults?.phone} className="field" />
                    </div>
                    <div>
                      <label htmlFor="lead-city" className="label">City</label>
                      <input id="lead-city" name="city" defaultValue={props.defaults?.city || props.city} className="field" />
                    </div>
                  </div>
                  <div>
                    <label htmlFor="lead-email" className="label">Email <span className="font-normal text-ink-mute">(optional)</span></label>
                    <input id="lead-email" name="email" type="email" defaultValue={props.defaults?.email} className="field" />
                  </div>

                  {(props.extraFields || []).map((f) => (
                    <div key={f.name}>
                      <label htmlFor={`lead-${f.name}`} className="label">{f.label}</label>
                      {f.options ? (
                        <select id={`lead-${f.name}`} name={f.name} required={f.required} className="field"
                          value={fields[f.name] || ''} onChange={(e) => setFields((s) => ({ ...s, [f.name]: e.target.value }))}>
                          <option value="">Select…</option>
                          {f.options.map((o) => <option key={o} value={o}>{o}</option>)}
                        </select>
                      ) : (
                        <input id={`lead-${f.name}`} name={f.name} type={f.type || 'text'} required={f.required} className="field" />
                      )}
                    </div>
                  ))}

                  <div>
                    <label htmlFor="lead-message" className="label">Message <span className="font-normal text-ink-mute">(optional)</span></label>
                    <textarea id="lead-message" name="message" rows={2} className="field" />
                  </div>
                </div>

                {error && <p className="err" role="alert">{error}</p>}

                <p className="mt-3 text-[11.5px] leading-5 text-ink-mute">
                  By submitting you agree that Bikepick.IN and the selected dealer may contact you about this enquiry.
                  See our <a href="/legal/privacy" className="underline">privacy policy</a>. We never guarantee loan
                  approval, price or availability.
                </p>

                <button type="submit" disabled={state === 'saving'} className="btn-primary mt-4 w-full">
                  {state === 'saving' ? 'Sending…' : 'Submit enquiry'}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
