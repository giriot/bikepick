import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { getMyProfile, getSettings, getMyFavorites, toggleFavoriteDb, myNotifications } from '../lib/api';
import type { Profile, SiteSettings, FavoritesData } from '../lib/types';

// ─── Toasts ─────────────────────────────────────────────────────────────────

export interface Toast {
  id: number;
  kind: 'success' | 'error' | 'info';
  message: string;
}

// ─── Context shape ──────────────────────────────────────────────────────────

interface AppCtx {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  authLoading: boolean;
  isAuthed: boolean;
  isAdmin: boolean;
  isDealer: boolean;
  role: string;
  settings: SiteSettings;
  settingsLoaded: boolean;
  refreshSettings: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  toasts: Toast[];
  toast: (message: string, kind?: Toast['kind']) => void;
  dismissToast: (id: number) => void;
  // favorites
  fav: FavoritesData;
  favLoaded: boolean;
  hasFav: (type: 'bike' | 'used_bike' | 'comparison', id: string) => boolean;
  toggleFav: (type: 'bike' | 'used_bike' | 'comparison', id: string) => void;
  // compare tray
  compareIds: string[];
  hasCompare: (id: string) => boolean;
  addCompare: (id: string) => void;
  removeCompare: (id: string) => void;
  clearCompare: () => void;
  unreadNotifs: number;
  refreshNotifCount: () => Promise<void>;
}

const Ctx = createContext<AppCtx | null>(null);

const FAV_KEY = 'comparebike_favs';
const CMP_KEY = 'comparebike_compare';

function loadJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [settings, setSettings] = useState<SiteSettings>({});
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [fav, setFav] = useState<FavoritesData>(() => loadJson<FavoritesData>(FAV_KEY, { bikes: [], used: [], comparisons: [] }));
  const [favLoaded, setFavLoaded] = useState(false);
  const [compareIds, setCompareIds] = useState<string[]>(() => loadJson<string[]>(CMP_KEY, []).slice(0, 4));
  const [unreadNotifs, setUnreadNotifs] = useState(0);
  const toastId = useRef(0);
  const navigate = useNavigate();

  // ── auth session ──
  useEffect(() => {
    if (!supabase) {
      setAuthLoading(false);
      return;
    }
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setAuthLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  const user = session?.user || null;
  const isAuthed = Boolean(user);

  const refreshProfile = useCallback(async () => {
    if (!supabase || !user) {
      setProfile(null);
      return;
    }
    try {
      setProfile(await getMyProfile());
    } catch {
      setProfile(null);
    }
  }, [user]);

  useEffect(() => {
    refreshProfile();
  }, [user?.id, refreshProfile]);

  // ── site settings (logo, brand name, weights, featured picks) ──
  const refreshSettings = useCallback(async () => {
    if (!supabase) return;
    try {
      setSettings(await getSettings());
      setSettingsLoaded(true);
    } catch {
      setSettings({});
      setSettingsLoaded(true);
    }
  }, []);

  useEffect(() => {
    refreshSettings();
  }, [refreshSettings]);

  // Dynamic favicon from storage when configured
  useEffect(() => {
    if (!settingsLoaded) return;
    const fav = settings['favicon_path'];
    if (fav && supabase) {
      const url = supabase.storage.from('site-assets').getPublicUrl(fav).data.publicUrl;
      let link = document.querySelector<HTMLLinkElement>("link[rel~='icon']");
      if (!link) {
        link = document.createElement('link');
        link.rel = 'icon';
        document.head.appendChild(link);
      }
      link.href = url;
    }
  }, [settings, settingsLoaded]);

  // ── toasts ──
  const dismissToast = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), []);
  const toast = useCallback(
    (message: string, kind: Toast['kind'] = 'info') => {
      const id = ++toastId.current;
      setToasts((t) => [...t.slice(-3), { id, kind, message }]);
      setTimeout(() => dismissToast(id), 5000);
    },
    [dismissToast],
  );

  // ── favorites (DB when signed in, localStorage mirror otherwise) ──
  useEffect(() => {
    (async () => {
      if (!supabase) return;
      if (user) {
        try {
          setFav(await getMyFavorites());
        } catch {
          setFav(loadJson<FavoritesData>(FAV_KEY, { bikes: [], used: [], comparisons: [] }));
        }
      } else {
        setFav(loadJson<FavoritesData>(FAV_KEY, { bikes: [], used: [], comparisons: [] }));
      }
      setFavLoaded(true);
    })();
  }, [user?.id]);

  const hasFav = useCallback(
    (type: 'bike' | 'used_bike' | 'comparison', id: string) => (fav[type === 'bike' ? 'bikes' : type === 'used_bike' ? 'used' : 'comparisons'] || []).includes(id),
    [fav],
  );

  const toggleFav = useCallback(
    (type: 'bike' | 'used_bike' | 'comparison', id: string) => {
      if (!user) {
        // local-only mode for guests
        const key = type === 'bike' ? 'bikes' : type === 'used_bike' ? 'used' : 'comparisons';
        setFav((f) => {
          const list = f[key] || [];
          const on = list.includes(id);
          const next = { ...f, [key]: on ? list.filter((x) => x !== id) : [...list, id] };
          localStorage.setItem(FAV_KEY, JSON.stringify(next));
          return next;
        });
        toast('Signed-in users keep saved items across devices. Login to keep your list safe.', 'info');
        return;
      }
      const key = type === 'bike' ? 'bikes' : type === 'used_bike' ? 'used' : 'comparisons';
      const turningOn = !(fav[key] || []).includes(id);
      setFav((f) => {
        const list = f[key] || [];
        const next = { ...f, [key]: turningOn ? [...list, id] : list.filter((x) => x !== id) };
        localStorage.setItem(FAV_KEY, JSON.stringify(next));
        return next;
      });
      toggleFavoriteDb(type, id, turningOn)
        .then(() => toast(turningOn ? 'Saved to your favorites' : 'Removed from favorites', 'success'))
        .catch((e) => toast(e.message || 'Could not update favorites', 'error'));
    },
    [user, fav, toast],
  );

  // ── compare tray (max 4) ──
  const hasCompare = useCallback((id: string) => compareIds.includes(id), [compareIds]);
  const addCompare = useCallback(
    (id: string) => {
      setCompareIds((ids) => {
        if (ids.includes(id)) return ids;
        if (ids.length >= 4) {
          toast('You can compare up to 4 bikes. Remove one to add another.', 'error');
          return ids;
        }
        const next = [...ids, id];
        localStorage.setItem(CMP_KEY, JSON.stringify(next));
        toast('Added to compare', 'success');
        return next;
      });
    },
    [toast],
  );
  const removeCompare = useCallback((id: string) => {
    setCompareIds((ids) => {
      const next = ids.filter((x) => x !== id);
      localStorage.setItem(CMP_KEY, JSON.stringify(next));
      return next;
    });
  }, []);
  const clearCompare = useCallback(() => {
    setCompareIds([]);
    localStorage.setItem(CMP_KEY, '[]');
  }, []);

  // ── notifications (count + realtime toast) ──
  const refreshNotifCount = useCallback(async () => {
    if (!supabase || !user) {
      setUnreadNotifs(0);
      return;
    }
    try {
      const rows = await myNotifications();
      setUnreadNotifs(rows.filter((n) => !n.is_read).length);
    } catch {
      /* non-fatal */
    }
  }, [user]);

  useEffect(() => {
    refreshNotifCount();
  }, [refreshNotifCount]);

  useEffect(() => {
    if (!supabase || !user) return;
    const chan = supabase
      .channel('notif-channel')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` },
        (payload) => {
          const n = payload.new as any;
          toast(`${n.title || 'New notification'}`, 'info');
          refreshNotifCount();
        },
      )
      .subscribe();
    return () => {
      supabase && supabase.removeChannel(chan);
    };
  }, [user, toast, refreshNotifCount]);

  const role = profile?.role || 'user';
  const isAdmin = role === 'admin';
  const isDealer = role === 'dealer' || isAdmin;

  const value = useMemo<AppCtx>(
    () => ({
      session, user, profile, authLoading, isAuthed, isAdmin, isDealer, role,
      settings, settingsLoaded, refreshSettings, refreshProfile,
      toasts, toast, dismissToast,
      fav, favLoaded, hasFav, toggleFav,
      compareIds, hasCompare, addCompare, removeCompare, clearCompare,
      unreadNotifs, refreshNotifCount,
    }),
    [session, user, profile, authLoading, settings, settingsLoaded, refreshSettings, refreshProfile, toasts, toast, dismissToast, fav, favLoaded, hasFav, toggleFav, compareIds, hasCompare, addCompare, removeCompare, clearCompare, unreadNotifs, refreshNotifCount, isAdmin, isDealer, role],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp(): AppCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useApp must be used inside AppProvider');
  return ctx;
}

export function useRequireAuth() {
  const { isAuthed, authLoading } = useApp();
  const navigate = useNavigate();
  return {
    isAuthed,
    authLoading,
    login: (redirect = '/account') => navigate(`/login?redirect=${encodeURIComponent(redirect)}`),
  };
}
