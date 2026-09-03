import React from 'react';
import { Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { supabase } from '../../lib/supabase';
import { Spinner, Tabs } from '../ui';

export interface DashTab {
  id: string;
  label: string;
  to: string;
}

/** Shared top-nav dashboard shell for /account and /dealer routes. */
export default function DashboardLayout({ tabs, title, requireRole }: { tabs: DashTab[]; title: string; requireRole?: 'dealer' | 'admin' }) {
  const { isAuthed, authLoading, profile, settings } = useApp();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const brandName = settings['brand_name'] || 'CompareBike';

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner className="h-8 w-8 text-primary-600" />
      </div>
    );
  }
  if (!isAuthed) return <Navigate to={`/login?redirect=${encodeURIComponent(pathname)}`} replace />;
  if (requireRole && profile?.role !== requireRole && profile?.role !== 'admin') {
    return <Navigate to="/dealer/register" replace />;
  }

  const active =
    tabs.find((t) => (t.to === pathname ? true : pathname.startsWith(t.to + '/')))?.id ||
    (pathname === tabs[0].to ? tabs[0].id : undefined) ||
    tabs[0].id;

  return (
    <div className="min-h-screen bg-ink-50">
      <header className="border-b border-ink-200 bg-white">
        <div className="container-x flex h-14 items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-ink-900 text-sm font-black text-primary-500">{brandName.charAt(0)}</span>
            <div>
              <p className="text-sm font-bold text-ink-900">{title}</p>
              <p className="text-[11px] text-ink-400">{profile?.full_name || profile?.email}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => navigate('/')} className="rounded-lg border border-ink-200 px-3 py-1.5 text-sm font-semibold text-ink-700 hover:bg-ink-50">
              ← Website
            </button>
            <button
              onClick={async () => {
                await supabase?.auth.signOut();
                navigate('/');
              }}
              className="rounded-lg px-3 py-1.5 text-sm font-semibold text-red-600 hover:bg-red-50"
            >
              Log out
            </button>
          </div>
        </div>
      </header>
      <div className="container-x py-6">
        <Tabs
          tabs={tabs.map((t) => ({ id: t.id, label: t.label }))}
          active={active}
          onChange={(id) => navigate(tabs.find((t) => t.id === id)?.to || tabs[0].to)}
          className="mb-6"
        />
        <Outlet />
      </div>
    </div>
  );
}
