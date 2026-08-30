'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function OfferActions({ id }: { id: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button className="btn-ghost btn-sm text-ink-mute" disabled={busy}
      onClick={async () => {
        if (!confirm('Withdraw this offer? Buyers will stop seeing it immediately.')) return;
        setBusy(true);
        await fetch(`/api/dealer/offers/${id}`, { method: 'DELETE' });
        router.refresh();
        setBusy(false);
      }}>
      {busy ? 'Withdrawing…' : 'Withdraw'}
    </button>
  );
}
