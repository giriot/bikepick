'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { resetRetryBudget } from '@/lib/retry-budget';

/**
 * Refills the global error boundary's auto-reload budget after a page renders.
 *
 * Without this, the budget stored per path in sessionStorage is only ever spent:
 * a route that hiccuped five times in one tab would then show "Something went
 * wrong" on the first transient failure, forever, instead of quietly retrying.
 * Skipped while the error boundary is rendering, so a page that genuinely
 * cannot render is not handed a fresh budget and left reloading in a loop.
 */
export function RetryBudgetReset() {
  const pathname = usePathname();
  useEffect(() => {
    resetRetryBudget(pathname);
  }, [pathname]);
  return null;
}
