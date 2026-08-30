import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useApp } from '../../context/AppContext';
import { Button, Field, Input } from '../../components/ui';

/**
 * /admin/login — professional admin login.
 * Uses Supabase Auth (email + password). Access to /admin/* is additionally
 * gated by the `admin` role stored in the database (never client metadata).
 * The initial admin account is created by the site owner during deployment —
 * see README ("Promote the first admin"). No credentials are stored in code.
 */
export default function AdminLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const { toast, authLoading, isAuthed, profile } = useApp();

  React.useEffect(() => {
    if (authLoading) return;
    if (isAuthed && profile?.role === 'admin') navigate('/admin', { replace: true });
  }, [authLoading, isAuthed, profile, navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const { error: err } = await supabase!.auth.signInWithPassword({ email, password });
      if (err) throw err;
      toast('Logged in. Verifying admin role…', 'info');
      navigate('/admin', { replace: true });
    } catch (err: any) {
      setError(err.message || 'Invalid credentials.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-ink-900 px-4">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <span className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-600">
            <svg className="h-7 w-7 text-white" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </span>
          <h1 className="text-2xl font-black text-white">Admin Control Panel</h1>
          <p className="mt-1 text-sm text-ink-400">Restricted area · role-verified via Supabase RLS</p>
        </div>
        <div className="rounded-2xl bg-white p-6 shadow-lift">
          <form onSubmit={submit} className="space-y-4">
            <Field label="Admin email">
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="admin@yourdomain.com" autoComplete="username" />
            </Field>
            <Field label="Password">
              <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" autoComplete="current-password" />
            </Field>
            {error && <p className="rounded-lg bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</p>}
            <Button type="submit" loading={busy} className="w-full !bg-ink-900 hover:!bg-ink-700">Sign in to Admin</Button>
          </form>
          <p className="mt-5 text-center text-xs leading-relaxed text-ink-400">
            Admin accounts are provisioned securely during deployment.<br />
            Not an admin? <button onClick={() => navigate('/login')} className="font-bold text-primary-600 hover:underline">User login</button>
          </p>
        </div>
      </div>
    </div>
  );
}
