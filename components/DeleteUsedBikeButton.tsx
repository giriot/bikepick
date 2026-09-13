'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function DeleteUsedBikeButton({ listingId }: { listingId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function remove() {
    if (!window.confirm('Delete this listing? It will be removed from your account and hidden from buyers.')) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/used-bikes/${listingId}`, { method: 'DELETE' });
      const json = await response.json();
      if (!response.ok || !json.ok) throw new Error(json.error || 'Could not delete the listing');
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not delete the listing');
      setBusy(false);
    }
  }

  return (
    <span className="inline-flex flex-col items-start gap-1">
      <button type="button" onClick={remove} disabled={busy} className="btn-ghost btn-sm text-danger hover:bg-danger-soft">
        {busy ? 'Deleting…' : 'Delete listing'}
      </button>
      {error && <span className="text-[11px] text-danger" role="alert">{error}</span>}
    </span>
  );
}
