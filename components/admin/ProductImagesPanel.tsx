'use client';

import { useRef, useState } from 'react';

type Img = {
  id: string;
  image_url: string;
  thumbnail_url: string | null;
  alt_text: string | null;
  is_primary: number;
  approved: number;
  license_status: string | null;
};

const MAX = 10;

/**
 * Photos for one product — inline on the product edit page.
 * Manual uploads keep the original file exactly as-is (no cropping/filters).
 * AI-generated images are original Bikepick illustrations (model name printed,
 * one per variant colour) and are always labelled as such.
 */
export function ProductImagesPanel({ productId, initial }: { productId: string; initial: Img[] }) {
  const [images, setImages] = useState<Img[]>(initial);
  const [busy, setBusy] = useState(false);
  const [genBusy, setGenBusy] = useState(false);
  const [genMsg, setGenMsg] = useState('');
  const [genErr, setGenErr] = useState('');
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  async function refresh() {
    try {
      const res = await fetch(`/api/admin/products/${productId}/images`, { cache: 'no-store' });
      const json = await res.json();
      if (json.ok) setImages(json.data);
    } catch { /* keep last known list */ }
  }

  async function upload(f: File) {
    setBusy(true); setErr(''); setMsg('');
    try {
      if (f.size > 4 * 1024 * 1024) throw new Error('Photo must be under 4 MB — the hosting plan rejects bigger uploads. Compress or resize it (e.g. 1600 px wide) and try again.');
      const fd = new FormData();
      fd.append('file', f);
      fd.append('purpose', 'product_image');
      // Vercel answers oversize bodies with plain text ("Request Entity Too
      // Large"), not JSON — parse defensively so the admin sees a real message.
      const upRes = await fetch('/api/uploads', { method: 'POST', body: fd });
      const ct = upRes.headers.get('content-type') || '';
      const up: any = ct.includes('application/json')
        ? await upRes.json()
        : { ok: false, error: upRes.status === 413 ? 'Upload rejected as too large by the hosting plan (4.5 MB cap). Compress the photo and try again.' : `Upload failed (HTTP ${upRes.status}).` };
      if (!up.ok) throw new Error(up.error || 'Upload failed.');

      const res = await fetch(`/api/admin/products/${productId}/images`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ image_url: up.data.url, alt_text: f.name.replace(/\.[^.]+$/, ''), license_status: 'owned' }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || 'Could not attach the photo.');
      await refresh();
      setMsg('Photo added.');
    } catch (e: any) {
      setErr(e?.message || 'Upload failed. Try again.');
    }
    setBusy(false);
    if (fileRef.current) fileRef.current.value = '';
  }

  async function makePrimary(id: string) {
    await fetch(`/api/admin/products/${productId}/images`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ image_id: id, primary: true }),
    });
    await refresh();
  }

  async function remove(id: string) {
    if (!window.confirm('Remove this photo from the model?')) return;
    await fetch(`/api/admin/products/${productId}/images?image_id=${encodeURIComponent(id)}`, { method: 'DELETE' });
    await refresh();
  }

  async function generateImages(target: number) {
    setGenBusy(true);
    setGenErr('');
    setGenMsg('');
    try {
      let made = 0;
      for (let i = 0; i < target; i++) {
        const res = await fetch(`/api/admin/products/${productId}/generate-images`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({}),
        });
        const json = await res.json();
        if (!json.ok) {
          if (res.status === 429) setGenErr(json.error || 'Image quota exhausted.');
          else setGenErr(json.error || 'Generation failed.');
          break;
        }
        made++;
        setGenMsg(`Generated “${json.data.color}” — image ${json.data.total} of ${json.data.max}.`);
        if (json.data.total >= MAX) break;
        await refresh();
      }
      if (made > 0) setGenMsg((m) => (m ? `${m} Done.` : m));
    } catch {
      setGenErr('Something went wrong while generating. Try again.');
    }
    setGenBusy(false);
    await refresh();
  }

  const space = MAX - images.length;
  const aiCount = images.filter((i) => (i.alt_text || '').includes('AI illustration')).length;

  return (
    <section id="photos" className="rounded-xl border border-line bg-white">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-5 py-3">
        <div>
          <h2 className="text-[13px] font-semibold uppercase tracking-wide text-ink-mute">
            Photos <span className="font-normal normal-case">({images.length}/{MAX})</span>
            {aiCount > 0 && <span className="ml-1.5 rounded bg-violet-100 px-1.5 py-0.5 text-[10px] font-semibold normal-case text-violet-700">{aiCount} AI illustration{aiCount > 1 ? 's' : ''}</span>}
          </h2>
          <p className="mt-0.5 text-[11.5px] leading-4 text-ink-mute">
            Up to 10 photos. The first (primary) one is the big photo on the model page.
            Uploaded originals are kept exactly as-is — no cropping, no filters.
          </p>
        </div>
        {space > 0 && (
          <button type="button" onClick={() => fileRef.current?.click()} disabled={busy} className="btn-primary btn-sm">
            {busy ? 'Uploading…' : '+ Add photo'}
          </button>
        )}
      </div>

      {space > 0 && (
        <div className="flex flex-wrap items-center gap-2 border-b border-line bg-violet-50/50 px-5 py-3">
          <p className="mr-1 text-[11.5px] leading-4 text-ink-mute">
            <b>AI images:</b> generates original illustrations — one per variant colour, model name printed on each, clean studio background.
            They are clearly labelled “AI illustration” (not OEM photos).
          </p>
          <button
            type="button"
            disabled={genBusy || busy}
            onClick={() => generateImages(space)}
            className="btn-outline btn-sm disabled:opacity-50"
          >
            {genBusy ? `Generating… ${MAX - space} `: `Generate up to ${space} from variant colours`}
          </button>
          {!genBusy && (
            <button
              type="button"
              disabled={busy}
              onClick={() => generateImages(1)}
              className="btn-outline btn-sm disabled:opacity-50"
            >
              Generate 1
            </button>
          )}
        </div>
      )}
      {genMsg && !genErr && <p className="px-5 pt-3 text-[12px] font-medium text-emerald-700">{genMsg}</p>}
      {genErr && <p className="px-5 pt-3 text-[12px] font-medium text-rose-700">{genErr}</p>}

      <div className="grid gap-3 p-5 sm:grid-cols-2 lg:grid-cols-3">
        {images.map((img) => (
          <figure key={img.id} className="overflow-hidden rounded-lg border border-line">
            <div className="product-stage grid h-32 place-items-center border-b border-line bg-white">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={img.thumbnail_url || img.image_url} alt={img.alt_text || 'model photo'} className="h-full w-full object-contain" />
            </div>
            <figcaption className="flex items-center justify-between gap-2 px-3 py-2">
              <span className="text-[11.5px] text-ink-mute">
                {img.is_primary === 1 ? 'Primary' : `Photo ${images.indexOf(img) + 1}`}
                {img.approved === 0 && ' · not approved'}
              </span>
              <span className="flex gap-1.5">
                {img.is_primary !== 1 && (
                  <button type="button" onClick={() => makePrimary(img.id)} className="rounded border border-line px-2 py-1 text-[11px] font-medium hover:bg-surface">
                    Make primary
                  </button>
                )}
                <button type="button" onClick={() => remove(img.id)} className="rounded border border-rose-200 px-2 py-1 text-[11px] font-medium text-rose-700 hover:bg-rose-50">
                  Remove
                </button>
              </span>
            </figcaption>
          </figure>
        ))}

        {space > 0 && (
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={busy}
            className="grid h-[168px] place-items-center rounded-lg border-2 border-dashed border-line text-center hover:border-brand-400 hover:bg-brand-50/40"
          >
            <span>
              <span className="mx-auto grid h-9 w-9 place-items-center rounded-full bg-surface text-lg text-ink-mute">+</span>
              <span className="mt-2 block text-[12.5px] font-medium">Add photo</span>
              <span className="mt-0.5 block text-[11px] text-ink-mute">JPG / PNG / WEBP · up to 8 MB</span>
            </span>
          </button>
        )}
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void upload(f);
        }}
      />

      {(msg || err) && (
        <p className={`px-5 pb-4 text-[12.5px] font-medium ${err ? 'text-rose-700' : 'text-emerald-700'}`}>
          {err || msg}
        </p>
      )}
    </section>
  );
}
