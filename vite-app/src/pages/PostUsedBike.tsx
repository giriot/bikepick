import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { getBrands, createUsedBike, updateUsedBike, getUsedBike, queryUsedBikes } from '../lib/api';
import type { Brand, ConditionGrade, FuelType, UsedBike } from '../lib/types';
import { inr, FUEL_OPTIONS, CONDITION_GRADES, titleCase } from '../lib/format';
import { Button, Field, Input, LoadingBlock, Select, StatusBadge, Textarea } from '../components/ui';
import { ImageUploader, DocUploader, type DraftImage, type DraftDoc } from '../components/uploaders';

const STATES = ['Andhra Pradesh','Assam','Bihar','Chhattisgarh','Delhi','Goa','Gujarat','Haryana','Himachal Pradesh','Jharkhand','Karnataka','Kerala','Madhya Pradesh','Maharashtra','Odisha','Punjab','Rajasthan','Tamil Nadu','Telangana','Uttar Pradesh','Uttarakhand','West Bengal','Other'];

const MIN_IMAGES = 5;
const MAX_IMAGES = 10;

/**
 * /post-used-bike — post or edit a used-bike listing.
 * Requires login. Minimum 5 photos are enforced client-side and the listing
 * can never be submitted below that. Proof documents go to private storage.
 * New/edited listings enter the approval workflow (waiting_approval).
 */
