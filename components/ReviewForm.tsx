'use client';

import Link from 'next/link';
import { useState } from 'react';

export function ReviewForm({ productId, signedIn, variants }: { productId: string; signedIn: boolean; variants: string[] }) {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<'idle' | 'saving' | 'done'>('idle');
  const [error, setError] = useState<string | null>(null);

  if (!signedIn) {
    return (
      <div className="card flex flex-wrap items-center justify-between gap-3 p-4">
        <p className="text-[13px] text-ink-mute">Owned this bike? Sign in to write a review. Every review is moderated before publication.</p>
        <Link href="/login" className="btn-outline btn-sm">Sign in to review</Link>
      </div>
    );
  }

  if (state === 'done') {
    return (
      <div className="card p-4 text-[13px] text-ink-soft">
        Thank you — your review has been submitted for moderation. It will appear once approved. We never publish
        fabricated or incentivised reviews.
      </div>
    );
  }

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setState('saving'); setError(null);
    const f = new FormData(e.currentTarget);
    const res = await fetch('/api/reviews', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        product_id: productId, rating: f.get('rating'), title: f.get('title'),
        variant_name: f.get('variant_name'), pros: f.get('pros'), cons: f.get('cons'),
        body: f.get('body'), ownership_months: f.get('ownership_months') || undefined,
        km_driven: f.get('km_driven') || undefined,
      }),
    });
    const json = await res.json();
    if (json.ok) setState('done'); else { setState('idle'); setError(json.error || 'Could not submit review'); }
  };

  return (
    <div className="card p-4">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="btn-outline btn-sm">
        {open ? 'Cancel' : 'Write an owner review'}
      </button>
      {open && (
        <form onSubmit={submit} className="mt-4 grid gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="rating" className="label">Overall rating</label>
            <select id="rating" name="rating" required className="field">
              {[5, 4, 3, 2, 1].map((r) => <option key={r} value={r}>{r} / 5</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="variant_name" className="label">Variant owned</label>
            <select id="variant_name" name="variant_name" className="field">
              <option value="">Not sure</option>
              {variants.map((v) => <option key={v} value={v}>{v}</option>)}
            </select>
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="title" className="label">Headline</label>
            <input id="title" name="title" maxLength={120} className="field" placeholder="Great commuter, thirsty on highways" />
          </div>
          <div>
            <label htmlFor="ownership_months" className="label">Ownership (months)</label>
            <input id="ownership_months" name="ownership_months" type="number" min={0} max={600} className="field" />
          </div>
          <div>
            <label htmlFor="km_driven" className="label">Kilometres ridden</label>
            <input id="km_driven" name="km_driven" type="number" min={0} className="field" />
          </div>
          <div>
            <label htmlFor="pros" className="label">Pros</label>
            <textarea id="pros" name="pros" rows={2} className="field" />
          </div>
          <div>
            <label htmlFor="cons" className="label">Cons</label>
            <textarea id="cons" name="cons" rows={2} className="field" />
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="body" className="label">Your experience</label>
            <textarea id="body" name="body" rows={4} required minLength={20} className="field" placeholder="Tell other buyers how it actually performs day to day." />
          </div>
          {error && <p className="err sm:col-span-2" role="alert">{error}</p>}
          <div className="sm:col-span-2">
            <button type="submit" disabled={state === 'saving'} className="btn-primary btn-sm">
              {state === 'saving' ? 'Submitting…' : 'Submit for moderation'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
