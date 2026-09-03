import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { getAdminStats, type AdminStats } from '../../lib/api';
import { Card, ErrorBlock, LoadingBlock, StatCard } from '../../components/ui';

export default function AdminDashboard() {
  const { settings } = useApp();
  const brandName = settings['brand_name'] || 'CompareBike';
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setStats(await getAdminStats());
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) return <LoadingBlock label="Loading dashboard…" />;
  if (error || !stats) return <ErrorBlock message={error || 'Failed to load'} onRetry={load} />;

  const queues: { to: string; label: string; count: number; tone: 'warn' | 'default' }[] = [
    { to: '/admin/dealers', label: 'Dealers waiting', count: stats.dealers_waiting, tone: 'warn' },
    { to: '/admin/used', label: 'Used bikes pending', count: stats.used_pending, tone: 'warn' },
    { to: '/admin/offers', label: 'Offers pending', count: stats.offers_pending, tone: 'warn' },
    { to: '/admin/reviews', label: 'Reviews pending', count: 0, tone: 'default' },
    { to: '/admin/reports', label: 'Open reports', count: stats.reports_open, tone: 'warn' },
  ];

  return (
    <div>
      <h1 className="text-2xl font-black text-ink-900">Dashboard</h1>
      <p className="mb-6 mt-1 text-sm text-ink-500">Everything happening across {brandName} at a glance.</p>

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        {queues.map((q) => (
          <StatCard key={q.to + q.label} label={q.label} value={q.count} to={q.to} tone={q.count > 0 ? 'warn' : 'default'} />
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Total users" value={stats.users} />
        <StatCard label="Total dealers" value={stats.dealers_total} to="/admin/dealers" />
        <StatCard label="Approved dealers" value={stats.dealers_approved} to="/admin/dealers" tone="good" />
        <StatCard label="Pending dealers" value={stats.dealers_waiting} to="/admin/dealers" tone={stats.dealers_waiting > 0 ? 'warn' : 'default'} />
      </div>

      <h2 className="mb-3 mt-8 text-sm font-black uppercase tracking-widest text-ink-400">Bike catalogue</h2>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <StatCard label="Total models" value={stats.models_total} to="/admin/bikes" />
        <StatCard label="Live" value={stats.models_live} to="/admin/bikes" tone="good" />
        <StatCard label="Upcoming" value={stats.models_upcoming} to="/admin/bikes" />
        <StatCard label="Outdated" value={stats.models_outdated} to="/admin/bikes" />
        <StatCard label="Enquiries" value={stats.enquiries_total} to="/admin/enquiries" />
      </div>

      <h2 className="mb-3 mt-8 text-sm font-black uppercase tracking-widest text-ink-400">Marketplace</h2>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <StatCard label="Used bikes (all)" value={stats.used_total} to="/admin/used" />
        <StatCard label="Used pending" value={stats.used_pending} to="/admin/used" tone={stats.used_pending > 0 ? 'warn' : 'default'} />
        <StatCard label="Used approved" value={stats.used_approved} to="/admin/used" tone="good" />
        <StatCard label="Offers pending" value={stats.offers_pending} to="/admin/offers" tone={stats.offers_pending > 0 ? 'warn' : 'default'} />
        <StatCard label="Offers approved" value={stats.offers_approved} to="/admin/offers" tone="good" />
      </div>

      <Card className="mt-8 p-5">
        <h2 className="mb-2 text-lg font-black text-ink-900">Common actions</h2>
        <div className="flex flex-wrap gap-2">
          <Link to="/admin/bikes/new" className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-bold text-white hover:bg-primary-700">+ Add bike model</Link>
          <Link to="/admin/brands" className="rounded-lg border border-ink-300 px-4 py-2 text-sm font-bold text-ink-700 hover:bg-ink-50">Manage brands</Link>
          <Link to="/admin/specs" className="rounded-lg border border-ink-300 px-4 py-2 text-sm font-bold text-ink-700 hover:bg-ink-50">Spec definitions</Link>
          <Link to="/admin/content" className="rounded-lg border border-ink-300 px-4 py-2 text-sm font-bold text-ink-700 hover:bg-ink-50">Content & homepage</Link>
          <Link to="/admin/settings" className="rounded-lg border border-ink-300 px-4 py-2 text-sm font-bold text-ink-700 hover:bg-ink-50">Import / export CSV</Link>
          <Link to="/admin/logs" className="rounded-lg border border-ink-300 px-4 py-2 text-sm font-bold text-ink-700 hover:bg-ink-50">Audit log</Link>
        </div>
      </Card>
    </div>
  );
}
