import { db } from '@/lib/db';
import { requirePermission } from '@/lib/rbac';
import { AdminHeader, AdminCard } from '@/components/admin/ui';
import { SettingsForm, type SettingRow } from '@/components/admin/SettingsForm';
import { DemoDataPurge } from '@/components/admin/DemoDataPurge';
import { DEFAULT_SETTINGS } from '@/lib/settings-defaults';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Settings · Bikepick Admin', robots: { index: false, follow: false } };

const DEMO_TABLES = [
  ['products', 'products'], ['dealer_profiles', 'dealers'], ['dealer_offers', 'offers'],
  ['used_bikes', 'used listings'], ['service_centres', 'service centres'],
];

export default async function AdminSettings() {
  await requirePermission('*');

  const rows = await db.all<SettingRow>('SELECT key, value, value_type, group_name, label, help_text FROM settings ORDER BY group_name, key');

  // Show a friendly ordering: brand first, system-ish last.
  const order = ['brand', 'general', 'homepage', 'scoring', 'calculators', 'verification', 'dealers', 'revenue', 'monetisation', 'ads', 'notifications', 'seo', 'ai'];
  const settings = rows.sort((a, b) => (order.indexOf(a.group_name) - order.indexOf(b.group_name)) || a.key.localeCompare(b.key));

  const counts: Record<string, number> = {};
  for (const [table, label] of DEMO_TABLES) {
    const r = await db.get<any>(`SELECT COUNT(*) AS c FROM ${table} WHERE is_demo = 1 AND deleted_at IS NULL`);
    counts[label] = r?.c ?? 0;
  }

  const missing = Object.keys(DEFAULT_SETTINGS).filter((k) => !rows.some((r) => r.key === k));

  return (
    <div className="space-y-5">
      <AdminHeader title="Settings"
        subtitle="Everything the platform reads at runtime. Changes take effect immediately — no deployment needed." />

      {missing.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] text-amber-900">
          {missing.length} default setting{missing.length === 1 ? '' : 's'} are not yet in the database. Run
          <code className="mx-1 rounded bg-white px-1.5 py-0.5 font-mono text-[12px]">npm run sync:settings</code> to add them.
        </div>
      )}

      <SettingsForm settings={settings} />

      <div id="demo">
        <AdminCard title="Demo data" subtitle="Demonstration records are labelled publicly and can be removed in one action.">
          <DemoDataPurge counts={counts} />
        </AdminCard>
      </div>

      <AdminCard title="Score integrity" subtitle="A guarantee that is enforced in code, not just policy.">
        <p className="text-[13px] leading-6 text-ink-soft">
          The Bikepick Score is calculated only from published specifications and the weights above. The scoring function
          receives no dealer, subscription, advertising or affiliate data at all — so a paid placement cannot move a score
          even by accident. Weights that do not total 100 are renormalised, and any dimension with missing data is excluded
          and reported as reduced coverage rather than filled with an assumption.
        </p>
      </AdminCard>
    </div>
  );
}
