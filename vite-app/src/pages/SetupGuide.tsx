import React, { useState } from 'react';
import { getStoredConfig, saveStoredConfig, clearStoredConfig } from '../lib/supabase';
import { Button, Card, Field, Input } from '../components/ui';

/**
 * Rendered instead of the whole app when no Supabase project is connected.
 * Honest by design: no fake data, no fake features — just the exact steps
 * to connect a real project (env vars, or paste URL + anon key here).
 *
 * The anon key is a PUBLIC key (safe to be in a browser); the service-role
 * key is never needed by this app and must never be pasted here.
 */
export default function SetupGuide() {
  const stored = getStoredConfig();
  const [url, setUrl] = useState(stored?.url || '');
  const [key, setKey] = useState(stored?.anonKey || '');
  const [err, setErr] = useState<string | null>(null);

  const connect = () => {
    if (!/^https?:\/\//.test(url.trim())) {
      setErr('Project URL must look like https://xxxx.supabase.co');
      return;
    }
    if (key.trim().length < 20) {
      setErr('The anon key looks too short — copy the full key from Project Settings → API.');
      return;
    }
    saveStoredConfig({ url: url.trim(), anonKey: key.trim() });
    window.location.reload();
  };

  const clear = () => {
    clearStoredConfig();
    window.location.reload();
  };

  return (
    <div className="min-h-screen bg-ink-50 text-ink-900">
      <header className="border-b border-ink-100 bg-white">
        <div className="mx-auto flex max-w-4xl items-center gap-3 px-5 py-4">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-600 text-lg font-black text-white">CB</span>
          <div>
            <p className="font-black leading-tight">CompareBike</p>
            <p className="text-xs text-ink-400">Setup required — no data is being shown or faked</p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl space-y-6 px-5 py-10">
        <div>
          <h1 className="text-3xl font-black">Connect your Supabase project</h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-500">
            This frontend has no backend yet, so every page would be empty. Instead of fake data, we show you this page. Once you connect a Supabase
            project (free tier is enough) and run the included migrations, the whole marketplace goes live.
          </p>
        </div>

        {/* Step 0: connect */}
        <Card className="p-6">
          <h2 className="font-black">Step 0 · Connect the project (2 minutes)</h2>
          <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-ink-600">
            <li>Create a project at <span className="font-mono text-xs">supabase.com</span> (any region).</li>
            <li>Open <strong>Project Settings → API</strong> and copy the <strong>Project URL</strong> and the <strong>anon / public key</strong>.</li>
            <li>Paste both below and click <strong>Connect</strong> — or set <code className="rounded bg-ink-100 px-1 text-xs">VITE_SUPABASE_URL</code> and <code className="rounded bg-ink-100 px-1 text-xs">VITE_SUPABASE_ANON_KEY</code> in <span className="font-mono text-xs">.env</span> and restart the dev server (env vars win over this form).</li>
          </ol>
          {err && <p className="mt-3 rounded-lg bg-red-50 p-3 text-sm font-bold text-red-700">{err}</p>}
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Field label="Project URL">
              <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://abcdefgh.supabase.co" className="font-mono text-xs" />
            </Field>
            <Field label="anon / public key" hint="Public key only. Never paste the service-role secret here.">
              <Input value={key} onChange={(e) => setKey(e.target.value)} placeholder="eyJhbGciOi..." className="font-mono text-xs" />
            </Field>
          </div>
          <div className="mt-4 flex gap-2">
            <Button onClick={connect}>Connect & reload</Button>
            {stored && <Button variant="outline" onClick={clear}>Forget stored project</Button>}
          </div>
        </Card>

        {/* Step 1: migrations */}
        <Card className="p-6">
          <h2 className="font-black">Step 1 · Run the SQL migrations</h2>
          <p className="mt-2 text-sm text-ink-600">
            In the Supabase dashboard open <strong>SQL Editor</strong> and run the files in <span className="font-mono text-xs">supabase/migrations/</span>{' '}
            <strong>in this exact order</strong> (each file works standalone):
          </p>
          <ol className="mt-3 space-y-1.5 text-sm text-ink-700">
            {['0001_schema.sql', '0002_functions_triggers.sql', '0003_rls.sql', '0004_storage.sql', '0005_seed.sql'].map((f) => (
              <li key={f} className="rounded-lg bg-ink-900 px-3 py-2 font-mono text-xs text-emerald-300">{f}</li>
            ))}
          </ol>
          <p className="mt-3 text-xs text-ink-400">
            0001 creates every table + indexes · 0002 the security-definer helpers, role trigger, audit + notification triggers · 0003 row-level security
            (no table is left without it) · 0004 the storage buckets + policies · 0005 brands, specification system, FAQs and site settings (no fake bikes).
          </p>
        </Card>

        {/* Step 2: edge function */}
        <Card className="p-6">
          <h2 className="font-black">Step 2 · Deploy the image-processing function</h2>
          <p className="mt-2 text-sm text-ink-600">
            Optional but recommended. Deploys <span className="font-mono text-xs">supabase/functions/image-process</span> — it optimises uploaded bike
            photos <strong>without altering the motorcycle itself</strong>, always keeps the original, and if it ever fails the listing still works with
            the original image.
          </p>
          <div className="mt-3 rounded-lg bg-ink-900 px-3 py-2 font-mono text-xs text-emerald-300">
            supabase functions deploy image-process --no-verify-jwt
          </div>
        </Card>

        {/* Step 3: admin */}
        <Card className="p-6">
          <h2 className="font-black">Step 3 · Create the admin account</h2>
          <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-ink-600">
            <li>Sign up on the site (public /register) with the email you want to use for admin.</li>
            <li>In Supabase SQL Editor run: <code className="rounded bg-ink-100 px-1.5 py-0.5 font-mono text-xs">select public.grant_role('admin', 'you@example.com');</code></li>
            <li>Log in at <strong>/admin</strong> with that email. Only the /admin panel changes for you — the public site is unchanged.</li>
          </ol>
          <p className="mt-3 text-xs text-ink-400">
            There is no hardcoded admin password anywhere. Admin rights come from the database role, and every admin action is written to the audit log.
          </p>
        </Card>

        {/* Step 4: verify */}
        <Card className="p-6">
          <h2 className="font-black">Step 4 · Verify it works</h2>
          <ul className="mt-2 space-y-1.5 text-sm text-ink-600">
            <li>• Homepage shows fuel categories (no random bike list) and the dynamic brand strip.</li>
            <li>• /admin loads stats, and you can add a brand + a bike end-to-end (variants, specs, images).</li>
            <li>• Upload a test image in the bike editor — it goes to the bike-images bucket and the image-process function picks it up.</li>
            <li>• Register a dealer from the public site, approve them in /admin/dealers, and check their offer flow.</li>
          </ul>
        </Card>

        <div className="rounded-xl border border-ink-200 bg-white p-5 text-xs leading-relaxed text-ink-500">
          <p className="font-black text-ink-800">Security notes</p>
          <p className="mt-1">
            The anon key is designed to be public and every table is protected by row-level security. The service-role key is used only server-side by the
            edge function (if you enable secret-based operations) and must never appear in this app, in browser code, or in Git. Proof documents
            (RC/insurance/GST) live in a <strong>private</strong> bucket readable only by their owner and approved admins.
          </p>
        </div>
      </main>
    </div>
  );
}
