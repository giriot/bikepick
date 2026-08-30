'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

const STATUSES = ['new', 'contacted', 'quoted', 'converted', 'lost', 'invalid'] as const;

export function LeadRow({ lead }: { lead: any }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState(lead.status);
  const [note, setNote] = useState(lead.dealer_note || '');
  const [saved, setSaved] = useState(false);

  const payload = lead.payload ? (() => { try { return JSON.parse(lead.payload); } catch { return null; } })() : null;

  async function save() {
    setBusy(true);
    const res = await fetch(`/api/dealer/leads/${lead.id}`, {
      method: 'PATCH', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ status, dealer_note: note }),
    });
    const json = await res.json();
    setBusy(false);
    if (json.ok) { setSaved(true); router.refresh(); setTimeout(() => setSaved(false), 2500); }
  }

  return (
    <li className="p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-[14px] font-semibold">{lead.name}</p>
            <span className={`badge ${lead.status === 'new' ? 'bg-brand-50 text-brand-700' : lead.status === 'converted' ? 'bg-emerald-50 text-emerald-700' : 'bg-surface text-ink-soft'}`}>{lead.status}</span>
            <span className="badge bg-surface text-ink-mute">{lead.lead_type.replace(/_/g, ' ')}</span>
          </div>
          <p className="mt-1 text-[12.5px] text-ink-mute">
            {lead.product_name || 'General enquiry'}{lead.city ? ` · ${lead.city}` : ''} · {new Date(lead.created_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
          </p>
          {lead.message && <p className="mt-1.5 text-[13px] leading-5 text-ink-soft">{lead.message}</p>}
          {payload && Object.keys(payload).length > 0 && (
            <dl className="mt-1.5 flex flex-wrap gap-x-4 gap-y-0.5">
              {Object.entries(payload).map(([k, v]) => (
                <div key={k} className="text-[12px]">
                  <dt className="inline text-ink-mute">{k.replace(/_/g, ' ')}: </dt>
                  <dd className="inline font-medium">{String(v)}</dd>
                </div>
              ))}
            </dl>
          )}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          <a href={`tel:${lead.phone}`} className="btn-primary btn-sm">Call {lead.phone}</a>
          {lead.email && <a href={`mailto:${lead.email}`} className="text-[12px] text-brand-700 hover:underline">{lead.email}</a>}
          <button onClick={() => setOpen(!open)} className="btn-ghost btn-sm text-ink-mute">{open ? 'Close' : 'Update status'}</button>
        </div>
      </div>

      {open && (
        <div className="mt-3 rounded-xl border border-line bg-surface p-3.5">
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="label" htmlFor={`st-${lead.id}`}>Status</label>
              <select id={`st-${lead.id}`} className="field w-44" value={status} onChange={(e) => setStatus(e.target.value)}>
                {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="min-w-[240px] flex-1">
              <label className="label" htmlFor={`nt-${lead.id}`}>Note to the buyer (they see this)</label>
              <input id={`nt-${lead.id}`} className="field" value={note} onChange={(e) => setNote(e.target.value)}
                placeholder="e.g. Quoted ₹1,42,500 on-road, in stock in black" />
            </div>
            <button className="btn-primary btn-sm" onClick={save} disabled={busy}>{busy ? 'Saving…' : 'Save'}</button>
            {saved && <span className="text-[12.5px] font-medium text-emerald-700">Saved</span>}
          </div>
        </div>
      )}
    </li>
  );
}
