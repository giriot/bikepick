import React, { lazy, Suspense, useEffect } from 'react';
import { BrowserRouter, Navigate, Outlet, Route, Routes, useLocation, useSearchParams } from 'react-router-dom';
import { AppProvider, useApp } from './context/AppContext';
import { isSupabaseConfigured } from './lib/supabase';
import { Spinner } from './components/ui';

// Layouts
import Header from './components/layout/Header';
import Footer from './components/layout/Footer';
import MobileNav from './components/layout/MobileNav';
import CompareTray from './components/CompareTray';
import AdminLayout from './components/layout/AdminLayout';

// Eager: home + core flows
import Home from './pages/Home';
import NewBikes from './pages/NewBikes';
import Compare from './pages/Compare';
import Login from './pages/auth/Login';
import Register from './pages/auth/Register';
import SetupGuide from './pages/SetupGuide';

// Lazy: everything else (code-splitting per route)
const BikeDetail = lazy(() => import('./pages/BikeDetail'));
const UsedBikes = lazy(() => import('./pages/UsedBikes'));
const UsedBikeDetail = lazy(() => import('./pages/UsedBikeDetail'));
const PostUsedBike = lazy(() => import('./pages/PostUsedBike'));
const BrandsPage = lazy(() => import('./pages/Brands'));
const BrandPage = lazy(() => import('./pages/BrandPage'));
const SearchPage = lazy(() => import('./pages/Search'));
const GuidesPage = lazy(() => import('./pages/Guides'));
const GuideDetail = lazy(() => import('./pages/GuideDetail'));
const FaqPage = lazy(() => import('./pages/Faq'));
const AboutPage = lazy(() => import('./pages/About'));
const ContactPage = lazy(() => import('./pages/Contact'));
const LegalPage = lazy(() => import('./pages/Legal'));
const NotFoundPage = lazy(() => import('./pages/NotFound'));
const ForgotPassword = lazy(() => import('./pages/auth/ForgotPassword'));
const ResetPassword = lazy(() => import('./pages/auth/ResetPassword'));
const AccountModule = import('./pages/account/Account');
const AccountLayout = lazy(() => AccountModule.then((m) => ({ default: m.AccountLayout })));
const AccountHome = lazy(() => AccountModule.then((m) => ({ default: m.AccountHome })));
const AccountUsed = lazy(() => AccountModule.then((m) => ({ default: m.AccountUsed })));
const AccountSaved = lazy(() => AccountModule.then((m) => ({ default: m.AccountSaved })));
const AccountEnquiries = lazy(() => AccountModule.then((m) => ({ default: m.AccountEnquiries })));
const AccountNotifications = lazy(() => AccountModule.then((m) => ({ default: m.AccountNotifications })));

const DealerRegister = lazy(() => import('./pages/dealer/DealerRegister'));
const DealerModule = import('./pages/dealer/DealerDashboard');
const DealerLayout = lazy(() => DealerModule.then((m) => ({ default: m.DealerLayout })));
const DealerHome = lazy(() => DealerModule.then((m) => ({ default: m.DealerHome })));
const DealerOffers = lazy(() => DealerModule.then((m) => ({ default: m.DealerOffers })));
const DealerUsed = lazy(() => DealerModule.then((m) => ({ default: m.DealerUsed })));
const DealerEnquiries = lazy(() => DealerModule.then((m) => ({ default: m.DealerEnquiries })));

