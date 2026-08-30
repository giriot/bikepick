import Image from 'next/image';
import Link from 'next/link';
import { inr } from '@/lib/format';
import type { ProductCard as Card } from '@/lib/queries';
import { CompareToggle } from './CompareToggle';

export function ProductCard({ p, showCompare = true }: { p: Card; showCompare?: boolean }) {
  const isEv = p.fuel_type === 'electric';
  const href = `/${isEv ? 'electric' : 'bikes'}/${p.brand_slug}/${p.slug}`;
  const range = p.real_world_range_km || p.claimed_range_km;

  return (
    <article className="card card-hover group flex flex-col overflow-hidden">
      <Link href={href} className="product-stage aspect-[8/5] w-full" aria-label={`${p.brand_name} ${p.name}`}>
        <Image
          src={p.image_url || '/media/commuter.svg'}
          alt={p.alt_text || `${p.brand_name} ${p.name} illustration`}
          width={480}
          height={300}
          sizes="(max-width: 640px) 90vw, (max-width: 1024px) 45vw, 300px"
          className="h-full w-full object-contain transition-transform duration-300 group-hover:scale-[1.03]"
          loading="lazy"
        />
        <div className="absolute left-2.5 top-2.5 flex flex-wrap gap-1.5">
          {isEv && <span className="badge-ev">Electric</span>}
          {p.featured === 1 && <span className="badge bg-ink text-white">Featured</span>}
          {p.is_demo === 1 && <span className="badge-demo">Demo data</span>}
        </div>
      </Link>

      <div className="flex flex-1 flex-col p-4">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-mute">{p.brand_name}</p>
        <h3 className="mt-0.5 text-[15px] font-semibold leading-snug">
          <Link href={href} className="hover:text-brand-600">{p.name}</Link>
        </h3>

        <div className="mt-2 flex items-baseline gap-2">
          <span className="text-[17px] font-bold tracking-[-0.02em]">{inr(p.price_min)}</span>
          <span className="text-[11px] text-ink-mute">onwards, ex-showroom</span>
        </div>

        <dl className="mt-3 grid grid-cols-3 gap-2 border-t border-line pt-3 text-center">
          {isEv ? (
            <>
              <Spec label="Range" value={range ? `${Math.round(range)} km` : '—'} />
              <Spec label="Battery" value={p.battery_capacity_kwh ? `${p.battery_capacity_kwh} kWh` : '—'} />
              <Spec label="Score" value={p.score ? `${p.score}` : '—'} />
            </>
          ) : (
            <>
              <Spec label="Engine" value={p.engine_capacity_cc ? `${Math.round(p.engine_capacity_cc)} cc` : '—'} />
              <Spec label="Mileage" value={p.mileage_kmpl ? `${p.mileage_kmpl} kmpl` : '—'} />
              <Spec label="Score" value={p.score ? `${p.score}` : '—'} />
            </>
          )}
        </dl>

        <div className="mt-4 flex items-center gap-2">
          <Link href={href} className="btn-outline btn-sm flex-1">View details</Link>
          {showCompare && <CompareToggle productId={p.id} label={`${p.brand_name} ${p.name}`} />}
        </div>
      </div>
    </article>
  );
}

function Spec({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[10.5px] uppercase tracking-wide text-ink-mute">{label}</dt>
      <dd className="mt-0.5 text-[13px] font-semibold">{value}</dd>
    </div>
  );
}
