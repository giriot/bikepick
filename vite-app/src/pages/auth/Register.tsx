import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useApp } from '../../context/AppContext';
import { Button, Field, Input } from '../../components/ui';
import { AuthShell } from './Login';

export default function Register() {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const navigate = useNavigate();
  const { toast } = useApp();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (fullName.trim().length < 2) return setError('Please enter your full name.');
    if (!/^\S+@\S+\.\S+$/.test(email)) return setError('Enter a valid email address.');
    if (phone && !/^[6-9]\d{9}$/.test(phone.replace(/\s/g, ''))) return setError('Enter a valid 10-digit Indian mobile number (or leave blank).');
    if (password.length < 8) return setError('Password must be at least 8 characters.');
    if (password !== confirm) return setError('Passwords do not match.');
    setBusy(true);
    try {
      const { data, error: err } = await supabase!.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: fullName.trim(), phone: phone.trim() || null },
          emailRedirectTo: `${window.location.origin}/reset-password`,
        },
      });
      if (err) throw err;
      setDone(true);
      if (data.session) {
        toast('Account created! Welcome to CompareBike.', 'success');
        navigate('/account', { replace: true });
      }
    } catch (err: any) {
      setError(err.message || 'Could not create the account.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell title="Create your account" subtitle="Save bikes, sell used bikes, and get dealer offers.">
      {done ? (
        <div className="py-4 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
            <svg className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
          </div>
          <h3 className="text-lg font-bold text-ink-900">Check your email</h3>
          <p className="mt-1 text-sm text-ink-500">
            We sent a verification link to <strong>{email}</strong>. Click it to activate your account, then log in.
          </p>
          <Button className="mt-5" onClick={() => navigate('/login')}>Go to Login</Button>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <Field label="Full name" required>
            <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Your name" autoComplete="name" />
          </Field>
          <Field label="Email" required>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email" />
          </Field>
          <Field label="Mobile number (optional)">
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="10-digit number" inputMode="tel" autoComplete="tel" />
          </Field>
          <Field label="Password" required hint="Minimum 8 characters.">
            <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" />
          </Field>
          <Field label="Confirm password" required>
            <Input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" />
          </Field>
          {error && <p className="rounded-lg bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</p>}
          <Button type="submit" loading={busy} className="w-full">Create account</Button>
          <p className="text-center text-sm text-ink-500">
            Already have an account? <Link to="/login" className="font-bold text-primary-600 hover:underline">Log in</Link>
          </p>
        </form>
      )}
    </AuthShell>
  );
}
