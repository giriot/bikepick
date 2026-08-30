'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export interface SettingRow { key: string; value: string | null; value_type: string; group_name: string; label: string; help_text: string | null }

export function SettingsForm({ settings }: { settings: SettingRow[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const groups = [...new Set(settings.map((s) => s.group_name))];

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true); setMsg(null); setError(null);
    const fd = new FormData(e.currentTarget);
    const values: Record<string, string> = {};
    for (const s of settings) {
      values[s.key] = s.value_type === 'bool' ? (fd.get(s.key) === 'on' ? '1' : '0') : String(fd.get(s.key) ?? '');
    }
    const res = await fetch('/api/admin/settings', {
      method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ values }),
    });
    const json = await res.json();
    setBusy(false);
    if (!json.ok) { setError(json.error || 'Could not save'); return; }
    setMsg('Settings saved. Changes are live immediately.');
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      {error && <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-[13px] text-rose-800">{error}</div>}
      {msg && <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-[13px] text-emerald-800">{msg}</div>}

      {groups.map((g) => (
        <section key={g} id={g} className="rounded-xl border border-line bg-white">
          <div className="border-b border-line px-5 py-3">
            <h2 className="text-[13px] font-semibold uppercase tracking-wide text-ink-mute">{g}</h2>
          </div>
          <div className="grid gap-4 p-5 sm:grid-cols-2">
            {settings.filter((s) => s.group_name === g).map((s) => (
              <div key={s.key} className={s.value_type === 'json' || s.value_type === 'text' ? 'sm:col-span-2' : ''}>
                {s.value_type === 'bool' ? (
                  <label className="flex items-start gap-2.5 rounded-xl border border-line px-3.5 py-2.5">
                    <input type="checkbox" name={s.key} defaultChecked={s.value === '1'} className="mt-0.5 h-4 w-4 rounded border-line" />
                    <span>
                      <span className="block text-[13px] font-medium">{s.label}</span>
                      {s.help_text && <span className="block text-[11.5px] leading-4 text-ink-mute">{s.help_text}</span>}
                    </span>
                  </label>
                ) : (
                  <>
                    <label className="label" htmlFor={s.key}>{s.label}</label>
                    {s.value_type === 'json' ? (
                      <textarea id={s.key} name={s.key} rows={4} defaultValue={s.value ?? ''} className="field font-mono text-[12px]" />
                    ) : s.value_type === 'text' ? (
                      <textarea id={s.key} name={s.key} rows={3} defaultValue={s.value ?? ''} className="field" />
                    ) : (
                      <input id={s.key} name={s.key} type={s.value_type === 'number' ? 'number' : 'text'}
                        step="any" defaultValue={s.value ?? ''} className="field" />
                    )}
                    {s.help_text && <p className="hint">{s.help_text}</p>}
                    <p className="mt-0.5 text-[10.5px] font-mono text-ink-mute/70">{s.key}</p>
                  </>
                )}
              </div>
            ))}
          </div>
        </section>
      ))}

      <div className="sticky bottom-3 flex justify-end">
        <button className="btn-primary shadow-pop" disabled={busy}>{busy ? 'Saving…' : 'Save all settings'}</button>
      </div>
    </form>
  );
}
