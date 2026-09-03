'use client';

import { useRef, useState } from 'react';

type BrandLogo = { logo_url: string | null; logo_source: string | null; logo_license: string | null };

/**
 * Brand logo — inline upload on the brand edit page.
 * The file is stored exactly as uploaded (logos are never cropped or altered).
 */
export function BrandLogoPanel({ brandId, initial }: { brandId: string; initial: BrandLogo }) {
  const [logo, setLogo] = useState<BrandLogo>(initial);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  async function save(patch: Partial<BrandLogo>) {
    const res = await fetch(`/api/admin/brands/${brandId}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(patch),
    });
    const json = await res.json();
    if (!json.ok) throw new Error(json.error || 'Could not save the logo.');
    setLogo((l) => ({ ...l, ...patch }));
  }

  async function upload(f: File) {
    setBusy(true); setErr(''); setMsg('');
    try {
      if (f.size > 2 * 1024 * 1024) throw new Error('Logo must be 2 MB or smaller.');
      const fd = new FormData();
      fd.append('file', f);
      fd.append('purpose', 'brand_logo');
      const up = await (await fetch('/api/uploads', { method: 'POST', body: fd })).json();
      if (!up.ok) throw new Error(up.error || 'Upload failed.');
      await save({ logo_url: up.data.url, logo_source: 'Admin upload', logo_license: 'owned' });
      setMsg('Logo saved.');
    } catch (e: any) {
      setErr(e?.message || 'Upload failed. Try again.');
    }
    setBusy(false);
    if (fileRef.current) fileRef.current.value = '';
  }

  async function remove() {
    if (!window.confirm('Remove this brand logo?')) return;
    setBusy(true); setErr(''); setMsg('');
    try {
      await save({ logo_url: null, logo_source: null, logo_license: 'unknown' });
      setMsg('Logo removed.');
    } catch (e: any) {
      setErr(e?.message || 'Could not remove the logo.');
    }
    setBusy(false);
  }

  async function pullFromWebsite() {
    setBusy(true); setErr(''); setMsg('Pulling the logo from the official website…');
    try {
      const res = await fetch(`/api/admin/brands/${brandId}/pull-logo`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({}),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || 'Could not pull the logo.');
      await save({ logo_url: json.data.logoUrl, logo_source: 'OEM website (auto-pulled, black & white)', logo_license: 'unknown' });
      setMsg(`Logo pulled from ${json.data.sourceUrl || 'the OEM website'} and converted to black & white.`);
    } catch (e: any) {
      setErr(e?.message || 'Could not pull the logo. Upload it manually instead.');
    }
    setBusy(false);
  }

  return (
    <section className="mb-4 rounded-xl border border-line bg-white p-5">
      <div className="flex flex-wrap items-center gap-4">
        <div className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-xl border border-line bg-surface">
          {logo.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logo.logo_url} alt="brand logo" className="h-full w-full object-contain p-1.5" />
          ) : (
            <span className="text-[12px] text-ink-mute">No logo</span>
          )}
        </div>
        <div className="min-w-[180px] flex-1">
          <h2 className="text-[13px] font-semibold uppercase tracking-wide text-ink-mute">Brand logo</h2>
          <p className="mt-0.5 text-[11.5px] leading-4 text-ink-mute">
            Where the logo is added: here. You can <b>pull it from the official website</b> (auto-converted to black &amp; white)
            or upload your own (kept exactly as uploaded, up to 2 MB). It appears on the model page and in the brand filter.
          </p>
          {(msg || err) && <p className={`mt-1.5 text-[12px] font-medium ${err ? 'text-rose-700' : 'text-emerald-700'}`}>{err || msg}</p>}
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={pullFromWebsite} disabled={busy} className="btn-outline btn-sm">
            {busy ? 'Working…' : 'Pull from official website (B&amp;W)'}
          </button>
          <button type="button" onClick={() => fileRef.current?.click()} disabled={busy} className="btn-primary btn-sm">
            {logo.logo_url ? 'Upload / replace' : 'Upload logo'}
          </button>
          {logo.logo_url && (
            <button type="button" onClick={remove} disabled={busy} className="btn-outline btn-sm">Remove</button>
          )}
        </div>
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
    </section>
  );
}
