'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

const COOKIE = 'bt_lock'; // body-type lock: 'all' | 'bike' | 'scooter'

/**
 * "Bike / Scooter / All" filter shown at the top of the catalogue pages.
 * The choice is stored in a cookie so it persists across pages and reloads —
 * the listing pages read the same cookie server-side, so once you lock to
 * "Bike", only bikes are shown everywhere until you release it here.
 */
export function BodyTypeLock({ initial }: { initial: 'all' | 'bike' | 'scooter' }) {
  const router = useRouter();
  const [value, setValue] = useState(initial);

  const choose = (v: 'all' | 'bike' | 'scooter') => {
    setValue(v);
    // Same-site, 1-year cookie; not HttpOnly so the server can still read it
    // on the next request — it only stores a UI preference.
    document.cookie = `${COOKIE}=${v}; path=/; max-age=31536000; SameSite=Lax`;
    router.refresh();
  };

  const options: { id: 'all' | 'bike' | 'scooter'; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'bike', label: 'Bike' },
    { id: 'scooter', label: 'Scooter' },
  ];

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-[12px] font-semibold uppercase tracking-wide text-ink-mute">Show</span>
      <div className="flex rounded-lg border border-line bg-white p-0.5">
        {options.map((o) => (
          <button
            key={o.id}
            type="button"
            onClick={() => choose(o.id)}
            className={`rounded-md px-4 py-1.5 text-[12.5px] font-semibold transition-colors ${
              value === o.id ? 'bg-brand-600 text-white' : 'text-ink-mute hover:text-ink'
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
      {value !== 'all' && (
        <span className="text-[11.5px] text-ink-mute">
          🔒 Locked to <span className="font-semibold text-ink">{value}s</span> everywhere — tap “All” to release.
        </span>
      )}
    </div>
  );
}
