import { inr } from '@/lib/format';

interface Point { recorded_at: string; price: number; source_name?: string | null; verified?: number }

const RANGES = [
  { key: '7d', label: '7 days', days: 7 }, { key: '30d', label: '30 days', days: 30 },
  { key: '90d', label: '90 days', days: 90 }, { key: '1y', label: '1 year', days: 365 },
];

/**
 * Server-rendered SVG price history. Renders only when enough verified or
 * recorded data points exist — otherwise it explains that instead of drawing
 * an invented line.
 */
export function PriceHistoryChart({ points, range = '1y' }: { points: Point[]; range?: string }) {
  const days = RANGES.find((r) => r.key === range)?.days || 365;
  const cutoff = Date.now() - days * 86400000;
  const data = points
    .filter((p) => new Date(p.recorded_at).getTime() >= cutoff)
    .sort((a, b) => +new Date(a.recorded_at) - +new Date(b.recorded_at));

  if (data.length < 3) {
    return (
      <div className="rounded-xl border border-dashed border-line p-5 text-center">
        <p className="text-sm font-medium text-ink-soft">Not enough price history yet</p>
        <p className="mt-1 text-[13px] text-ink-mute">
          A chart appears once at least three dated price records exist for this period. We do not interpolate or
          estimate historical prices.
        </p>
      </div>
    );
  }

  const w = 640, h = 200, pad = 34;
  const prices = data.map((d) => d.price);
  const min = Math.min(...prices), max = Math.max(...prices);
  const span = max - min || 1;
  const x = (i: number) => pad + (i / (data.length - 1)) * (w - pad * 2);
  const y = (p: number) => h - pad - ((p - min) / span) * (h - pad * 2);
  const path = data.map((d, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(d.price).toFixed(1)}`).join(' ');
  const area = `${path} L${x(data.length - 1).toFixed(1)},${h - pad} L${pad},${h - pad} Z`;
  const change = data[data.length - 1].price - data[0].price;

  return (
    <figure>
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full" role="img" aria-label={`Price history: ${inr(data[0].price)} to ${inr(data[data.length - 1].price)}`}>
        <defs>
          <linearGradient id="ph" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#F0620C" stopOpacity=".22" />
            <stop offset="100%" stopColor="#F0620C" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0, 0.5, 1].map((f) => (
          <g key={f}>
            <line x1={pad} x2={w - pad} y1={pad + f * (h - pad * 2)} y2={pad + f * (h - pad * 2)} stroke="#E7EBF0" strokeWidth="1" />
            <text x={4} y={pad + f * (h - pad * 2) + 4} fontSize="10" fill="#8C96A6">{inr(max - f * span, { compact: true })}</text>
          </g>
        ))}
        <path d={area} fill="url(#ph)" />
        <path d={path} fill="none" stroke="#F0620C" strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round" />
        <circle cx={x(data.length - 1)} cy={y(data[data.length - 1].price)} r="4" fill="#F0620C" stroke="#fff" strokeWidth="2" />
        <text x={pad} y={h - 8} fontSize="10" fill="#8C96A6">{new Date(data[0].recorded_at).toLocaleDateString('en-IN', { month: 'short', year: '2-digit' })}</text>
        <text x={w - pad} y={h - 8} fontSize="10" fill="#8C96A6" textAnchor="end">{new Date(data[data.length - 1].recorded_at).toLocaleDateString('en-IN', { month: 'short', year: '2-digit' })}</text>
      </svg>
      <figcaption className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-ink-mute">
        <span>{data.length} recorded price points</span>
        <span className={change > 0 ? 'text-danger' : change < 0 ? 'text-accent-dark' : ''}>
          {change === 0 ? 'No net change' : `${change > 0 ? '▲' : '▼'} ${inr(Math.abs(change))} over the period`}
        </span>
        <span>Source: {data[data.length - 1].source_name || 'recorded price entries'}</span>
      </figcaption>
    </figure>
  );
}

export function PriceHistoryRanges({ active }: { active: string }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {RANGES.map((r) => (
        <a key={r.key} href={`?range=${r.key}#price-history`} className={`chip !py-1 !text-xs ${active === r.key ? 'chip-active' : ''}`}>{r.label}</a>
      ))}
    </div>
  );
}
