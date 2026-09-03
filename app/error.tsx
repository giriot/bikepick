'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';

const MAX_AUTO_RETRIES = 5;
const WINDOW_MS = 180_000;
const DELAYS = [800, 2000, 4500, 9000, 15000];

/**
 * Self-healing error boundary.
 *
 * A first request after a quiet period may hit a cold server that takes a
 * little too long to wake up (the request gets cut off before it finishes).
 * Instead of showing the scary error screen, we quietly reload — up to 3
 * times within 2 minutes, with increasing waits. By the second or third
 * attempt the server is warm and the page renders. Only if every attempt
 * fails do we show the error screen with a manual "Try again".
 */
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const [failed, setFailed] = useState(false);
  const fired = useRef(false);

  useEffect(() => {
    if (fired.current) return;
    fired.current = true;
    console.error('[global-error]', error);

    let allowed = false;
    let attempt = 1;
    try {
      const key = 'bp_retry_' + window.location.pathname;
      const now = Date.now();
      const raw = sessionStorage.getItem(key);
      let count = 0;
      let first = now;
      if (raw) {
        try {
          const s = JSON.parse(raw);
          count = s.count || 0;
          first = s.first || now;
        } catch { /* ignore */ }
      }
      if (count < MAX_AUTO_RETRIES && now - first < WINDOW_MS) {
        allowed = true;
        attempt = count + 1;
        sessionStorage.setItem(key, JSON.stringify({ count: attempt, first }));
      }
    } catch {
      allowed = true;
    }

    if (allowed) {
      const delay = DELAYS[Math.min(attempt - 1, DELAYS.length - 1)];
      const t = setTimeout(() => reset(), delay);
      return () => clearTimeout(t);
    }
    setFailed(true);
  }, [error, reset]);

  if (!failed) {
    return (
      <div className="container-xl grid min-h-[60vh] place-items-center py-20 text-center">
        <div className="max-w-md">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-[3px] border-line border-t-brand-600" />
          <p className="mt-5 text-sm font-medium">Loading page…</p>
          <p className="mt-1.5 text-[12.5px] text-ink-mute">
            Taking a moment — your data is safe. If this continues, your internet connection may be slow.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="container-xl grid min-h-[60vh] place-items-center py-20 text-center">
      <div className="max-w-md">
        <h1 className="text-2xl font-bold tracking-[-0.03em]">Something went wrong</h1>
        <p className="mt-3 text-sm text-ink-mute">
          The page could not be rendered. Existing data has not been changed.
        </p>
        <div className="mt-6 flex justify-center gap-2">
          <button type="button" onClick={reset} className="btn-primary">Try again</button>
          <Link href="/" className="btn-outline">Homepage</Link>
        </div>
      </div>
    </div>
  );
}
