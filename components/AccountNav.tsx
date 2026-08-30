'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LogoutButton } from './LogoutButton';

const LINKS = [
  ['/account', 'Overview'],
  ['/account/listings', 'My listings'],
  ['/account/alerts', 'Price alerts'],
  ['/account/saved', 'Saved comparisons'],
  ['/account/enquiries', 'My enquiries'],
  ['/account/reviews', 'My reviews'],
  ['/account/profile', 'Profile'],
];

export function AccountNav() {
  const path = usePathname();
  return (
    <nav className="flex gap-1.5 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible lg:pb-0" aria-label="Account">
      {LINKS.map(([href, label]) => {
        const active = path === href;
        return (
          <Link key={href} href={href} aria-current={active ? 'page' : undefined}
            className={`whitespace-nowrap rounded-xl px-3.5 py-2 text-[13.5px] font-medium transition ${
              active ? 'bg-brand-50 text-brand-700' : 'text-ink-soft hover:bg-surface hover:text-ink'}`}>
            {label}
          </Link>
        );
      })}
      <div className="hidden pt-2 lg:block"><LogoutButton /></div>
    </nav>
  );
}
