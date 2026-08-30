'use client';

import { useState } from 'react';

export function PriceAlertButton({ productId, currentPrice, signedIn }: { productId: string; currentPrice: number | null; signedIn: boolean }) {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<'idle' | 'saving' | 'done'>('idle');
  const [error, setError] = useState<string | null>(null);

  if (!signedIn) {
    return <a href={`/login?next=/bikes`} className="btn-outline btn-sm w-full">Sign in to set a price alert</a>;
  }

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setState('saving'); setError(null);
    const form = new FormData(e.currentTarget);
    const res = await fetch('/api/price-alerts', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ product_id: productId, target_price: form.get('target_price'), city: form.get('city') || '' }),
    });
    const json = await res.json();
    if (json.ok) setState('done'); else { setState('idle'); setError(json.error); }
  };

  return (
    <div>
      <button type="button" onClick={() => setOpen((o) => !o)} className="btn-outline btn-sm w-full" aria-expanded={open}>
        {open ? 'Cancel price alert' : 'Set a price alert'}
      </button>
      {open && (
        state === 'done' ? (
          <p className="mt-2 rounded-xl bg-accent-soft px-3 py-2 text-[13px] text-accent-dark">
            Alert saved. We will notify you when a verified price reaches your target.
          </p>
        ) : (
          <form onSubmit={submit} className="mt-2 space-y-2 rounded-xl border border-line p-3">
            <label htmlFor="target" className="label">Notify me below</label>
            <input id="target" name="target_price" type="number" required min={1000}
              defaultValue={currentPrice ? Math.round(currentPrice * 0.95) : undefined} className="field !py-2 !text-[13px]" />
            <input name="city" placeholder="City (optional)" className="field !py-2 !text-[13px]" />
            {error && <p className="err">{error}</p>}
            <button type="submit" disabled={state === 'saving'} className="btn-primary btn-sm w-full">
              {state === 'saving' ? 'Saving…' : 'Create alert'}
            </button>
            <p className="text-[11px] leading-4 text-ink-mute">
              We only trigger alerts on verified price records, never on estimates.
            </p>
          </form>
        )
      )}
    </div>
  );
}
