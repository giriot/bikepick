'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { LogoutButton } from '@/components/LogoutButton';

export interface NavItem { href: string; label: string; badge?: number }
export interface NavGroup { group: string; items: NavItem[] }

export function AdminNav({ groups }: { groups: NavGroup[] }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);

  const body = (
    <nav className="space-y-5" aria-label="Admin sections">
      {groups.map((g) => (
        <div key={g.group}>
          <p className="px-3 text-[10.5px] font-bold uppercase tracking-[0.08em] text-ink-mute/70">{g.group}</p>
          <ul className="mt-1.5 space-y-0.5">
            {g.items.map((i) => {
              const active = path === i.href || (i.href !== '/admin' && path.startsWith(i.href));
              return (
                <li key={i.href}>
                  <Link href={i.href} onClick={() => setOpen(false)} aria-current={active ? 'page' : undefined}
                    className={`flex items-center justify-between gap-2 rounded-lg px-3 py-[7px] text-[13px] transition ${
                      active ? 'bg-brand-600 font-semibold text-white' : 'text-ink-soft hover:bg-surface hover:text-ink'}`}>
                    <span>{i.label}</span>
                    {i.badge ? (
                      <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${active ? 'bg-white/25 text-white' : 'bg-warn-soft text-[#8A5B00]'}`}>{i.badge}</span>
                    ) : null}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
      <div className="border-t border-line pt-3"><LogoutButton /></div>
    </nav>
  );

  return (
    <>
      <button onClick={() => setOpen(!open)} className="btn-outline btn-sm mb-3 lg:hidden" aria-expanded={open}>
        {open ? 'Hide menu' : 'Admin menu'}
      </button>
      <div className={`${open ? 'block' : 'hidden'} lg:block`}>{body}</div>
    </>
  );
}
