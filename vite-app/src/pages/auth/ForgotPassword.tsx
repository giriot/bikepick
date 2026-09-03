import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { Button, Field, Input } from '../../components/ui';
import { AuthShell } from './Login';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!/^\S+@\S+\.\S+$/.test(email)) return setError('Enter a valid email address.');
    setBusy(true);
    try {
      const { error: err } = await supabase!.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (err) throw err;
      setSent(true);
    } catch (err: any) {
      setError(err.message || 'Could not send the reset email.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell title="Forgot password?" subtitle="We'll email you a secure link to set a new password.">
      {sent ? (
        <div className="py-4 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
            <svg className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
          </div>
          <h3 className="text-lg font-bold text-ink-900">Reset email sent</h3>
          <p className="mt-1 text-sm text-ink-500">If an account exists for <strong>{email}</strong>, a reset link is on its way. Check your spam folder too.</p>
          <Link to="/login" className="mt-5 inline-block rounded-lg bg-ink-900 px-5 py-2.5 text-sm font-bold text-white hover:bg-ink-700">Back to Login</Link>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <Field label="Email" required>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
          </Field>
          {error && <p className="rounded-lg bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</p>}
          <Button type="submit" loading={busy} className="w-full">Send reset link</Button>
          <p className="text-center text-sm">
            <Link to="/login" className="font-bold text-primary-600 hover:underline">← Back to login</Link>
          </p>
        </form>
      )}
    </AuthShell>
  );
}
