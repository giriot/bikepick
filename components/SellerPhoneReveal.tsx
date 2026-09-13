'use client';

import { useState } from 'react';

export function SellerPhoneReveal({
  usedBikeId,
  loggedIn,
  loginHref,
}: {
  usedBikeId: string;
  loggedIn: boolean;
  loginHref: string;
}) {
  const [phone, setPhone] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function reveal() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/used-bikes/${encodeURIComponent(usedBikeId)}/contact`, {
        method: 'GET',
        cache: 'no-store',
      });
      const json = await response.json();
      if (!response.ok || !json.ok || !json.data?.phone) {
        throw new Error(json.error || 'Seller phone number is unavailable');
      }
      setPhone(String(json.data.phone));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Seller phone number is unavailable');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl border border-brand-200 bg-brand-50 p-3">
      {phone ? (
        <a href={`tel:${phone}`} className="btn-primary btn-sm w-full justify-center sm:w-auto" aria-label={`Call seller at ${phone}`}>
          Call seller: {phone}
        </a>
      ) : !loggedIn ? (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-[12px] font-medium text-brand-900">Sign in as a buyer to view the registered seller number.</p>
          <a href={loginHref} className="btn-outline btn-sm bg-white">Sign in to show number</a>
        </div>
      ) : (
        <div className="flex min-w-0 flex-col items-stretch gap-1 sm:items-start">
          <button type="button" onClick={reveal} disabled={busy} className="btn-outline btn-sm w-full justify-center bg-white sm:w-auto">
            {busy ? 'Loading number…' : 'Show seller phone number'}
          </button>
          {error ? <p className="text-[11.5px] text-rose-700" role="alert">{error}</p> : <p className="text-[11px] text-ink-mute">Registered seller contact · visible only to signed-in buyers.</p>}
        </div>
      )}
    </div>
  );
}
