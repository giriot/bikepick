'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function ProfileForm({ initial }: { initial: any }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true); setMsg(null); setErr(null);
    const fd = new FormData(e.currentTarget);
    const res = await fetch('/api/account/profile', {
      method: 'PATCH', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        full_name: fd.get('full_name'), phone: fd.get('phone'), city: fd.get('city'),
        notify_email: fd.get('notify_email') === 'on', notify_sms: fd.get('notify_sms') === 'on',
        password: fd.get('password') || undefined,
      }),
    });
    const json = await res.json();
    if (json.ok) { setMsg('Saved.'); router.refresh(); } else setErr(json.error || 'Could not save');
    setBusy(false);
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      {msg && <p className="rounded-xl bg-emerald-50 px-3 py-2 text-[13px] text-emerald-800">{msg}</p>}
      {err && <p className="rounded-xl bg-rose-50 px-3 py-2 text-[13px] text-rose-800">{err}</p>}
      <div className="grid gap-3.5 sm:grid-cols-2">
        <div><label className="label" htmlFor="full_name">Full name</label>
          <input id="full_name" name="full_name" defaultValue={initial?.full_name || ''} required className="field" /></div>
        <div><label className="label" htmlFor="email">Email</label>
          <input id="email" defaultValue={initial?.email || ''} disabled className="field bg-surface text-ink-mute" />
          <p className="hint">Contact support to change your email.</p></div>
        <div><label className="label" htmlFor="phone">Phone</label>
          <input id="phone" name="phone" defaultValue={initial?.phone || ''} inputMode="numeric" className="field" /></div>
        <div><label className="label" htmlFor="city">City</label>
          <input id="city" name="city" defaultValue={initial?.city || ''} className="field" /></div>
      </div>

      <fieldset className="rounded-xl border border-line p-4">
        <legend className="px-1 text-[12px] font-semibold text-ink-mute">Notifications</legend>
        <label className="flex items-center gap-2 text-[13.5px]">
          <input type="checkbox" name="notify_email" defaultChecked={!!initial?.notify_email} className="h-4 w-4 rounded border-line" /> Email me about price drops and listing updates
        </label>
        <label className="mt-2 flex items-center gap-2 text-[13.5px]">
          <input type="checkbox" name="notify_sms" defaultChecked={!!initial?.notify_sms} className="h-4 w-4 rounded border-line" /> Send me SMS/WhatsApp updates
        </label>
        <p className="hint">Channels only send when the site owner has configured a provider.</p>
      </fieldset>

      <div>
        <label className="label" htmlFor="password">New password (optional)</label>
        <input id="password" name="password" type="password" minLength={8} autoComplete="new-password" className="field" placeholder="Leave blank to keep current password" />
      </div>

      <button className="btn-primary btn-sm" disabled={busy}>{busy ? 'Saving…' : 'Save changes'}</button>
    </form>
  );
}
