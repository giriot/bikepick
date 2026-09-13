'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { USED_BIKE_DOCUMENT_TYPES, usedBikeDocumentLabel, type UsedBikeDocumentType } from '@/lib/used-bike-documents';

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

export function UsedBikeDocumentUpload({ listingId, documents }: { listingId: string; documents: DocumentRow[] }) {
  const router = useRouter();
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const [rows, setRows] = useState(documents);
  const [selectedFiles, setSelectedFiles] = useState<Record<string, File | undefined>>({});
  const [uploadingType, setUploadingType] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function uploadDocument(docType: UsedBikeDocumentType) {
    const file = selectedFiles[docType];
    if (!file) {
      setError(`Choose the ${usedBikeDocumentLabel(docType)} file first`);
      return;
    }

    setUploadingType(docType);
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
      setSelectedFiles((current) => ({ ...current, [docType]: undefined }));
      if (inputRefs.current[docType]) inputRefs.current[docType]!.value = '';
      setMessage(`${usedBikeDocumentLabel(docType)} uploaded. Our verification team will review it privately.`);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not upload the document');
    } finally {
      setUploadingType(null);
    }
  }

  return (
    <section className="rounded-xl border border-line bg-surface p-4 sm:p-5" aria-labelledby={`documents-${listingId}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h4 id={`documents-${listingId}`} className="text-[13.5px] font-semibold">Verification documents</h4>
          <p className="mt-1 max-w-2xl text-[12px] leading-5 text-ink-mute">
            Upload each document on its own line. These files stay private and are visible only to authorised verifiers — never to buyers.
          </p>
        </div>
        <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-medium text-ink-mute">
          {rows.length} uploaded
        </span>
      </div>

      <div className="mt-4 divide-y divide-line border-y border-line" aria-label="Upload verification documents">
        {USED_BIKE_DOCUMENT_TYPES.map(([value, label]) => {
          const existing = rows.filter((row) => row.doc_type === value);
          const selected = selectedFiles[value];
          return (
            <div key={value} className="grid gap-3 py-3 sm:grid-cols-[minmax(0,170px)_minmax(0,1fr)_auto] sm:items-center">
              <div className="min-w-0">
                <p className="text-[12.5px] font-semibold">{label}</p>
                {existing.length > 0 && (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {existing.slice(0, 3).map((row) => (
                      <span key={row.id} className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${STATUS_TONE[row.status] || 'bg-white text-ink-mute'}`}>
                        {row.status.replace(/_/g, ' ')}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <input
                ref={(node) => { inputRefs.current[value] = node; }}
                id={`document-file-${listingId}-${value}`}
                type="file"
                accept="image/jpeg,image/png,image/webp,application/pdf"
                className="field py-2"
                onClick={(e) => { e.currentTarget.value = ''; }}
                onChange={(e) => setSelectedFiles((current) => ({ ...current, [value]: e.currentTarget.files?.[0] }))}
              />
              <button type="button" onClick={() => uploadDocument(value)} className="btn-outline btn-sm whitespace-nowrap" disabled={uploadingType !== null}>
                {uploadingType === value ? 'Uploading…' : 'Upload'}
              </button>
              {selected && <p className="text-[11px] text-ink-mute sm:col-start-2">Selected: {selected.name}</p>}
            </div>
          );
        })}
      </div>

      {message && <p className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-[12px] text-emerald-800" role="status">{message}</p>}
      {error && <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-[12px] text-rose-800" role="alert">{error}</p>}
    </section>
  );
}
