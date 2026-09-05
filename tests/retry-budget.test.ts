import { beforeEach, describe, expect, it, vi } from 'vitest';

/** Minimal sessionStorage so the module can be exercised outside a browser. */
function stubStorage() {
  const store = new Map<string, string>();
  (globalThis as any).sessionStorage = {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => void store.set(k, String(v)),
    removeItem: (k: string) => void store.delete(k),
  };
  return store;
}

async function load() {
  vi.resetModules();
  return import('../lib/retry-budget');
}

describe('error-boundary retry budget', () => {
  let store: Map<string, string>;
  beforeEach(() => { store = stubStorage(); });

  it('allows exactly MAX attempts and then stops', async () => {
    const m = await load();
    const attempts: (number | null)[] = [];
    for (let i = 0; i < 7; i++) attempts.push(m.takeRetryBudget('/bikes'));
    expect(attempts).toEqual([1, 2, 3, 4, 5, null, null]);
  });

  it('tracks each path separately', async () => {
    const m = await load();
    expect(m.takeRetryBudget('/bikes')).toBe(1);
    expect(m.takeRetryBudget('/compare')).toBe(1);
    expect(m.takeRetryBudget('/bikes')).toBe(2);
  });

  it('refills the window after 3 minutes instead of disabling auto-heal forever', async () => {
    const m = await load();
    const t0 = Date.now();
    vi.spyOn(Date, 'now').mockImplementation(() => t0);
    for (let i = 0; i < 5; i++) expect(m.takeRetryBudget('/bikes')).toBe(i + 1);
    expect(m.takeRetryBudget('/bikes')).toBeNull();
    vi.spyOn(Date, 'now').mockImplementation(() => t0 + 181_000);
    expect(m.takeRetryBudget('/bikes')).toBe(1);
    vi.restoreAllMocks();
  });

  it('a successful render refills the budget', async () => {
    const m = await load();
    m.takeRetryBudget('/bikes');
    m.takeRetryBudget('/bikes');
    m.resetRetryBudget('/bikes');
    expect(m.takeRetryBudget('/bikes')).toBe(1);
  });

  it('does NOT refill while the error boundary is rendering (loop guard)', async () => {
    const m = await load();
    expect(m.takeRetryBudget('/bikes')).toBe(1);
    m.markErrorBoundaryRendering();
    m.resetRetryBudget('/bikes');            // must be ignored
    expect(m.takeRetryBudget('/bikes')).toBe(2);
    expect(store.size).toBe(1);
  });
});
