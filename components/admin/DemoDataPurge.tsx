'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function DemoDataPurge({ counts }: { counts: Record<string, number> }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [result, setResult] = useState<string | null>(null);
  const total = Object.values(counts).reduce((a, b) => a + b, 0);

  async function purge() {
    setBusy(true);
    const res = await fetch('/api/admin/demo-data', { method: 'DELETE' });
    const json = await res.json();
    setBusy(false);
    if (json.ok) {
      setResult(`Removed ${json.data.removed} demo records. Real data was not touched.`);
      setConfirmText('');
      router.refresh();
    } else setResult(json.error || 'Could not remove demo data');
  }

  if (total === 0) {
    return <p className="text-[13px] text-ink-mute">No demo records remain — this installation is running on real data only.</p>;
  }

  return (
    <div>
      <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {Object.entries(counts).map(([k, v]) => (
          <li key={k} className="rounded-lg bg-surface px-3 py-2">
            <p className="text-[18px] font-bold leading-none">{v}</p>
            <p className="text-[11.5px] text-ink-mute">{k.replace(/_/g, ' ')}</p>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-[12.5px] leading-5 text-ink-mute">
        This permanently removes every record flagged as demo data — {total} in total — along with their images and offers.
        Records you created yourself are not flagged as demo and will not be touched.
      </p>
      {result && <p className="mt-2 rounded-xl bg-emerald-50 px-3 py-2 text-[13px] text-emerald-800">{result}</p>}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <input value={confirmText} onChange={(e) => setConfirmText(e.target.value)} placeholder="Type DELETE DEMO to confirm"
          className="field w-64" aria-label="Type DELETE DEMO to confirm" />
        <button onClick={purge} disabled={busy || confirmText !== 'DELETE DEMO'}
          className="btn-outline btn-sm border-rose-200 text-rose-700 hover:bg-rose-50 disabled:opacity-40">
          {busy ? 'Removing…' : 'Remove all demo data'}
        </button>
      </div>
    </div>
  );
}
