import React, { useRef, useState } from 'react';
import { validateImageFile, uploadBytes, storagePath, fileExt, type UploadedFile } from '../lib/upload';
import { Button, Spinner } from './ui';
import { useApp } from '../context/AppContext';

export interface DraftImage extends UploadedFile {
  id: string;
  recordId?: string | null; // persisted row id after save
}

// ─── Multi-image uploader (drag & drop, reorder, primary, delete) ───────────

export function ImageUploader({
  images,
  onChange,
  bucket,
  pathPrefix,
  min = 0,
  max = 12,
  label = 'Add photos',
  compact = false,
}: {
  images: DraftImage[];
  onChange: (imgs: DraftImage[]) => void;
  bucket: string;
  pathPrefix: string;
  min?: number;
  max?: number;
  label?: string;
  compact?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useApp();
  const [dragOver, setDragOver] = useState(false);

  const addFiles = async (files: FileList | File[]) => {
    setError(null);
    const list = Array.from(files).slice(0, max - images.length);
    if (!list.length) return;
    setBusy(list.length);
    const next = [...images];
    for (const file of list) {
      const problem = validateImageFile(file);
      if (problem) {
        setError(`${file.name}: ${problem}`);
        setBusy((b) => b - 1);
        continue;
      }
      try {
        const { optimizeImage } = await import('../lib/upload');
        const opt = await optimizeImage(file, 1600, 0.85);
        const uploaded = await uploadBytes(bucket, storagePath(pathPrefix, fileExt(file, opt.mime)), opt.blob, { original: file });
        next.push({ ...uploaded, id: crypto.randomUUID(), recordId: null });
      } catch (e: any) {
        setError(`Could not upload ${file.name}: ${e.message || 'upload failed'}`);
      } finally {
        setBusy((b) => b - 1);
        onChange([...next]);
      }
    }
    if (min && images.length + list.length < min) {
      toast(`Minimum ${min} photos required for this listing.`, 'info');
    }
  };

  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= images.length) return;
    const next = [...images];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };

  const remove = (i: number) => {
    onChange(images.filter((_, x) => x !== i));
  };

  return (
    <div>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          addFiles(e.dataTransfer.files);
        }}
        className={`rounded-xl border-2 border-dashed p-4 text-center transition ${dragOver ? 'border-primary-500 bg-primary-50' : 'border-ink-300 bg-white'}`}
      >
        <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" multiple hidden onChange={(e) => e.target.files && addFiles(e.target.files)} />
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="mx-auto flex flex-col items-center gap-2 py-2 text-ink-500 hover:text-ink-800"
        >
          <svg className="h-8 w-8" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 16V4m0 0L7 9m5-5l5 5M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2" />
          </svg>
          <span className="text-sm font-semibold">{label} (drag & drop or browse)</span>
          <span className="text-xs text-ink-400">JPG, PNG or WebP · up to 10 MB each · {min > 0 ? `minimum ${min} required` : ''}</span>
        </button>
      </div>

      {busy > 0 && (
        <div className="mt-3 flex items-center gap-2 text-sm text-ink-500">
          <Spinner className="h-4 w-4 text-primary-600" /> Uploading & optimizing…
        </div>
      )}
      {error && <p className="mt-2 text-xs font-semibold text-red-600">{error}</p>}
      {min > 0 && images.length < min && (
        <p className="mt-2 text-xs font-semibold text-amber-600">
          {min - images.length} more photo{min - images.length > 1 ? 's' : ''} needed (minimum {min}).
        </p>
      )}

      {images.length > 0 && (
        <div className={`mt-3 grid gap-3 ${compact ? 'grid-cols-3 sm:grid-cols-4' : 'grid-cols-2 sm:grid-cols-3'}`}>
          {images.map((img, i) => (
            <div key={img.id} className="group relative overflow-hidden rounded-lg border border-ink-200 bg-white">
              <div className="aspect-[4/3] bg-ink-100">
                <img src={img.url} alt={`Photo ${i + 1}`} className="h-full w-full object-cover" />
              </div>
              {i === 0 && (
                <span className="absolute left-1.5 top-1.5 rounded-full bg-ink-900/90 px-2 py-0.5 text-[10px] font-bold text-white">PRIMARY</span>
              )}
              <div className="flex items-center justify-between border-t border-ink-100 p-1.5">
                <span className="px-1 text-[10px] font-medium text-ink-400">{i + 1}/{images.length}</span>
                <span className="flex gap-0.5">
                  <MiniBtn onClick={() => move(i, -1)} disabled={i === 0} label="Move earlier">←</MiniBtn>
                  <MiniBtn onClick={() => move(i, 1)} disabled={i === images.length - 1} label="Move later">→</MiniBtn>
                  <MiniBtn onClick={() => remove(i)} label="Remove" danger>✕</MiniBtn>
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function MiniBtn({ children, onClick, disabled, label, danger = false }: { children: React.ReactNode; onClick: () => void; disabled?: boolean; label: string; danger?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className={`rounded px-1.5 py-0.5 text-xs font-bold transition disabled:opacity-30 ${danger ? 'text-red-500 hover:bg-red-50' : 'text-ink-500 hover:bg-ink-100'}`}
    >
      {children}
    </button>
  );
}

// ─── Private document uploader (proof documents) ────────────────────────────

export interface DraftDoc {
  id: string;
  doc_type: string;
  label: string;
  url: string | null;
  path: string | null;
  file: File | null;
  mime: string;
  size: number;
  recordId?: string | null;
}

const DOC_OPTIONS = [
  { value: 'rc', label: 'RC (Registration Certificate)' },
  { value: 'insurance', label: 'Insurance' },
  { value: 'identity', label: 'Identity proof (Aadhaar/PAN/Passport)' },
  { value: 'service', label: 'Service records' },
  { value: 'business_proof', label: 'Business proof' },
  { value: 'gst', label: 'GST certificate' },
  { value: 'other', label: 'Other' },
];

export function DocUploader({
  docs,
  onChange,
  bucket = 'private-documents',
  pathPrefix,
}: {
  docs: DraftDoc[];
  onChange: (docs: DraftDoc[]) => void;
  bucket?: string;
  pathPrefix: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [type, setType] = useState('rc');
  const [label, setLabel] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useApp();

  const add = async (file: File) => {
    setError(null);
    if (!['image/jpeg', 'image/png', 'image/webp', 'application/pdf'].includes(file.type)) {
      setError('Documents must be JPG, PNG, WebP or PDF.');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError('Document must be under 10 MB.');
      return;
    }
    setBusy(true);
    try {
      const uploaded = await uploadBytes(bucket, storagePath(pathPrefix, fileExt(file, file.type)), file);
      onChange([
        ...docs,
        {
          id: crypto.randomUUID(),
          doc_type: type,
          label: label.trim() || DOC_OPTIONS.find((o) => o.value === type)?.label || type,
          url: uploaded.url,
          path: uploaded.path,
          file: null,
          mime: uploaded.mime,
          size: uploaded.size,
          recordId: null,
        },
      ]);
      setLabel('');
      toast('Document uploaded to private storage.', 'success');
    } catch (e: any) {
      setError(e.message || 'Upload failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <label className="label-base">Document type</label>
          <select value={type} onChange={(e) => setType(e.target.value)} className="input-base">
            {DOC_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label-base">Label (optional)</label>
          <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. 2nd owner RC" className="input-base" />
        </div>
        <div className="flex items-end">
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,application/pdf"
            hidden
            onChange={(e) => e.target.files?.[0] && add(e.target.files[0])}
          />
          <Button type="button" variant="outline" loading={busy} onClick={() => inputRef.current?.click()} className="w-full">
            Upload document
          </Button>
        </div>
      </div>
      <p className="flex items-start gap-2 rounded-lg bg-sky-50 p-3 text-xs leading-relaxed text-sky-800">
        <svg className="mt-0.5 h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
        </svg>
        Proof documents are stored in <strong>private</strong> Supabase storage. They are never shown publicly — only the seller (or dealer) and approved administrators can access them.
      </p>
      {error && <p className="text-xs font-semibold text-red-600">{error}</p>}
      {docs.length > 0 && (
        <ul className="divide-y divide-ink-100 rounded-lg border border-ink-200">
          {docs.map((d) => (
            <li key={d.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-ink-800">{d.label}</p>
                <p className="text-xs text-ink-400">{DOC_OPTIONS.find((o) => o.value === d.doc_type)?.label} · {(d.size / 1024).toFixed(0)} KB</p>
              </div>
              <button onClick={() => onChange(docs.filter((x) => x.id !== d.id))} className="shrink-0 text-xs font-bold text-red-500 hover:underline">
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
