import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useApp } from '../../context/AppContext';

const items = [
  { to: '/', label: 'Home', icon: 'M3 10.5L12 3l9 7.5M5 9.5V21h5v-6h4v6h5V9.5' },
  { to: '/new-bikes', label: 'New Bikes', icon: 'M6 16a4 4 0 108 0 4 4 0 00-8 0zM14 16a4 4 0 108 0 4 4 0 00-8 0zM10 16h4M14 9l2-4h4l-3 4.5' },
  { to: '/used-bikes', label: 'Used Bikes', icon: 'M4 7h16M4 12h16M4 17h10M17 16l4 3-4 3' },
  { to: '/compare', label: 'Compare', icon: 'M9 3v18M3 8l6-5 6 5M15 21l6-5M15 16l6 5' },
];

export default function MobileNav() {
  const { profile } = useApp();
  const { pathname } = useLocation();
  const accountTo = profile?.role === 'admin' ? '/admin' : profile?.role === 'dealer' ? '/dealer' : '/account';
  const profileItem = { to: accountTo, label: 'Profile', icon: 'M12 12a4 4 0 100-8 4 4 0 000 8zM4 21c0-4 3.6-6 8-6s8 2 8 6' };
  const all = [...items, profileItem];
  const isPublicRoute = !pathname.startsWith('/admin') && !pathname.startsWith('/account') && !pathname.startsWith('/dealer');
  if (!isPublicRoute) return null;

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-ink-200 bg-white/95 backdrop-blur md:hidden" aria-label="Mobile bottom navigation">
      <div className="grid grid-cols-5">
        {all.map((it) => (
          <NavLink
            key={it.to}
            to={it.to}
            end={it.to === '/'}
            className={({ isActive }) =>
              `flex flex-col items-center gap-0.5 py-2.5 text-[10px] font-semibold ${isActive ? 'text-primary-600' : 'text-ink-400'}`
            }
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
              <path d={it.icon} />
            </svg>
            {it.label}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
