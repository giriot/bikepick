'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export function AuthForm({ mode, next }: { mode: 'login' | 'register'; next?: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true); setError(null); setFields({});
    const fd = new FormData(e.currentTarget);
    const payload = Object.fromEntries(fd.entries());
    try {
      const res = await fetch(`/api/auth/${mode}`, {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!json.ok) { setError(json.error || 'Something went wrong'); setFields(json.fields || {}); return; }
      router.push(next || json.data?.redirect || '/account');
      router.refresh();
    } catch {
      setError('Network error. Please check your connection and try again.');
    } finally {
      setBusy(false);
    }
  }

  const label = 'block text-[12px] font-semibold text-ink-mute';

  return (
    <form onSubmit={submit} className="space-y-3.5" noValidate>
      {error && <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-[13px] text-rose-800">{error}</div>}

      {mode === 'register' && (
        <div>
          <label className={label} htmlFor="full_name">Full name</label>
          <input id="full_name" name="full_name" required autoComplete="name" className="field mt-1" placeholder="Your name" />
          {fields.full_name && <p className="mt-1 text-[11.5px] text-rose-600">{fields.full_name}</p>}
        </div>
      )}

      <div>
        <label className={label} htmlFor="email">Email</label>
        <input id="email" name="email" type="email" required autoComplete="email" className="field mt-1" placeholder="you@example.com" />
        {fields.email && <p className="mt-1 text-[11.5px] text-rose-600">{fields.email}</p>}
      </div>

      {mode === 'register' && (
        <div className="grid gap-3.5 sm:grid-cols-2">
          <div>
            <label className={label} htmlFor="phone">Phone (optional)</label>
            <input id="phone" name="phone" inputMode="numeric" autoComplete="tel" className="field mt-1" placeholder="10-digit mobile" />
            {fields.phone && <p className="mt-1 text-[11.5px] text-rose-600">{fields.phone}</p>}
          </div>
          <div>
            <label className={label} htmlFor="city">City (optional)</label>
            <input id="city" name="city" autoComplete="address-level2" className="field mt-1" placeholder="Coimbatore" />
          </div>
        </div>
      )}

      <div>
        <label className={label} htmlFor="password">Password</label>
        <input id="password" name="password" type="password" required minLength={mode === 'register' ? 8 : 1}
          autoComplete={mode === 'register' ? 'new-password' : 'current-password'} className="field mt-1"
          placeholder={mode === 'register' ? 'At least 8 characters' : 'Your password'} />
        {fields.password && <p className="mt-1 text-[11.5px] text-rose-600">{fields.password}</p>}
      </div>

      <button className="btn-primary w-full" disabled={busy}>
        {busy ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account'}
      </button>

      <p className="text-center text-[12.5px] text-ink-mute">
        {mode === 'login' ? (
          <>New to Bikepick? <Link className="font-semibold text-brand-700 hover:underline" href={`/register${next ? `?next=${encodeURIComponent(next)}` : ''}`}>Create an account</Link></>
        ) : (
          <>Already registered? <Link className="font-semibold text-brand-700 hover:underline" href={`/login${next ? `?next=${encodeURIComponent(next)}` : ''}`}>Sign in</Link></>
        )}
      </p>
    </form>
  );
}