const AdminLogin = lazy(() => import('./pages/admin/AdminLogin'));
const AdminDashboard = lazy(() => import('./pages/admin/AdminDashboard'));
const AdminBikesModule = import('./pages/admin/AdminBikes');
const AdminBikes = lazy(() => AdminBikesModule.then((m) => ({ default: m.default })));
const AdminBikeNew = lazy(() => AdminBikesModule.then((m) => ({ default: m.AdminBikeNew })));
const BikeManager = lazy(() => import('./pages/admin/BikeManager'));
const AdminBrands = lazy(() => import('./pages/admin/AdminBrands'));
const AdminSpecs = lazy(() => import('./pages/admin/AdminSpecs'));
const AdminDealers = lazy(() => import('./pages/admin/AdminDealers'));
const AdminOffers = lazy(() => import('./pages/admin/AdminOffers'));
const AdminUsedBikes = lazy(() => import('./pages/admin/AdminUsedBikes'));
const AdminReviews = lazy(() => import('./pages/admin/AdminReviews'));
const AdminReports = lazy(() => import('./pages/admin/AdminReports'));
const AdminEnquiries = lazy(() => import('./pages/admin/AdminEnquiries'));
const AdminContent = lazy(() => import('./pages/admin/AdminContent'));
const AdminScores = lazy(() => import('./pages/admin/AdminScores'));
const AdminSettings = lazy(() => import('./pages/admin/AdminSettings'));
const AdminLogs = lazy(() => import('./pages/admin/AdminLogs'));

function Fade({ children }: { children: React.ReactNode }) {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[50vh] items-center justify-center">
          <Spinner className="h-7 w-7 text-primary-600" />
        </div>
      }
    >
      {children}
    </Suspense>
  );
}

/* ─── Guards ──────────────────────────────────────────────────────────────── */

function RequireAuth() {
  const { isAuthed, authLoading } = useApp();
  const { pathname, search } = useLocation();
  if (authLoading)
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner className="h-8 w-8 text-primary-600" />
      </div>
    );
  if (!isAuthed) return <Navigate to={`/login?redirect=${encodeURIComponent(pathname + search)}`} replace />;
  return <Outlet />;
}

function RequireAdmin() {
  const { isAuthed, authLoading, profile } = useApp();
  if (authLoading)
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner className="h-8 w-8 text-primary-600" />
      </div>
    );
  if (!isAuthed) return <Navigate to="/admin/login" replace />;
  if (profile?.role !== 'admin') return <Navigate to="/admin/login?notadmin=1" replace />;
  return <Outlet />;
}

/* ─── Public shell ────────────────────────────────────────────────────────── */

function PublicLayout() {
  return (
    <div className="flex min-h-screen flex-col bg-ink-50">
      <Header />
      <main className="flex-1">
        <Outlet />
      </main>
      <Footer />
      <MobileNav />
      <CompareTray />
    </div>
  );
}

