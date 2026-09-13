'use client';

import { useState } from 'react';

export function SellerPhoneReveal({ usedBikeId }: { usedBikeId: string }) {
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

  if (phone) {
    return (
      <a href={`tel:${phone}`} className="btn-outline btn-sm w-full justify-center sm:w-auto" aria-label={`Call seller at ${phone}`}>
        Call seller: {phone}
      </a>
    );
  }

  return (
    <div className="flex min-w-0 flex-col items-stretch gap-1 sm:items-start">
      <button type="button" onClick={reveal} disabled={busy} className="btn-outline btn-sm w-full justify-center sm:w-auto">
        {busy ? 'Loading number…' : 'Show seller phone number'}
      </button>
      {error ? <p className="text-[11.5px] text-rose-700" role="alert">{error}</p> : <p className="text-[11px] text-ink-mute">Registered seller contact · number is revealed on request.</p>}
    </div>
  );
}
