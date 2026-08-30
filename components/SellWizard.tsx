'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';

interface Props {
  signedIn: boolean;
  brands: { name: string; models: { id: string; name: string; price: number | null }[] }[];
  minPhotos: number;
  defaults: { name: string; phone: string; city: string };
}

const REQUIRED_ANGLES = [
  ['front', 'Front'], ['rear', 'Rear'], ['left', 'Left side'], ['right', 'Right side'],
  ['odometer', 'Odometer'], ['engine', 'Engine'], ['tyres', 'Tyres'],
] as const;
const OPTIONAL_ANGLES = [['damage', 'Damage (if any)'], ['chassis', 'VIN / chassis plate']] as const;

const STEPS = ['Vehicle', 'Condition', 'Paperwork', 'Photos', 'Price & submit'] as const;

export function SellWizard({ signedIn, brands, minPhotos, defaults }: Props) {
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ slug: string; status: string } | null>(null);
  const [photos, setPhotos] = useState<Record<string, string>>({});
  const [uploading, setUploading] = useState<string | null>(null);
  const [valuation, setValuation] = useState<any>(null);

  const [f, setF] = useState<Record<string, string>>({
    brand_name: '', model_name: '', product_id: '', variant_name: '',
    manufacture_year: String(new Date().getFullYear() - 3), registration_year: '',
    km_driven: '', owners: '1', fuel_type: 'petrol', city: defaults.city || '', state: '', pincode: '',
    asking_price: '', condition_grade: 'good', insurance_status: 'comprehensive', insurance_valid_till: '',
    rc_available: 'original', loan_status: 'no_loan', service_history: 'partial',
    accident_history: 'none', tyre_condition: 'good', battery_condition: 'na', abs_equipped: '',
    description: '',
  });

  const set = (k: string, v: string) => setF((s) => ({ ...s, [k]: v }));
  const models = useMemo(() => brands.find((b) => b.name === f.brand_name)?.models || [], [brands, f.brand_name]);

  const uploadedRequired = REQUIRED_ANGLES.filter(([a]) => photos[a]).length;

  const stepValid = (i: number): string | null => {
    if (i === 0) {
      if (!f.brand_name) return 'Choose a brand';
      if (!f.model_name) return 'Choose or enter a model';
      if (!f.manufacture_year) return 'Enter the manufacture year';
      if (!f.km_driven) return 'Enter kilometres driven';
      if (!f.city) return 'Enter your city';
      return null;
    }
    if (i === 3 && Object.keys(photos).length < minPhotos) return `Upload at least ${minPhotos} photos`;
    if (i === 4 && (!f.asking_price || Number(f.asking_price) < 1000)) return 'Enter a realistic asking price';
    return null;
  };

  const next = async () => {
    const err = stepValid(step);
    if (err) { setError(err); return; }
    setError(null);
    if (step === 3) await runValuation();
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  };

  const runValuation = async () => {
    try {
      const res = await fetch('/api/used-bikes/estimate', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          product_id: f.product_id || undefined, brand_name: f.brand_name, model_name: f.model_name,
          manufacture_year: Number(f.manufacture_year), km_driven: Number(f.km_driven),
          owners: Number(f.owners), condition: f.condition_grade, insurance_status: f.insurance_status,
          service_history: f.service_history, accident_history: f.accident_history, city: f.city,
        }),
      });
      const json = await res.json();
      if (json.ok) {
        setValuation(json.data);
        if (!f.asking_price) set('asking_price', String(json.data.fair));
      }
    } catch { /* estimator is optional; the seller can still set a price */ }
  };

  const upload = async (angle: string, file: File) => {
    setUploading(angle); setError(null);
    const body = new FormData();
    body.append('file', file);
    body.append('purpose', 'used_bike_photo');
    const res = await fetch('/api/uploads', { method: 'POST', body });
    const json = await res.json();
    setUploading(null);
    if (json.ok) setPhotos((p) => ({ ...p, [angle]: json.data.url }));
    else setError(json.error || 'Upload failed');
  };

  const submit = async () => {
    const err = stepValid(4);
    if (err) { setError(err); return; }
    setSaving(true); setError(null);
    const res = await fetch('/api/used-bikes', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        ...f,
        manufacture_year: Number(f.manufacture_year),
        registration_year: f.registration_year ? Number(f.registration_year) : undefined,
        km_driven: Number(f.km_driven), owners: Number(f.owners), asking_price: Number(f.asking_price),
        abs_equipped: f.abs_equipped === 'yes',
        images: Object.entries(photos).map(([angle, image_url]) => ({ angle, image_url })),
      }),
    });
    const json = await res.json();
    setSaving(false);
    if (json.ok) setDone(json.data);
    else setError(json.error || 'Could not submit your listing');
  };

  if (!signedIn) {
    return (
      <div className="card p-6 text-center">
        <h2 className="text-lg font-semibold">Sign in to list your bike</h2>
        <p className="mx-auto mt-2 max-w-md text-[13px] leading-6 text-ink-mute">
          We require an account so we can verify your identity, keep your documents private and route buyer enquiries to
          you. It takes under a minute.
        </p>
        <div className="mt-5 flex justify-center gap-2">
          <Link href="/login?next=/used-bikes/sell" className="btn-primary">Sign in</Link>
          <Link href="/register?next=/used-bikes/sell" className="btn-outline">Create an account</Link>
        </div>
      </div>
    );
  }

  if (done) {
    return (
      <div className="card p-8 text-center">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-accent-soft text-accent-dark" aria-hidden="true">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none"><path d="m5 13 4 4L19 7" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </div>
        <h2 className="mt-4 text-xl font-semibold">Listing submitted for verification</h2>
        <p className="mx-auto mt-2 max-w-lg text-[13.5px] leading-6 text-ink-mute">
          Status: <strong className="text-ink">{done.status.replace(/_/g, ' ')}</strong>. Our team will verify your
          identity and documents before the listing becomes public. You will be notified of the outcome — including if we
          need more information.
        </p>
        <div className="mt-5 flex justify-center gap-2">
          <Link href="/account/listings" className="btn-primary">Track my listing</Link>
          <Link href="/used-bikes" className="btn-outline">Browse used bikes</Link>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Stepper */}
      <ol className="mb-6 flex flex-wrap gap-2" aria-label="Progress">
        {STEPS.map((s, i) => (
          <li key={s} className="flex items-center gap-2">
            <span className={`grid h-7 w-7 place-items-center rounded-full text-[12px] font-bold ${i < step ? 'bg-accent text-white' : i === step ? 'bg-brand-500 text-white' : 'bg-surface text-ink-mute'}`} aria-current={i === step ? 'step' : undefined}>
              {i < step ? '✓' : i + 1}
            </span>
            <span className={`text-[13px] ${i === step ? 'font-semibold text-ink' : 'text-ink-mute'}`}>{s}</span>
            {i < STEPS.length - 1 && <span className="mx-1 hidden h-px w-6 bg-line sm:block" aria-hidden="true" />}
          </li>
        ))}
      </ol>

      <div className="card p-5 sm:p-6">
        {/* STEP 0 — vehicle */}
        {step === 0 && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Brand" required>
              <select value={f.brand_name} onChange={(e) => { set('brand_name', e.target.value); set('model_name', ''); set('product_id', ''); }} className="field">
                <option value="">Select brand</option>
                {brands.map((b) => <option key={b.name} value={b.name}>{b.name}</option>)}
              </select>
            </Field>
            <Field label="Model" required hint="Pick from our database so buyers can find your listing in search.">
              <select value={f.product_id} onChange={(e) => {
                const m = models.find((x) => x.id === e.target.value);
                set('product_id', e.target.value); set('model_name', m?.name || '');
              }} className="field">
                <option value="">Select model</option>
                {models.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                <option value="other">Other / not listed</option>
              </select>
              {f.product_id === 'other' && (
                <input value={f.model_name} onChange={(e) => set('model_name', e.target.value)} placeholder="Enter model name" className="field mt-2" />
              )}
            </Field>
            <Field label="Variant"><input value={f.variant_name} onChange={(e) => set('variant_name', e.target.value)} placeholder="e.g. Disc, Dual ABS" className="field" /></Field>
            <Field label="Fuel type">
              <select value={f.fuel_type} onChange={(e) => set('fuel_type', e.target.value)} className="field">
                <option value="petrol">Petrol</option><option value="electric">Electric</option>
              </select>
            </Field>
            <Field label="Manufacture year" required>
              <select value={f.manufacture_year} onChange={(e) => set('manufacture_year', e.target.value)} className="field">
                {Array.from({ length: 26 }, (_, i) => new Date().getFullYear() - i).map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
            </Field>
            <Field label="Registration year"><input type="number" value={f.registration_year} onChange={(e) => set('registration_year', e.target.value)} className="field" /></Field>
            <Field label="Kilometres driven" required><input type="number" inputMode="numeric" value={f.km_driven} onChange={(e) => set('km_driven', e.target.value)} className="field" /></Field>
            <Field label="Number of owners" required>
              <select value={f.owners} onChange={(e) => set('owners', e.target.value)} className="field">
                {[1, 2, 3, 4, 5].map((o) => <option key={o} value={o}>{o}{o === 5 ? '+' : ''}</option>)}
              </select>
            </Field>
            <Field label="City" required><input value={f.city} onChange={(e) => set('city', e.target.value)} className="field" /></Field>
            <Field label="State"><input value={f.state} onChange={(e) => set('state', e.target.value)} className="field" /></Field>
            <Field label="Pincode"><input value={f.pincode} onChange={(e) => set('pincode', e.target.value)} inputMode="numeric" className="field" /></Field>
          </div>
        )}

        {/* STEP 1 — condition */}
        {step === 1 && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Overall condition" required>
              <select value={f.condition_grade} onChange={(e) => set('condition_grade', e.target.value)} className="field">
                <option value="excellent">Excellent — like new, no work needed</option>
                <option value="good">Good — normal wear, fully usable</option>
                <option value="fair">Fair — visible wear, minor work needed</option>
                <option value="needs_work">Needs work — mechanical attention required</option>
              </select>
            </Field>
            <Field label="Accident history" required>
              <select value={f.accident_history} onChange={(e) => set('accident_history', e.target.value)} className="field">
                <option value="none">No accidents</option><option value="minor">Minor — cosmetic only</option><option value="major">Major — structural or engine</option>
              </select>
            </Field>
            <Field label="Tyre condition">
              <select value={f.tyre_condition} onChange={(e) => set('tyre_condition', e.target.value)} className="field">
                <option value="new">New</option><option value="good">Good</option><option value="average">Average</option><option value="replace_soon">Replace soon</option>
              </select>
            </Field>
            <Field label="Battery condition">
              <select value={f.battery_condition} onChange={(e) => set('battery_condition', e.target.value)} className="field">
                <option value="na">Not applicable</option><option value="new">New</option><option value="good">Good</option><option value="average">Average</option><option value="replace_soon">Replace soon</option>
              </select>
            </Field>
            <Field label="ABS equipped">
              <select value={f.abs_equipped} onChange={(e) => set('abs_equipped', e.target.value)} className="field">
                <option value="">Not sure</option><option value="yes">Yes</option><option value="no">No</option>
              </select>
            </Field>
            <Field label="Service history" required>
              <select value={f.service_history} onChange={(e) => set('service_history', e.target.value)} className="field">
                <option value="full_authorised">Full — authorised service centre</option>
                <option value="partial">Partial records</option>
                <option value="local">Local mechanic only</option>
                <option value="none">No records</option>
              </select>
            </Field>
            <div className="sm:col-span-2">
              <Field label="Description" hint="Be honest about faults — undisclosed issues are the main reason listings get rejected.">
                <textarea value={f.description} onChange={(e) => set('description', e.target.value)} rows={4} maxLength={2000} className="field" placeholder="Single owner, garage parked, new tyres at 22,000 km, minor scratch on left panel." />
              </Field>
            </div>
          </div>
        )}

        {/* STEP 2 — paperwork */}
        {step === 2 && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Insurance status" required>
              <select value={f.insurance_status} onChange={(e) => set('insurance_status', e.target.value)} className="field">
                <option value="comprehensive">Comprehensive, valid</option><option value="third_party">Third-party only</option>
                <option value="expired">Expired</option><option value="none">No insurance</option>
              </select>
            </Field>
            <Field label="Insurance valid till"><input type="date" value={f.insurance_valid_till} onChange={(e) => set('insurance_valid_till', e.target.value)} className="field" /></Field>
            <Field label="RC availability" required>
              <select value={f.rc_available} onChange={(e) => set('rc_available', e.target.value)} className="field">
                <option value="original">Original RC available</option><option value="duplicate">Duplicate RC</option><option value="not_available">Not available</option>
              </select>
            </Field>
            <Field label="Loan / hypothecation" required>
              <select value={f.loan_status} onChange={(e) => set('loan_status', e.target.value)} className="field">
                <option value="no_loan">No loan taken</option><option value="loan_closed_noc">Loan closed, NOC available</option><option value="loan_running">Loan still running</option>
              </select>
            </Field>
            <div className="sm:col-span-2 rounded-xl border border-line bg-surface p-4 text-[12.5px] leading-6 text-ink-mute">
              <p className="font-semibold text-ink">Documents are collected after submission</p>
              <p className="mt-1">
                Once you submit, our verification team will request your RC, insurance and identity documents through a
                private, secure upload. These files are stored in private storage, are never shown on the public
                listing, and are visible only to authorised verifiers. We record only the result of each check
                (passed / failed / not checked) — never the document itself on your listing.
              </p>
            </div>
          </div>
        )}

        {/* STEP 3 — photos */}
        {step === 3 && (
          <div>
            <p className="mb-4 text-[13px] text-ink-mute">
              Upload at least {minPhotos} clear daylight photos. Blurred, cropped or stock images are rejected during review.
              Required angles: {uploadedRequired}/{REQUIRED_ANGLES.length} uploaded.
            </p>
            <div className="grid gap-3 sm:grid-cols-3">
              {[...REQUIRED_ANGLES, ...OPTIONAL_ANGLES].map(([angle, label]) => (
                <div key={angle} className="rounded-xl border border-dashed border-line p-3">
                  <p className="mb-2 text-[12px] font-medium">
                    {label} {REQUIRED_ANGLES.some(([a]) => a === angle) && <span className="text-danger">*</span>}
                  </p>
                  {photos[angle] ? (
                    <div className="relative">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={photos[angle]} alt={`${label} preview`} className="h-24 w-full rounded-lg object-cover" />
                      <button type="button" onClick={() => setPhotos((p) => { const n = { ...p }; delete n[angle]; return n; })} className="absolute right-1 top-1 rounded-lg bg-white/90 px-2 py-0.5 text-[11px] font-semibold text-danger">Remove</button>
                    </div>
                  ) : (
                    <label className="flex h-24 cursor-pointer items-center justify-center rounded-lg bg-surface text-[12px] text-ink-mute hover:bg-brand-50">
                      {uploading === angle ? 'Uploading…' : '+ Add photo'}
                      <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only"
                        onChange={(e) => { const file = e.target.files?.[0]; if (file) upload(angle, file); }} />
                    </label>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* STEP 4 — price */}
        {step === 4 && (
          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <Field label="Your asking price (₹)" required>
                <input type="number" value={f.asking_price} onChange={(e) => set('asking_price', e.target.value)} className="field" />
              </Field>
              <button type="button" onClick={runValuation} className="btn-outline btn-sm mt-2">Recalculate estimate</button>
            </div>
            <div className="rounded-xl border border-line bg-surface p-4">
              {valuation ? (
                <>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-mute">Estimated market range</p>
                  <p className="mt-1 text-xl font-bold">₹{valuation.min.toLocaleString('en-IN')} – ₹{valuation.max.toLocaleString('en-IN')}</p>
                  <p className="text-[12px] text-ink-mute">Fair price estimate: ₹{valuation.fair.toLocaleString('en-IN')}</p>
                  <ul className="mt-3 space-y-1">
                    {valuation.factors.slice(0, 5).map((x: any) => (
                      <li key={x.label} className="flex justify-between gap-2 text-[12px]">
                        <span className="text-ink-mute">{x.label}</span>
                        <span className={x.effect >= 0 ? 'text-accent-dark' : 'text-danger'}>{x.effect >= 0 ? '+' : ''}{Math.round(x.effect * 100)}%</span>
                      </li>
                    ))}
                  </ul>
                  <p className="mt-3 text-[11px] leading-4 text-ink-mute">{valuation.disclaimer}</p>
                </>
              ) : (
                <p className="text-[13px] text-ink-mute">Continue to generate a market estimate from your inputs.</p>
              )}
            </div>
            <div className="sm:col-span-2 rounded-xl border border-line p-4 text-[12.5px] leading-6 text-ink-mute">
              By submitting you confirm the information is accurate, you are the legal owner or authorised to sell this
              vehicle, and you accept the{' '}
              <Link href="/legal/used-bike-terms" className="underline">used bike terms</Link> and{' '}
              <Link href="/legal/verification-terms" className="underline">verification terms</Link>. Listings go live
              only after our team completes verification.
            </div>
          </div>
        )}

        {error && <p className="err mt-4" role="alert">{error}</p>}

        <div className="mt-6 flex items-center justify-between gap-3">
          <button type="button" onClick={() => { setError(null); setStep((s) => Math.max(0, s - 1)); }} disabled={step === 0} className="btn-ghost">← Back</button>
          {step < STEPS.length - 1 ? (
            <button type="button" onClick={next} className="btn-primary">Continue →</button>
          ) : (
            <button type="button" onClick={submit} disabled={saving} className="btn-accent">{saving ? 'Submitting…' : 'Submit for verification'}</button>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({ label, children, required, hint }: { label: string; children: React.ReactNode; required?: boolean; hint?: string }) {
  return (
    <div>
      <span className="label">{label}{required && <span className="text-danger"> *</span>}</span>
      {children}
      {hint && <p className="hint">{hint}</p>}
    </div>
  );
}
