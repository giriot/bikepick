import React, { useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import SearchBox from '../SearchBox';
import { supabase } from '../../lib/supabase';
import { markAllNotificationsRead } from '../../lib/api';

const navLinks = [
  { to: '/new-bikes', label: 'New Bikes' },
  { to: '/used-bikes', label: 'Used Bikes' },
  { to: '/compare', label: 'Compare' },
  { to: '/brands', label: 'Brands' },
  { to: '/guides', label: 'Guides' },
];

export default function Header() {
  const { profile, isAuthed, settings, settingsLoaded, toast } = useApp();
  const [menuOpen, setMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const navigate = useNavigate();
  const brandName = settings['brand_name'] || 'CompareBike';
  const logoUrl = settings['active_logo_path'] && supabase
    ? supabase.storage.from('site-assets').getPublicUrl(settings['active_logo_path']).data.publicUrl
    : null;

  const logout = async () => {
    await supabase?.auth.signOut();
    setMenuOpen(false);
    toast('Logged out. See you soon!', 'info');
    navigate('/');
  };

  const accountPath = profile?.role === 'admin' ? '/admin' : profile?.role === 'dealer' ? '/dealer' : '/account';

  return (
    <header className="sticky top-0 z-50 border-b border-ink-200 bg-white/95 backdrop-blur">
      <div className="container-x flex h-16 items-center gap-4">
        {/* Logo */}
        <Link to="/" className="flex shrink-0 items-center gap-2.5" aria-label={brandName}>
          {logoUrl ? (
            <img src={logoUrl} alt={brandName} className="h-9 w-auto max-w-[140px] object-contain" />
          ) : (
            <>
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-ink-900">
                <svg className="h-5 w-5 text-primary-500" viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 40c0-8 6-14 14-14h10l6-8h8l-7 10c4 3 6 8 6 12" />
                  <circle cx="18" cy="44" r="7" />
                  <circle cx="46" cy="44" r="7" />
                  <path d="M25 44h14" />
                </svg>
              </span>
              <span className="text-lg font-extrabold tracking-tight text-ink-900">
                {brandName.split(' ')[0]}
                <span className="text-primary-600">{brandName.split(' ').slice(1).join(' ') || 'Bike'}</span>
              </span>
            </>
          )}
        </Link>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-1 lg:flex" aria-label="Main">
          {navLinks.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              className={({ isActive }) =>
                `rounded-lg px-3 py-2 text-sm font-semibold transition ${isActive ? 'bg-ink-100 text-ink-900' : 'text-ink-500 hover:text-ink-900'}`
              }
            >
              {l.label}
            </NavLink>
          ))}
        </nav>

        {/* Search (desktop) */}
        <div className="hidden flex-1 justify-end md:flex">
          <div className="w-full max-w-sm">
            <SearchBox />
          </div>
        </div>

        <div className="ml-auto flex items-center gap-2 md:ml-0">
          {/* Notifications */}
          {isAuthed && (
            <div className="relative">
              <button
                onClick={() => {
                  setNotifOpen((o) => !o);
                  setMenuOpen(false);
                  markAllNotificationsRead().catch(() => null);
                }}
                className="relative rounded-lg p-2 text-ink-500 hover:bg-ink-100"
                aria-label="Notifications"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.4-1.4A2 2 0 0118 14.2V11a6 6 0 10-12 0v3.2a2 2 0 01-.6 1.4L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
              </button>
              {notifOpen && (
                <div className="absolute right-0 mt-2 w-64 rounded-xl border border-ink-200 bg-white p-3 shadow-lift">
                  <p className="mb-2 text-xs font-bold uppercase tracking-wide text-ink-400">Notifications</p>
                  <Link to={accountPath === '/admin' ? '/admin' : '/account?tab=notifications'} className="block rounded-lg px-2 py-1.5 text-sm text-ink-700 hover:bg-ink-50">
                    View all notifications →
                  </Link>
                </div>
              )}
            </div>
          )}

          {/* Auth */}
          {isAuthed ? (
            <div className="relative">
              <button
                onClick={() => {
                  setMenuOpen((o) => !o);
                  setNotifOpen(false);
                }}
                className="flex items-center gap-2 rounded-lg border border-ink-200 px-3 py-1.5 text-sm font-semibold text-ink-800 hover:bg-ink-50"
              >
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary-600 text-xs font-bold text-white">
                  {(profile?.full_name || profile?.email || 'U').charAt(0).toUpperCase()}
                </span>
                <span className="hidden sm:block">{(profile?.full_name || 'Account').split(' ')[0]}</span>
              </button>
              {menuOpen && (
                <div className="absolute right-0 mt-2 w-56 rounded-xl border border-ink-200 bg-white p-2 shadow-lift">
                  <p className="truncate px-3 py-2 text-xs text-ink-400">{profile?.email}</p>
                  <div className="my-1 border-t border-ink-100" />
                  <Link to={accountPath} onClick={() => setMenuOpen(false)} className="block rounded-lg px-3 py-2 text-sm font-medium text-ink-700 hover:bg-ink-50">
                    {profile?.role === 'admin' ? 'Admin Panel' : profile?.role === 'dealer' ? 'Dealer Dashboard' : 'My Account'}
                  </Link>
                  {profile?.role !== 'admin' && (
                    <Link to="/post-used-bike" onClick={() => setMenuOpen(false)} className="block rounded-lg px-3 py-2 text-sm font-medium text-ink-700 hover:bg-ink-50">
                      Sell a used bike
                    </Link>
                  )}
                  <Link to="/dealer/register" onClick={() => setMenuOpen(false)} className="block rounded-lg px-3 py-2 text-sm font-medium text-ink-700 hover:bg-ink-50">
                    Dealer registration
                  </Link>
                  {profile?.role === 'admin' && (
                    <Link to="/" onClick={() => setMenuOpen(false)} className="block rounded-lg px-3 py-2 text-sm font-medium text-ink-700 hover:bg-ink-50">
                      View public site
                    </Link>
                  )}
                  <div className="my-1 border-t border-ink-100" />
                  <button onClick={logout} className="block w-full rounded-lg px-3 py-2 text-left text-sm font-semibold text-red-600 hover:bg-red-50">
                    Log out
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link to="/login" className="rounded-lg px-3 py-2 text-sm font-semibold text-ink-700 hover:bg-ink-100">
                Login
              </Link>
              <Link to="/register" className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-primary-700">
                Sign up
              </Link>
            </div>
          )}

          {/* Mobile menu button */}
          <button className="rounded-lg p-2 text-ink-700 hover:bg-ink-100 lg:hidden" onClick={() => setMenuOpen((o) => !o)} aria-label="Menu">
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              {menuOpen ? <path strokeLinecap="round" d="M6 18L18 6M6 6l12 12" /> : <path strokeLinecap="round" d="M4 6h16M4 12h16M4 18h16" />}
            </svg>
          </button>
        </div>
      </div>

      {/* Mobile search + nav */}
      <div className="border-t border-ink-100 px-4 pb-3 pt-2 md:hidden">
        <SearchBox onNavigate={() => setMenuOpen(false)} />
      </div>
      {menuOpen && (
        <nav className="border-t border-ink-100 bg-white px-4 py-2 lg:hidden" aria-label="Mobile">
          {navLinks.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              onClick={() => setMenuOpen(false)}
              className={({ isActive }) =>
                `block rounded-lg px-3 py-2.5 text-sm font-semibold ${isActive ? 'bg-ink-100 text-ink-900' : 'text-ink-600'}`
              }
            >
              {l.label}
            </NavLink>
          ))}
        </nav>
      )}
    </header>
  );
}
