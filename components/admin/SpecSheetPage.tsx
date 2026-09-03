'use client';

import { useState } from 'react';
import { SpecSheetForm } from './SpecSheetForm';
import { AiTemplatePanel } from './AiTemplatePanel';
import { BIKE_SPEC_KEYS, EV_SPEC_KEYS, NUMERIC_BIKE, BOOL_BIKE, NUMERIC_EV, BOOL_EV } from '@/lib/spec-fields';

type VariantRow = { id: string; name: string; is_new: number; price: number | null; on_road_price: number | null };

function inr(n: number | null): string {
  return n == null ? '' : ` · ₹${Number(n).toLocaleString('en-IN')}`;
}

function parseExtras(v: any): Record<string, string> {
  if (!v) return {};
  if (typeof v === 'object') return v as Record<string, string>;
  try {
    const o = JSON.parse(v);
    return o && typeof o === 'object' ? o : {};
  } catch {
    return {};
  }
}

/**
 * Spec sheet page body: AI template on top, model sheet, then per-variant sheets.
 * Applying AI values FILLS blanks AND corrects fields that already have a value
 * (the AI template is the source; the admin reviews + saves).
 */
export function SpecSheetPage({
  productId, fuelType, brandName, productName, initial,
  variants, variantSpecs,
}: {
  productId: string;
  fuelType: string;
  brandName: string;
  productName: string;
  initial: Record<string, any>;
  variants: VariantRow[];
  variantSpecs: Record<string, Record<string, any>>;
}) {
  const [spec, setSpec] = useState<Record<string, any>>(() => ({
    ...initial,
    extras: parseExtras(initial.extras),
  }));
  const [formKey, setFormKey] = useState(0);
  const [note, setNote] = useState('');
  const [vlist, setVlist] = useState<VariantRow[]>(variants);
  const [openVariant, setOpenVariant] = useState<string | null>(null);

  function applyAi(extracted: Record<string, any>, extraFields?: Record<string, string>) {
    const keys = fuelType === 'electric' ? EV_SPEC_KEYS : BIKE_SPEC_KEYS;
    const numeric = fuelType === 'electric' ? NUMERIC_EV : NUMERIC_BIKE;
    const bools = fuelType === 'electric' ? BOOL_EV : BOOL_BIKE;
    const merged = { ...spec };
    let filled = 0;
    for (const k of keys) {
      const v = extracted[k];
      if (v === undefined || v === null || v === '') continue;
      if (numeric.has(k)) {
        const n = Number(v);
        if (!Number.isFinite(n) || n <= 0) continue;
        merged[k] = n; // overwrites what was there — AI value wins, admin reviews before save
      } else if (bools.has(k)) {
        merged[k] = v ? 1 : 0;
      } else {
        merged[k] = String(v);
      }
      filled++;
    }
    if (extraFields && Object.keys(extraFields).length) {
      const curExtras: Record<string, string> = { ...(merged.extras || {}) };
      let extraFilled = 0;
      for (const [k, v] of Object.entries(extraFields)) {
        const vs = v == null ? '' : (typeof v === 'object' ? '' : String(v).trim());
        if (!k || !vs || vs === '[object Object]') continue; // never store object noise
        const existing = Object.keys(curExtras).find((e) => e.toLowerCase() === k.toLowerCase());
        if (existing) curExtras[existing] = vs; // correct the existing extra too
        else curExtras[k] = vs;
        extraFilled++;
      }
      if (extraFilled) {
        merged.extras = curExtras;
        filled += extraFilled;
      }
    }
    setSpec(merged);
    setFormKey((k) => k + 1);
    setNote(filled > 0
      ? `Updated ${filled} field${filled > 1 ? 's' : ''} from the AI — blanks filled and already-filled values corrected. Review them, then press “Save spec sheet”.`
      : 'No AI values matched a spec field — nothing changed.');
  }

  // Variant added from the AI panel -> show it in the variant grid immediately, expanded for editing.
  function handleAiVariant(v: VariantRow) {
    setVlist((l) => (l.some((x) => x.id === v.id) ? l : [...l, v]));
    setOpenVariant(v.id);
  }

  async function addVariant(name: string, price: string, colours: string) {
    const res = await fetch('/api/admin/variants', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        product_id: productId,
        name,
        price: price === '' ? null : Number(price),
        colours: colours === '' ? null : colours,
        status: 'active',
        is_base: vlist.length === 0 ? 1 : 0,
      }),
    });
    const json = await res.json();
    if (!json.ok) throw new Error(json.error || 'Could not add the variant.');
    setVlist((l) => [...l, { id: json.data.id, name, is_new: 0, price: price === '' ? null : Number(price), on_road_price: null }]);
    return true;
  }

  async function toggleNew(v: VariantRow) {
    await fetch(`/api/admin/variants/${v.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ is_new: v.is_new === 1 ? 0 : 1 }),
    });
    setVlist((l) => l.map((x) => (x.id === v.id ? { ...x, is_new: x.is_new === 1 ? 0 : 1 } : x)));
  }

  // Remove a variant (e.g. a duplicate created by applying the AI template twice).
  async function removeVariant(v: VariantRow) {
    if (!confirm(`Delete variant "${v.name}"?\nIt disappears from the model page immediately. (The record is soft-deleted and can be restored.)`)) return;
    const res = await fetch(`/api/admin/variants/${v.id}`, { method: 'DELETE' });
    const json = await res.json().catch(() => null);
    if (!json?.ok) { alert(json?.error || 'Could not delete the variant.'); return; }
    setVlist((l) => l.filter((x) => x.id !== v.id));
  }

  return (
    <div className="space-y-5">
      <AiTemplatePanel
        productId={productId}
        brandName={brandName}
        productName={productName}
        onApplySpecs={(ai) => { applyAi(ai.specs, ai.extras); }}
        onVariantAdded={handleAiVariant}
      />
      {note && <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-[12.5px] font-medium text-emerald-800">{note}</p>}
      <SpecSheetForm key={`model-${formKey}`} productId={productId} fuelType={fuelType} initial={spec} />

      <section className="rounded-xl border border-line bg-white">
        <div className="border-b border-line px-5 py-3">
          <h2 className="text-[13px] font-semibold uppercase tracking-wide text-ink-mute">Variant specifications</h2>
          <p className="mt-0.5 text-[11.5px] leading-4 text-ink-mute">
            For every trim (variant) of this model, add its differences — colours, display, brakes, seat… The model page then shows a
            side-by-side variant table with prices and colours, like the OEM&apos;s own table.
          </p>
        </div>
        <div className="space-y-3 p-5">
          {vlist.length === 0 && (
            <p className="text-[12.5px] text-ink-mute">
              No variants yet. Add them below, or use “Add variant + comparison” in the AI template box above.
            </p>
          )}
          {vlist.map((v) => (
            <details key={v.id} className="overflow-hidden rounded-lg border border-line">
              <summary className="flex cursor-pointer flex-wrap items-center gap-3 bg-surface px-4 py-2.5">
                <span className="text-[13.5px] font-semibold">{v.name}</span>
                {inr(v.price) && <span className="text-[12px] text-ink-mute">ex-show{inr(v.price)}</span>}
                {v.is_new === 1 && <span className="rounded bg-amber-300 px-1.5 py-0.5 text-[10px] font-bold uppercase text-amber-950">New</span>}
                <span className="ml-auto flex items-center gap-3">
                  <label className="flex items-center gap-1.5 text-[12px] font-medium text-ink-mute">
                    <input
                      type="checkbox"
                      checked={v.is_new === 1}
                      onChange={() => toggleNew(v)}
                      className="h-3.5 w-3.5 accent-[#F0620C]"
                      onClick={(e) => e.preventDefault()}
                    />
                    OEM “New” tag
                  </label>
                  <button
                    type="button"
                    onClick={() => removeVariant(v)}
                    className="rounded-md border border-rose-200 bg-white px-2 py-1 text-[11.5px] font-medium text-rose-600 hover:bg-rose-50"
                  >
                    Delete
                  </button>
                  <span className="text-[11.5px] text-ink-mute">{vlist.indexOf(v) + 1} / {vlist.length}</span>
                </span>
              </summary>
              <div className="p-4">
                <SpecSheetForm
                  key={v.id}
                  productId={productId}
                  fuelType={fuelType}
                  variantId={v.id}
                  variantName={v.name}
                  initial={variantSpecs[v.id] || {}}
                />
              </div>
            </details>
          ))}
          <AddVariantRow onAdd={addVariant} />
        </div>
      </section>
    </div>
  );
}

function AddVariantRow({ onAdd }: { onAdd: (name: string, price: string, colours: string) => Promise<boolean> }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [colours, setColours] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function submit() {
    if (!name.trim()) { setErr('Variant name is required.'); return; }
    setBusy(true); setErr('');
    try {
      await onAdd(name.trim(), price, colours);
      setName(''); setPrice(''); setColours(''); setOpen(false);
    } catch (e: any) {
      setErr(e?.message || 'Could not add the variant.');
    }
    setBusy(false);
  }

  if (!open) {
    return <button type="button" onClick={() => setOpen(true)} className="btn-outline btn-sm">+ Add variant</button>;
  }
  return (
    <div className="flex flex-wrap items-end gap-3 rounded-lg border border-line bg-surface p-3">
      <label className="block">
        <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-ink-mute">Variant name</span>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. iGO" className="w-44 rounded-lg border border-[#c3cad4] bg-white px-3 py-2 text-[13px] outline-none" />
      </label>
      <label className="block">
        <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-ink-mute">Ex-showroom ₹</span>
        <input type="number" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="e.g. 91500" className="w-36 rounded-lg border border-[#c3cad4] bg-white px-3 py-2 text-[13px] outline-none" />
      </label>
      <label className="block flex-1 min-w-[180px]">
        <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-ink-mute">Colours (comma separated)</span>
        <input value={colours} onChange={(e) => setColours(e.target.value)} placeholder="e.g. Nardo Grey, Wicked Black" className="w-full rounded-lg border border-[#c3cad4] bg-white px-3 py-2 text-[13px] outline-none" />
      </label>
      <div className="flex gap-2">
        <button type="button" onClick={submit} disabled={busy} className="btn-primary btn-sm">{busy ? 'Adding…' : 'Add'}</button>
        <button type="button" onClick={() => setOpen(false)} className="btn-outline btn-sm">Cancel</button>
      </div>
      {err && <p className="w-full text-[12px] font-medium text-rose-700">{err}</p>}
    </div>
  );
}
