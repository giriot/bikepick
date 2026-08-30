import Link from 'next/link';
import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { Empty, Pagination, Stat } from '@/components/ui';
import { LeadRow } from '@/components/LeadRow';
import { buildMetadata } from '@/lib/seo';

export const dynamic = 'force-dynamic';
export const metadata = buildMetadata({ title: 'Leads', description: 'Buyer enquiries sent to your dealership.', path: '/dealer/leads', robots: 'noindex,nofollow' });

const PER = 20;
const TABS = ['all', 'new', 'contacted', 'quoted', 'converted', 'lost'];

export default async function DealerLeads({ searchParams }: { searchParams: { status?: string; page?: string } }) {
  const user = await requireUser();
  const dealer = await db.get<any>('SELECT * FROM dealer_profiles WHERE user_id = ? AND deleted_at IS NULL', [user.id]);
  if (!dealer) redirect('/dealer/register');
  if (dealer.status !== 'verified') redirect('/dealer');

  const status = searchParams.status && TABS.includes(searchParams.status) ? searchParams.status : 'all';
  const page = Math.max(1, Number(searchParams.page) || 1);
  const where = status === 'all' ? 'l.dealer_id = ?' : 'l.dealer_id = ? AND l.status = ?';
  const args = status === 'all' ? [dealer.id] : [dealer.id, status];

  const [rows, count, counts] = await Promise.all([
    db.all<any>(
      `SELECT l.*, p.name AS product_name FROM leads l LEFT JOIN products p ON p.id = l.product_id
        WHERE ${where} ORDER BY l.created_at DESC LIMIT ? OFFSET ?`,
      [...args, PER, (page - 1) * PER],
    ),
    db.get<any>(`SELECT COUNT(*) AS c FROM leads l WHERE ${where}`, args),
    db.all<any>('SELECT status, COUNT(*) AS c FROM leads WHERE dealer_id = ? GROUP BY status', [dealer.id]),
  ]);

  const byStatus: Record<string, number> = Object.fromEntries(counts.map((c: any) => [c.status, c.c]));
  const total = counts.reduce((n: number, c: any) => n + c.c, 0);
  const pages = Math.max(1, Math.ceil((count?.c || 0) / PER));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="All leads" value={String(total)} />
        <Stat label="Awaiting response" value={String(byStatus.new || 0)} />
        <Stat label="Quoted" value={String(byStatus.quoted || 0)} />
        <Stat label="Converted" value={String(byStatus.converted || 0)} />
      </div>

      <nav className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <Link key={t} href={`/dealer/leads${t === 'all' ? '' : `?status=${t}`}`}
            className={`chip ${status === t ? 'chip-active' : ''}`}>
            {t}{t !== 'all' && byStatus[t] ? ` (${byStatus[t]})` : ''}
          </Link>
        ))}
      </nav>

      {rows.length === 0 ? (
        <Empty title="No leads here" body="When a buyer asks for a best price, books a test ride or claims one of your offers, it appears in this list with their phone number." />
      ) : (
        <>
          <ul className="divide-y divide-line rounded-2xl border border-line bg-white">
            {rows.map((l) => <LeadRow key={l.id} lead={l} />)}
          </ul>
          <Pagination page={page} pages={pages} base={`/dealer/leads${status === 'all' ? '' : `?status=${status}`}`} />
        </>
      )}
    </div>
  );
}
