'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { AdminField } from '@/lib/admin-config';

export function ResourceForm({ resource, id, fields, initial, relations, canDelete }: {
  resource: string; id?: string; fields: AdminField[]; initial: any;
  relations: Record<string, { id: string; label: string }[]>;
  canDelete?: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const groups = [...new Set(fields.map((f) => f.group || 'Details'))];

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true); setError(null); setMsg(null); setFieldErrors({});
    const fd = new FormData(e.currentTarget);
    const payload: Record<string, any> = {};
    for (const f of fields) {
      if (f.type === 'readonly') continue;
      if (f.type === 'bool') payload[f.name] = fd.get(f.name) === 'on' ? 1 : 0;
      else {
        const v = fd.get(f.name);
        payload[f.name] = v === '' ? null : v;
      }
    }
    const res = await fetch(id ? `/api/admin/${resource}/${id}` : `/api/admin/${resource}`, {
      method: id ? 'PATCH' : 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const json = await res.json();
    setBusy(false);
    if (!json.ok) { setError(json.error || 'Could not save'); setFieldErrors(json.fields || {}); return; }
    if (!id) { router.push(`/admin/${resource}/${json.data.id}`); return; }
    setMsg('Saved.');
    router.refresh();
  }

  async function remove() {
    if (!confirm('Delete this record?')) return;
    setBusy(true);
    await fetch(`/api/admin/${resource}/${id}`, { method: 'DELETE' });
    router.push(`/admin/${resource}`);
  }

  function renderField(f: AdminField) {
    const value = initial?.[f.name];
    const common = { id: f.name, name: f.name, className: 'field', required: f.required, placeholder: f.placeholder };

    if (f.type === 'readonly') {
      return <p className="rounded-xl bg-surface px-3.5 py-2.5 text-[13px] text-ink-mute">{value ?? '—'}</p>;
    }
    if (f.type === 'bool') {
      return (
        <label className="flex items-center gap-2.5 rounded-xl border border-line px-3.5 py-2.5">
          <input type="checkbox" name={f.name} defaultChecked={value === 1 || value === true} className="h-4 w-4 rounded border-line" />
          <span className="text-[13px]">{f.label}</span>
        </label>
      );
    }
    if (f.type === 'select') {
      return (
        <select {...common} defaultValue={value ?? ''}>
          {!f.required && <option value="">— none —</option>}
          {f.options?.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      );
    }
    if (f.type === 'relation') {
      return (
        <select {...common} defaultValue={value ?? ''}>
          <option value="">— none —</option>
          {(relations[f.name] || []).map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
        </select>
      );
    }
    if (f.type === 'longtext') return <textarea {...common} rows={12} defaultValue={value ?? ''} className="field font-mono text-[12.5px] leading-6" />;
    if (f.type === 'textarea' || f.type === 'json') return <textarea {...common} rows={4} defaultValue={typeof value === 'object' ? JSON.stringify(value, null, 2) : value ?? ''} />;
    if (f.type === 'number' || f.type === 'money') return <input {...common} type="number" step={f.step ?? (f.type === 'money' ? 1 : 'any')} defaultValue={value ?? ''} />;
    if (f.type === 'date') return <input {...common} type="date" defaultValue={value ? String(value).slice(0, 10) : ''} />;
    if (f.type === 'datetime') return <input {...common} type="datetime-local" defaultValue={value ? String(value).slice(0, 16) : ''} />;
    if (f.type === 'image') {
      return (
        <div className="space-y-2">
          <input {...common} type="text" defaultValue={value ?? ''} placeholder="/media/example.svg or https://…" />
          {value && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={value} alt="" className="h-24 w-auto rounded-lg border border-line object-contain" />
          )}
        </div>
      );
    }
    return <input {...common} type="text" defaultValue={value ?? ''} />;
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      {error && <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-[13px] text-rose-800">{error}</div>}
      {msg && <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-[13px] text-emerald-800">{msg}</div>}

      {groups.map((g) => (
        <section key={g} className="rounded-xl border border-line bg-white">
          <div className="border-b border-line px-5 py-3"><h2 className="text-[13px] font-semibold uppercase tracking-wide text-ink-mute">{g}</h2></div>
          <div className="grid gap-4 p-5 sm:grid-cols-2">
            {fields.filter((f) => (f.group || 'Details') === g).map((f) => (
              <div key={f.name} className={['longtext', 'textarea', 'json'].includes(f.type) ? 'sm:col-span-2' : ''}>
                {f.type !== 'bool' && <label className="label" htmlFor={f.name}>{f.label}{f.required && <span className="text-danger"> *</span>}</label>}
                {renderField(f)}
                {f.help && <p className="hint">{f.help}</p>}
                {fieldErrors[f.name] && <p className="err">{fieldErrors[f.name]}</p>}
              </div>
            ))}
          </div>
        </section>
      ))}

      <div className="flex flex-wrap items-center gap-2">
        <button className="btn-primary" disabled={busy}>{busy ? 'Saving…' : id ? 'Save changes' : 'Create'}</button>
        <button type="button" className="btn-ghost" onClick={() => router.push(`/admin/${resource}`)}>Cancel</button>
        {id && canDelete && (
          <button type="button" className="btn-ghost ml-auto text-rose-700 hover:bg-rose-50" onClick={remove}>Delete record</button>
        )}
      </div>
    </form>
  );
}
