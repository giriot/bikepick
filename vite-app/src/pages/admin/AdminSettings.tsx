import React, { useCallback, useEffect, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { getSetting, saveSetting, saveModel } from '../../lib/api';
import { getModelsAdmin, type AdminModelRow } from '../../lib/api-admin';
import { uploadBytes, storagePath, fileExt, validateImageFile } from '../../lib/upload';
import { parseCSV, toCSV, downloadFile, readCsvFile, BIKES_CSV_TEMPLATE } from '../../lib/csv';
import { Button, Card, ErrorBlock, Field, Input, LoadingBlock, Tabs, Textarea } from '../../components/ui';

/**
 * /admin/settings —
 *  · Branding: site name, tagline, hero text, logo image (stored in site-assets)
 *  · Data: CSV export of the whole bike catalogue + CSV import (bulk add/update)
 */
export default function AdminSettings() {
  const [tab, setTab] = useState<'branding' | 'data'>('branding');
  return (
    <div>
      <h1 className="mb-5 text-2xl font-black text-ink-900">Settings</h1>
      <Tabs
        tabs={[
          { id: 'branding', label: 'Branding & Text' },
          { id: 'data', label: 'CSV Import / Export' },
        ]}
        active={tab}
        onChange={(t) => setTab(t as any)}
        className="mb-5 max-w-xl"
      />
      {tab === 'branding' && <Branding />}
      {tab === 'data' && <DataTools />}
    </div>
  );
}

/* ─── Branding ──────────────────────────────────────────────────────────── */

function Branding() {
  const { toast, settings, refreshSettings } = useApp();
  const [form, setForm] = useState({
    brand_name: '',
    tagline: '',
  });
  const [logoPath, setLogoPath] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!loaded) {
      setForm({
        brand_name: (settings['brand_name'] as string) ?? 'CompareBike',
        tagline: (settings['tagline'] as string) ?? 'Find, compare and choose India\u2019s perfect bike.',
      });
      setLogoPath((settings['active_logo_path'] as string) || null);
      setLoaded(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings, loaded]);

  const onLogo = async (f: File) => {
    const problem = validateImageFile(f);
    if (problem) return toast(problem, 'error');
    try {
      const up = await uploadBytes('site-assets', storagePath('logo', fileExt(f)), f);
      const path = up.path;
      setLogoPath(path);
      await saveSetting('active_logo_path', path);
      await refreshSettings();
      toast('Logo uploaded and saved.', 'success');
    } catch (e: any) {
      toast(e.message, 'error');
    }
  };

  const save = async () => {
    setBusy(true);
    try {
      await saveSetting('brand_name', form.brand_name || null);
      await saveSetting('tagline', form.tagline || null);
      await refreshSettings();
      toast('Branding saved — header, footer and dashboards now use it.', 'success');
    } catch (e: any) {
      toast(e.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="max-w-2xl p-5">
      <div className="space-y-4">
        <Field label="Brand name" hint="Shown in the header, dashboards and document titles.">
          <Input value={form.brand_name} onChange={(e) => setForm({ ...form, brand_name: e.target.value })} />
        </Field>
        <Field label="Tagline" hint="Shown in the footer and login screens.">
          <Input value={form.tagline} onChange={(e) => setForm({ ...form, tagline: e.target.value })} />
        </Field>
        <Field label="Logo" hint="Square-ish image. Stored in site-assets and used in header + favicon.">
          <div className="flex items-center gap-3">
            {logoPath && <LogoPreview path={logoPath} />}
            <label className="cursor-pointer rounded-lg border border-ink-300 px-3 py-2 text-xs font-bold text-ink-700 hover:bg-ink-50">
              Upload logo
              <input type="file" accept="image/*" hidden onChange={(e) => e.target.files?.[0] && onLogo(e.target.files[0])} />
            </label>
            <span className="text-xs text-ink-400">{logoPath ? logoPath : 'default mark used'}</span>
          </div>
        </Field>
        <Button loading={busy} onClick={save}>Save branding</Button>
      </div>
    </Card>
  );
}

function LogoPreview({ path }: { path: string }) {
  const [url, setUrl] = useState('');
  useEffect(() => {
    (async () => {
      try {
        const sb = (await import('../../lib/supabase')).requireSupabase();
        setUrl(sb.storage.from('site-assets').getPublicUrl(path).data.publicUrl);
      } catch {
        /* leave blank */
      }
    })();
  }, [path]);
  if (!url) return <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-ink-100 text-xs text-ink-400">…</span>;
  return <img src={url} alt="Logo preview" className="h-10 w-10 rounded-lg bg-ink-50 object-contain p-1" />;
}

/* ─── CSV data tools ────────────────────────────────────────────────────── */

function DataTools() {
  const { toast } = useApp();
  const [rows, setRows] = useState<AdminModelRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState('');

  const COLS = BIKES_CSV_TEMPLATE.split('\n')[0].split(',');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setRows(await getModelsAdmin({}));
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const downloadTemplate = () => {
    downloadFile('comparebike-models-template.csv', BIKES_CSV_TEMPLATE);
  };

  const exportAll = () => {
    const data = rows.map((m) => [
      m.brand_name || '', m.brand_slug || '', m.name, m.fuel_type, m.body_type || '',
      m.price_start, m.price_end, m.status, m.launch_date || '',
      m.engine_cc, m.power_ps, m.torque_nm, m.top_speed_kmph, m.mileage_kmpl,
      m.battery_kwh, m.range_km, m.charging_time || '',
      m.abs_enabled ? 'Y' : 'N', m.overview || '',
    ]);
    downloadFile(`comparebike-models-${new Date().toISOString().slice(0, 10)}.csv`, toCSV(COLS, data));
  };

  const onImport = async (f: File) => {
    if (!confirm(`Import "${f.name}"?\n\n\u2022 Rows matching an existing brand + model name UPDATE that bike.\n\u2022 Unknown brands are created automatically.\n\u2022 New bikes are created UNPUBLISHED until you review them.`)) return;
    setImporting(true);
    setProgress('Reading file…');
    try {
      const sb = (await import('../../lib/supabase')).requireSupabase();
      const text = await readCsvFile(f);
      const grid = parseCSV(text).filter((r) => !r[0]?.trim().startsWith('#'));
      if (grid.length < 2) throw new Error('The CSV has no data rows.');
      const header = grid[0].map((h) => h.trim());
      const idx = (name: string) => header.indexOf(name);
      if (idx('brand_name') === -1 || idx('name') === -1) throw new Error('CSV must include at least brand_name and name columns (use the template).');

      const { rows: brands } = await (async () => {
        const { getBrands } = await import('../../lib/api');
        const list = await getBrands();
        return { rows: list };
      })();
      let created = 0, updated = 0, skipped = 0;
      for (let i = 1; i < grid.length; i++) {
        const r = grid[i];
        const val = (name: string) => {
          const j = idx(name);
          return j >= 0 ? (r[j] || '').trim() : '';
        };
        const num = (name: string) => {
          const v = val(name);
          return v === '' ? null : Number(v);
        };
        const brandName = val('brand_name');
        const modelName = val('name');
        if (!brandName || !modelName) {
          skipped++;
          continue;
        }
        setProgress(`Row ${i} / ${grid.length - 1}: ${brandName} ${modelName}`);

        // resolve (or auto-create) the brand
        let brand = brands.find((b) => b.name.toLowerCase() === brandName.toLowerCase());
        if (!brand) {
          const slug = modelName ? brandName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') : '';
          const { data: nb, error: be } = await sb.from('brands').insert({ name: brandName, slug, is_active: true }).select().maybeSingle();
          if (be) throw new Error(`Could not create brand "${brandName}": ${be.message}`);
          if (!nb) throw new Error(`Could not create brand "${brandName}".`);
          brand = nb;
          brands.push(nb);
        }
        const brandRow = brand as any;

        const existing = await getModelsAdmin({ search: modelName });
        const found = existing.find((m) => m.brand_id === brandRow.id && m.name.toLowerCase() === modelName.toLowerCase());
        const patch: any = {
          fuel_type: val('fuel_type') || 'petrol',
          body_type: val('body_type') || null,
          price_start: num('price_start'),
          price_end: num('price_end'),
          status: val('status') || 'live',
          launch_date: val('launch_date') || null,
          engine_cc: num('engine_cc'),
          power_ps: num('power_ps'),
          torque_nm: num('torque_nm'),
          top_speed_kmph: num('top_speed_kmph'),
          mileage_kmpl: num('mileage_kmpl'),
          battery_kwh: num('battery_kwh'),
          range_km: num('range_km'),
          charging_time: val('charging_time') || null,
          abs_enabled: val('abs_enabled').toUpperCase() === 'Y' || val('abs_enabled').toUpperCase() === 'TRUE',
          overview: val('overview') || null,
        };
        if (found) {
          await saveModel({ id: found.id, ...patch });
          updated++;
        } else {
          const modelSlug = modelName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
          await saveModel({ brand_id: brandRow.id, name: modelName, slug: modelSlug, is_published: false, ...patch });
          created++;
        }
      }
      toast(`Import complete: ${created} created, ${updated} updated, ${skipped} skipped. New bikes stay unpublished until you review them.`, 'success');
      load();
    } catch (e: any) {
      toast(e.message, 'error');
    } finally {
      setImporting(false);
      setProgress('');
    }
  };

  if (loading) return <LoadingBlock />;
  if (error) return <ErrorBlock message={error} onRetry={load} />;

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card className="p-5">
        <h2 className="mb-2 font-black text-ink-900">Export</h2>
        <p className="mb-4 text-sm text-ink-500">Download every bike model (all importer columns) as CSV — a full catalogue backup you can re-import anywhere.</p>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={exportAll}>⬇ Export all ({rows.length})</Button>
          <Button variant="ghost" onClick={downloadTemplate}>Download empty template</Button>
        </div>
      </Card>
      <Card className="p-5">
        <h2 className="mb-2 font-black text-ink-900">Import</h2>
        <p className="mb-4 text-sm text-ink-500">
          Upload a CSV with the same columns as the template. Existing <strong>brand + model</strong> rows are updated; new rows are created
          <strong> unpublished</strong>. Unknown brands are added automatically. Nothing goes live until you publish it.
        </p>
        <label className="block cursor-pointer rounded-xl border-2 border-dashed border-ink-300 p-6 text-center text-sm font-bold text-ink-500 hover:border-primary-500 hover:text-primary-600">
          {progress || (importing ? 'Importing…' : 'Choose a .csv file to import')}
          <input
            type="file"
            accept=".csv,text/csv"
            hidden
            disabled={importing}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onImport(f);
              e.currentTarget.value = '';
            }}
          />
        </label>
      </Card>
    </div>
  );
}

