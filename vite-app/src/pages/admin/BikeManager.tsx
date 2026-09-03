import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import {
  getBrands, getVariants, getColours, getImages, getSpecsForModel, getFeatures, getPros, getCons,
  saveModel, saveVariant, deleteVariant, saveColour, deleteColour, saveImageRow, deleteImageRow,
  reorderImages, setSpecValue, deleteSpecValue, saveSpecDefinition, saveSpecGroup,
  getSpecGroups, getSpecDefinitions, setProsCons, setFeatures as saveModelFeatures, triggerImageProcessing,
  publicImageUrl,
} from '../../lib/api';
import { inr, fuelShort, slugify, fileSize, formatDate } from '../../lib/format';
import type { BikeColour, BikeImage, BikeVariant, ModelStatus, SpecDefinition, SpecGroup } from '../../lib/types';
import { Button, Card, Field, Input, LoadingBlock, Select, Spinner, StatusBadge, Tabs, Textarea } from '../../components/ui';
import { ImageUploader, type DraftImage } from '../../components/uploaders';

type TabId = 'basics' | 'variants' | 'colours' | 'images' | 'specs' | 'pros' | 'features' | 'seo';

const TABS: { id: TabId; label: string }[] = [
  { id: 'basics', label: 'Basics' },
  { id: 'variants', label: 'Variants' },
  { id: 'colours', label: 'Colours' },
  { id: 'images', label: 'Images' },
  { id: 'specs', label: 'Specifications' },
  { id: 'pros', label: 'Pros & Cons' },
  { id: 'features', label: 'Features' },
  { id: 'seo', label: 'SEO' },
];

export default function BikeManager() {
  const { id } = useParams<{ id: string }>();
  const { toast } = useApp();
  const [tab, setTab] = useState<TabId>('basics');

  const [model, setModel] = useState<any>(null);
  const [brands, setBrands] = useState<any[]>([]);
  const [variants, setVariants] = useState<BikeVariant[]>([]);
  const [colours, setColours] = useState<BikeColour[]>([]);
  const [images, setImages] = useState<BikeImage[]>([]);
  const [specs, setSpecs] = useState<any[]>([]);
  const [specDefs, setSpecDefs] = useState<SpecDefinition[]>([]);
  const [groups, setGroups] = useState<SpecGroup[]>([]);
  const [features, setFeatures] = useState<{ name: string; included: boolean }[]>([]);
  const [pros, setPros] = useState<string[]>([]);
  const [cons, setCons] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const sb = (await import('../../lib/supabase')).requireSupabase();
      const { data, error: e } = await sb
        .from('bike_models')
        .select('*, brands ( id, name, slug )')
        .eq('id', id)
        .maybeSingle();
      if (e || !data) throw new Error('Model not found. It may have been deleted.');
      const m = { ...data, brand_name: data.brands?.name };
      setModel(m);
      const [v, c, img, sp, feats, pr, cn, defs, gr] = await Promise.all([
        getVariants(id),
        getColours(id),
        getImages(id),
        getSpecsForModel(id),
        getFeatures(id),
        getPros(id),
        getCons(id),
        getSpecDefinitions(),
        getSpecGroups(),
      ]);
      setVariants(v);
      setColours(c);
      setImages(img);
      setSpecs(sp);
      setFeatures(feats.length ? feats.map((f) => ({ name: f.name, included: f.included })) : []);
      setPros(pr.map((p) => p.text));
      setCons(cn.map((c2) => c2.text));
      setSpecDefs(defs);
      setGroups(gr);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    getBrands().then(setBrands).catch(() => null);
  }, []);

  if (loading) return <LoadingBlock label="Loading model…" />;
  if (error || !model) {
    return (
      <div className="card mx-auto max-w-md p-8 text-center">
        <p className="font-semibold text-ink-800">{error || 'Not found'}</p>
        <Link to="/admin/bikes" className="mt-4 inline-block text-sm font-bold text-primary-600 hover:underline">← Back to bikes</Link>
      </div>
    );
  }

  const patchModel = (patch: any) => setModel((m: any) => ({ ...m, ...patch }));

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <nav className="text-xs text-ink-400">
            <Link to="/admin/bikes" className="hover:text-primary-600">← All bikes</Link>
          </nav>
          <h1 className="flex flex-wrap items-center gap-2 text-2xl font-black text-ink-900">
            {model.brands?.name} {model.name}
            <StatusBadge status={model.status} />
            {model.is_published ? <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-700">Published</span> : <span className="rounded-full bg-ink-100 px-2 py-0.5 text-xs font-bold text-ink-500">Hidden</span>}
          </h1>
        </div>
        <div className="flex gap-2">
          <Link to={`/new-bikes/${model.brands?.slug}/${model.slug}`} className="rounded-lg border border-ink-300 px-4 py-2 text-sm font-bold text-ink-700 hover:bg-ink-50">
            View public page
          </Link>
          <Button
            variant={model.is_published ? 'outline' : 'success'}
            onClick={async () => {
              try {
                await saveModel({ id: model.id, is_published: !model.is_published });
                patchModel({ is_published: !model.is_published });
                toast(model.is_published ? 'Unpublished — hidden from the public site.' : 'Published to the public site.', 'success');
              } catch (e: any) {
                toast(e.message, 'error');
              }
            }}
          >
            {model.is_published ? 'Unpublish' : 'Publish'}
          </Button>
        </div>
      </div>

      <Tabs tabs={TABS.map((t) => ({ id: t.id, label: t.label }))} active={tab} onChange={(t) => setTab(t as TabId)} className="mb-6 max-w-full" />

      {tab === 'basics' && <BasicsTab model={model} brands={brands} patch={patchModel} onSaved={load} />}
      {tab === 'variants' && <VariantsTab modelId={model.id} variants={variants} onChange={setVariants} onSaved={load} />}
      {tab === 'colours' && <ColoursTab modelId={model.id} colours={colours} onChange={setColours} onSaved={load} />}
      {tab === 'images' && <ImagesTab modelId={model.id} images={images} onChange={setImages} onSaved={load} />}
      {tab === 'specs' && <SpecsTab model={model} specs={specs} defs={specDefs} groups={groups} setSpecs={setSpecs} setSpecDefs={setSpecDefs} setGroups={setGroups} />}
      {tab === 'pros' && <ProsConsTab modelId={model.id} pros={pros} cons={cons} setPros={setPros} setCons={setCons} />}
      {tab === 'features' && <FeaturesTab modelId={model.id} features={features} onChanged={setFeatures} />}
      {tab === 'seo' && <SeoTab model={model} patch={patchModel} />}
    </div>
  );
}

