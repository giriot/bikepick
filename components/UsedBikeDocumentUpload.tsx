'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

const TYPES = [
  ['identity', 'Identity proof'],
  ['rc', 'Registration certificate (RC)'],
  ['insurance', 'Insurance document'],
  ['loan_noc', 'Loan closure / NOC'],
  ['service_history', 'Service history'],
  ['other', 'Other document'],
] as const;

type DocumentRow = {
  id: string;
  doc_type: string;
  status: string;
  note?: string | null;
  created_at?: string;
};

const STATUS_TONE: Record<string, string> = {
  pending: 'bg-warn-soft text-[#8A5B00]',
  approved: 'bg-emerald-50 text-emerald-700',
  rejected: 'bg-rose-50 text-rose-700',
};

function labelFor(type: string) {
  return TYPES.find(([value]) => value === type)?.[1] || type.replace(/_/g, ' ');
}

export function UsedBikeDocumentUpload({ listingId, documents }: { listingId: string; documents: DocumentRow[] }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState(documents);
  const [docType, setDocType] = useState<string>('identity');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const file = inputRef.current?.files?.[0];
    if (!file) {
      setError('Choose a PDF or image first');
      return;
    }

    setBusy(true);
    setMessage(null);
    setError(null);

    try {
      const upload = new FormData();
      upload.append('file', file);
      upload.append('purpose', 'used_bike_document');
      const uploadResponse = await fetch('/api/uploads', { method: 'POST', body: upload });
      const uploadJson = await uploadResponse.json();
      if (!uploadResponse.ok || !uploadJson.ok || !uploadJson.data?.key) {
        throw new Error(uploadJson.error || 'Document upload failed');
      }

      const response = await fetch(`/api/used-bikes/${listingId}/documents`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ doc_type: docType, file_key: uploadJson.data.key }),
      });
      const json = await response.json();
      if (!response.ok || !json.ok) throw new Error(json.error || 'Could not save the document');

      setRows((current) => [
        {
          id: json.data.id,
          doc_type: docType,
          status: 'pending',
          created_at: new Date().toISOString(),
        },
        ...current,
      ]);
      if (inputRef.current) inputRef.current.value = '';
      setMessage('Document uploaded. Our verification team will review it privately.');
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not upload the document');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-xl border border-line bg-surface p-4 sm:p-5" aria-labelledby={`documents-${listingId}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h4 id={`documents-${listingId}`} className="text-[13.5px] font-semibold">Verification documents</h4>
          <p className="mt-1 max-w-2xl text-[12px] leading-5 text-ink-mute">
            Upload clear copies of your RC, insurance and identity proof. These files stay private and are visible only to
            authorised verifiers — never to buyers.
          </p>
        </div>
        <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-medium text-ink-mute">
          {rows.length} uploaded
        </span>
      </div>

      {rows.length > 0 && (
        <ul className="mt-4 grid gap-2 sm:grid-cols-2" aria-label="Uploaded documents">
          {rows.map((row) => (
            <li key={row.id} className="flex min-w-0 items-center justify-between gap-3 rounded-lg border border-line bg-white px-3 py-2.5">
              <span className="min-w-0 truncate text-[12.5px] font-medium">{labelFor(row.doc_type)}</span>
              <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10.5px] font-semibold ${STATUS_TONE[row.status] || 'bg-surface text-ink-mute'}`}>
                {row.status.replace(/_/g, ' ')}
              </span>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={submit} className="mt-4 grid gap-3 border-t border-line pt-4 sm:grid-cols-[minmax(0,220px)_minmax(0,1fr)_auto] sm:items-end">
        <div>
          <label className="label" htmlFor={`document-type-${listingId}`}>Document type</label>
          <select id={`document-type-${listingId}`} value={docType} onChange={(e) => setDocType(e.target.value)} className="field">
            {TYPES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </div>
        <div>
          <label className="label" htmlFor={`document-file-${listingId}`}>File (PDF or image, max 10 MB)</label>
          <input ref={inputRef} id={`document-file-${listingId}`} type="file" accept="image/jpeg,image/png,image/webp,application/pdf" className="field py-2" />
        </div>
        <button type="submit" className="btn-outline btn-sm whitespace-nowrap" disabled={busy}>
          {busy ? 'Uploading…' : 'Upload document'}
        </button>
      </form>

      {message && <p className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-[12px] text-emerald-800" role="status">{message}</p>}
      {error && <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-[12px] text-rose-800" role="alert">{error}</p>}
    </section>
  );
}
