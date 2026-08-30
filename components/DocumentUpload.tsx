'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

const TYPES = [
  ['gst_certificate', 'GST certificate'],
  ['trade_licence', 'Trade licence'],
  ['address_proof', 'Address proof'],
  ['pan_card', 'PAN card'],
  ['dealership_letter', 'Manufacturer dealership letter'],
  ['other', 'Other'],
];

export function DocumentUpload() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    const file = fd.get('file') as File;
    if (!file || file.size === 0) { setErr('Choose a file first'); return; }
    setBusy(true); setErr(null); setMsg(null);

    const up = new FormData();
    up.append('file', file);
    up.append('purpose', 'dealer_document');
    const upRes = await fetch('/api/uploads', { method: 'POST', body: up });
    const upJson = await upRes.json();
    if (!upJson.ok) { setErr(upJson.error || 'Upload failed'); setBusy(false); return; }

    const res = await fetch('/api/dealer/documents', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ doc_type: fd.get('doc_type'), file_key: upJson.data.key, note: fd.get('note') || '' }),
    });
    const json = await res.json();
    setBusy(false);
    if (!json.ok) { setErr(json.error || 'Could not save'); return; }
    setMsg('Uploaded. Our verification team will review it.');
    form.reset();
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      {msg && <p className="rounded-xl bg-emerald-50 px-3 py-2 text-[13px] text-emerald-800">{msg}</p>}
      {err && <p className="rounded-xl bg-rose-50 px-3 py-2 text-[13px] text-rose-800">{err}</p>}
      <div className="grid gap-3 sm:grid-cols-2">
        <div><label className="label" htmlFor="doc_type">Document type</label>
          <select id="doc_type" name="doc_type" className="field">{TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div>
        <div><label className="label" htmlFor="file">File (PDF or image, max 10 MB)</label>
          <input id="file" name="file" type="file" accept="image/jpeg,image/png,image/webp,application/pdf" className="field py-2" /></div>
      </div>
      <div><label className="label" htmlFor="note">Note (optional)</label>
        <input id="note" name="note" className="field" placeholder="Anything our verifier should know" /></div>
      <button className="btn-outline btn-sm" disabled={busy}>{busy ? 'Uploading…' : 'Upload document'}</button>
      <p className="hint">Documents are stored privately and are visible only to our verification team — never to buyers.</p>
    </form>
  );
}
