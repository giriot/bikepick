import React, { useEffect } from 'react';
import { Link, NavLink, Navigate, Outlet, useNavigate } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { supabase } from '../../lib/supabase';
import { Spinner } from '../ui';

const groups: { title: string; links: { to: string; label: string; icon: string; badge?: boolean }[] }[] = [
  {
    title: 'Overview',
    links: [{ to: '/admin', label: 'Dashboard', icon: 'M4 5a1 1 0 011-1h5v6H5a1 1 0 01-1-1V5zM14 5a1 1 0 011-1h5v6h-5a1 1 0 01-1-1V5zM4 15a1 1 0 011-1h5v6H5a1 1 0 01-1-1v-5zM14 15a1 1 0 011-1h5v6h-5a1 1 0 01-1-1v-5z' }],
  },
  {
    title: 'Bikes',
    links: [
      { to: '/admin/bikes', label: 'Bike Models', icon: 'M6 16a4 4 0 108 0 4 4 0 00-8 0zM14 16a4 4 0 108 0 4 4 0 00-8 0z' },
      { to: '/admin/brands', label: 'Brands', icon: 'M4 21V8l8-5 8 5v13M9 21v-6h6v6' },
      { to: '/admin/specs', label: 'Specifications', icon: 'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01' },
    ],
  },
  {
    title: 'Approvals',
    links: [
      { to: '/admin/dealers', label: 'Dealers', icon: 'M12 12a4 4 0 100-8 4 4 0 000 8zM4 21c0-4 3.6-6 8-6s8 2 8 6' },
      { to: '/admin/used', label: 'Used Bikes', icon: 'M4 7h16M4 12h16M4 17h10' },
      { to: '/admin/offers', label: 'Dealer Offers', icon: 'M9 12l2 2 4-4M12 3l7 4v5c0 5-3.5 8-7 9-3.5-1-7-4-7-9V7l7-4z' },
      { to: '/admin/reviews', label: 'Reviews', icon: 'M11.5 3.9l1.9 3.9 4.3.6-3.1 3 .7 4.3-3.8-2-3.8 2 .7-4.3-3.1-3 4.3-.6 1.9-3.9z' },
      { to: '/admin/reports', label: 'Reports', icon: 'M12 9v4m0 4h.01M4.9 19h14.2a2 2 0 001.7-3L13.7 4a2 2 0 00-3.4 0L3.2 16a2 2 0 001.7 3z' },
    ],
  },
  {
    title: 'Engagement',
    links: [
      { to: '/admin/enquiries', label: 'Enquiries', icon: 'M8 10h8m-8 4h5m-9 6l3.5-3.5H18a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v14z' },
    ],
  },
  {
    title: 'Content & Settings',
    links: [
      { to: '/admin/content', label: 'Content & Home', icon: 'M4 6h16M4 12h16M4 18h10' },
      { to: '/admin/scores', label: 'Score Weights', icon: 'M4 20V10m6 10V4m6 16v-7m4 7H2' },
      { to: '/admin/settings', label: 'Settings & CSV', icon: 'M12 15a3 3 0 100-6 3 3 0 000 6zM19 12a7 7 0 01-.1 1.2l2 1.6-2 3.4-2.4-1a7 7 0 01-2 1.2L14 21h-4l-.5-2.6a7 7 0 01-2-1.2l-2.4 1-2-3.4 2-1.6A7 7 0 015 12a7 7 0 01.1-1.2l-2-1.6 2-3.4 2.4 1a7 7 0 012-1.2L10 3h4l.5 2.6a7 7 0 012 1.2l2.4-1 2 3.4-2 1.6c.06.4.1.8.1 1.2z' },
      { to: '/admin/logs', label: 'Audit Log', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4' },
    ],
  },
];

export default function AdminLayout() {
  const { isAuthed, profile, authLoading, settings } = useApp();
  const navigate = useNavigate();
  const [sideOpen, setSideOpen] = React.useState(false);
  const brandName = settings['brand_name'] || 'CompareBike';

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthed) navigate('/admin/login', { replace: true });
    else if (profile?.role !== 'admin') navigate('/', { replace: true });
  }, [authLoading, isAuthed, profile, navigate]);

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-ink-50">
        <Spinner className="h-8 w-8 text-primary-600" />
      </div>
    );
  }
  if (!isAuthed || profile?.role !== 'admin') return <Navigate to={isAuthed ? '/' : '/admin/login'} replace />;

  const sidebar = (
    <aside className="flex h-full w-64 flex-col border-r border-ink-800 bg-ink-900">
      <div className="flex items-center gap-2 border-b border-ink-800 px-5 py-4">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-600 text-sm font-black text-white">A</span>
        <div>
          <p className="text-sm font-bold text-white">{brandName} Admin</p>
          <p className="text-[10px] uppercase tracking-widest text-ink-500">Control Panel</p>
        </div>
      </div>
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        {groups.map((g) => (
          <div key={g.title} className="mb-5">
            <p className="mb-1.5 px-2 text-[10px] font-bold uppercase tracking-widest text-ink-500">{g.title}</p>
            {g.links.map((l) => (
              <NavLink
                key={l.to}
                to={l.to}
                end={l.to === '/admin'}
                onClick={() => setSideOpen(false)}
                className={({ isActive }) =>
                  `mb-0.5 flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition ${isActive ? 'bg-primary-600 text-white' : 'text-ink-300 hover:bg-ink-800 hover:text-white'}`
                }
              >
                <svg className="h-4.5 w-4.5 h-5 w-5 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                  <path d={l.icon} />
                </svg>
                {l.label}
              </NavLink>
            ))}
          </div>
        ))}
      </nav>
      <div className="border-t border-ink-800 p-3">
        <Link to="/" className="mb-1 flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm font-medium text-ink-300 hover:bg-ink-800 hover:text-white">
          <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
          View Public Site
        </Link>
        <button
          onClick={async () => {
            await supabase?.auth.signOut();
            navigate('/admin/login');
          }}
          className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-sm font-semibold text-red-400 hover:bg-red-500/10"
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 8H5a2 2 0 01-2-2V6a2 2 0 012-2h6" /></svg>
          Log out
        </button>
      </div>
    </aside>
  );

  return (
    <div className="flex h-screen bg-ink-50">
      <div className="hidden lg:block">{sidebar}</div>
      {sideOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-ink-900/60" onClick={() => setSideOpen(false)} />
          <div className="absolute inset-y-0 left-0">{sidebar}</div>
        </div>
      )}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 items-center gap-3 border-b border-ink-200 bg-white px-4 lg:px-6">
          <button className="rounded-lg p-2 text-ink-600 hover:bg-ink-100 lg:hidden" onClick={() => setSideOpen(true)} aria-label="Open menu">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" d="M4 6h16M4 12h16M4 18h16" /></svg>
          </button>
          <p className="text-sm font-semibold text-ink-500">
            {profile?.full_name || profile?.email} <span className="ml-2 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-bold text-emerald-700 ring-1 ring-emerald-600/20">ADMIN</span>
          </p>
        </header>
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
