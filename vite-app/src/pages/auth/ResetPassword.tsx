import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { Button, Field, Input, Spinner } from '../../components/ui';
import { AuthShell } from './Login';

/**
 * Handles the magic link from the "reset password" email
 * (Supabase Auth recovery flow — ?type=recovery).
 */
export default function ResetPassword() {
  const [checking, setChecking] = useState(true);
  const [isRecovery, setIsRecovery] = useState(false);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    (async () => {
      const { data } = await supabase!.auth.getSession();
      const params = new URLSearchParams(window.location.search);
      const isRecoveryLink = params.get('type') === 'recovery';
      if (!data.session) {
        // no active session and no recovery param — send back to login
        navigate('/login', { replace: true });
        return;
      }
      setIsRecovery(Boolean(isRecoveryLink));
      setChecking(false);
    })();
  }, [navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < 8) return setError('Password must be at least 8 characters.');
    if (password !== confirm) return setError('Passwords do not match.');
    setBusy(true);
    try {
      const { error: err } = await supabase!.auth.updateUser({ password });
      if (err) throw err;
      navigate('/account', { replace: true });
    } catch (err: any) {
      setError(err.message || 'Could not update the password.');
    } finally {
      setBusy(false);
    }
  };

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner className="h-8 w-8 text-primary-600" />
      </div>
    );
  }

  if (!isRecovery) {
    return (
      <AuthShell title="Nothing to reset" subtitle="Open the reset link from your email first.">
        <Link to="/login" className="block w-full rounded-lg bg-ink-900 py-2.5 text-center text-sm font-bold text-white">← Back to login</Link>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Set a new password" subtitle="Your reset link is valid — choose a strong password.">
      <form onSubmit={submit} className="space-y-4">
        <Field label="New password" required hint="Minimum 8 characters.">
          <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" />
        </Field>
        <Field label="Confirm new password" required>
          <Input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" />
        </Field>
        {error && <p className="rounded-lg bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</p>}
        <Button type="submit" loading={busy} className="w-full">Update password</Button>
      </form>
    </AuthShell>
  );
}
