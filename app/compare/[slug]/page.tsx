import { notFound, redirect } from 'next/navigation';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

/** Stored comparison permalinks — /compare/yamaha-mt-15-vs-... */
export default async function SavedComparison({ params }: { params: { slug: string } }) {
  const row = await db.get<any>('SELECT * FROM comparisons WHERE slug = ?', [params.slug]);
  if (!row) notFound();
  await db.run('UPDATE comparisons SET view_count = view_count + 1 WHERE id = ?', [row.id]);
  const ids = (JSON.parse(row.product_ids) as string[]).join(',');
  redirect(`/compare?ids=${ids}`);
}
