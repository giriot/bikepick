'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

async function responseJson(response: Response): Promise<any> {
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    return { ok: false, error: `Request failed (${response.status || 'no response'})` };
  }
}

export function DealerEmailVerification({ dealerId, email }: { dealerId: string; email: string }) {
  const router = useRouter();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [resendBusy, setResendBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>('We sent a 6-digit verification code to your business email.');

  async function verify(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (code.length !== 6) return;
    setBusy(true); setError(null); setNotice(null);
    try {
      const res = await fetch('/api/dealer/verify-email', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'same-origin',
        cache: 'no-store',
        body: JSON.stringify({ dealer_id: dealerId, email, code }),
      });
      const json = await responseJson(res);
      if (!res.ok || !json.ok) { setError(json.error || 'Could not confirm the dealer email'); return; }
      router.push('/dealer');
      router.refresh();
    } catch {
      setError('Could not reach the verification service. Check your connection and try again.');
    } finally {
      setBusy(false);
    }
  }

  async function resend() {
    setResendBusy(true); setError(null); setNotice(null);
    try {
      const res = await fetch('/api/dealer/resend-email-otp', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'same-origin',
        cache: 'no-store',
        body: JSON.stringify({ dealer_id: dealerId }),
      });
      const json = await responseJson(res);
      if (!res.ok || !json.ok) { setError(json.error || 'Could not resend the code'); return; }
      setCode('');
      setNotice(json.message || 'A new verification code was sent.');
    } catch {
      setError('Could not reach the email service. Check your connection and try again.');
    } finally {
      setResendBusy(false);
    }
  }

  return (
    <div className="card mx-auto w-full max-w-xl p-6">
      {error && <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-[13px] text-rose-800" role="alert">{error}</div>}
      {notice && <div className="mt-0 rounded-xl border border-brand-200 bg-brand-50 px-3 py-2 text-[13px] text-brand-900">{notice}</div>}
      <h1 className="mt-5 text-xl font-bold">Confirm your dealer email</h1>
      <p className="mt-1 text-[13px] leading-5 text-ink-mute">
        Enter the 6-digit code sent to <strong className="text-ink">{email}</strong>. The code is valid for 10 minutes.
      </p>
      <form onSubmit={verify} className="mt-5 space-y-3" noValidate>
        <label className="block text-[12px] font-semibold text-ink-mute" htmlFor="dealer-email-code">Email verification code</label>
        <input id="dealer-email-code" value={code}
          onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
          inputMode="numeric" autoComplete="one-time-code" maxLength={6} required
          className="field text-center text-lg tracking-[0.35em]" placeholder="000000" />
        <button className="btn-primary w-full" disabled={busy || code.length !== 6}>
          {busy ? 'Checking…' : 'Verify email and continue'}
        </button>
      </form>
      <div className="mt-4 flex justify-center gap-4 text-[12.5px]">
        <button type="button" onClick={resend} disabled={resendBusy} className="font-semibold text-brand-700 hover:underline">
          {resendBusy ? 'Sending…' : 'Resend code'}
        </button>
        <span className="text-ink-mute">·</span>
        <span className="text-ink-mute">Check spam or junk mail</span>
      </div>
    </div>
  );
}
