'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LogoutButton } from './LogoutButton';

const LINKS: [string, string, boolean][] = [
  ['/dealer', 'Dashboard', false],
  ['/dealer/leads', 'Leads', true],
  ['/dealer/offers', 'My offers', true],
  ['/dealer/profile', 'Business profile', false],
  ['/dealer/subscription', 'Plan & billing', false],
];

export function DealerNav({ verified }: { verified: boolean }) {
  const path = usePathname();
  return (
    <nav className="flex gap-1.5 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible lg:pb-0" aria-label="Dealer">
      {LINKS.map(([href, label, needsVerified]) => {
        const disabled = needsVerified && !verified;
        const active = path === href;
        if (disabled) {
          return (
            <span key={href} title="Available once your dealership is verified"
              className="cursor-not-allowed whitespace-nowrap rounded-xl px-3.5 py-2 text-[13.5px] text-ink-mute/60">
              {label} <span className="text-[10px]">🔒</span>
            </span>
          );
        }
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
