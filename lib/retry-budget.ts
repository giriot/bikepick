/**
 * Auto-reload budget for the global error boundary (app/error.tsx).
 *
 * Lives here rather than inside the boundary because the budget has to be
 * *spent* by the boundary and *refilled* by a successful render, and both sides
 * need the same sessionStorage key. Browser-only; every entry point is guarded.
 */

const MAX_AUTO_RETRIES = 5;
const WINDOW_MS = 180_000;

/**
 * Set synchronously while the error boundary renders. A successful page mount
 * must not refill the budget underneath a recovery cycle that is in progress,
 * or a page that genuinely cannot render would reload forever.
 */
const RENDERING_ERROR_FLAG = '__bpErrorBoundary';

export function isRenderingError(): boolean {
  try {
    return (globalThis as any)[RENDERING_ERROR_FLAG] === true;
  } catch {
    return false;
  }
}

export function markErrorBoundaryRendering(): void {
  try {
    (globalThis as any)[RENDERING_ERROR_FLAG] = true;
  } catch {
    /* private mode, frozen global — the guard is best-effort */
  }
}

function retryKey(pathname: string): string {
  return 'bp_retry_' + pathname;
}

/**
 * Spend one retry for `pathname`. Returns the 1-based attempt number, or null
 * when the boundary has already used up its retries and the error screen should
 * actually be shown.
 *
 * The window rolls over: five attempts inside 3 minutes count as one incident,
 * but the budget is not permanent — a tab left open for hours gets to try again
 * (the previous implementation stored the first attempt forever, so a path that
 * had ever hiccuped stopped auto-healing in that tab for good).
 */
export function takeRetryBudget(pathname: string): number | null {
  try {
    const now = Date.now();
    let count = 0;
    let first = now;
    const raw = sessionStorage.getItem(retryKey(pathname));
    if (raw) {
      try {
        const saved = JSON.parse(raw);
        count = Number(saved?.count) || 0;
        first = Number(saved?.first) || now;
      } catch {
        /* unreadable entry — start a fresh incident */
      }
    }
    if (now - first >= WINDOW_MS) {
      count = 0;
      first = now;
    }
    if (count >= MAX_AUTO_RETRIES) return null;
    count += 1;
    sessionStorage.setItem(retryKey(pathname), JSON.stringify({ count, first }));
    return count;
  } catch {
    // sessionStorage unavailable (private mode / disabled): allow one retry,
    // but never more than one per render, because nothing can be remembered.
    return 1;
  }
}

/** Refill the budget after the page rendered successfully. */
export function resetRetryBudget(pathname: string): void {
  try {
    if (isRenderingError()) return;
    sessionStorage.removeItem(retryKey(pathname));
  } catch {
    /* ignore */
  }
}

export const RETRY_DELAYS_MS = [800, 2000, 4500, 9000, 15000];
