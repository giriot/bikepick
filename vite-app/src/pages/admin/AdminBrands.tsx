import React, { useCallback, useEffect, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { getBrands } from '../../lib/api';
import { uploadBytes, storagePath, fileExt, validateImageFile } from '../../lib/upload';
import { slugify } from '../../lib/format';
import { publicImageUrl } from '../../lib/api';
import type { Brand } from '../../lib/types';
import { Button, Card, Field, Input, LoadingBlock, ErrorBlock, Textarea } from '../../components/ui';

export default function AdminBrands() {
  const { toast } = useApp();
  const [rows, setRows] = useState<Brand[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [tagline, setTagline] = useState('');
  const [desc, setDesc] = useState('');
  const [logo, setLogo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const sb = (await import('../../lib/supabase')).requireSupabase();
      const { data, error: e } = await sb.from('brands').select('*').order('name');
      if (e) throw new Error(e.message);
      setRows((data || []) as Brand[]);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const add = async () => {
    if (!name.trim()) return;
    setBusy(true);
    try {
      const sb = (await import('../../lib/supabase')).requireSupabase();
      let logoPath: string | null = null;
      if (logo) {
        const url = new URL(logo);
        const path = logo.split('/').pop() || 'logo';
        logoPath = path; // uploaded to brand-images/{path}
      }
      const { error: e } = await sb
        .from('brands')
        .upsert(
          { name: name.trim(), slug: slugify(name), tagline: tagline.trim() || null, description: desc.trim() || null, logo_path: logoPath, is_active: true },
          { onConflict: 'slug' },
        );
      if (e) throw new Error(e.message);
      toast(`Brand "${name.trim()}" saved.`, 'success');
      setName(''); setTagline(''); setDesc(''); setLogo(null);
      load();
    } catch (e: any) {
      toast(e.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const toggle = async (b: Brand) => {
    try {
      const sb = (await import('../../lib/supabase')).requireSupabase();
      await sb.from('brands').update({ is_active: !b.is_active }).eq('id', b.id);
      toast(`${b.name} ${b.is_active ? 'deactivated' : 'activated'}.`, 'success');
      load();
    } catch (e: any) {
      toast(e.message, 'error');
    }
  };

  const remove = async (b: Brand) => {
    if (!confirm(`Delete brand "${b.name}"? Models under it are NOT deleted but will lose their brand link.`)) return;
    try {
      const sb = (await import('../../lib/supabase')).requireSupabase();
      const { error: e } = await sb.from('brands').delete().eq('id', b.id);
      if (e) throw new Error(e.message);
      toast('Brand deleted.', 'success');
      load();
    } catch (e: any) {
      toast(e.message, 'error');
    }
  };

  const onLogo = async (f: File) => {
    const problem = validateImageFile(f);
    if (problem) return toast(problem, 'error');
    try {
      const up = await uploadBytes('brand-images', storagePath('logos', fileExt(f)), f);
      setLogo(up.url);
      toast('Logo uploaded.', 'success');
    } catch (e: any) {
      toast(e.message, 'error');
    }
  };

  if (loading) return <LoadingBlock />;
  if (error) return <ErrorBlock message={error} onRetry={load} />;

  return (
    <div>
      <h1 className="mb-5 text-2xl font-black text-ink-900">Brands</h1>
      <Card className="mb-6 p-5">
        <h2 className="mb-3 font-black text-ink-900">Add / update brand</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <Input placeholder="Brand name (e.g. Royal Enfield)" value={name} onChange={(e) => setName(e.target.value)} />
          <Input placeholder="Tagline (optional)" value={tagline} onChange={(e) => setTagline(e.target.value)} />
          <div className="flex items-center gap-2">
            <label className="cursor-pointer rounded-lg border border-ink-300 px-3 py-2 text-xs font-bold text-ink-700 hover:bg-ink-50">
              Upload logo
              <input type="file" accept="image/*" hidden onChange={(e) => e.target.files?.[0] && onLogo(e.target.files[0])} />
            </label>
            {logo && <img src={logo} alt="logo preview" className="h-9 w-14 rounded object-contain" />}
          </div>
        </div>
        <div className="mt-3 flex items-end justify-between gap-3">
          <div className="flex-1">
            <Textarea placeholder="Brand description (optional)" value={desc} onChange={(e) => setDesc(e.target.value)} className="min-h-[60px]" />
          </div>
          <Button loading={busy} onClick={add}>Save brand</Button>
        </div>
      </Card>
      <div className="card divide-y divide-ink-100">
        {rows.map((b) => (
          <div key={b.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
            <div className="flex items-center gap-3">
              {b.logo_path && publicImageUrl('brand-images', b.logo_path) ? (
                <img src={publicImageUrl('brand-images', b.logo_path) || undefined} alt={b.name} className="h-9 w-14 rounded-lg object-contain" />
              ) : (
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-ink-900 text-sm font-black text-white">{b.name.charAt(0)}</span>
              )}
              <div>
                <p className="font-bold text-ink-900">{b.name}</p>
                <p className="text-xs text-ink-400">/{b.slug}{b.tagline ? ` · ${b.tagline}` : ''}</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant={b.is_active ? 'outline' : 'success'} onClick={() => toggle(b)}>
                {b.is_active ? 'Active' : 'Inactive'}
              </Button>
              <Button size="sm" variant="ghost" className="!text-red-600" onClick={() => remove(b)}>Delete</Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
