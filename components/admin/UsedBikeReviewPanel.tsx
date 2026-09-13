import { db } from '@/lib/db';
import { storage, isStagingKey } from '@/services/storage';
import { relative } from '@/lib/format';
import { UsedBikeChecks } from './UsedBikeChecks';
import { UsedBikeDocuments } from './UsedBikeDocuments';

export async function UsedBikeReviewPanel({ usedBikeId }: { usedBikeId: string }) {
  const [seller, images, documents, checks] = await Promise.all([
    db.get<any>(
      `SELECT u.full_name, u.email, u.phone, u.city, u.state
         FROM used_bikes b JOIN users u ON u.id = b.seller_id
        WHERE b.id = ?`,
      [usedBikeId],
    ),
    db.all<any>(
      'SELECT id, angle, image_url, approved, rejected_reason, created_at FROM used_bike_images WHERE used_bike_id = ? ORDER BY sort_order, created_at',
      [usedBikeId],
    ),
    db.all<any>(
      'SELECT id, doc_type, storage_key, status, note, created_at FROM used_bike_documents WHERE used_bike_id = ? ORDER BY created_at DESC',
      [usedBikeId],
    ),
    db.all<any>(
      "SELECT id, check_type, result, method, evidence_note, performed_at FROM verification_records WHERE entity_type='used_bike' AND entity_id = ? ORDER BY created_at",
      [usedBikeId],
    ),
  ]);

  const store = storage();
  const viewableImages = await Promise.all(images.map(async (image) => ({
    ...image,
    href: isStagingKey(image.image_url)
      ? await store.getSignedUrl('private-docs', image.image_url, 3600).catch(() => null)
      : image.image_url,
  })));
  const viewableDocuments = await Promise.all(documents.map(async (document) => ({
    id: document.id,
    doc_type: document.doc_type,
    status: document.status,
    note: document.note,
    href: await store.getSignedUrl('private-docs', document.storage_key, 3600).catch(() => null),
  })));

  return (
    <section className="mb-5 space-y-4" aria-label="Used-bike review details">
      <section className="rounded-xl border border-line bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 className="text-[14px] font-semibold">Owner details</h2>
            <p className="mt-0.5 text-[12px] text-ink-mute">Use these details for verification and listing notifications. They are never shown to buyers.</p>
          </div>
          {seller?.phone && <a href={`tel:${seller.phone}`} className="btn-outline btn-sm">Call owner</a>}
        </div>
        <dl className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[
            ['Name', seller?.full_name || 'Not recorded'],
            ['Email', seller?.email || 'Not recorded'],
            ['Mobile', seller?.phone || 'Not recorded'],
            ['Location', [seller?.city, seller?.state].filter(Boolean).join(', ') || 'Not recorded'],
          ].map(([label, value]) => (
            <div key={label} className="min-w-0 rounded-xl border border-line bg-surface px-3.5 py-3">
              <dt className="text-[10.5px] uppercase tracking-wide text-ink-mute">{label}</dt>
              <dd className="mt-1 truncate text-[13px] font-semibold" title={value}>{value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <div className="grid gap-4 2xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.65fr)]">
        <section className="rounded-xl border border-line bg-white p-5">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h2 className="text-[14px] font-semibold">Submitted photos</h2>
              <p className="mt-0.5 text-[12px] text-ink-mute">Pre-approval photos stay private. They become public only after approval.</p>
            </div>
            <span className="rounded-full bg-surface px-2.5 py-1 text-[11px] font-medium text-ink-mute">{images.length} files</span>
          </div>
          {viewableImages.length > 0 ? (
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
              {viewableImages.map((image) => (
                <a key={image.id} href={image.href || undefined} target={image.href ? '_blank' : undefined} rel="noreferrer" className="group min-w-0 rounded-xl border border-line bg-surface p-2">
                  <div className="product-stage aspect-[4/3] overflow-hidden rounded-lg">
                    {image.href ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={image.href} alt={`${image.angle} view`} className="h-full w-full object-contain transition group-hover:scale-[1.02]" />
                    ) : <span className="grid h-full place-items-center text-[11px] text-ink-mute">Preview unavailable</span>}
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <span className="truncate text-[11.5px] font-medium capitalize">{image.angle}</span>
                    <span className={`shrink-0 text-[10px] ${image.approved ? 'text-emerald-700' : 'text-ink-mute'}`}>{image.approved ? 'approved' : 'private'}</span>
                  </div>
                </a>
              ))}
            </div>
          ) : (
            <p className="mt-4 rounded-xl border border-dashed border-line bg-surface p-4 text-[12.5px] text-ink-mute">No photos attached.</p>
          )}
        </section>

        <section className="rounded-xl border border-line bg-white p-5">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h2 className="text-[14px] font-semibold">Seller documents</h2>
              <p className="mt-0.5 text-[12px] text-ink-mute">Private files for verification. Never publish these links. If a required document is unavailable, an administrator can use the audited exception after completing the checks and photo review.</p>
            </div>
            <span className="rounded-full bg-surface px-2.5 py-1 text-[11px] font-medium text-ink-mute">{documents.length} files</span>
          </div>
          <div className="mt-4">
            <UsedBikeDocuments initial={viewableDocuments} />
          </div>
        </section>
      </div>

      <section className="rounded-xl border border-line bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 className="text-[14px] font-semibold">Verification checklist</h2>
            <p className="mt-0.5 text-[12px] text-ink-mute">Seller identity, ownership, RC verification and all seven photos are required for publishing. Insurance, loan/NOC status and service history are optional evidence that improves the trust score.</p>
          </div>
          <span className="rounded-full bg-surface px-2.5 py-1 text-[11px] font-medium text-ink-mute">
            {checks.filter((check) => check.result === 'passed').length}/{checks.length} passed
          </span>
        </div>
        <div className="mt-4">
          <UsedBikeChecks initial={checks} />
        </div>
      </section>

      <p className="text-[11.5px] text-ink-mute">
        Uploaded {relative(documents[documents.length - 1]?.created_at || images[0]?.created_at || new Date().toISOString())}. Verification notes should describe the check only — never paste full document numbers.
      </p>
    </section>
  );
}
