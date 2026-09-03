import React, { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { getUsedBike, getUsedImages, getUsedDocs, signedImageUrl, type UsedBikeDocumentRaw } from '../lib/api';
import type {UsedBike} from '../lib/types';
import { inr, fuelShort, titleCase, formatDate, fileSize } from '../lib/format';
import { useSEO, breadcrumbJsonLd } from '../lib/seo';
import { Button, Card, EmptyState, ErrorBlock, LoadingBlock, VerifiedBadge, Badge } from '../components/ui';
import EnquiryModal from '../components/EnquiryModal';
import ReportModal from '../components/ReportModal';

type ImgRow = { id: string; url: string; is_primary: boolean; sort_order: number };

export default function UsedBikeDetail() {
  const { id } = useParams<{ id: string }>();
  const { isAuthed, profile, hasFav, toggleFav, isAdmin } = useApp();
  const [bike, setBike] = useState<UsedBike | null>(null);
  const [images, setImages] = useState<ImgRow[]>([]);
  const [docs, setDocs] = useState<UsedBikeDocumentRaw[]>([]);
  const [main, setMain] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [enquiryOpen, setEnquiryOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [viewDocs, setViewDocs] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setNotFound(false);
    try {
      const b = await getUsedBike(id!);
      if (!b) {
        setNotFound(true);
        return;
      }
      setBike(b);
      const imgs = await getUsedImages(id!);
      setImages(imgs as ImgRow[]);
      const first = imgs.find((i: any) => i.is_primary) || imgs[0];
      if (first) setMain((first as any).url);
      getUsedDocs(id!).then(setDocs).catch(() => setDocs([]));
      if (location.hash === '#contact') setTimeout(() => setEnquiryOpen(true), 300);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  useSEO(
    bike
      ? {
          title: `${bike.year || 'Used'} ${bike.model_name} for ${inr(bike.price)}${bike.city ? ` in ${bike.city}` : ''} | CompareBike`,
          description: `${bike.year || ''} ${bike.model_name}${bike.km_driven ? ` with ${bike.km_driven} km` : ''} for sale${bike.city ? ` in ${bike.city}, ${bike.state || 'India'}` : ''}. ${bike.is_verified_listing ? 'Verified listing with checked documents.' : ''}`,
          jsonLd: breadcrumbJsonLd([
            { name: 'Home', url: '/' },
            { name: 'Used Bikes', url: '/used-bikes' },
            { name: bike.model_name, url: `/used-bikes/${bike.id}` },
          ]),
        }
      : { title: 'Loading…' },
  );

  if (loading) return <LoadingBlock label="Loading listing…" />;
  if (error) return <ErrorBlock message={error} onRetry={load} />;
  if (notFound || !bike) {
    return (
      <div className="container-x py-16">
        <EmptyState title="Listing not found" desc="This used bike may have been removed or sold." action={<Link to="/used-bikes" className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-bold text-white">Browse used bikes</Link>} />
      </div>
    );
  }

  const saved = hasFav('used_bike', bike.id);
  const verifiedDocs = docs.filter((d) => d.is_verified).length;
  const isOwner = profile?.id === bike.user_id;
  const isDealerSeller = Boolean(bike.dealer_name);

  return (
    <div className="container-x py-6 md:py-8">
      <nav className="mb-4 text-xs text-ink-400">
        <Link to="/" className="hover:text-primary-600">Home</Link><span className="mx-1.5">/</span>
        <Link to="/used-bikes" className="hover:text-primary-600">Used Bikes</Link><span className="mx-1.5">/</span>
        <span className="font-semibold text-ink-700">{bike.model_name}</span>
      </nav>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Gallery */}
        <div className="lg:col-span-2">
          <div className="card overflow-hidden">
            <div className="relative aspect-[16/10] bg-ink-100">
              {main ? (
                <img src={main} alt={`${bike.year || ''} ${bike.model_name}`} className="h-full w-full object-cover" />
              ) : (
                <span className="flex h-full items-center justify-center text-ink-300"><svg className="h-20 w-20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="5" width="18" height="14" rx="2" /><circle cx="12" cy="12" r="3.5" /></svg></span>
              )}
              <div className="absolute left-3 top-3 flex gap-2">
                {bike.is_verified_listing && <VerifiedBadge label="Verified Listing" />}
                {isDealerSeller && <VerifiedBadge label="Verified Dealer" />}
              </div>
            </div>
            {images.length > 1 && (
              <div className="no-scrollbar flex gap-2 overflow-x-auto border-t border-ink-100 p-3">
                {images.map((img) => (
                  <button key={img.id} onClick={() => setMain(img.url)} className={`h-16 w-24 shrink-0 overflow-hidden rounded-lg border-2 ${main === img.url ? 'border-primary-500' : 'border-transparent'}`}>
                    <img src={img.url} alt="" className="h-full w-full object-cover" loading="lazy" />
                  </button>
                ))}
              </div>
            )}
            <p className="border-t border-ink-100 px-4 py-2 text-xs text-ink-400">
              {images.length} photo{images.length > 1 ? 's' : ''} {images.length < 5 ? '(minimum 5 required for approval)' : '· meets the 5-photo minimum'}
            </p>
          </div>

          {/* Description */}
          <Card className="mt-4 p-5">
            <h2 className="mb-2 text-lg font-black text-ink-900">Description</h2>
            <p className="whitespace-pre-line text-sm leading-relaxed text-ink-600">{bike.description || 'No description provided by the seller.'}</p>
          </Card>

          {/* Seller + docs */}
          <Card className="mt-4 p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-black text-ink-900">
                  {isDealerSeller ? `Sold by ${bike.dealer_name}` : 'Seller'}
                </h2>
                <p className="text-sm text-ink-500">
                  {isDealerSeller ? `Verified dealer · ${bike.city || 'India'}` : bike.seller_name ? bike.seller_name : 'Individual seller'} · listing posted {formatDate(bike.created_at)}
                </p>
              </div>
              <div className="flex flex-col items-end gap-1 text-right text-xs text-ink-500">
                <span>{bike.doc_count ?? docs.length} proof document{(bike.doc_count ?? docs.length) === 1 ? '' : 's'} submitted</span>
                {bike.is_verified_listing && verifiedDocs > 0 && <span className="font-bold text-emerald-600">✓ {verifiedDocs} verified by admin</span>}
              </div>
            </div>
            <p className="mt-3 rounded-lg bg-sky-50 p-3 text-xs leading-relaxed text-sky-800">
              <strong>Privacy:</strong> proof documents (RC, insurance, identity) are stored privately. {isAdmin ? 'As admin, you can' : (isOwner ? 'As the seller, you can' : 'Only the seller and site admins can')} view them below. The seller's phone number is never shown publicly — use the enquiry form.
            </p>
            {(isAdmin || isOwner) && docs.length > 0 && (
              <div className="mt-3">
                <Button size="sm" variant="outline" onClick={() => setViewDocs(true)}>View proof documents ({docs.length})</Button>
              </div>
            )}
            <div id="contact" className="mt-4 flex flex-wrap gap-2 scroll-mt-24">
              <Button onClick={() => setEnquiryOpen(true)}>Contact Seller / Get Offer</Button>
              <Button variant="outline" onClick={() => toggleFav('used_bike', bike.id)}>{saved ? '♥ Saved' : '♡ Save'}</Button>
              <Button variant="ghost" className="!text-red-600" onClick={() => setReportOpen(true)}>Report</Button>
            </div>
          </Card>
        </div>

        {/* Facts + CTA */}
        <div className="space-y-4">
          <Card className="p-5">
            <p className="text-xs font-bold uppercase tracking-widest text-ink-400">Price</p>
            <p className="mt-1 text-3xl font-black text-ink-900">{inr(bike.price)}</p>
            <p className="mt-1 text-xs text-ink-400">Negotiable with valid exchange, usually.</p>
            <dl className="mt-4 space-y-2.5 border-t border-ink-100 pt-4 text-sm">
              <Row label="Brand" value={bike.brand_name || 'N/A'} />
              <Row label="Model" value={`${bike.model_name}${bike.variant_name ? ` (${bike.variant_name})` : ''}`} />
              <Row label="Year" value={bike.year ? String(bike.year) : 'N/A'} />
              <Row label="Fuel" value={bike.fuel_type ? fuelShort(bike.fuel_type) : 'N/A'} />
              <Row label="KM driven" value={bike.km_driven != null ? `${bike.km_driven.toLocaleString('en-IN')} km` : 'N/A'} />
              <Row label="Condition" value={bike.condition_grade ? titleCase(bike.condition_grade) : 'N/A'} />
              <Row label="Owners" value={bike.owner_count ? String(bike.owner_count) : 'N/A'} />
              <Row label="Registration" value={bike.registration_number || 'Provided privately'} />
              <Row label="Insurance" value={bike.has_insurance ? 'Valid' : 'N/A'} />
              <Row label="Service history" value={bike.service_history ? 'Yes' : 'N/A'} />
              <Row label="Accident history" value={bike.accident_history ? 'Disclosed' : 'None reported'} />
              <Row label="Location" value={[bike.area, bike.city, bike.state].filter(Boolean).join(', ') || 'India'} />
            </dl>
          </Card>

          <Card className="p-5">
            <h3 className="mb-2 text-sm font-black text-ink-900">Safety before you buy</h3>
            <ul className="space-y-1.5 text-xs leading-relaxed text-ink-600">
              <li>• Meet in a public place or at the seller's home.</li>
              <li>• Take a mechanic for a pre-purchase inspection.</li>
              <li>• Verify the RC and do a name-transfer check.</li>
              <li>• Never pay advance before physical inspection.</li>
            </ul>
            <Link to="/used-bike-safety" className="mt-3 inline-block text-xs font-bold text-primary-600 hover:underline">Full used-bike safety guide →</Link>
          </Card>
        </div>
      </div>

      <EnquiryModal
        open={enquiryOpen}
        onClose={() => setEnquiryOpen(false)}
        ctx={{
          type: 'contact_seller',
          title: isDealerSeller ? 'Contact this dealer' : 'Contact the seller',
          subject: `You're interested in the ${bike.year || ''} ${bike.model_name} (${inr(bike.price)}) listing.`,
          used_bike_id: bike.id,
          to_user_id: isOwner ? null : bike.user_id,
        }}
      />
      <ReportModal open={reportOpen} onClose={() => setReportOpen(false)} itemType="used_bike" itemId={bike.id} itemLabel={`${bike.year || ''} ${bike.model_name} listing`} />

      {/* Private documents viewer */}
      {viewDocs && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-ink-900/60" onClick={() => setViewDocs(false)} />
          <div className="relative z-10 max-h-[80vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-5 shadow-lift">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-bold">Proof documents (private)</h3>
              <button onClick={() => setViewDocs(false)} className="rounded-lg p-1.5 text-ink-400 hover:bg-ink-100">✕</button>
            </div>
            <p className="mb-4 rounded-lg bg-amber-50 p-3 text-xs text-amber-800">
              🔒 These are private documents. Links are time-limited (10 minutes) and access is logged. Never share them.
            </p>
            <ul className="divide-y divide-ink-100">
              {docs.map((d) => (
                <li key={d.id} className="flex items-center justify-between gap-3 py-3">
                  <div>
                    <p className="text-sm font-semibold text-ink-800">{d.label || titleCase(d.doc_type)}</p>
                    <p className="text-xs text-ink-400">{titleCase(d.doc_type)} · {fileSize(d.file_size)} {d.is_verified ? <span className="ml-1 font-bold text-emerald-600">✓ verified by admin</span> : <span className="ml-1 text-amber-600">(awaiting verification)</span>}</p>
                  </div>
                  <a
                    href="#"
                    onClick={async (e) => {
                      e.preventDefault();
                      const url = await signedImageUrl(d.bucket || 'private-documents', d.storage_path, 600);
                      if (url) window.open(url, '_blank', 'noopener');
                    }}
                    className="shrink-0 rounded-lg border border-ink-300 px-3 py-1.5 text-xs font-bold text-ink-700 hover:bg-ink-50"
                  >
                    View (10 min)
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-ink-500">{label}</dt>
      <dd className={`text-right font-semibold ${value === 'N/A' ? 'text-ink-300' : 'text-ink-900'}`}>{value}</dd>
    </div>
  );
}
