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
  { href: '/hybrid', label: 'Hybrid' },
  { href: '/ethanol', label: 'Ethanol' },
  { href: '/compare', label: 'Compare' },
  { href: '/used-bikes', label: 'Used Bikes' },
  { href: '/used-bikes/sell', label: 'Sell Your Bike' },
  { href: '/dealer-offers', label: 'Dealer Offers' },
];

export function Header({ user }: { user: AppUser | null }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const isRegistrationPage = pathname === '/login' || pathname === '/register' || pathname === '/dealer/register';

  useEffect(() => { setOpen(false); }, [pathname]);

  const accountHref = user
    ? user.role === 'admin' || user.role === 'moderator' || user.role === 'verifier'
      ? '/admin'
      : user.role === 'dealer'
        ? '/dealer'
        : '/account'
    : '/login';

  return (
    <header className={`${isRegistrationPage ? 'relative' : 'sticky top-0'} z-40 border-b border-line bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80`}>
      <div className="container-xl">
        <div className="flex min-h-16 items-center gap-3">
          <Logo compact />

          <nav aria-label="Primary" className="hidden min-w-0 flex-1 items-center gap-0 xl:flex">
            {NAV.map((n) => {
              const active = pathname === n.href || pathname.startsWith(`${n.href}/`);
              return (
                <Link
                  key={n.href}
                  href={n.href}
                  aria-current={active ? 'page' : undefined}
                  className={`whitespace-nowrap rounded-lg px-2 py-2 text-[13px] font-medium transition-colors ${active ? 'bg-brand-50 text-brand-700' : 'text-ink-soft hover:bg-surface hover:text-ink'}`}
                >
                  {n.label}
                </Link>
              );
            })}
          </nav>

          <div className="ml-auto flex shrink-0 items-center gap-2">
            <div className="hidden w-[250px] lg:block xl:w-[270px]">
              <SearchBox placeholder="Search bikes, scooters and used bikes" />
            </div>
            <Link href={accountHref} className="hidden btn-outline btn-sm md:inline-flex">
              {user ? (user.full_name?.split(' ')[0] || 'Account') : 'Login'}
            </Link>
            <button
              type="button"
              onClick={() => setOpen((o) => !o)}
              aria-label="Menu"
              aria-expanded={open}
              className="grid h-9 w-9 place-items-center rounded-xl border border-line text-ink-soft xl:hidden"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d={open ? 'M6 6l12 12M18 6 6 18' : 'M4 7h16M4 12h16M4 17h16'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        </div>

        <div className="pb-3 lg:hidden">
          <SearchBox placeholder="Search bikes, scooters and used bikes" />
        </div>
      </div>

      {open && (
        <div className="animate-fade-up border-t border-line bg-white xl:hidden">
          <nav aria-label="Mobile" className="container-xl grid gap-1 py-3">
            {NAV.map((n) => (
              <Link key={n.href} href={n.href} className="rounded-lg px-3 py-2.5 text-sm font-medium text-ink-soft hover:bg-surface">
                {n.label}
              </Link>
            ))}
            <div className="mt-2">
              <Link href={accountHref} className="btn-outline w-full">{user ? 'My account' : 'Login'}</Link>
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