function SaveBar({ busy, onSave, label = 'Save changes' }: { busy: boolean; onSave: () => void; label?: string }) {
  const { toast } = useApp();
  return (
    <div className="mt-5 flex items-center gap-3">
      <Button loading={busy} onClick={onSave}>{label}</Button>
    </div>
  );
}

// ─── Basics ─────────────────────────────────────────────────────────────────

function BasicsTab({ model, brands, patch, onSaved }: { model: any; brands: any[]; patch: (p: any) => void; onSaved: () => void }) {
  const { toast } = useApp();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ev = model.fuel_type === 'electric';

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      await saveModel({
        id: model.id,
        brand_id: model.brand_id,
        name: model.name,
        slug: model.slug,
        fuel_type: model.fuel_type,
        body_type: model.body_type || null,
        price_start: model.price_start || null,
        price_end: model.price_end || null,
        engine_cc: model.engine_cc || null,
        power_ps: model.power_ps || null,
        torque_nm: model.torque_nm || null,
        top_speed_kmph: model.top_speed_kmph || null,
        mileage_kmpl: ev ? null : model.mileage_kmpl || null,
        range_km: ev ? model.range_km || null : null,
        battery_kwh: ev ? model.battery_kwh || null : null,
        charging_time: ev ? model.charging_time || null : null,
        abs_enabled: model.abs_enabled === 'Y' ? true : model.abs_enabled === 'N' ? false : null,
        status: model.status,
        launch_date: model.launch_date || null,
        is_featured: model.is_featured === 'Y',
        popularity: model.popularity || null,
        overview: model.overview || null,
      });
      toast('Saved.', 'success');
      onSaved();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Card className="space-y-4 p-5 lg:col-span-2">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Brand">
            <Select value={model.brand_id} onChange={(e) => patch({ brand_id: e.target.value })}>
              {brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </Select>
          </Field>
          <Field label="Model name">
            <Input value={model.name} onChange={(e) => patch({ name: e.target.value, slug: slugify(e.target.value) })} />
          </Field>
          <Field label="Slug (URL)">
            <Input value={model.slug} onChange={(e) => patch({ slug: slugify(e.target.value) })} />
          </Field>
          <Field label="Fuel type">
            <Select value={model.fuel_type} onChange={(e) => patch({ fuel_type: e.target.value })}>
              <option value="petrol">Petrol</option>
              <option value="electric">Electric</option>
              <option value="cng_petrol">CNG + Petrol</option>
              <option value="diesel">Diesel</option>
            </Select>
          </Field>
          <Field label="Body type">
            <Select value={model.body_type || ''} onChange={(e) => patch({ body_type: e.target.value || null })}>
              <option value="">—</option>
              <option>Commuter</option><option>Standard</option><option>Sport</option><option>Cruiser</option><option>Adventure</option>
            </Select>
          </Field>
          <Field label="Status">
            <Select value={model.status} onChange={(e) => patch({ status: e.target.value as ModelStatus })}>
              <option value="live">Live</option>
              <option value="upcoming">Upcoming</option>
              <option value="outdated">Outdated</option>
              <option value="discontinued">Discontinued</option>
            </Select>
          </Field>
          <Field label="Price from (₹)">
            <Input type="number" value={model.price_start ?? ''} onChange={(e) => patch({ price_start: e.target.value ? Number(e.target.value) : null })} />
          </Field>
          <Field label="Price to (₹)">
            <Input type="number" value={model.price_end ?? ''} onChange={(e) => patch({ price_end: e.target.value ? Number(e.target.value) : null })} />
          </Field>
          {!ev && (
            <Field label="Engine (cc)">
              <Input type="number" value={model.engine_cc ?? ''} onChange={(e) => patch({ engine_cc: e.target.value ? Number(e.target.value) : null })} />
            </Field>
          )}
          {ev && (
            <>
              <Field label="Range (km)">
                <Input type="number" value={model.range_km ?? ''} onChange={(e) => patch({ range_km: e.target.value ? Number(e.target.value) : null })} />
              </Field>
              <Field label="Battery (kWh)">
                <Input type="number" step="0.01" value={model.battery_kwh ?? ''} onChange={(e) => patch({ battery_kwh: e.target.value ? Number(e.target.value) : null })} />
              </Field>
              <Field label="Charging time">
                <Input value={model.charging_time ?? ''} onChange={(e) => patch({ charging_time: e.target.value || null })} placeholder="e.g. 4 hours (0-80%)" />
              </Field>
            </>
          )}
          <Field label="Power (PS)">
            <Input type="number" value={model.power_ps ?? ''} onChange={(e) => patch({ power_ps: e.target.value ? Number(e.target.value) : null })} />
          </Field>
          <Field label="Torque (Nm)">
            <Input type="number" value={model.torque_nm ?? ''} onChange={(e) => patch({ torque_nm: e.target.value ? Number(e.target.value) : null })} />
          </Field>
          <Field label="Top speed (kmph)">
            <Input type="number" value={model.top_speed_kmph ?? ''} onChange={(e) => patch({ top_speed_kmph: e.target.value ? Number(e.target.value) : null })} />
          </Field>
          {!ev && (
            <Field label="Mileage (kmpl)">
              <Input type="number" value={model.mileage_kmpl ?? ''} onChange={(e) => patch({ mileage_kmpl: e.target.value ? Number(e.target.value) : null })} />
            </Field>
          )}
          <Field label="ABS">
            <Select value={model.abs_enabled == null ? '' : model.abs_enabled ? 'Y' : 'N'} onChange={(e) => patch({ abs_enabled: e.target.value === 'Y' ? true : e.target.value === 'N' ? false : null })}>
              <option value="">Unknown</option><option value="Y">Yes</option><option value="N">No</option>
            </Select>
          </Field>
          <Field label="Launch date">
            <Input type="date" value={model.launch_date ? model.launch_date.slice(0, 10) : ''} onChange={(e) => patch({ launch_date: e.target.value || null })} />
          </Field>
          <Field label="Popularity (0-100)">
            <Input type="number" value={model.popularity ?? ''} onChange={(e) => patch({ popularity: e.target.value ? Number(e.target.value) : null })} />
          </Field>
          <Field label="Featured on homepage">
            <Select value={model.is_featured ? 'Y' : 'N'} onChange={(e) => patch({ is_featured: e.target.value === 'Y' })}>
              <option value="N">No</option><option value="Y">Yes</option>
            </Select>
          </Field>
        </div>
        <Field label="Overview">
          <Textarea value={model.overview ?? ''} onChange={(e) => patch({ overview: e.target.value })} placeholder="Public description…" />
        </Field>
        {error && <p className="text-sm font-semibold text-red-600">{error}</p>}
        <Button loading={busy} onClick={save}>Save basics</Button>
      </Card>
      <Card className="h-fit p-5 text-sm text-ink-600">
        <h3 className="mb-2 font-black text-ink-900">Data accuracy rules</h3>
        <ul className="list-disc space-y-1.5 pl-4 text-xs leading-relaxed">
          <li>Only enter prices, mileage and specs you have verified from the brand or a trusted source.</li>
          <li>Leave a field empty when the value is unknown — it will show as <strong>N/A</strong>, never a guessed number.</li>
          <li>Upcoming models: set status to “Upcoming” so they appear in the Upcoming Bikes section.</li>
        </ul>
      </Card>
    </div>
  );
}

