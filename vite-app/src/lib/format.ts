// ─── Formatting helpers (Indian conventions) ────────────────────────────────

/** ₹92000 → "₹92,000" ; ₹152000 → "₹1.52 Lakh" ; ₹12500000 → "₹1.25 Cr" */
export function inr(n: number | null | undefined): string {
  if (n === null || n === undefined || isNaN(Number(n))) return 'N/A';
  const v = Number(n);
  if (v >= 1_00_00_000) return `₹${(v / 1_00_00_000).toFixed(2).replace(/\.?0+$/, '')} Cr`;
  if (v >= 1_00_000) return `₹${(v / 1_00_000).toFixed(2).replace(/\.?0+$/, '')} Lakh`;
  return `₹${v.toLocaleString('en-IN')}`;
}

export function inrRange(a: number | null | undefined, b: number | null | undefined): string {
  const av = a == null ? null : Number(a);
  const bv = b == null ? null : Number(b);
  if (av == null && bv == null) return 'Price on request';
  if (av == null) return `From ${inr(bv)}`;
  if (bv == null || bv <= av) return `From ${inr(av)}`;
  return `${inr(av)} – ${inr(bv)}`;
}

export function kmpl(n: number | null | undefined): string {
  if (n == null) return 'N/A';
  return `${Number(n)} kmpl`;
}

export function kmRange(n: number | null | undefined): string {
  if (n == null) return 'N/A';
  return `${Number(n)} km`;
}

export function cc(n: number | null | undefined): string {
  if (n == null) return 'N/A';
  return `${Number(n)} cc`;
}

export function formatDate(d: string | null | undefined): string {
  if (!d) return 'N/A';
  try {
    return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return d;
  }
}

export function timeAgo(d: string | null | undefined): string {
  if (!d) return '';
  const s = Math.floor((Date.now() - new Date(d).getTime()) / 1000);
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} hr ago`;
  const days = Math.floor(h / 24);
  if (days < 30) return `${days} day${days > 1 ? 's' : ''} ago`;
  const mo = Math.floor(days / 30);
  if (mo < 12) return `${mo} month${mo > 1 ? 's' : ''} ago`;
  return `${Math.floor(mo / 12)} yr ago`;
}

export function slugify(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '');
}

export function titleCase(s: string | null | undefined): string {
  if (!s) return '';
  return s
    .split(/[_\s-]+/)
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(' ');
}

export function fuelLabel(f: string | null | undefined): string {
  switch (f) {
    case 'petrol':
      return 'Petrol';
    case 'electric':
      return 'Electric';
    case 'cng_petrol':
      return 'CNG + Petrol';
    case 'diesel':
      return 'Diesel';
    default:
      return f ? titleCase(f) : 'N/A';
  }
}

export function fuelShort(f: string | null | undefined): string {
  switch (f) {
    case 'petrol':
      return 'Petrol';
    case 'electric':
      return 'Electric';
    case 'cng_petrol':
      return 'CNG + Petrol';
    case 'diesel':
      return 'Diesel';
    default:
      return 'N/A';
  }
}

export function fileSize(bytes: number | null | undefined): string {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export const FUEL_OPTIONS = [
  { value: 'petrol', label: 'Petrol' },
  { value: 'electric', label: 'Electric' },
  { value: 'cng_petrol', label: 'CNG + Petrol' },
  { value: 'diesel', label: 'Diesel' },
] as const;

export const BODY_TYPES = ['Commuter', 'Standard', 'Sport', 'Cruiser', 'Adventure', 'Scooter-style'];
export const CONDITION_GRADES = [
  { value: 'excellent', label: 'Excellent' },
  { value: 'good', label: 'Good' },
  { value: 'fair', label: 'Fair' },
  { value: 'needs_repair', label: 'Needs repair' },
];

export const REPORT_REASONS = [
  { value: 'fake_listing', label: 'Fake listing' },
  { value: 'fraud', label: 'Fraud' },
  { value: 'wrong_information', label: 'Wrong information' },
  { value: 'duplicate', label: 'Duplicate' },
  { value: 'wrong_price', label: 'Wrong price' },
  { value: 'sold', label: 'Already sold' },
  { value: 'other', label: 'Other' },
];
