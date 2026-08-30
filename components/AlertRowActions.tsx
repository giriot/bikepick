'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function AlertRowActions({ id }: { id: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button className="btn-ghost btn-sm text-ink-mute" disabled={busy}
      onClick={async () => {
        setBusy(true);
        await fetch(`/api/price-alerts?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
        router.refresh();
        setBusy(false);
      }}>
      {busy ? 'Removing…' : 'Cancel'}
    </button>
  );
}
