'use client';

import { useState } from 'react';

type Variant = {
  name: string;
  price: number | null;
  on_road_price: number | null;
  colours: string | null;
  is_new: boolean;
  variant_specs: Record<string, any>;
};

function inr(n: number | null): string {
  return n == null ? '—' : '₹' + n.toLocaleString('en-IN');
}

/**
 * Admin-only AI template generator. The admin only needs the brand + model
 * name (already on the product) — the AI drafts the full specification,
 * variants with comparison values, and pros & cons. Nothing is saved
 * automatically; every part is applied through the normal review flows.
 */
export function AiTemplatePanel({
  productId, brandName, productName, onApplySpecs, onVariantAdded,
}: {
  productId: string;
  brandName: string;
  productName: string;
  onApplySpecs: (ai: { specs: Record<string, any>; extras?: Record<string, string> }, note: string) => void;
  onVariantAdded?: (v: { id: string; name: string; is_new: number; price: number | null; on_road_price: number | null }) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [result, setResult] = useState<any>(null);
  const [added, setAdded] = useState<string[]>([]);
  const [adding, setAdding] = useState<string | null>(null);
  const [savedPc, setSavedPc] = useState(false);
  const [savingPc, setSavingPc] = useState(false);
  // Manual "AI missed a variant" add — straight from the AI panel.
  const [nvName, setNvName] = useState('');
  const [nvPrice, setNvPrice] = useState('');
  const [nvColours, setNvColours] = useState('');
  const [nvBusy, setNvBusy] = useState(false);
  const [nvAdded, setNvAdded] = useState(false);
  // Variant auto-detect — a focused AI pass that finds the trims the main template missed.
  const [sweeping, setSweeping] = useState(false);
  const [sweepNote, setSweepNote] = useState('');

  async function runSweep(base?: any) {
    const baseRes = base ?? result;
    if (!baseRes) return;
    setSweeping(true);
    setSweepNote('');
    setErr('');
    try {
      const res = await fetch(`/api/admin/products/${productId}/ai-variants`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{}',
      });
      const ct = res.headers.get('content-type') || '';
      if (!ct.includes('application/json')) {
        throw new Error('The AI service timed out before it could answer. Try the button again in a minute.');
      }
      const json = await res.json().catch(() => null);
      if (!json?.ok) throw new Error(json?.error || `AI service error (${res.status}) — try again.`);
      const current: Variant[] = Array.isArray(baseRes.variants) ? baseRes.variants : [];
      const extra: Variant[] = (Array.isArray(json.data?.variants) ? json.data.variants : []).filter(
        (v: Variant) => !current.some((x) => x.name.trim().toLowerCase() === String(v?.name || '').trim().toLowerCase()),
      );
      const all = [...current, ...extra];
      const next = {
        ...baseRes,
        variants: all,
        warnings: [...(Array.isArray(baseRes.warnings) ? baseRes.warnings : []), ...(Array.isArray(json.data?.warnings) ? json.data.warnings : [])].slice(0, 5),
      };
      setResult(next);
      setSweepNote(
        extra.length
          ? `Auto-detect found ${extra.length} more variant${extra.length > 1 ? 's' : ''} ✓ — verify each one and press "Add variant + comparison" (same review flow).`
          : 'Auto-detect found no additional variants — the model appears to be single-variant. Cross-check manually if needed.',
      );
    } catch (e: any) {
      setErr(e?.message || 'Variant auto-detect failed — try again.');
    }
    setSweeping(false);
  }

  async function addManualVariant() {
    if (!nvName.trim()) { setErr('Give the missing variant a name.'); return; }
    setNvBusy(true);
    setNvAdded(false);
    const ok = await addVariant({
      name: nvName.trim(),
      price: nvPrice === '' ? null : Number(nvPrice),
      on_road_price: null,
      colours: nvColours.trim() || null,
      is_new: false,
      variant_specs: {},
    });
    if (ok) { setNvName(''); setNvPrice(''); setNvColours(''); setNvAdded(true); }
    setNvBusy(false);
  }

  async function generate() {
    setBusy(true);
    setErr('');
    setResult(null);
    setAdded([]);
    setSavedPc(false);
    try {
      const res = await fetch(`/api/admin/products/${productId}/ai-generate`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
      // A platform timeout returns an HTML error page, not JSON — say so plainly.
      const ct = res.headers.get('content-type') || '';
      if (!ct.includes('application/json')) {
        throw new Error('The AI service timed out before it could answer. Please try again in a minute.');
      }
      const json = await res.json().catch(() => null);
      if (!json?.ok) throw new Error(json?.error || `AI service error (${res.status}) — try again.`);
      setResult(json.data);
      // The template often under-counts variants (e.g. only "Standard") —
      // when it lists 1 or fewer, immediately run the auto-detect pass.
      const dv = Array.isArray(json.data?.variants) ? json.data.variants.length : 0;
      if (dv <= 1) void runSweep(json.data);
    } catch (e: any) {
      setErr(e?.message || 'Generation failed. Try again.');
    }
    setBusy(false);
  }

  async function addVariant(v: Variant): Promise<boolean> {
    setAdding(v.name);
    setErr('');
    try {
      const res = await fetch('/api/admin/variants', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          product_id: productId,
          name: v.name,
          price: v.price ?? null,
          on_road_price: v.on_road_price ?? null,
          colours: v.colours || null,
          status: 'active',
          is_new: v.is_new ? 1 : 0,
        }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || 'Could not add the variant.');
      const newId: string = json.data?.id;
      // Save the per-variant comparison values straight into that variant's spec row.
      const vs = v.variant_specs || {};
      if (newId && Object.keys(vs).length) {
        await fetch(`/api/admin/products/${productId}/specs`, {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ variant_id: newId, ...vs }),
        });
      }
      setAdded((a) => [...a, v.name]);
      // Show the new variant in the spec sheet's variant grid immediately (expanded, editable).
      if (newId) {
        onVariantAdded?.({
          id: newId,
          name: v.name,
          is_new: v.is_new ? 1 : 0,
          price: v.price ?? null,
          on_road_price: v.on_road_price ?? null,
        });
      }
      return true;
    } catch (e: any) {
      setErr(e?.message || 'Could not add the variant.');
      return false;
    } finally {
      setAdding(null);
    }
  }

  async function saveProsCons() {
    if (!result) return;
    setSavingPc(true);
    setErr('');
    try {
      const res = await fetch(`/api/admin/products/${productId}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          pros: (result.pros || []).join('\n'),
          cons: (result.cons || []).join('\n'),
          best_for: (result.best_for || []).join(', '),
        }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || 'Could not save pros & cons.');
      setSavedPc(true);
    } catch (e: any) {
      setErr(e?.message || 'Could not save pros & cons.');
    }
    setSavingPc(false);
  }

  const specCount = result ? Object.keys(result.specs || {}).length : 0;
  const extraCount = result ? Object.keys(result.extras || {}).length : 0;

  // Don't double the brand when the model name already contains it.
  const fullName =
    brandName && productName.toLowerCase().startsWith(brandName.toLowerCase().trim())
      ? productName
      : `${brandName} ${productName}`.trim();

  return (
    <section className="rounded-xl border border-[#ffd9b8] bg-[#fff7ef]">
      <div className="border-b border-[#ffe7d1] px-5 py-3">
        <h2 className="text-[13px] font-semibold uppercase tracking-wide text-[#9a3412]">AI template — brand &amp; model name only</h2>
        <p className="mt-0.5 text-[11.5px] leading-4 text-[#7c4a21]">
          One click and the AI drafts the <b>full specification</b>, <b>all variants</b> (with comparison values), manufacturer
          extras and <b>pros &amp; cons</b> for <b>{fullName}</b>. You review everything and apply it piece by
          piece below — <b>nothing is saved or published automatically</b>.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3 p-5">
        <button type="button" onClick={generate} disabled={busy} className="btn-primary disabled:opacity-50">
          {busy ? 'AI is writing the template… (10–40 s)' : result ? `Re-run ${fullName} template from AI (manual trigger)` : `Generate ${fullName} template from AI`}
        </button>
        {result && (
          <div className="flex flex-wrap items-center gap-2 text-[12px]">
            <span className="rounded-full bg-white px-2.5 py-1 font-medium text-[#9a3412] ring-1 ring-[#ffd9b8]">AI: {result.provider}</span>
            <span className="rounded-full bg-white px-2.5 py-1 font-medium text-ink-soft ring-1 ring-line">{specCount} specs</span>
            {extraCount > 0 && <span className="rounded-full bg-white px-2.5 py-1 font-medium text-ink-soft ring-1 ring-line">{extraCount} extras</span>}
            {result.variants?.length > 0 && (
              <span className="rounded-full bg-white px-2.5 py-1 font-medium text-ink-soft ring-1 ring-line">{result.variants.length} variants</span>
            )}
          </div>
        )}
      </div>

      {err && <p className="px-5 pb-4 text-[12.5px] font-medium text-rose-700">{err}</p>}

      {result && (
        <div className="space-y-4 px-5 pb-5">
          {result.warnings?.length > 0 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-2.5">
              {result.warnings.map((w: string, i: number) => (
                <p key={i} className="text-[11.5px] leading-5 text-amber-800">⚠ {w}</p>
              ))}
              <p className="mt-1 text-[11.5px] font-semibold text-amber-900">Values come from the AI — verify each one before publishing.</p>
            </div>
          )}

          {/* Variant auto-detect — near the notes: finds trims the template missed, same review flow */}
          <div className="flex flex-wrap items-center gap-3 rounded-lg border border-line bg-white px-4 py-2.5">
            <button
              type="button"
              onClick={() => runSweep()}
              disabled={sweeping || busy}
              className="btn-outline btn-sm disabled:opacity-50"
            >
              {sweeping ? 'Auto-detecting all variants… (10–30 s)' : 'Auto-detect all variants (AI)'}
            </button>
            <span className="text-[11.5px] leading-4 text-ink-mute">
              Runs when the template lists only 1 variant (automatically) — or any time. Finds every other trim with its price,
              colours and comparison details, then adds it to the Variants list below for the usual &ldquo;Add variant + comparison&rdquo; review.
            </span>
            {sweepNote && <span className="text-[11.5px] font-medium text-emerald-700">{sweepNote}</span>}
          </div>

          {specCount > 0 && (
            <div className="rounded-xl border border-line bg-white p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="text-[12.5px]">
                  <p className="font-semibold">Full specification ({specCount} fields{extraCount ? ` + ${extraCount} extras` : ''})</p>
                  <p className="mt-0.5 text-[11.5px] leading-4 text-ink-mute">
                    Fills the spec sheet form below — blank fields get filled <b>and</b> fields that already have a value are
                    corrected to the AI&rsquo;s. Review, then press &ldquo;Save spec sheet&rdquo;.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onApplySpecs({ specs: result.specs, extras: result.extras }, `Filled ${specCount} spec fields from the AI template.`)}
                  className="btn-primary btn-sm"
                >
                  Fill spec sheet below →
                </button>
              </div>
            </div>
          )}

          <div className="overflow-hidden rounded-xl border border-line bg-white">
            <div className="border-b border-line bg-surface px-4 py-2.5">
              <p className="text-[12.5px] font-semibold">Variants ({Array.isArray(result.variants) ? result.variants.length : 0})</p>
              <p className="text-[11.5px] text-ink-mute">
                Adding a variant also stores its comparison values (brakes, display, battery…) so the model page shows the side-by-side variant table.
                <b> If the model has more variants than the AI listed (e.g. it has 2 but only 1 is shown below), add the missing one in the
                box under this list, or re-run the AI with the &ldquo;Re-run … (manual trigger)&rdquo; button above.</b>
              </p>
            </div>
            {(() => {
              const vc = Array.isArray(result.variants) ? result.variants.length : 0;
              if (vc > 1) return null;
              return vc === 1 ? (
                <div className="border-b border-amber-200 bg-amber-50 px-4 py-2.5">
                  <p className="text-[11.5px] leading-5 text-amber-900">
                    ⚠ <b>Only 1 variant found.</b> Most bikes in this segment are sold in 2 or more variants (e.g. Standard/Disc, LED/Digital,
                    top-end). Press <b>&ldquo;Auto-detect all variants (AI)&rdquo;</b> above to fetch the missing variants with their price and
                    comparison details automatically — or cross-check the OEM website and add them manually in the box below.
                  </p>
                </div>
              ) : (
                <div className="border-b border-amber-200 bg-amber-50 px-4 py-2.5">
                  <p className="text-[11.5px] leading-5 text-amber-900">
                    ⚠ <b>The AI listed no variants — please manually cross-check this model.</b> Add every variant with its ex-showroom price and
                    comparison details in the box below.
                  </p>
                </div>
              );
            })()}
            {Array.isArray(result.variants) && result.variants.length > 0 && (
              <ul className="divide-y divide-line">
                {result.variants.map((v: Variant) => {
                  const isAdded = added.includes(v.name);
                  const vCount = Object.keys(v.variant_specs || {}).length;
                  return (
                    <li key={v.name} className="flex flex-wrap items-center gap-3 px-4 py-2.5 text-[13px]">
                      <span className="flex-1 font-medium">
                        {v.name}
                        {v.is_new && (
                          <span className="ml-1.5 rounded bg-amber-300 px-1.5 py-0.5 text-[9.5px] font-bold uppercase leading-none text-amber-950 align-middle">New</span>
                        )}
                      </span>
                      <span className="text-ink-mute">ex-show {inr(v.price)}</span>
                      {v.on_road_price != null && <span className="text-ink-mute">on-road {inr(v.on_road_price)}</span>}
                      {v.colours && <span className="max-w-[200px] truncate text-[11.5px] text-ink-mute" title={v.colours}>{v.colours}</span>}
                      {vCount > 0 && <span className="rounded bg-surface px-1.5 py-0.5 text-[10.5px] font-medium text-ink-mute">{vCount} compare fields</span>}
                      {isAdded ? (
                        <span className="text-[11.5px] font-medium text-emerald-700">Added ✓</span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => addVariant(v)}
                          disabled={adding === v.name}
                          className="btn-outline btn-sm disabled:opacity-50"
                        >
                          {adding === v.name ? 'Adding…' : 'Add variant + comparison'}
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
              {/* Manual catch-up: the AI missed a variant (e.g. model has 2, AI listed 1) */}
              <div className="border-t border-line bg-surface/60 px-4 py-3">
                <p className="text-[11.5px] font-semibold uppercase tracking-wide text-ink-mute">
                  AI missed a variant? Add it manually
                </p>
                <div className="mt-2 flex flex-wrap items-end gap-2.5">
                  <label className="block">
                    <span className="mb-1 block text-[10.5px] font-semibold uppercase tracking-wide text-ink-mute">Variant name</span>
                    <input value={nvName} onChange={(e) => setNvName(e.target.value)} placeholder="e.g. Shine Disc" className="w-40 rounded-lg border border-[#c3cad4] bg-white px-3 py-1.5 text-[12.5px] outline-none" />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-[10.5px] font-semibold uppercase tracking-wide text-ink-mute">Ex-showroom ₹</span>
                    <input value={nvPrice} onChange={(e) => setNvPrice(e.target.value)} placeholder="e.g. 78500" className="w-32 rounded-lg border border-[#c3cad4] bg-white px-3 py-1.5 text-[12.5px] outline-none" />
                  </label>
                  <label className="block min-w-[140px] flex-1">
                    <span className="mb-1 block text-[10.5px] font-semibold uppercase tracking-wide text-ink-mute">Colours (optional)</span>
                    <input value={nvColours} onChange={(e) => setNvColours(e.target.value)} placeholder="e.g. Red, Black" className="w-full rounded-lg border border-[#c3cad4] bg-white px-3 py-1.5 text-[12.5px] outline-none" />
                  </label>
                  <button type="button" onClick={addManualVariant} disabled={nvBusy} className="btn-outline btn-sm disabled:opacity-50">
                    {nvBusy ? 'Adding…' : 'Add this variant'}
                  </button>
                  {nvAdded && <span className="text-[11.5px] font-medium text-emerald-700">Added ✓ — it is in the grid below</span>}
                </div>
              </div>
            </div>

          {(result.pros?.length > 0 || result.cons?.length > 0 || result.best_for?.length > 0) && (
            /* Excel-grid style (same look as the public Full specifications sheet):
                6 columns on wide screens, band rows for PROS / CONS, one
                numbered row per item with a full-width value. */
            <div className="card overflow-hidden">
              <div className="grid grid-cols-2 min-[900px]:grid-cols-[1.1fr_1.6fr_1.1fr_1.6fr_1.1fr_1.6fr]">
                {result.pros?.length > 0 && (
                  <>
                    <div className="col-span-2 min-[900px]:col-span-6 border-b border-line bg-surface px-4 py-1.5 text-[11.5px] font-semibold uppercase tracking-wide text-emerald-700">
                      Pros ({result.pros.length})
                    </div>
                    {result.pros.map((p: string, i: number) => (
                      <div key={`pro-${i}`} className="contents">
                        <div className="border-b border-line px-4 py-1.5 text-[12.5px] text-ink-mute">#{i + 1}</div>
                        <div className="col-span-1 min-[900px]:col-span-5 border-b border-r border-line px-4 py-1.5 text-[12.5px] font-medium leading-5 text-emerald-900">
                          <span className="font-semibold text-emerald-600">✓ </span>{p}
                        </div>
                      </div>
                    ))}
                  </>
                )}
                {result.cons?.length > 0 && (
                  <>
                    <div className="col-span-2 min-[900px]:col-span-6 border-b border-line bg-surface px-4 py-1.5 text-[11.5px] font-semibold uppercase tracking-wide text-rose-700">
                      Cons ({result.cons.length})
                    </div>
                    {result.cons.map((c: string, i: number) => (
                      <div key={`con-${i}`} className="contents">
                        <div className="border-b border-line px-4 py-1.5 text-[12.5px] text-ink-mute">#{i + 1}</div>
                        <div className="col-span-1 min-[900px]:col-span-5 border-b border-r border-line px-4 py-1.5 text-[12.5px] font-medium leading-5 text-rose-900">
                          <span className="font-semibold text-rose-600">! </span>{c}
                        </div>
                      </div>
                    ))}
                  </>
                )}
                {result.best_for?.length > 0 && (
                  <>
                    <div className="col-span-2 min-[900px]:col-span-6 border-b border-line bg-surface px-4 py-1.5 text-[11.5px] font-semibold uppercase tracking-wide text-brand-600">
                      Suitable for
                    </div>
                    <div className="border-b border-line px-4 py-1.5 text-[12.5px] text-ink-mute">Best fit</div>
                    <div className="col-span-1 min-[900px]:col-span-5 border-b border-r border-line px-4 py-1.5">
                      <span className="flex flex-wrap gap-1.5">
                        {result.best_for.map((b: string) => (
                          <span key={b} className="rounded-full bg-surface px-2.5 py-0.5 text-[12px] text-ink-soft ring-1 ring-line">{b}</span>
                        ))}
                      </span>
                    </div>
                  </>
                )}
                <div className="col-span-2 min-[900px]:col-span-6 flex items-center justify-end gap-2 bg-white px-4 py-2.5">
                  {savedPc ? (
                    <span className="text-[12px] font-medium text-emerald-700">Pros, cons &amp; suitable-for saved ✓</span>
                  ) : (
                    <button type="button" onClick={saveProsCons} disabled={savingPc} className="btn-primary btn-sm disabled:opacity-50">
                      {savingPc ? 'Saving…' : 'Save pros, cons & suitable for'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
