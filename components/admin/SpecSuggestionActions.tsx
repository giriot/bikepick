'use client';

import { useState } from 'react';

/** Admin actions for one spec suggestion: mark applied / dismiss. */
export function SpecSuggestionActions({ id, status }: { id: string; status: string }) {
  const [busy, setBusy] = useState(false);

  async function set(next: 'applied' | 'dismissed' | 'pending') {
    if (busy) return;
    setBusy(true);
    try {
      await fetch('/api/admin/spec-suggestions', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status: next }),
      });
      window.location.reload();
    } finally {
      setBusy(false);
    }
  }

  if (status !== 'pending') {
    return (
      <button
        type="button"
        disabled={busy}
        onClick={() => set('pending')}
        className="rounded-lg border border-line px-2.5 py-1 text-[11.5px] font-semibold text-ink-mute hover:border-ink-mute disabled:opacity-50"
      >
        Reopen
      </button>
    );
  }

  return (
    <span className="flex gap-2">
      <button
        type="button"
        disabled={busy}
        onClick={() => set('applied')}
        className="rounded-lg bg-emerald-600 px-2.5 py-1 text-[11.5px] font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
      >
        Mark applied
      </button>
      <button
        type="button"
        disabled={busy}
        onClick={() => set('dismissed')}
        className="rounded-lg border border-line px-2.5 py-1 text-[11.5px] font-semibold text-ink-mute hover:border-rose-400 hover:text-rose-600 disabled:opacity-50"
      >
        Dismiss
      </button>
    </span>
  );
}
