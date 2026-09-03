import React, { useCallback, useEffect, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { getArticles, getFaqs, getSeoPages, saveArticle, saveFaq, saveSeoPage, deleteRow, getSetting, saveSetting, queryModels } from '../../lib/api';
import type { Article, Faq, SeoPage } from '../../lib/types';
import { titleCase, formatDate } from '../../lib/format';
import { Button, Card, EmptyState, ErrorBlock, Field, Input, LoadingBlock, Modal, Select, Tabs, Textarea, VerifiedBadge } from '../../components/ui';

/**
 * /admin/content — site content:
 *  · Guides / articles (create, edit, publish, delete, featured)
 *  · FAQs
 *  · SEO pages (legal pages: titles, meta descriptions, body)
 *  · Homepage settings (hero text, featured-bike pickers, tagline, etc.)
 */
export default function AdminContent() {
  const [tab, setTab] = useState<'guides' | 'faqs' | 'seo' | 'home'>('guides');
  return (
    <div>
      <h1 className="mb-5 text-2xl font-black text-ink-900">Content Management</h1>
      <Tabs
        tabs={[
          { id: 'guides', label: 'Guides / Articles' },
          { id: 'faqs', label: 'FAQs' },
          { id: 'seo', label: 'SEO pages' },
          { id: 'home', label: 'Homepage' },
        ]}
        active={tab}
        onChange={(t) => setTab(t as any)}
        className="mb-5 max-w-2xl"
      />
      {tab === 'guides' && <Guides />}
      {tab === 'faqs' && <Faqs />}
      {tab === 'seo' && <Seo />}
      {tab === 'home' && <HomeSettings />}
    </div>
  );
}

/* ─── Guides / Articles ─────────────────────────────────────────────────── */

function Guides() {
  const { toast } = useApp();
  const [rows, setRows] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [edit, setEdit] = useState<Partial<Article> | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const sb = (await import('../../lib/supabase')).requireSupabase();
      const { data, error: e } = await sb.from('articles').select('*').order('is_published', { ascending: false }).order('created_at', { ascending: false });
      if (e) throw new Error(e.message);
      setRows((data || []) as Article[]);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const save = async () => {
    if (!edit?.title?.trim() || !edit?.slug?.trim() || !edit?.body?.trim()) {
      toast('Title, slug and body are required.', 'error');
      return;
    }
    setBusy(true);
    try {
      await saveArticle({ ...edit, is_featured: !!edit.is_featured } as Article);
      toast(edit.id ? 'Article updated.' : 'Article created.', 'success');
      setEdit(null);
      load();
    } catch (e: any) {
      toast(e.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const remove = async (a: Article) => {
    if (!confirm(`Delete article "${a.title}"?`)) return;
    try {
      await deleteRow('articles', a.id);
      toast('Deleted.', 'success');
      load();
    } catch (e: any) {
      toast(e.message, 'error');
    }
  };

  if (loading) return <LoadingBlock />;
  if (error) return <ErrorBlock message={error} onRetry={load} />;

  return (
    <>
      <Button className="mb-4" onClick={() => setEdit({ is_published: false, is_featured: false })}>+ New guide</Button>
      <div className="space-y-3">
        {rows.map((a) => (
          <Card key={a.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-bold text-ink-900">{a.title}</p>
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${a.is_published ? 'bg-emerald-100 text-emerald-700' : 'bg-ink-100 text-ink-500'}`}>{a.is_published ? 'published' : 'draft'}</span>
                {a.is_featured && <VerifiedBadge label="Featured" />}
                <span className="text-xs text-ink-400">/{a.slug}</span>
              </div>
              <p className="mt-1 text-xs text-ink-500">{a.category ? `${titleCase(a.category)} · ` : ''}{a.seo_description ? `${a.seo_description.slice(0, 80)}…` : 'no meta description'}</p>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => setEdit(a)}>Edit</Button>
              <Button size="sm" variant="ghost" className="!text-red-600" onClick={() => remove(a)}>Delete</Button>
            </div>
          </Card>
        ))}
        {!rows.length && <EmptyState title="No guides yet" desc="Create guides like 'Petrol vs Electric in 2026' — they power /guides." />}
      </div>

      <Modal open={!!edit} onClose={() => setEdit(null)} title={edit?.id ? 'Edit guide' : 'New guide'} wide>
        {edit && (
          <div className="space-y-3">
            <Field label="Title" required><Input value={edit.title || ''} onChange={(e) => setEdit({ ...edit, title: e.target.value })} /></Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Slug" required><Input value={edit.slug || ''} onChange={(e) => setEdit({ ...edit, slug: e.target.value })} placeholder="petrol-vs-electric-2026" /></Field>
              <Field label="Category"><Input value={edit.category || ''} onChange={(e) => setEdit({ ...edit, category: e.target.value as any })} placeholder="Buying Guide" /></Field>
            </div>
            <Field label="Meta description (SEO)"><Input value={edit.seo_description || ''} onChange={(e) => setEdit({ ...edit, seo_description: e.target.value })} /></Field>
            <Field label="Body (plain text / markdown-ish)" required>
              <Textarea className="min-h-[200px] font-mono text-xs" value={edit.body || ''} onChange={(e) => setEdit({ ...edit, body: e.target.value })} />
            </Field>
            <div className="flex flex-wrap items-center gap-5">
              <label className="flex items-center gap-2 text-sm font-bold text-ink-700">
                <input type="checkbox" checked={!!edit.is_published} onChange={(e) => setEdit({ ...edit, is_published: e.target.checked })} /> Published
              </label>
              <label className="flex items-center gap-2 text-sm font-bold text-ink-700">
                <input type="checkbox" checked={!!edit.is_featured} onChange={(e) => setEdit({ ...edit, is_featured: e.target.checked })} /> Featured on homepage
              </label>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setEdit(null)}>Cancel</Button>
              <Button loading={busy} onClick={save}>Save article</Button>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}

/* ─── FAQs ──────────────────────────────────────────────────────────────── */

function Faqs() {
  const { toast } = useApp();
  const [rows, setRows] = useState<Faq[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [edit, setEdit] = useState<Partial<Faq> | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await getFaqs());
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const save = async () => {
    if (!edit?.question?.trim() || !edit?.answer?.trim()) {
      toast('Question and answer are required.', 'error');
      return;
    }
    setBusy(true);
    try {
      await saveFaq(edit as Faq);
      toast(edit.id ? 'FAQ updated.' : 'FAQ added.', 'success');
      setEdit(null);
      load();
    } catch (e: any) {
      toast(e.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <LoadingBlock />;
  if (error) return <ErrorBlock message={error} onRetry={load} />;

  return (
    <>
      <Button className="mb-4" onClick={() => setEdit({ category: 'General', sort_order: 99 })}>+ New FAQ</Button>
      <div className="space-y-3">
        {rows.map((f) => (
          <Card key={f.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
            <div className="min-w-[220px] flex-1">
              <p className="font-bold text-ink-900">{f.question}</p>
              <p className="mt-1 text-sm text-ink-600">{f.answer.slice(0, 140)}{f.answer.length > 140 ? '…' : ''}</p>
              <p className="mt-1 text-xs text-ink-400">{titleCase(f.category)}</p>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => setEdit(f)}>Edit</Button>
              <Button size="sm" variant="ghost" className="!text-red-600" onClick={async () => { if (confirm('Delete FAQ?')) { await deleteRow('faqs', f.id).then(() => { toast('Deleted.', 'success'); load(); }).catch((e) => toast(e.message, 'error')); } }}>Delete</Button>
            </div>
          </Card>
        ))}
        {!rows.length && <EmptyState title="No FAQs yet" />}
      </div>

      <Modal open={!!edit} onClose={() => setEdit(null)} title={edit?.id ? 'Edit FAQ' : 'New FAQ'} wide>
        {edit && (
          <div className="space-y-3">
            <Field label="Question" required><Input value={edit.question || ''} onChange={(e) => setEdit({ ...edit, question: e.target.value })} /></Field>
            <Field label="Answer" required><Textarea className="min-h-[100px]" value={edit.answer || ''} onChange={(e) => setEdit({ ...edit, answer: e.target.value })} /></Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Category"><Input value={edit.category || ''} onChange={(e) => setEdit({ ...edit, category: e.target.value })} /></Field>
              <Field label="Sort order"><Input type="number" value={edit.sort_order ?? 99} onChange={(e) => setEdit({ ...edit, sort_order: Number(e.target.value) || 0 })} /></Field>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setEdit(null)}>Cancel</Button>
              <Button loading={busy} onClick={save}>Save FAQ</Button>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}

/* ─── SEO pages ─────────────────────────────────────────────────────────── */

function Seo() {
  const { toast } = useApp();
  const [rows, setRows] = useState<SeoPage[]>([]);
  const [loading, setLoading] = useState(true);
  const [edit, setEdit] = useState<Partial<SeoPage> | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await getSeoPages());
    } catch (e: any) {
      toast(e.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  const save = async () => {
    if (!edit?.slug?.trim() || !edit?.title?.trim()) {
      toast('Slug and title are required.', 'error');
      return;
    }
    setBusy(true);
    try {
      await saveSeoPage(edit as SeoPage);
      toast('SEO page saved.', 'success');
      setEdit(null);
      load();
    } catch (e: any) {
      toast(e.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <LoadingBlock />;

  return (
    <>
      <p className="mb-4 text-sm text-ink-500">Edit the body & SEO of static pages (privacy, terms, etc.). The slug is the URL path — change it only if you know what you're doing.</p>
      <div className="space-y-3">
        {rows.map((p) => (
          <Card key={p.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
            <div>
              <p className="font-bold text-ink-900">{p.title}</p>
              <p className="text-xs text-ink-400">/{p.slug} · {formatDate(p.updated_at)}</p>
            </div>
            <Button size="sm" variant="outline" onClick={() => setEdit(p)}>Edit</Button>
          </Card>
        ))}
        {!rows.length && <EmptyState title="No SEO pages yet" desc="Run the seed migration to create the default legal pages." />}
      </div>

      <Modal open={!!edit} onClose={() => setEdit(null)} title={edit?.id ? `Edit — ${edit.title}` : ''} wide>
        {edit && (
          <div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Slug" required><Input value={edit.slug || ''} onChange={(e) => setEdit({ ...edit, slug: e.target.value })} /></Field>
              <Field label="Title" required><Input value={edit.title || ''} onChange={(e) => setEdit({ ...edit, title: e.target.value })} /></Field>
            </div>
            <Field label="Meta description"><Input value={edit.meta_description || ''} onChange={(e) => setEdit({ ...edit, meta_description: e.target.value })} /></Field>
            <Field label="Body (plain text, paragraphs separated by blank lines)">
              <Textarea className="min-h-[240px] text-sm" value={edit.body || ''} onChange={(e) => setEdit({ ...edit, body: e.target.value })} />
            </Field>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setEdit(null)}>Cancel</Button>
              <Button loading={busy} onClick={save}>Save page</Button>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}

/* ─── Homepage settings ─────────────────────────────────────────────────── */

const HOME_FIELDS: { key: string; label: string; kind: 'ids' }[] = [
  { key: 'featured_used', label: 'Featured used bikes on homepage (comma-separated listing UUIDs)', kind: 'ids' },
  { key: 'featured_offers', label: 'Featured dealer offers on homepage (comma-separated offer UUIDs)', kind: 'ids' },
];

function HomeSettings() {
  const { toast, settings, refreshSettings } = useApp();
  const [form, setForm] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!loaded) {
      const init: Record<string, string> = {};
      for (const f of HOME_FIELDS) {
        const v = settings[f.key];
        init[f.key] = Array.isArray(v) ? (v as string[]).join(', ') : (typeof v === 'string' ? v : '');
      }
      setForm(init);
      setLoaded(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings, loaded]);

  const save = async () => {
    setBusy(true);
    try {
      for (const f of HOME_FIELDS) {
        const raw = (form[f.key] || '').trim();
        const arr = raw ? raw.split(',').map((x) => x.trim()).filter(Boolean) : [];
        await saveSetting(f.key, arr.length ? arr : null);
      }
      await refreshSettings();
      toast('Homepage settings saved — the site header, hero and featured picks now use them.', 'success');
    } catch (e: any) {
      toast(e.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="max-w-2xl p-5">
      <div className="space-y-4">
        {HOME_FIELDS.map((f) => (
          <Field key={f.key} label={f.label}>
            <Input value={form[f.key] ?? ''} onChange={(e) => setForm({ ...form, [f.key]: e.target.value })} placeholder="e.g. 123e4567-…, 9f8e7d65-…" className="font-mono text-xs" />
          </Field>
        ))}
        <p className="text-xs text-ink-400">
          Leave a field empty to let the homepage auto-pick from recently approved items. UUIDs are visible in the admin listings (hover a row's copy link) or in the database.
        </p>
        <Button loading={busy} onClick={save}>Save homepage settings</Button>
      </div>
    </Card>
  );
}