/** /top-mileage-bikes — same catalogue, mileage sort pinned. */
function TopMileageBikes() {
  const [params, setParams] = useSearchParams();
  useEffect(() => {
    if (params.get('sort') !== 'mileage') {
      const p = new URLSearchParams(params);
      p.set('sort', 'mileage');
      setParams(p, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return <NewBikes />;
}

/* ─── App ─────────────────────────────────────────────────────────────────── */

function AppRoutes() {
  return (
    <Routes>
      {/* Standalone (no public chrome) */}
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/forgot-password" element={<Fade><ForgotPassword /></Fade>} />
      <Route path="/reset-password" element={<Fade><ResetPassword /></Fade>} />

      {/* Admin panel — independent, own login, own shell */}
      <Route path="/admin/login" element={<Fade><AdminLogin /></Fade>} />
      <Route path="/admin" element={<RequireAdmin />}>
        <Route element={<AdminLayout />}>
          <Route index element={<Fade><AdminDashboard /></Fade>} />
          <Route path="bikes" element={<Fade><AdminBikes /></Fade>} />
          <Route path="bikes/new" element={<Fade><AdminBikeNew /></Fade>} />
          <Route path="bikes/:id" element={<Fade><BikeManager /></Fade>} />
          <Route path="brands" element={<Fade><AdminBrands /></Fade>} />
          <Route path="specs" element={<Fade><AdminSpecs /></Fade>} />
          <Route path="dealers" element={<Fade><AdminDealers /></Fade>} />
          <Route path="offers" element={<Fade><AdminOffers /></Fade>} />
          <Route path="used" element={<Fade><AdminUsedBikes /></Fade>} />
          <Route path="reviews" element={<Fade><AdminReviews /></Fade>} />
          <Route path="reports" element={<Fade><AdminReports /></Fade>} />
          <Route path="enquiries" element={<Fade><AdminEnquiries /></Fade>} />
          <Route path="content" element={<Fade><AdminContent /></Fade>} />
          <Route path="scores" element={<Fade><AdminScores /></Fade>} />
          <Route path="settings" element={<Fade><AdminSettings /></Fade>} />
          <Route path="logs" element={<Fade><AdminLogs /></Fade>} />
        </Route>
      </Route>

      {/* Dealer area (auth + dealer role) */}
      <Route element={<RequireAuth />}>
        <Route path="/dealer/register" element={<Fade><DealerRegister /></Fade>} />
        <Route path="/dealer" element={<Fade><DealerLayout /></Fade>}>
          <Route index element={<Fade><DealerHome /></Fade>} />
          <Route path="offers" element={<Fade><DealerOffers /></Fade>} />
          <Route path="used" element={<Fade><DealerUsed /></Fade>} />
          <Route path="enquiries" element={<Fade><DealerEnquiries /></Fade>} />
        </Route>
      </Route>

      {/* Account (auth) */}
      <Route element={<RequireAuth />}>
        <Route path="/account" element={<Fade><AccountLayout /></Fade>}>
          <Route index element={<Fade><AccountHome /></Fade>} />
          <Route path="used" element={<Fade><AccountUsed /></Fade>} />
          <Route path="used/new" element={<Fade><PostUsedBike /></Fade>} />
          <Route path="used/:editId/edit" element={<Fade><PostUsedBike /></Fade>} />
          <Route path="saved" element={<Fade><AccountSaved /></Fade>} />
          <Route path="enquiries" element={<Fade><AccountEnquiries /></Fade>} />
          <Route path="notifications" element={<Fade><AccountNotifications /></Fade>} />
        </Route>
        <Route path="/post-used-bike" element={<Fade><PostUsedBike /></Fade>} />
      </Route>

      {/* Public site */}
      <Route element={<PublicLayout />}>
        <Route index element={<Home />} />
        <Route path="/:fuel" element={<Home />} />
        <Route path="/new-bikes" element={<NewBikes />} />
        <Route path="/new-bikes/:brand/:model" element={<Fade><BikeDetail /></Fade>} />
        <Route path="/upcoming-bikes" element={<NewBikes fixedStatus="upcoming" />} />
        <Route path="/top-mileage-bikes" element={<TopMileageBikes />} />
        <Route path="/used-bikes" element={<Fade><UsedBikes /></Fade>} />
        <Route path="/used-bikes/:id" element={<Fade><UsedBikeDetail /></Fade>} />
        <Route path="/compare" element={<Compare />} />
        <Route path="/brands" element={<Fade><BrandsPage /></Fade>} />
        <Route path="/brands/:slug" element={<Fade><BrandPage /></Fade>} />
        <Route path="/search" element={<Fade><SearchPage /></Fade>} />
        <Route path="/guides" element={<Fade><GuidesPage /></Fade>} />
        <Route path="/guides/:slug" element={<Fade><GuideDetail /></Fade>} />
        <Route path="/faq" element={<Fade><FaqPage /></Fade>} />
        <Route path="/about" element={<Fade><AboutPage /></Fade>} />
        <Route path="/contact" element={<Fade><ContactPage /></Fade>} />
        <Route path="/legal/:slug" element={<Fade><LegalPage /></Fade>} />
        <Route path="*" element={<Fade><NotFoundPage /></Fade>} />
      </Route>
    </Routes>
  );
}

export default function App() {
  // Honest gate: with no Supabase project connected we show setup
  // instructions instead of pretending to have data.
  if (!isSupabaseConfigured) {
    return <SetupGuide />;
  }
  return (
    <BrowserRouter>
      <AppProvider>
        <AppRoutes />
      </AppProvider>
    </BrowserRouter>
  );
}
