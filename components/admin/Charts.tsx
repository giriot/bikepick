import type { SeriesPoint } from '@/lib/analytics';

/** Dependency-free inline SVG bar chart — renders identically in the sandboxed preview. */
export function BarChart({ data, format, height = 120, tone = '#F0620C' }: {
  data: SeriesPoint[]; format?: (n: number) => string; height?: number; tone?: string;
}) {
  const max = Math.max(1, ...data.map((d) => d.value));
  const total = data.reduce((a, b) => a + b.value, 0);
  if (total === 0) {
    return <p className="py-8 text-center text-[12.5px] text-ink-mute">No activity in this period yet.</p>;
  }
  const w = 100 / data.length;
  return (
    <div>
      <svg viewBox={`0 0 100 ${height}`} preserveAspectRatio="none" className="w-full" style={{ height }} role="img"
        aria-label={`Chart of ${data.length} daily values, total ${total}`}>
        {data.map((d, i) => {
          const h = (d.value / max) * (height - 8);
          return (
            <rect key={d.label} x={i * w + w * 0.15} y={height - h} width={w * 0.7} height={h}
              rx={Math.min(1.2, w * 0.3)} fill={tone} opacity={d.value === 0 ? 0.15 : 0.85}>
              <title>{`${d.label}: ${format ? format(d.value) : d.value}`}</title>
            </rect>
          );
        })}
      </svg>
      <div className="mt-1.5 flex justify-between text-[10.5px] text-ink-mute">
        <span>{data[0]?.label}</span>
        <span>{format ? format(total) : total} total</span>
        <span>{data[data.length - 1]?.label}</span>
      </div>
    </div>
  );
}

export function BreakdownBars({ rows, format }: { rows: { label: string; value: number }[]; format?: (n: number) => string }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  if (rows.length === 0) return <p className="py-4 text-[12.5px] text-ink-mute">Nothing recorded yet.</p>;
  return (
    <ul className="space-y-2">
      {rows.map((r) => (
        <li key={r.label}>
          <div className="flex items-baseline justify-between text-[12.5px]">
            <span className="font-medium capitalize">{r.label.replace(/_/g, ' ')}</span>
            <span className="tabular-nums text-ink-mute">{format ? format(r.value) : r.value}</span>
          </div>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface">
            <div className="h-full rounded-full bg-brand-500" style={{ width: `${(r.value / max) * 100}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}
