import { Breadcrumbs } from '@/components/ui';
import { LeadDialog } from '@/components/LeadDialog';
import { buildMetadata, breadcrumbJsonLd, JsonLd } from '@/lib/seo';

export const metadata = buildMetadata({
  title: 'Bulk & Fleet Two-Wheeler Purchase Enquiry',
  description: 'Buying five or more two-wheelers for a delivery fleet, campus or corporate pool? Send one enquiry and get quotes from verified dealers.',
  path: '/business/bulk-enquiry',
});

const USE_CASES = [
  { title: 'Last-mile delivery fleets', body: 'EV scooters with swap or charge infrastructure, priced per unit with an AMC.' },
  { title: 'Corporate and campus pools', body: 'Shared commuters with fleet insurance and a single service contract.' },
  { title: 'Rental and subscription operators', body: 'Volume pricing, staggered delivery and registration support.' },
  { title: 'Government and institutional tenders', body: 'Documentation support and GST invoicing through registered dealers.' },
];

export default function BulkEnquiryPage() {
  const crumbs = [{ name: 'Home', url: '/' }, { name: 'Business', url: '/business/bulk-enquiry' }, { name: 'Bulk enquiry', url: '/business/bulk-enquiry' }];
  return (
    <div className="container-xl py-6">
      <JsonLd data={breadcrumbJsonLd(crumbs)} />
      <Breadcrumbs items={crumbs} />
      <div className="mt-4 grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div>
          <span className="badge bg-brand-50 text-brand-700">For businesses</span>
          <h1 className="mt-3 text-2xl font-bold tracking-[-0.03em] sm:text-[34px]">Buying in volume?</h1>
          <p className="mt-2 max-w-2xl text-[15px] leading-7 text-ink-mute">
            One enquiry, routed to verified dealers who actually handle fleet orders in your city. You get quotes directly —
            we do not mark anything up and we do not sell your details to a list.
          </p>

          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            {USE_CASES.map((u) => (
              <div key={u.title} className="card p-5">
                <p className="text-[14px] font-semibold">{u.title}</p>
                <p className="mt-1 text-[12.5px] leading-5 text-ink-mute">{u.body}</p>
              </div>
            ))}
          </div>

          <h2 className="mt-9 text-[20px] font-bold tracking-[-0.02em]">What happens next</h2>
          <ol className="mt-4 space-y-3">
            {[
              'You submit the requirement — models, quantity, city, timeline.',
              'We match it to dealers who are verified and handle fleet volume.',
              'Dealers contact you directly with quotes. You negotiate with them.',
              'We follow up once to check that someone actually responded.',
            ].map((s, i) => (
              <li key={s} className="flex gap-3">
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-brand-600 text-[11px] font-bold text-white">{i + 1}</span>
                <span className="text-[13.5px] leading-6 text-ink-soft">{s}</span>
              </li>
            ))}
          </ol>
        </div>

        <aside className="lg:sticky lg:top-24 lg:h-max">
          <div className="card p-6">
            <p className="text-[15px] font-semibold">Send your requirement</p>
            <p className="mt-1 text-[12.5px] leading-5 text-ink-mute">Minimum five units. Free, and there is no obligation to buy.</p>
            <div className="mt-4">
              <LeadDialog
                leadType="bulk_purchase" label="Start bulk enquiry"
                title="Bulk / fleet purchase enquiry"
                description="Give us the outline and we route it to dealers who handle volume orders."
                source="business/bulk-enquiry" className="btn-primary w-full"
                extraFields={[
                  { name: 'company', label: 'Company / organisation', required: true },
                  { name: 'quantity', label: 'Units required', type: 'number', required: true },
                  { name: 'models', label: 'Models or segment you have in mind' },
                  { name: 'timeline', label: 'When do you need delivery', type: 'select', options: ['Within 30 days', '1–3 months', '3–6 months', 'Just exploring'] },
                  { name: 'gstin', label: 'GSTIN (optional)' },
                ]}
              />
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
