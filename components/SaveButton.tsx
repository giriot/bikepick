'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

/** Toggles a model or used listing in the signed-in user's saved list. */
export function SaveButton({ productId, usedBikeId, initialSaved = false, className = 'btn-outline btn-sm' }: {
  productId?: string; usedBikeId?: string; initialSaved?: boolean; className?: string;
}) {
  const router = useRouter();
  const [saved, setSaved] = useState(initialSaved);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function toggle() {
    setBusy(true); setMsg(null);
    const res = await fetch('/api/account/saved', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ product_id: productId, used_bike_id: usedBikeId }),
    });
    if (res.status === 401) {
      setBusy(false);
      router.push(`/login?next=${encodeURIComponent(window.location.pathname)}`);
      return;
    }
    const json = await res.json();
    setBusy(false);
    if (!json.ok) { setMsg(json.error || 'Could not save'); return; }
    setSaved(json.data.saved);
    router.refresh();
  }

  return (
    <span className="flex w-full flex-col items-stretch">
      <button type="button" onClick={toggle} disabled={busy} className={`${className} inline-flex items-center justify-center gap-2`.trim()} aria-pressed={saved}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill={saved ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
        </svg>
        {busy ? 'Saving…' : saved ? 'Saved' : 'Save'}
      </button>
      {msg && <span className="mt-1 text-[11.5px] text-danger">{msg}</span>}
    </span>
  );
}
