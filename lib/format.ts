export function inr(value: number | null | undefined, opts: { compact?: boolean } = {}): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  if (opts.compact) {
    if (value >= 1_00_00_000) return `₹${(value / 1_00_00_000).toFixed(2).replace(/\.00$/, '')} Cr`;
    if (value >= 1_00_000) return `₹${(value / 1_00_000).toFixed(2).replace(/\.00$/, '')} L`;
    if (value >= 1_000) return `₹${Math.round(value / 1000)}k`;
  }
  return `₹${Math.round(value).toLocaleString('en-IN')}`;
}

export function num(value: number | null | undefined, unit = '', digits = 1): string {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '—';
  const n = Number(value);
  const s = Number.isInteger(n) ? String(n) : n.toFixed(digits);
  return unit ? `${s} ${unit}` : s;
}

export function yesNo(value: any): string {
  if (value === null || value === undefined || value === '') return '—';
  return value === 1 || value === true ? 'Yes' : 'No';
}

export function dateIn(value: string | null | undefined): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function relative(value: string | null | undefined): string {
  if (!value) return '—';
  const diff = Date.now() - new Date(value).getTime();
  const days = Math.floor(diff / 86400000);
  if (days < 1) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 30) return `${days} days ago`;
  if (days < 365) return `${Math.floor(days / 30)} months ago`;
  return `${Math.floor(days / 365)} years ago`;
}

export function titleCase(s: string): string {
  return s.replace(/[_-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}