// ─── Variants ───────────────────────────────────────────────────────────────

function VariantsTab({ modelId, variants, onChange, onSaved }: { modelId: string; variants: BikeVariant[]; onChange: (v: BikeVariant[]) => void; onSaved: () => void }) {
  const { toast } = useApp();
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [onRoad, setOnRoad] = useState('');
  const [avail, setAvail] = useState('available');
  const [busy, setBusy] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const add = async () => {
    if (!name.trim()) return;
    setBusy(true);
    try {
      await saveVariant({
        bike_model_id: modelId,
        name: name.trim(),
        price: price ? Number(price) : null,
        on_road_price: onRoad ? Number(onRoad) : null,
        availability: (avail as any) || 'available',
        is_default: variants.length === 0,
      });
      toast('Variant added.', 'success');
      setName(''); setPrice(''); setOnRoad('');
      onSaved();
    } catch (e: any) {
      toast(e.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const remove = async (v: BikeVariant) => {
    try {
      await deleteVariant(v.id);
      toast('Variant removed.', 'success');
      onSaved();
    } catch (e: any) {
      toast(e.message, 'error');
    }
  };

  const setDefault = async (v: BikeVariant) => {
    try {
      await saveVariant({ id: v.id, is_default: true });
      toast(`"${v.name}" is now the default variant.`, 'success');
      onSaved();
    } catch (e: any) {
      toast(e.message, 'error');
    }
  };

  return (
    <div className="space-y-4">
      <Card className="p-5">
        <h3 className="mb-3 font-black text-ink-900">Add variant</h3>
        <div className="grid gap-3 sm:grid-cols-5">
          <Input placeholder="Variant name (e.g. Standard)" value={name} onChange={(e) => setName(e.target.value)} />
          <Input type="number" placeholder="Price ₹" value={price} onChange={(e) => setPrice(e.target.value)} />
          <Input type="number" placeholder="On-road ₹ (optional)" value={onRoad} onChange={(e) => setOnRoad(e.target.value)} />
          <Select value={avail} onChange={(e) => setAvail(e.target.value)}>
            <option value="available">Available</option>
            <option value="on_order">On order</option>
            <option value="discontinued">Discontinued</option>
          </Select>
          <Button loading={busy} onClick={add}>Add</Button>
        </div>
      </Card>
      {variants.length ? (
        <div className="card divide-y divide-ink-100">
          {variants.map((v) => (
            <div key={v.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
              <div className="flex items-center gap-3">
                <p className="font-bold text-ink-900">{v.name}</p>
                {v.is_default && <span className="rounded-full bg-primary-100 px-2 py-0.5 text-[10px] font-black uppercase text-primary-700">Default</span>}
                <span className="text-sm text-ink-500">{v.price != null ? inr(v.price) : 'N/A'} · <span className="capitalize">{v.availability.replace('_', ' ')}</span></span>
              </div>
              <div className="flex gap-2">
                {!v.is_default && <Button size="sm" variant="outline" onClick={() => setDefault(v)}>Make default</Button>}
                <Button size="sm" variant="ghost" className="!text-red-600" onClick={() => remove(v)}>Remove</Button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <Card className="p-6 text-center text-sm text-ink-400">No variants yet. Add at least one (Standard / Deluxe / Premium…).</Card>
      )}
    </div>
  );
}

// ─── Colours ────────────────────────────────────────────────────────────────

function ColoursTab({ modelId, colours, onChange, onSaved }: { modelId: string; colours: BikeColour[]; onChange: (c: BikeColour[]) => void; onSaved: () => void }) {
  const { toast } = useApp();
  const [name, setName] = useState('');
  const [hex, setHex] = useState('#111111');
  const [img, setImg] = useState<DraftImage | null>(null);
  const [busy, setBusy] = useState(false);

  const add = async () => {
    if (!name.trim()) return;
    setBusy(true);
    try {
      let imagePath: string | null = null;
      if (img) imagePath = img.path;
      await saveColour({ bike_model_id: modelId, name: name.trim(), hex_code: hex || null, image_path: imagePath, sort_order: colours.length });
      toast('Colour added.' + (imagePath ? ' Image will be used when this colour is selected.' : ''), 'success');
      setName(''); setImg(null);
      onSaved();
    } catch (e: any) {
      toast(e.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const remove = async (c: BikeColour) => {
    try {
      await deleteColour(c.id);
      toast('Colour removed.', 'success');
      onSaved();
    } catch (e: any) {
      toast(e.message, 'error');
    }
  };

  return (
    <div className="space-y-4">
      <Card className="p-5">
        <h3 className="mb-3 font-black text-ink-900">Add colour</h3>
        <div className="grid gap-3 sm:grid-cols-4">
          <Input placeholder="Colour name (e.g. Pearl Black)" value={name} onChange={(e) => setName(e.target.value)} />
          <input type="color" value={hex} onChange={(e) => setHex(e.target.value)} className="h-11 w-full cursor-pointer rounded-lg border border-ink-200" aria-label="Colour swatch" />
          <div className="flex items-center gap-2">
            {img ? (
              <img src={img.url} alt="preview" className="h-10 w-14 rounded object-cover" />
            ) : (
              <span className="text-xs text-ink-400">Optional colour-specific image</span>
            )}
          </div>
          <Button loading={busy} onClick={add}>Add colour</Button>
        </div>
        <div className="mt-3 max-w-sm">
          <ImageUploader
            images={img ? [img] : []}
            onChange={(imgs) => setImg(imgs[0] || null)}
            bucket="bike-images"
            pathPrefix={`models/${modelId}/colours`}
            max={1}
            label="Colour image (bike in this colour)"
            compact
          />
        </div>
      </Card>
      {colours.length ? (
        <div className="flex flex-wrap gap-2">
          {colours.map((c) => (
            <div key={c.id} className="flex items-center gap-2 rounded-full border border-ink-200 bg-white py-1.5 pl-2 pr-1.5">
              <span className="h-4 w-4 rounded-full border border-ink-200" style={{ background: c.hex_code || '#999' }} />
              <span className="text-sm font-semibold text-ink-800">{c.name}</span>
              {c.image_path && <span className="text-[10px] font-bold text-emerald-600">IMG</span>}
              <button onClick={() => remove(c)} className="rounded-full p-1 text-ink-400 hover:bg-red-50 hover:text-red-600" aria-label={`Remove ${c.name}`}>✕</button>
            </div>
          ))}
        </div>
      ) : (
        <Card className="p-6 text-center text-sm text-ink-400">No colours yet.</Card>
      )}
    </div>
  );
}

// ─── Images ─────────────────────────────────────────────────────────────────

function ImagesTab({ modelId, images, onChange, onSaved }: { modelId: string; images: BikeImage[]; onChange: (i: BikeImage[]) => void; onSaved: () => void }) {
  const { toast } = useApp();
  const [newImgs, setNewImgs] = useState<DraftImage[]>([]);
  const [roles, setRoles] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const urlFor = (i: { bucket: string; processed_path: string | null; original_path: string; storage_path: string; processing_status: string }) =>
    publicImageUrl(i.bucket || 'bike-images', (i.processing_status === 'failed' ? null : i.processed_path) || i.original_path || i.storage_path);

  const saveNew = async () => {
    if (!newImgs.length) return;
    setBusy(true);
    try {
      for (let i = 0; i < newImgs.length; i++) {
        const img = newImgs[i];
        const { data, error } = await (await import('../../lib/supabase')).requireSupabase()
          .from('bike_images')
          .insert({
            bike_model_id: modelId,
            bucket: 'bike-images',
            storage_path: img.path,
            original_path: img.path,
            mime_type: img.mime,
            file_size: img.size,
            width: img.width || null,
            height: img.height || null,
            image_role: (roles[img.id] as any) || 'gallery',
            sort_order: images.length + i,
            is_primary: images.length === 0 && i === 0,
            processing_status: 'pending',
          })
          .select('id')
          .single();
        if (error) throw new Error(error.message);
        // kick off async server-side processing (never blocks; falls back to original)
        triggerImageProcessing(data.id).catch(() => null);
      }
      toast(`${newImgs.length} image(s) uploaded. Originals preserved; background cleanup running in the background.`, 'success');
      setNewImgs([]);
      setRoles({});
      onSaved();
    } catch (e: any) {
      toast(e.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const reorder = async (ordered: BikeImage[]) => {
    onChange(ordered);
    await reorderImages(modelId, ordered.map((i) => i.id));
    toast('Order updated. First image is the primary.', 'success');
  };

  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= images.length) return;
    const next = [...images];
    [next[i], next[j]] = [next[j], next[i]];
    reorder(next);
  };

  const reprocess = async (img: BikeImage) => {
    try {
      await (await import('../../lib/supabase')).requireSupabase().from('bike_images').update({ processing_status: 'pending' }).eq('id', img.id);
      await triggerImageProcessing(img.id);
      toast('Reprocessing requested — check back in a minute.', 'success');
      setTimeout(onSaved, 1500);
    } catch (e: any) {
      toast(e.message, 'error');
    }
  };

  const del = async (img: BikeImage) => {
    try {
      await deleteImageRow(img.id);
      const sb = (await import('../../lib/supabase')).requireSupabase();
      await sb.storage.from(img.bucket || 'bike-images').remove([img.original_path, ...(img.processed_path ? [img.processed_path] : [])]).catch(() => null);
      toast('Image deleted.', 'success');
      onSaved();
    } catch (e: any) {
      toast(e.message, 'error');
    }
  };

  const toggleProcessed = async (img: BikeImage, useProcessed: boolean) => {
    try {
      const sb = (await import('../../lib/supabase')).requireSupabase();
      await sb
        .from('bike_images')
        .update(useProcessed ? { processed_path: img.processed_path, processing_status: 'completed' } : { processed_path: null, processing_status: 'skipped' })
        .eq('id', img.id);
      toast(useProcessed ? 'Using processed (studio) version.' : 'Using original upload.', 'success');
      onSaved();
    } catch (e: any) {
      toast(e.message, 'error');
    }
  };

  return (
    <div className="space-y-6">
      <Card className="p-5">
        <h3 className="mb-1 font-black text-ink-900">Upload new images</h3>
        <p className="mb-4 text-xs text-ink-400">
          Drag & drop multiple images (front, side, rear, dashboard, engine…). Each upload is validated, resized and compressed, the original is preserved, and a background-cleanup job is queued. Assign a role to each image.
        </p>
        <ImageUploader images={newImgs} onChange={setNewImgs} bucket="bike-images" pathPrefix={`models/${modelId}`} label="Upload bike images" max={20} />
        {newImgs.length > 0 && (
          <div className="mt-4">
            <p className="mb-2 text-xs font-bold uppercase tracking-wide text-ink-400">Assign roles</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {newImgs.map((img, i) => (
                <label key={img.id} className="flex items-center gap-2 text-sm">
                  <img src={img.url} alt="" className="h-10 w-14 rounded object-cover" />
                  <span className="flex-1 text-xs text-ink-500">Image {i + 1}</span>
                  <select
                    value={roles[img.id] || 'gallery'}
                    onChange={(e) => setRoles((r) => ({ ...r, [img.id]: e.target.value }))}
                    className="rounded-lg border border-ink-200 px-2 py-1 text-xs"
                  >
                    <option value="main">Main</option>
                    <option value="gallery">Gallery</option>
                    <option value="front">Front</option>
                    <option value="side">Side</option>
                    <option value="rear">Rear</option>
                    <option value="dashboard">Dashboard</option>
                    <option value="engine">Engine</option>
                    <option value="feature">Feature</option>
                  </select>
                </label>
              ))}
            </div>
          </div>
        )}
        <Button className="mt-4" loading={busy} onClick={saveNew} disabled={!newImgs.length}>
          Save {newImgs.length || ''} image{newImgs.length === 1 ? '' : 's'}
        </Button>
      </Card>

      {images.length > 0 && (
        <div>
          <h3 className="mb-3 font-black text-ink-900">Saved images ({images.length})</h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {images.map((img, i) => (
              <div key={img.id} className="card overflow-hidden">
                <div className="relative aspect-[4/3] bg-ink-100">
                  <img src={urlFor(img) || undefined} alt="" className="h-full w-full object-cover" />
                  {img.is_primary && <span className="absolute left-2 top-2 rounded-full bg-ink-900/90 px-2 py-0.5 text-[10px] font-bold text-white">PRIMARY</span>}
                  <span className={`absolute right-2 top-2 rounded-full px-2 py-0.5 text-[10px] font-bold ${img.processing_status === 'completed' ? 'bg-emerald-500 text-white' : img.processing_status === 'failed' ? 'bg-red-500 text-white' : 'bg-amber-400 text-ink-900'}`}>
                    {img.processing_status}
                  </span>
                </div>
                <div className="space-y-2 p-3">
                  <div className="flex items-center justify-between text-xs text-ink-500">
                    <span className="font-bold uppercase tracking-wide">{img.image_role}</span>
                    <span>{fileSize(img.file_size)} · {img.width || '?'}×{img.height || '?'} · {formatDate(img.created_at)}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="flex gap-1">
                      <Mini onClick={() => move(i, -1)} disabled={i === 0}>←</Mini>
                      <Mini onClick={() => move(i, 1)} disabled={i === images.length - 1}>→</Mini>
                      <Mini onClick={() => reprocess(img)} title="Reprocess (background cleanup)">↻</Mini>
                    </div>
                    <div className="flex justify-end gap-1">
                      {img.processed_path && img.processing_status === 'completed' ? (
                        <Mini onClick={() => toggleProcessed(img, false)} title="Switch to original">Orig</Mini>
                      ) : (
                        <span className="text-[10px] text-ink-300">no processed</span>
                      )}
                      {img.processed_path && img.processing_status !== 'completed' && (
                        <Mini onClick={() => toggleProcessed(img, true)} title="Use processed">Proc</Mini>
                      )}
                      <Mini onClick={() => del(img)} danger title="Delete">✕</Mini>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Mini({ children, onClick, disabled, danger, title }: { children: React.ReactNode; onClick: () => void; disabled?: boolean; danger?: boolean; title?: string }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`rounded border px-2 py-1 text-xs font-bold transition disabled:opacity-30 ${danger ? 'border-red-200 text-red-600 hover:bg-red-50' : 'border-ink-200 text-ink-600 hover:bg-ink-100'}`}
    >
      {children}
    </button>
  );
}

// ─── Specifications (dynamic) ───────────────────────────────────────────────

function SpecsTab({ model, specs, defs, groups, setSpecs, setSpecDefs, setGroups }: {
  model: any;
  specs: any[];
  defs: SpecDefinition[];
  groups: SpecGroup[];
  setSpecs: (s: any[]) => void;
  setSpecDefs: (d: SpecDefinition[]) => void;
  setGroups: (g: SpecGroup[]) => void;
}) {
  const { toast } = useApp();
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [newSpecName, setNewSpecName] = useState('');
  const [newSpecUnit, setNewSpecUnit] = useState('');
  const [newSpecType, setNewSpecType] = useState('text');
  const [groupFilter, setGroupFilter] = useState('');

  const valueFor = (specId: string) => specs.find((s) => s.specification_id === specId && !s.variant_id);

  const setValue = async (specId: string, value: { value_text?: string; value_numeric?: number | null; value_boolean?: boolean | null }) => {
    try {
      await setSpecValue(model.id, specId, value);
      setSpecs(await getSpecsForModel(model.id));
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    } catch (e: any) {
      toast(e.message, 'error');
    }
  };

  const clearValue = async (specRow: any) => {
    try {
      await deleteSpecValue(specRow.id);
      setSpecs(await getSpecsForModel(model.id));
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    } catch (e: any) {
      toast(e.message, 'error');
    }
  };

  const createDef = async () => {
    if (!newSpecName.trim()) return;
    setBusy(true);
    try {
      let groupId: string;
      const existingGroup = groups.find((g) => g.name.toLowerCase() === newGroupName.trim().toLowerCase());
      if (existingGroup) {
        groupId = existingGroup.id;
      } else if (newGroupName.trim()) {
        await saveSpecGroup(newGroupName.trim());
        const gs = await getSpecGroups();
        setGroups(gs);
        const g = gs.find((x) => x.name.toLowerCase() === newGroupName.trim().toLowerCase());
        if (!g) throw new Error('Could not create the group.');
        groupId = g.id;
      } else {
        const other = groups.find((g) => g.name.toLowerCase() === 'other');
        if (!other) throw new Error('Create or pick a group first.');
        groupId = other.id;
      }
      await saveSpecDefinition({ group_id: groupId, name: newSpecName.trim(), unit: newSpecUnit.trim() || null, data_type: newSpecType as any, is_compare: true, sort_order: 999 });
      const ds = await getSpecDefinitions();
      setSpecDefs(ds);
      toast(`Specification "${newSpecName}" added${newGroupName ? ` under ${newGroupName}` : ''}. Now enter its value.`, 'success');
      setAddOpen(false);
      setNewGroupName(''); setNewSpecName(''); setNewSpecUnit('');
    } catch (e: any) {
      toast(e.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const visibleDefs = groupFilter ? defs.filter((d) => d.group_name === groupFilter) : defs;
  const usedSpecIds = new Set(specs.map((s) => s.specification_id));

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-ink-500">
          Dynamic specification system — add unlimited specs. Values save instantly. Unused definitions can be added below.
        </p>
        <div className="flex gap-2">
          <Select value={groupFilter} onChange={(e) => setGroupFilter(e.target.value)} className="w-auto">
            <option value="">All groups</option>
            {groups.map((g) => <option key={g.id} value={g.name}>{g.name}</option>)}
          </Select>
          <Button size="sm" onClick={() => setAddOpen((o) => !o)}>+ Add Specification</Button>
        </div>
      </div>

      {addOpen && (
        <Card className="mb-5 p-4">
          <div className="grid gap-3 sm:grid-cols-5">
            <Input placeholder="Group (e.g. Engine) — new groups auto-created" value={newGroupName} onChange={(e) => setNewGroupName(e.target.value)} />
            <Input placeholder="Spec name (e.g. Displacement)" value={newSpecName} onChange={(e) => setNewSpecName(e.target.value)} />
            <Input placeholder="Unit (cc, Yes/No…)" value={newSpecUnit} onChange={(e) => setNewSpecUnit(e.target.value)} />
            <Select value={newSpecType} onChange={(e) => setNewSpecType(e.target.value)}>
              <option value="text">Text</option>
              <option value="number">Number</option>
              <option value="boolean">Yes/No</option>
            </Select>
            <Button loading={busy} onClick={createDef}>Create</Button>
          </div>
        </Card>
      )}

      {Object.entries(groups.reduce<Record<string, SpecDefinition[]>>((acc, g) => {
        const inGroup = visibleDefs.filter((d) => d.group_name === g.name);
        if (inGroup.length) acc[g.name] = inGroup;
        return acc;
      }, {})).map(([groupName, gDefs]) => (
        <Card key={groupName} className="mb-4 overflow-hidden">
          <p className="border-b border-ink-100 bg-ink-50 px-4 py-2.5 text-xs font-black uppercase tracking-widest text-ink-500">{groupName}</p>
          <div className="divide-y divide-ink-50">
            {gDefs.map((d) => {
              const row = valueFor(d.id);
              return (
                <div key={d.id} className="flex flex-wrap items-center gap-3 px-4 py-2.5">
                  <span className="w-56 shrink-0 text-sm font-semibold text-ink-700">{d.name}</span>
                  {d.data_type === 'boolean' ? (
                    <Select
                      value={row?.value_boolean == null ? '' : row.value_boolean ? 'Y' : 'N'}
                      onChange={(e) => setValue(d.id, { value_boolean: e.target.value === 'Y' ? true : e.target.value === 'N' ? false : null })}
                      className="w-32"
                    >
                      <option value="">—</option>
                      <option value="Y">Yes</option>
                      <option value="N">No</option>
                    </Select>
                  ) : (
                    <Input
                      type={d.data_type === 'number' ? 'number' : 'text'}
                      placeholder={`Value${d.unit ? ` (${d.unit})` : ''}`}
                      value={row?.value_numeric ?? row?.value_text ?? ''}
                      onChange={(e) =>
                        setValue(d.id, d.data_type === 'number' ? { value_numeric: e.target.value === '' ? null : Number(e.target.value) } : { value_text: e.target.value || undefined })
                      }
                      className="w-48"
                    />
                  )}
                  <span className="text-xs text-ink-400">{d.unit || ''}</span>
                  {row && (
                    <button onClick={() => clearValue(row)} className="ml-auto text-xs font-bold text-red-500 hover:underline">Clear</button>
                  )}
                </div>
              );
            })}
          </div>
        </Card>
      ))}

      {/* unused definitions quick-add */}
      {!groupFilter && (
        <Card className="p-4">
          <p className="mb-2 text-xs font-black uppercase tracking-widest text-ink-400">Available but unset specifications</p>
          <div className="flex flex-wrap gap-2">
            {defs.filter((d) => !usedSpecIds.has(d.id)).slice(0, 20).map((d) => (
              <span key={d.id} className="rounded-full border border-dashed border-ink-300 px-3 py-1 text-xs text-ink-500">
                {d.name} <span className="text-ink-300">({d.group_name})</span>
              </span>
            ))}
            {!defs.filter((d) => !usedSpecIds.has(d.id)).length && <span className="text-xs text-ink-400">All defined specifications are in use.</span>}
          </div>
        </Card>
      )}
      {saved && <p className="mt-3 text-sm font-semibold text-emerald-600">✓ Saved</p>}
    </div>
  );
}

// ─── Pros / Cons ────────────────────────────────────────────────────────────

function ProsConsTab({ modelId, pros, cons, setPros, setCons }: { modelId: string; pros: string[]; cons: string[]; setPros: (p: string[]) => void; setCons: (c: string[]) => void }) {
  const { toast } = useApp();
  const [prosText, setProsText] = useState(pros.join('\n'));
  const [consText, setConsText] = useState(cons.join('\n'));
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    try {
      await setProsCons(modelId, 'pros', prosText.split('\n').map((x) => x.trim()).filter(Boolean));
      await setProsCons(modelId, 'cons', consText.split('\n').map((x) => x.trim()).filter(Boolean));
      toast('Pros and cons saved.', 'success');
    } catch (e: any) {
      toast(e.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card className="p-5">
        <h3 className="mb-2 font-black text-emerald-700">Pros (one per line)</h3>
        <Textarea value={prosText} onChange={(e) => setProsText(e.target.value)} className="min-h-[220px]" placeholder={'Excellent mileage\nLow maintenance cost\nComfortable seat'} />
      </Card>
      <Card className="p-5">
        <h3 className="mb-2 font-black text-red-600">Cons (one per line)</h3>
        <Textarea value={consText} onChange={(e) => setConsText(e.target.value)} className="min-h-[220px]" placeholder={'Rattles at high speed\nLimited storage space'} />
      </Card>
      <div className="md:col-span-2">
        <Button loading={busy} onClick={save}>Save pros & cons</Button>
      </div>
    </div>
  );
}

// ─── Features ───────────────────────────────────────────────────────────────

function FeaturesTab({ modelId, features, onChanged }: { modelId: string; features: { name: string; included: boolean }[]; onChanged: (rows: { name: string; included: boolean }[]) => void }) {
  const { toast } = useApp();
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);

  const save = async (rows: { name: string; included: boolean }[]) => {
    setBusy(true);
    try {
      await saveModelFeatures(modelId, rows);
      onChanged(rows);
      toast('Features saved.', 'success');
    } catch (e: any) {
      toast(e.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-2xl space-y-4">
      <Card className="p-5">
        <h3 className="mb-3 font-black text-ink-900">Add feature</h3>
        <div className="flex gap-2">
          <Input placeholder="e.g. Bluetooth Connectivity" value={name} onChange={(e) => setName(e.target.value)} />
          <Button
            onClick={() => {
              if (!name.trim()) return;
              save([...features, { name: name.trim(), included: true }]);
              setName('');
            }}
            loading={busy}
          >
            Add
          </Button>
        </div>
      </Card>
      {features.length > 0 && (
        <Card className="divide-y divide-ink-100">
          {features.map((f, i) => (
            <div key={i} className="flex items-center justify-between gap-3 px-4 py-2.5">
              <label className="flex flex-1 items-center gap-2 text-sm font-semibold text-ink-800">
                <input
                  type="checkbox"
                  checked={f.included}
                  onChange={(e) => save(features.map((x, xi) => (xi === i ? { ...x, included: e.target.checked } : x)))}
                  className="h-4 w-4 accent-primary-600"
                />
                {f.name}
              </label>
              <button onClick={() => save(features.filter((_, xi) => xi !== i))} className="text-xs font-bold text-red-500 hover:underline">Remove</button>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}

// ─── SEO ────────────────────────────────────────────────────────────────────

function SeoTab({ model, patch }: { model: any; patch: (p: any) => void }) {
  const { toast } = useApp();
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    try {
      await saveModel({
        id: model.id,
        seo_title: model.seo_title || null,
        seo_description: model.seo_description || null,
        canonical_url: model.canonical_url || null,
      });
      toast('SEO saved.', 'success');
    } catch (e: any) {
      toast(e.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const url = `https://your-domain.com/new-bikes/${model.brands?.slug}/${model.slug}`;

  return (
    <Card className="max-w-2xl space-y-4 p-5">
      <Field label="SEO title" hint="Shown in search results. Keep under 60 characters.">
        <Input value={model.seo_title ?? ''} onChange={(e) => patch({ seo_title: e.target.value })} placeholder={`${model.brands?.name} ${model.name} price, specs — CompareBike`} />
      </Field>
      <Field label="Meta description" hint="Under 160 characters.">
        <Textarea value={model.seo_description ?? ''} onChange={(e) => patch({ seo_description: e.target.value })} />
      </Field>
      <Field label="Canonical URL (optional)" hint={`Default: ${url}`}>
        <Input value={model.canonical_url ?? ''} onChange={(e) => patch({ canonical_url: e.target.value })} />
      </Field>
      <div className="rounded-lg bg-ink-50 p-4 text-xs leading-relaxed text-ink-500">
        <p className="font-bold text-ink-700">Automatic SEO (no action needed)</p>
        <p>Each bike page automatically gets OpenGraph tags, a Schema.org <code>Product</code> JSON-LD block with price and mileage, and breadcrumb structured data. The OG image defaults to the primary bike image.</p>
      </div>
      <Button loading={busy} onClick={save}>Save SEO</Button>
    </Card>
  );
}
