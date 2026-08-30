import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useApp } from '../../context/AppContext';
import { Button, Field, Input } from '../../components/ui';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const redirect = params.get('redirect') || '';
  const { toast } = useApp();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);
    if (!/^\S+@\S+\.\S+$/.test(email)) return setError('Enter a valid email address.');
    if (!password) return setError('Enter your password.');
    setBusy(true);
    try {
      const { data, error: err } = await supabase!.auth.signInWithPassword({ email, password });
      if (err) throw err;
      const role = (data.user?.user_metadata as any)?.role;
      toast(`Welcome back, ${(data.user?.email || '').split('@')[0]}!`, 'success');
      navigate(redirect || (role === 'admin' ? '/admin' : role === 'dealer' ? '/dealer' : '/account'), { replace: true });
    } catch (err: any) {
      setError(err.message || 'Login failed. Check your credentials.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell title="Welcome back" subtitle="Log in to manage your bikes, favourites, enquiries and more.">
      <form onSubmit={submit} className="space-y-4">
        <Field label="Email">
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email" />
        </Field>
        <Field label="Password">
          <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Your password" autoComplete="current-password" />
        </Field>
        {error && <p className="rounded-lg bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</p>}
        {info && <p className="rounded-lg bg-sky-50 p-3 text-sm text-sky-800">{info}</p>}
        <Button type="submit" loading={busy} className="w-full">Log in</Button>
        <div className="flex items-center justify-between text-sm">
          <Link to={`/forgot-password${redirect ? `?redirect=${encodeURIComponent(redirect)}` : ''}`} className="font-bold text-primary-600 hover:underline">Forgot password?</Link>
          <Link to="/register" className="font-bold text-ink-700 hover:underline">Create account →</Link>
        </div>
      </form>
      <p className="mt-6 border-t border-ink-100 pt-4 text-center text-xs text-ink-400">
        Authentication is handled securely by Supabase Auth.{' '}
        <Link to="/admin/login" className="font-semibold text-ink-500 hover:underline">Admin login →</Link>
      </p>
    </AuthShell>
  );
}

export function AuthShell({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center bg-ink-50 px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <span className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-ink-900">
            <svg className="h-6 w-6 text-primary-500" viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 40c0-8 6-14 14-14h10l6-8h8l-7 10c4 3 6 8 6 12" /><circle cx="18" cy="44" r="7" /><circle cx="46" cy="44" r="7" /><path d="M25 44h14" />
            </svg>
          </span>
          <h1 className="text-2xl font-black text-ink-900">{title}</h1>
          <p className="mt-1 text-sm text-ink-500">{subtitle}</p>
        </div>
        <div className="card p-6">{children}</div>
      </div>
    </div>
  );
}
