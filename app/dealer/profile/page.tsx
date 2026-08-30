import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { relative, titleCase } from '@/lib/format';
import { DealerProfileForm } from '@/components/DealerProfileForm';
import { DocumentUpload } from '@/components/DocumentUpload';
import { buildMetadata } from '@/lib/seo';

export const dynamic = 'force-dynamic';
export const metadata = buildMetadata({ title: 'Business profile', description: 'Manage your dealership profile.', path: '/dealer/profile', robots: 'noindex,nofollow' });

export default async function DealerProfilePage() {
  const user = await requireUser();
  const dealer = await db.get<any>('SELECT * FROM dealer_profiles WHERE user_id = ? AND deleted_at IS NULL', [user.id]);
  if (!dealer) redirect('/dealer/register');

  const [brands, docs] = await Promise.all([
    db.all<any>('SELECT id, name FROM brands WHERE deleted_at IS NULL ORDER BY name'),
    db.all<any>('SELECT * FROM dealer_documents WHERE dealer_id = ? ORDER BY created_at DESC', [dealer.id]),
  ]);

  return (
    <div className="space-y-4">
      <div className="card p-5">
        <h2 className="text-[15px] font-semibold">Business profile</h2>
        <p className="mt-1 text-[12.5px] text-ink-mute">This is what buyers see next to your offers.</p>
        <div className="mt-4"><DealerProfileForm dealer={dealer} allBrands={brands} /></div>
      </div>

      <div className="card p-5">
        <h2 className="text-[15px] font-semibold">Verification documents</h2>
        <p className="mt-1 text-[12.5px] text-ink-mute">
          {dealer.status === 'verified'
            ? 'Your dealership is verified. Upload updated documents whenever a licence is renewed.'
            : 'Upload these to speed up verification: GST certificate, trade licence and address proof.'}
        </p>

        {docs.length > 0 && (
          <ul className="mt-4 divide-y divide-line rounded-xl border border-line">
            {docs.map((d) => (
              <li key={d.id} className="flex items-center justify-between gap-3 px-3.5 py-2.5">
                <div>
                  <p className="text-[13px] font-medium">{titleCase(d.doc_type.replace(/_/g, ' '))}</p>
                  <p className="text-[11.5px] text-ink-mute">Uploaded {relative(d.created_at)} · stored privately</p>
                </div>
                <span className={`badge ${d.status === 'approved' ? 'bg-emerald-50 text-emerald-700' : d.status === 'rejected' ? 'bg-rose-50 text-rose-700' : 'bg-warn-soft text-[#8A5B00]'}`}>{d.status}</span>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-4 border-t border-line pt-4"><DocumentUpload /></div>
      </div>
    </div>
  );
}
