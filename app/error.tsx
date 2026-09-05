'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { RETRY_DELAYS_MS, markErrorBoundaryRendering, takeRetryBudget } from '@/lib/retry-budget';

/**
 * Self-healing error boundary.
 *
 * Two different failures land here and need different treatment:
 *
 * 1. A cold or briefly unavailable server — the RSC payload for the page could
 *    not be fetched. Waiting a moment and asking for the *document* again fixes
 *    it, so we reload up to five times with increasing waits (see
 *    lib/retry-budget.ts for the window).
 * 2. A stale tab after a deployment. The HTML the browser already has points at
 *    `/_next/static/chunks/….js` from the previous build, which no longer
 *    resolves, so a module import throws during render.
 *
 * In both cases the recovery step is the same: re-fetch the document.
 * `reset()` only re-renders the components that are already in memory, so it
 * cannot repair a missing chunk or re-run a server query — that is why it is no
 * longer used for the automatic attempts.
 */
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const [failed, setFailed] = useState(false);
  const fired = useRef(false);

  // Read by the layout so a successful mount does not refill the budget while a
  // recovery cycle is still running. Assigned during render, before any parent
  // effect can observe the tree.
  markErrorBoundaryRendering();

  useEffect(() => {
    if (fired.current) return;
    fired.current = true;
    console.error('[global-error]', error);

    const attempt = takeRetryBudget(window.location.pathname);
    if (attempt === null) {
      setFailed(true);
      return;
    }
    const delay = RETRY_DELAYS_MS[Math.min(attempt - 1, RETRY_DELAYS_MS.length - 1)];
    const t = setTimeout(() => window.location.reload(), delay);
    return () => clearTimeout(t);
  }, [error]);

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
          The page could not be rendered. Existing data has not been changed. Reloading usually
          clears it — this screen appears once the page has already retried on its own.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button type="button" onClick={() => window.location.reload()} className="btn-primary">
            Reload the page
          </button>
          <button type="button" onClick={reset} className="btn-outline">
            Try again
          </button>
          <Link href="/" className="btn-outline">Homepage</Link>
        </div>
        {error?.digest ? (
          <p className="mt-5 text-[11.5px] leading-relaxed text-ink-mute">
            Reference <code className="rounded bg-surface px-1.5 py-0.5">{error.digest}</code>
            {' '}when reporting this — it matches the entry in the deployment logs.
          </p>
        ) : null}
      </div>
    </div>
  );
}