export default function PostUsedBike() {
  const { editId } = useParams<{ editId?: string }>();
  const navigate = useNavigate();
  const { isAuthed, authLoading, profile, toast } = useApp();

  const [brands, setBrands] = useState<Brand[]>([]);
  const [loadingExisting, setLoadingExisting] = useState(Boolean(editId));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  // form state
  const [brandId, setBrandId] = useState('');
  const [modelName, setModelName] = useState('');
  const [variantName, setVariantName] = useState('');
  const [year, setYear] = useState('');
  const [price, setPrice] = useState('');
  const [km, setKm] = useState('');
  const [fuel, setFuel] = useState('');
  const [state, setState] = useState('');
  const [city, setCity] = useState('');
  const [area, setArea] = useState('');
  const [condition, setCondition] = useState('');
  const [registration, setRegistration] = useState('');
  const [ownerCount, setOwnerCount] = useState('1');
  const [hasInsurance, setHasInsurance] = useState(false);
  const [serviceHistory, setServiceHistory] = useState(false);
  const [accidentHistory, setAccidentHistory] = useState(false);
  const [description, setDescription] = useState('');
  const [images, setImages] = useState<DraftImage[]>([]);
  const [docs, setDocs] = useState<DraftDoc[]>([]);

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthed) navigate(`/login?redirect=${encodeURIComponent(location.pathname)}`, { replace: true });
  }, [isAuthed, authLoading, navigate]);

  useEffect(() => {
    getBrands().then(setBrands).catch(() => null);
  }, []);

  // load existing when editing (after changes_required / from drafts)
  useEffect(() => {
    if (!editId || !isAuthed) return;
    (async () => {
      try {
        const res = await queryUsedBikes({ user_id: profile!.id, status: ['draft', 'changes_required', 'rejected', 'waiting_approval', 'approved'] });
        const b = res.rows.find((x) => x.id === editId);
        if (!b) {
          setError('Listing not found or you do not own it.');
          setLoadingExisting(false);
          return;
        }
        setBrandId(b.brand_id || '');
        setModelName(b.model_name);
        setVariantName(b.variant_name || '');
        setYear(b.year ? String(b.year) : '');
        setPrice(String(b.price));
        setKm(b.km_driven ? String(b.km_driven) : '');
        setFuel(b.fuel_type || '');
        setState(b.state || '');
        setCity(b.city || '');
        setArea(b.area || '');
        setCondition(b.condition_grade || '');
        setRegistration(b.registration_number || '');
        setOwnerCount(b.owner_count ? String(b.owner_count) : '1');
        setHasInsurance(b.has_insurance);
        setServiceHistory(b.service_history);
        setAccidentHistory(b.accident_history);
        setDescription(b.description || '');
        // load existing images (owner RLS allows own rows)
        const { getUsedImages } = await import('../lib/api');
        const imgs = await getUsedImages(b.id);
        setImages(
          imgs.map((i: any) => ({
            id: i.id,
            recordId: i.id,
            path: i.storage_path,
            url: i.url,
            thumbPath: undefined,
            thumbUrl: undefined,
            width: i.width || 0,
            height: i.height || 0,
            size: i.file_size || 0,
            mime: i.mime_type || 'image/jpeg',
          })),
        );
      } catch (e: any) {
        setError(e.message);
      } finally {
        setLoadingExisting(false);
      }
    })();
  }, [editId, isAuthed, profile]);

  if (authLoading || loadingExisting) return <LoadingBlock label="Loading…" />;
  if (!isAuthed) return null;

  const validate = (): string | null => {
    if (!brandId) return 'Please select a brand.';
    if (!modelName.trim()) return 'Please enter the model name.';
    if (!year || Number(year) < 1990 || Number(year) > new Date().getFullYear() + 1) return 'Enter a valid model year.';
    if (!price || Number(price) <= 0) return 'Enter the asking price.';
    if (km && (Number(km) < 0 || Number(km) > 500000)) return 'Enter a valid km driven value.';
    if (!fuel) return 'Select the fuel type.';
    if (!state) return 'Select the state.';
    if (!city.trim()) return 'Enter the city (used for location, your exact address is never shown).';
    if (!condition) return 'Select the condition.';
    if (images.length < MIN_IMAGES) return `Minimum ${MIN_IMAGES} photos are required — you have ${images.length}. Add ${MIN_IMAGES - images.length} more.`;
    if (description.trim().length < 30) return 'Please write a short description (at least 30 characters).';
    return null;
  };

  const buildPayload = () => ({
    brand_id: brandId || null,
    model_name: modelName.trim(),
    variant_name: variantName.trim() || null,
    year: year ? Number(year) : null,
    price: Number(price),
    km_driven: km ? Number(km) : null,
    fuel_type: (fuel || null) as FuelType | null,
    state: state || null,
    city: city.trim() || null,
    area: area.trim() || null,
    condition_grade: (condition || null) as ConditionGrade | null,
    owner_count: Number(ownerCount) || 1,
    registration_number: registration.trim() || null,
    has_insurance: hasInsurance,
    service_history: serviceHistory,
    accident_history: accidentHistory,
    description: description.trim(),
  });

  const persistImages = async (bikeId: string, keep: DraftImage[]) => {
    const sb = (await import('../lib/supabase')).requireSupabase();
    for (let i = 0; i < keep.length; i++) {
      const img = keep[i];
      if (img.recordId) {
        await sb.from('used_bike_images').update({ sort_order: i, is_primary: i === 0 }).eq('id', img.recordId);
      } else {
        await sb.from('used_bike_images').insert({
          used_bike_id: bikeId,
          user_id: profile!.id,
          bucket: 'used-bike-images',
          storage_path: img.path,
          mime_type: img.mime,
          file_size: img.size,
          width: img.width || null,
          height: img.height || null,
          sort_order: i,
          is_primary: i === 0,
        });
      }
    }
    // delete images removed from the list
    const { data: existing } = await sb.from('used_bike_images').select('id, storage_path, bucket').eq('used_bike_id', bikeId);
    const keepIds = keep.map((k) => k.recordId).filter(Boolean) as string[];
    const removed = (existing || []).filter((r: any) => !keepIds.includes(r.id));
    for (const r of removed) {
      await sb.from('used_bike_images').delete().eq('id', r.id);
      await sb.storage.from(r.bucket || 'used-bike-images').remove([r.storage_path]).catch(() => null);
    }
  };

  const persistDocs = async (bikeId: string, keep: DraftDoc[]) => {
    const sb = (await import('../lib/supabase')).requireSupabase();
    for (const d of keep) {
      if (!d.recordId && d.path) {
        const { data, error } = await sb
          .from('used_bike_documents')
          .insert({ used_bike_id: bikeId, user_id: profile!.id, doc_type: d.doc_type, label: d.label, bucket: 'private-documents', storage_path: d.path, mime_type: d.mime, file_size: d.size })
          .select('id')
          .single();
        if (!error && data) {
          d.recordId = data.id;
        }
      }
    }
    const { data: existing } = await sb.from('used_bike_documents').select('id, storage_path, bucket').eq('used_bike_id', bikeId);
    const keepIds = keep.map((k) => k.recordId).filter(Boolean) as string[];
    const removed = (existing || []).filter((r: any) => !keepIds.includes(r.id));
    for (const r of removed) {
      await sb.from('used_bike_documents').delete().eq('id', r.id);
      await sb.storage.from(r.bucket || 'private-documents').remove([r.storage_path]).catch(() => null);
    }
  };

  const submit = async (mode: 'draft' | 'submit') => {
    setError(null);
    if (mode === 'submit') {
      const problem = validate();
      if (problem) {
        setError(problem);
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }
    }
    setBusy(true);
    try {
      const payload = buildPayload();
      const status = mode === 'draft' ? 'draft' : 'waiting_approval';
      let bikeId: string;
      if (editId) {
        bikeId = editId;
        await updateUsedBike(bikeId, { ...payload, status, reject_reason: null } as Partial<UsedBike>);
      } else {
        bikeId = await createUsedBike({ ...payload, status } as Partial<UsedBike>);
      }
      await persistImages(bikeId, images);
      await persistDocs(bikeId, docs);
      setSaved(bikeId);
      toast(mode === 'draft' ? 'Draft saved.' : 'Listing submitted for approval!', 'success');
    } catch (e: any) {
      setError(e.message || 'Could not save the listing. Please try again.');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      setBusy(false);
    }
  };

  if (saved) {
    return (
      <div className="container-x py-16">
        <div className="card mx-auto max-w-lg p-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
            <svg className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
          </div>
          <h1 className="text-2xl font-black text-ink-900">{saved && images.length >= MIN_IMAGES ? 'Listing submitted!' : 'Draft saved!'}</h1>
          <p className="mt-2 text-sm leading-relaxed text-ink-500">
            {images.length >= MIN_IMAGES
              ? 'Our verification team will review your photos, documents and details. You\u2019ll get a notification the moment it\u2019s approved — only then does it appear publicly with the Verified badge.'
              : 'Your draft is safe. Come back and add photos whenever you\u2019re ready.'}
          </p>
          <div className="mt-6 flex justify-center gap-3">
            <Link to="/account" className="rounded-lg bg-ink-900 px-5 py-2.5 text-sm font-bold text-white hover:bg-ink-700">Go to My Used Bikes</Link>
            <Link to="/used-bikes" className="rounded-lg border border-ink-300 px-5 py-2.5 text-sm font-bold text-ink-700 hover:bg-ink-50">Browse listings</Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container-x max-w-4xl py-8">
      <nav className="mb-3 text-xs text-ink-400">
        <Link to="/" className="hover:text-primary-600">Home</Link>
        <span className="mx-1.5">/</span>
        <Link to="/used-bikes" className="hover:text-primary-600">Used Bikes</Link>
        <span className="mx-1.5">/</span>
        <span className="font-semibold text-ink-700">{editId ? 'Edit listing' : 'Post a used bike'}</span>
      </nav>
      <h1 className="text-3xl font-black tracking-tight text-ink-900">{editId ? 'Edit Your Used Bike Listing' : 'Sell Your Bike'}</h1>
      <p className="mt-1 mb-6 max-w-2xl text-sm text-ink-500">
        Fill in honest details, add at least <strong>{MIN_IMAGES} photos</strong>, and upload proof documents. Your listing goes through admin verification before it is published — this is what protects buyers and earns the Verified badge.
      </p>

      {error && (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">
          {error}
        </div>
      )}

      <div className="space-y-6">
        {/* Bike details */}
        <section className="card p-5">
          <h2 className="mb-4 text-lg font-black text-ink-900">Bike details</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Brand" required>
              <Select value={brandId} onChange={(e) => setBrandId(e.target.value)}>
                <option value="">Select brand…</option>
                {brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </Select>
            </Field>
            <Field label="Model" required>
              <Input value={modelName} onChange={(e) => setModelName(e.target.value)} placeholder="e.g. Activa 6G / Splendor Plus" />
            </Field>
            <Field label="Variant (optional)">
              <Input value={variantName} onChange={(e) => setVariantName(e.target.value)} placeholder="e.g. Drum brake" />
            </Field>
            <Field label="Year" required>
              <Input value={year} onChange={(e) => setYear(e.target.value)} placeholder="e.g. 2021" inputMode="numeric" />
            </Field>
            <Field label="Asking price (₹)" required>
              <Input value={price} onChange={(e) => setPrice(e.target.value)} placeholder="e.g. 45000" inputMode="numeric" />
            </Field>
            <Field label="KM driven">
              <Input value={km} onChange={(e) => setKm(e.target.value)} placeholder="e.g. 32000" inputMode="numeric" />
            </Field>
            <Field label="Fuel type" required>
              <Select value={fuel} onChange={(e) => setFuel(e.target.value)}>
                <option value="">Select…</option>
                {FUEL_OPTIONS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
              </Select>
            </Field>
            <Field label="Condition" required>
              <Select value={condition} onChange={(e) => setCondition(e.target.value)}>
                <option value="">Select…</option>
                {CONDITION_GRADES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
              </Select>
            </Field>
            <Field label="Owner count">
              <Select value={ownerCount} onChange={(e) => setOwnerCount(e.target.value)}>
                <option value="1">1st owner</option>
                <option value="2">2nd owner</option>
                <option value="3">3rd owner</option>
                <option value="4">4th owner or more</option>
              </Select>
            </Field>
            <Field label="Registration number" hint="Used for verification only; shown to buyers as partial.">
              <Input value={registration} onChange={(e) => setRegistration(e.target.value)} placeholder="e.g. TN 10 AB 1234" />
            </Field>
          </div>
        </section>

        {/* Location */}
        <section className="card p-5">
          <h2 className="mb-1 text-lg font-black text-ink-900">Location</h2>
          <p className="mb-4 text-xs text-ink-400">State + city + area is enough for buyers. Your exact address is never published.</p>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="State" required>
              <Select value={state} onChange={(e) => setState(e.target.value)}>
                <option value="">Select…</option>
                {STATES.map((s) => <option key={s}>{s}</option>)}
              </Select>
            </Field>
            <Field label="City" required>
              <Input value={city} onChange={(e) => setCity(e.target.value)} placeholder="e.g. Coimbatore" />
            </Field>
            <Field label="Area (optional)">
              <Input value={area} onChange={(e) => setArea(e.target.value)} placeholder="e.g. RS Puram" />
            </Field>
          </div>
        </section>

        {/* History */}
        <section className="card p-5">
          <h2 className="mb-4 text-lg font-black text-ink-900">History & condition</h2>
          <div className="grid gap-3 sm:grid-cols-3">
            <Check label="Valid insurance" checked={hasInsurance} onChange={setHasInsurance} />
            <Check label="Complete service history" checked={serviceHistory} onChange={setServiceHistory} />
            <Check label="Has accident history (be honest)" checked={accidentHistory} onChange={setAccidentHistory} />
          </div>
        </section>

        {/* Description */}
        <section className="card p-5">
          <h2 className="mb-4 text-lg font-black text-ink-900">Description</h2>
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Condition of the bike, why you're selling, extras (helmet, cover, spare tyres), pickup area…"
            className="min-h-[120px]"
          />
        </section>

        {/* Photos */}
        <section className="card p-5">
          <h2 className="mb-1 text-lg font-black text-ink-900">Photos <span className="text-sm font-semibold text-ink-400">— minimum {MIN_IMAGES}, up to {MAX_IMAGES}</span></h2>
          <p className="mb-4 text-xs text-ink-400">
            Good photos sell faster: front, rear, side, dashboard with odometer, engine bay, and any scratches. The first photo becomes your primary image.
          </p>
          <ImageUploader images={images} onChange={setImages} bucket="used-bike-images" pathPrefix={`used/${profile!.id}`} min={MIN_IMAGES} max={MAX_IMAGES} />
        </section>

        {/* Proof documents */}
        <section className="card p-5">
          <h2 className="mb-1 text-lg font-black text-ink-900">Proof documents <span className="text-sm font-semibold text-ink-400">— RC strongly recommended</span></h2>
          <p className="mb-4 text-xs text-ink-400">
            RC, insurance and identity proof go to <strong>private</strong> storage. Buyers never see them; our admin verifies them during approval.
          </p>
          <DocUploader docs={docs} onChange={setDocs} pathPrefix={`used/${profile!.id}`} />
        </section>

        {/* Actions */}
        <section className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-ink-400">
            By submitting you agree to the <Link to="/seller-terms" className="font-bold text-primary-600 hover:underline">Seller Terms</Link> and <Link to="/listing-rules" className="font-bold text-primary-600 hover:underline">Listing Rules</Link>.
          </p>
          <div className="flex gap-2">
            <Button variant="outline" loading={busy} onClick={() => submit('draft')}>Save draft</Button>
            <Button loading={busy} onClick={() => submit('submit')}>
              {editId ? 'Submit updated listing' : 'Submit for approval'}
            </Button>
          </div>
        </section>
      </div>
    </div>
  );
}

function Check({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center gap-2.5 rounded-lg border border-ink-200 px-3 py-2.5 text-sm font-semibold text-ink-700 transition has-[:checked]:border-primary-500 has-[:checked]:bg-primary-50">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="h-4 w-4 accent-primary-600" />
      {label}
    </label>
  );
}
