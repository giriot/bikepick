'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Logo } from './Logo';
import { SearchBox } from './SearchBox';
import type { AppUser } from '@/types';

const NAV = [
  { href: '/bikes', label: 'Bikes' },
  { href: '/electric', label: 'Electric' },
  { href: '/compare', label: 'Compare' },
  { href: '/used-bikes', label: 'Used Bikes' },
  { href: '/dealer-offers', label: 'Dealer Offers' },
  { href: '/reviews', label: 'Reviews' },
  { href: '/guides', label: 'Guides' },
];

export function Header({ user }: { user: AppUser | null }) {
  const [open, setOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => { setOpen(false); setSearchOpen(false); }, [pathname]);

  const accountHref = user
    ? user.role === 'admin' || user.role === 'moderator' || user.role === 'verifier'
      ? '/admin'
      : user.role === 'dealer'
        ? '/dealer'
        : '/account'
    : '/login';

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80">
      <div className="container-xl">
        <div className="flex h-16 items-center gap-4">
          <Logo compact />

          <nav aria-label="Primary" className="hidden flex-1 items-center gap-0.5 lg:flex">
            {NAV.map((n) => {
              const active = pathname === n.href || pathname.startsWith(`${n.href}/`);
              return (
                <Link
                  key={n.href}
                  href={n.href}
                  aria-current={active ? 'page' : undefined}
                  className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${active ? 'bg-brand-50 text-brand-700' : 'text-ink-soft hover:bg-surface hover:text-ink'}`}
                >
                  {n.label}
                </Link>
              );
            })}
          </nav>

          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              onClick={() => setSearchOpen((s) => !s)}
              aria-label="Search"
              aria-expanded={searchOpen}
              className="grid h-9 w-9 place-items-center rounded-xl border border-line text-ink-soft hover:border-brand-300 hover:text-brand-600"
            >
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
                <path d="m20 20-3.5-3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </button>

            <Link href="/used-bikes/sell" className="hidden btn-accent btn-sm sm:inline-flex">Sell Your Bike</Link>

            <Link href={accountHref} className="hidden btn-outline btn-sm md:inline-flex">
              {user ? (user.full_name?.split(' ')[0] || 'Account') : 'Login'}
            </Link>

            <button
              type="button"
              onClick={() => setOpen((o) => !o)}
              aria-label="Menu"
              aria-expanded={open}
              className="grid h-9 w-9 place-items-center rounded-xl border border-line text-ink-soft lg:hidden"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d={open ? 'M6 6l12 12M18 6 6 18' : 'M4 7h16M4 12h16M4 17h16'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        </div>

        {searchOpen && (
          <div className="animate-fade-up pb-3">
            <SearchBox autoFocus placeholder="Try “MT 15”, “Activa”, “Ather 450X”, “used Shine Coimbatore”" />
          </div>
        )}
      </div>

      {open && (
        <div className="animate-fade-up border-t border-line bg-white lg:hidden">
          <nav aria-label="Mobile" className="container-xl grid gap-1 py-3">
            {NAV.map((n) => (
              <Link key={n.href} href={n.href} className="rounded-lg px-3 py-2.5 text-sm font-medium text-ink-soft hover:bg-surface">
                {n.label}
              </Link>
            ))}
            <div className="mt-2 grid grid-cols-2 gap-2">
              <Link href="/used-bikes/sell" className="btn-accent">Sell Your Bike</Link>
              <Link href={accountHref} className="btn-outline">{user ? 'My account' : 'Login'}</Link>
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
