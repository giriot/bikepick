import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getModelsAdmin } from '../../lib/api-admin';
import { saveModel, deleteModel, duplicateModel, getBrands } from '../../lib/api';
import { slugify } from '../../lib/format';
import { useApp } from '../../context/AppContext';
import { inr, fuelShort, formatDate } from '../../lib/format';
import { Button, ErrorBlock, Field, Input, LoadingBlock, Modal, Select, StatusBadge } from '../../components/ui';
import type { ModelStatus } from '../../lib/types';

/**
 * /admin/bikes — admin catalogue management:
 * add, edit, duplicate, publish/unpublish, change status, delete.
 * Full editing (variants, colours, images, specs, pros/cons, SEO) is in BikeManager.
 */
export default function AdminBikes() {
  const { toast } = useApp();
  const [rows, setRows] = useState<Awaited<ReturnType<typeof getModelsAdmin>>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [delConfirm, setDelConfirm] = useState<any | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setRows(await getModelsAdmin({ status: statusFilter || undefined, search: search || undefined }));
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, search]);

  useEffect(() => {
    const t = setTimeout(load, search ? 300 : 0);
    return () => clearTimeout(t);
  }, [load, search]);

  const togglePublish = async (m: any) => {
    setBusyId(m.id);
    try {
      await saveModel({ id: m.id, is_published: !m.is_published });
      toast(m.is_published ? 'Model unpublished (hidden from public site).' : 'Model published. It is now visible publicly.', 'success');
      load();
    } catch (e: any) {
      toast(e.message, 'error');
    } finally {
      setBusyId(null);
    }
  };

  const setStatus = async (m: any, status: ModelStatus) => {
    setBusyId(m.id);
    try {
      await saveModel({ id: m.id, status });
      toast(`Status changed to ${status}.`, 'success');
      load();
    } catch (e: any) {
      toast(e.message, 'error');
    } finally {
      setBusyId(null);
    }
  };

  const doDuplicate = async (m: any) => {
    setBusyId(m.id);
    try {
      const newId = await duplicateModel(m.id);
      toast('Duplicated as an unpublished copy. Edit and publish when ready.', 'success');
      window.location.href = `/admin/bikes/${newId}`;
    } catch (e: any) {
      toast(e.message, 'error');
    } finally {
      setBusyId(null);
    }
  };

  const doDelete = async () => {
    if (!delConfirm) return;
    setBusyId(delConfirm.id);
    try {
      await deleteModel(delConfirm.id);
      toast('Model deleted.', 'success');
      setDelConfirm(null);
      load();
    } catch (e: any) {
      toast(e.message, 'error');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-ink-900">Bike Models</h1>
          <p className="text-sm text-ink-500">{rows.length} models</p>
        </div>
        <Link to="/admin/bikes/new" className="rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-primary-700">+ Add New Model</Link>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        <Input placeholder="Search model name…" value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-xs" />
        <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="max-w-[180px]">
          <option value="">All statuses</option>
          <option value="live">Live</option>
          <option value="upcoming">Upcoming</option>
          <option value="outdated">Outdated</option>
          <option value="discontinued">Discontinued</option>
        </Select>
      </div>

      {loading ? (
        <LoadingBlock />
      ) : error ? (
        <ErrorBlock message={error} onRetry={load} />
      ) : rows.length ? (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[900px] text-sm">
            <thead>
              <tr className="border-b border-ink-200 text-left text-xs uppercase tracking-wide text-ink-400">
                <th className="px-4 py-3 font-bold">Model</th>
                <th className="px-4 py-3 font-bold">Fuel</th>
                <th className="px-4 py-3 font-bold">Price</th>
                <th className="px-4 py-3 font-bold">Status</th>
                <th className="px-4 py-3 font-bold">Visibility</th>
                <th className="px-4 py-3 font-bold">Launched</th>
                <th className="px-4 py-3 font-bold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((m) => (
                <tr key={m.id} className="border-b border-ink-100 last:border-0 hover:bg-ink-50/50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <span className="flex h-9 w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-ink-100">
                        {m.primary_image_url ? (
                          <img src={m.primary_image_url} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <span className="text-xs font-bold text-ink-400">{m.brand_name?.slice(0, 2)}</span>
                        )}
                      </span>
                      <div>
                        <Link to={`/admin/bikes/${m.id}`} className="font-bold text-ink-900 hover:text-primary-600">
                          {m.brand_name} {m.name}
                        </Link>
                        <p className="text-xs text-ink-400">/{m.brand_slug}/{m.slug}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">{fuelShort(m.fuel_type)}</td>
                  <td className="px-4 py-3 font-semibold">{inr(m.price_start)}</td>
                  <td className="px-4 py-3">
                    <select
                      value={m.status}
                      onChange={(e) => setStatus(m, e.target.value as ModelStatus)}
                      disabled={busyId === m.id}
                      className="rounded-lg border border-ink-200 bg-white px-2 py-1 text-xs font-bold"
                    >
                      <option value="live">Live</option>
                      <option value="upcoming">Upcoming</option>
                      <option value="outdated">Outdated</option>
                      <option value="discontinued">Discontinued</option>
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => togglePublish(m)}
                      disabled={busyId === m.id}
                      className={`rounded-full px-3 py-1 text-xs font-bold transition ${m.is_published ? 'bg-emerald-100 text-emerald-700' : 'bg-ink-100 text-ink-500'}`}
                    >
                      {m.is_published ? '● Published' : '○ Hidden'}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-xs text-ink-500">{m.launch_date ? formatDate(m.launch_date) : '—'}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1.5">
                      <Button size="sm" onClick={() => (window.location.href = `/admin/bikes/${m.id}`)}>Edit</Button>
                      <Button size="sm" variant="outline" loading={busyId === m.id} onClick={() => doDuplicate(m)}>Duplicate</Button>
                      <Button size="sm" variant="ghost" className="!text-red-600" onClick={() => setDelConfirm(m)}>Delete</Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="card p-10 text-center text-sm text-ink-500">
          No models found. <Link to="/admin/bikes/new" className="font-bold text-primary-600 hover:underline">Add your first model →</Link>
        </div>
      )}

      {/* Delete confirm */}
      <Modal open={!!delConfirm} onClose={() => setDelConfirm(null)} title="Delete bike model?">
        {delConfirm && (
          <div>
            <p className="text-sm text-ink-600">
              This permanently deletes <strong>{delConfirm.brand_name} {delConfirm.name}</strong> with all its variants, images, specs, offers and reviews. This cannot be undone.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDelConfirm(null)}>Cancel</Button>
              <Button variant="danger" loading={busyId === delConfirm.id} onClick={doDelete}>Delete permanently</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

// ─── New model quick form ───────────────────────────────────────────────────

export function AdminBikeNew() {
  const { toast } = useApp();
  const [brands, setBrands] = useState<any[]>([]);
  const [brandId, setBrandId] = useState('');
  const [name, setName] = useState('');
  const [fuel, setFuel] = useState('petrol');
  const [body, setBody] = useState('');
  const [priceStart, setPriceStart] = useState('');
  const [priceEnd, setPriceEnd] = useState('');
  const [cc, setCc] = useState('');
  const [power, setPower] = useState('');
  const [torque, setTorque] = useState('');
  const [mileage, setMileage] = useState('');
  const [range, setRange] = useState('');
  const [battery, setBattery] = useState('');
  const [charging, setCharging] = useState('');
  const [topSpeed, setTopSpeed] = useState('');
  const [abs, setAbs] = useState('');
  const [status, setStatus] = useState<ModelStatus>('live');
  const [launchDate, setLaunchDate] = useState('');
  const [overview, setOverview] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getBrands().then(setBrands).catch(() => null);
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!brandId) return setError('Select a brand.');
    if (!name.trim()) return setError('Enter the model name.');
    setBusy(true);
    try {
      const id = await saveModel({
        brand_id: brandId,
        name: name.trim(),
        slug: slugify(name),
        fuel_type: fuel as any,
        body_type: body || null,
        price_start: priceStart ? Number(priceStart) : null,
        price_end: priceEnd ? Number(priceEnd) : null,
        engine_cc: cc ? Number(cc) : null,
        power_ps: power ? Number(power) : null,
        torque_nm: torque ? Number(torque) : null,
        mileage_kmpl: fuel === 'electric' ? null : mileage ? Number(mileage) : null,
        range_km: fuel === 'electric' ? range ? Number(range) : null : null,
        battery_kwh: fuel === 'electric' ? battery ? Number(battery) : null : null,
        charging_time: fuel === 'electric' ? charging || null : null,
        top_speed_kmph: topSpeed ? Number(topSpeed) : null,
        abs_enabled: abs === 'Y' ? true : abs === 'N' ? false : null,
        status,
        launch_date: launchDate || null,
        overview: overview.trim() || null,
        is_published: status === 'live',
      });
      toast('Model created! Now add variants, images, colours and specs.', 'success');
      window.location.href = `/admin/bikes/${id}`;
    } catch (err: any) {
      setError(err.message || 'Could not create the model.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-black text-ink-900">Add New Bike Model</h1>
      <p className="mb-6 mt-1 text-sm text-ink-500">Start with the basics — you can add everything else on the next screen.</p>
      <form onSubmit={submit} className="space-y-5">
        <div className="card grid gap-4 p-5 sm:grid-cols-2">
          <Field label="Brand" required>
            <Select value={brandId} onChange={(e) => setBrandId(e.target.value)}>
              <option value="">Select brand…</option>
              {brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </Select>
          </Field>
          <Field label="Model name" required>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Splendor Plus" />
          </Field>
          <Field label="Fuel type" required>
            <Select value={fuel} onChange={(e) => setFuel(e.target.value)}>
              <option value="petrol">Petrol</option>
              <option value="electric">Electric</option>
              <option value="cng_petrol">CNG + Petrol</option>
              <option value="diesel">Diesel</option>
            </Select>
          </Field>
          <Field label="Body type">
            <Select value={body} onChange={(e) => setBody(e.target.value)}>
              <option value="">—</option>
              <option>Commuter</option>
              <option>Standard</option>
              <option>Sport</option>
              <option>Cruiser</option>
              <option>Adventure</option>
            </Select>
          </Field>
          <Field label="Price from (₹ ex-showroom)" hint="Only enter real, verified prices. Leave empty if unknown.">
            <Input type="number" value={priceStart} onChange={(e) => setPriceStart(e.target.value)} placeholder="e.g. 92000" />
          </Field>
          <Field label="Price to (₹)">
            <Input type="number" value={priceEnd} onChange={(e) => setPriceEnd(e.target.value)} />
          </Field>
          {fuel !== 'electric' && (
            <>
              <Field label="Engine (cc)">
                <Input type="number" value={cc} onChange={(e) => setCc(e.target.value)} />
              </Field>
              <Field label="Mileage (kmpl)">
                <Input type="number" value={mileage} onChange={(e) => setMileage(e.target.value)} />
              </Field>
            </>
          )}
          {fuel === 'electric' && (
            <>
              <Field label="Range (km)">
                <Input type="number" value={range} onChange={(e) => setRange(e.target.value)} />
              </Field>
              <Field label="Battery (kWh)">
                <Input type="number" step="0.01" value={battery} onChange={(e) => setBattery(e.target.value)} />
              </Field>
              <Field label="Charging time">
                <Input value={charging} onChange={(e) => setCharging(e.target.value)} placeholder="e.g. 4 hours (0-80%)" />
              </Field>
            </>
          )}
          <Field label="Power (PS)">
            <Input type="number" value={power} onChange={(e) => setPower(e.target.value)} />
          </Field>
          <Field label="Torque (Nm)">
            <Input type="number" value={torque} onChange={(e) => setTorque(e.target.value)} />
          </Field>
          <Field label="Top speed (kmph)">
            <Input type="number" value={topSpeed} onChange={(e) => setTopSpeed(e.target.value)} />
          </Field>
          <Field label="ABS">
            <Select value={abs} onChange={(e) => setAbs(e.target.value)}>
              <option value="">Unknown</option>
              <option value="Y">Yes</option>
              <option value="N">No</option>
            </Select>
          </Field>
          <Field label="Status" required>
            <Select value={status} onChange={(e) => setStatus(e.target.value as ModelStatus)}>
              <option value="live">Live (published)</option>
              <option value="upcoming">Upcoming</option>
              <option value="outdated">Outdated</option>
              <option value="discontinued">Discontinued</option>
            </Select>
          </Field>
          <Field label="Launch date">
            <Input type="date" value={launchDate} onChange={(e) => setLaunchDate(e.target.value)} />
          </Field>
        </div>
        <div className="card p-5">
          <Field label="Overview">
            <textarea value={overview} onChange={(e) => setOverview(e.target.value)} className="input-base min-h-[100px]" placeholder="Short public description of the model…" />
          </Field>
        </div>
        {error && <p className="rounded-lg bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</p>}
        <div className="flex gap-2">
          <Button type="submit" loading={busy} size="lg">Create model & continue →</Button>
          <Button type="button" variant="outline" size="lg" onClick={() => (window.location.href = '/admin/bikes')}>Cancel</Button>
        </div>
      </form>
    </div>
  );
}
