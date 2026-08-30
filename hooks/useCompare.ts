'use client';

import { useCallback, useEffect, useState } from 'react';

const KEY = 'bikepick.compare';
const MAX = 4;
const EVENT = 'bikepick:compare-changed';

function read(): string[] {
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as string[]).slice(0, MAX) : [];
  } catch {
    return [];
  }
}

/** Shared client-side compare tray (max 4 products, section 23). */
export function useCompare() {
  const [ids, setIds] = useState<string[]>([]);

  useEffect(() => {
    setIds(read());
    const sync = () => setIds(read());
    window.addEventListener(EVENT, sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(EVENT, sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  const write = useCallback((next: string[]) => {
    try { window.localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* ignore */ }
    setIds(next);
    window.dispatchEvent(new Event(EVENT));
  }, []);

  const toggle = useCallback((id: string) => {
    const current = read();
    write(current.includes(id) ? current.filter((x) => x !== id) : current.length >= MAX ? current : [...current, id]);
  }, [write]);

  const remove = useCallback((id: string) => write(read().filter((x) => x !== id)), [write]);
  const clear = useCallback(() => write([]), [write]);

  return { ids, toggle, remove, clear, isFull: ids.length >= MAX, max: MAX };
}
