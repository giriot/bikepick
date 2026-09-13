'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export function AuthForm({ mode, next }: { mode: 'login' | 'register'; next?: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [resendBusy, setResendBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [verificationEmail, setVerificationEmail] = useState<string | null>(null);
  const [verificationCode, setVerificationCode] = useState('');

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true); setError(null); setNotice(null); setFields({});
    const fd = new FormData(e.currentTarget);
    const payload = Object.fromEntries(fd.entries());
    try {
      const res = await fetch(`/api/auth/${mode}`, {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!json.ok) { setError(json.error || 'Something went wrong'); setFields(json.fields || {}); return; }
      if (mode === 'register' && json.data?.needs_email_verification) {
        setVerificationEmail(json.data.email || String(payload.email));
        setNotice(json.message || 'We sent a verification code to your email.');
        return;
      }
      router.push(next || json.data?.redirect || '/account');
      router.refresh();
    } catch {
      setError('Network error. Please check your connection and try again.');
    } finally {
      setBusy(false);
    }
  }

  async function verifyEmail(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!verificationEmail) return;
    setBusy(true); setError(null); setNotice(null);
    try {
      const res = await fetch('/api/auth/verify-email', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: verificationEmail, code: verificationCode }),
      });
      const json = await res.json();
      if (!json.ok) { setError(json.error || 'Could not confirm email'); return; }
      router.push(next || json.data?.redirect || '/account');
      router.refresh();
    } catch {
      setError('Network error. Please check your connection and try again.');
    } finally {
      setBusy(false);
    }
  }

  async function resendCode() {
    if (!verificationEmail) return;
    setResendBusy(true); setError(null); setNotice(null);
    try {
      const res = await fetch('/api/auth/resend-email-otp', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: verificationEmail }),
      });
      const json = await res.json();
      if (!json.ok) { setError(json.error || 'Could not resend the code'); return; }
      setNotice(json.message || 'A new verification code was sent.');
      setVerificationCode('');
    } catch {
      setError('Network error. Please check your connection and try again.');
    } finally {
      setResendBusy(false);
    }
  }

  const label = 'block text-[12px] font-semibold text-ink-mute';

  if (verificationEmail) {
    return (
      <div className="space-y-4">
        {error && <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-[13px] text-rose-800">{error}</div>}
        {notice && <div className="rounded-xl border border-brand-200 bg-brand-50 px-3 py-2 text-[13px] text-brand-900">{notice}</div>}
        <div>
          <h2 className="text-lg font-semibold">Confirm your email</h2>
          <p className="mt-1 text-[13px] leading-5 text-ink-mute">Enter the 6-digit code sent to <strong className="text-ink">{verificationEmail}</strong>. The code is valid for 10 minutes.</p>
        </div>
        <form onSubmit={verifyEmail} className="space-y-3" noValidate>
          <div>
            <label className={label} htmlFor="email-code">Email verification code</label>
            <input id="email-code" value={verificationCode} onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              inputMode="numeric" autoComplete="one-time-code" maxLength={6} className="field mt-1 text-center text-lg tracking-[0.35em]" placeholder="000000" required />
          </div>
          <button className="btn-primary w-full" disabled={busy || verificationCode.length !== 6}>
            {busy ? 'Checking…' : 'Confirm email and continue'}
          </button>
        </form>
        <div className="flex flex-wrap justify-center gap-3 text-[12.5px]">
          <button type="button" onClick={resendCode} disabled={resendBusy} className="font-semibold text-brand-700 hover:underline">
            {resendBusy ? 'Sending…' : 'Resend code'}
          </button>
          <button type="button" onClick={() => { setVerificationEmail(null); setVerificationCode(''); setNotice(null); setError(null); }} className="text-ink-mute hover:underline">
            Use another email
          </button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-3.5" noValidate>
      {error && <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-[13px] text-rose-800">{error}</div>}
      {notice && <div className="rounded-xl border border-brand-200 bg-brand-50 px-3 py-2 text-[13px] text-brand-900">{notice}</div>}

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
            <label className={label} htmlFor="phone">Phone <span className="text-danger">*</span></label>
            <input id="phone" name="phone" required inputMode="numeric" autoComplete="tel" className="field mt-1" placeholder="10-digit mobile" />
            {fields.phone && <p className="mt-1 text-[11.5px] text-rose-600">{fields.phone}</p>}
          </div>
          <div>
            <label className={label} htmlFor="city">City (optional)</label>
            <input id="city" name="city" autoComplete="off" spellCheck={false} className="field mt-1" placeholder="Coimbatore" />
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
