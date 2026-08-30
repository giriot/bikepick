'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function PlanCheckout({ planId, label, disabled }: { planId: string; label: string; disabled?: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function start() {
    setBusy(true); setError(null); setMessage(null);
    const res = await fetch('/api/payments/create-order', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ purpose: 'subscription', reference_id: planId }),
    });
    const json = await res.json();
    setBusy(false);
    if (!json.ok) { setError(json.error || 'Could not start checkout'); return; }
    setMessage(json.data.message);
    router.refresh();
  }

  return (
    <div>
      <button className="btn-primary btn-sm w-full" onClick={start} disabled={busy || disabled}>
        {busy ? 'Starting…' : disabled ? 'Current plan' : label}
      </button>
      {message && <p className="mt-2 text-[12px] leading-5 text-ink-mute">{message}</p>}
      {error && <p className="mt-2 text-[12px] text-rose-700">{error}</p>}
    </div>
  );
}
