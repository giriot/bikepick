export function inr(value: number | null | undefined, opts: { compact?: boolean } = {}): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  if (opts.compact) {
    if (value >= 1_00_00_000) return `₹${(value / 1_00_00_000).toFixed(2).replace(/\.00$/, '')} Cr`;
    if (value >= 1_00_000) return `₹${(value / 1_00_000).toFixed(2).replace(/\.00$/, '')} L`;
    if (value >= 1_000) return `₹${Math.round(value / 1000)}k`;
  }
  return `₹${Math.round(value).toLocaleString('en-IN')}`;
}

/**
 * Parse a stored `product_ids` value into a clean string[] of ids.
 *
 * The comparisons / saved_comparisons tables contain both shapes:
 *   - JSON arrays      → '["prd_1","prd_2"]'  (seed / app writes)
 *   - comma lists      → 'prd_1,prd_2'        (admin UI writes)
 *
 * This never throws — invalid JSON falls back to a comma split, and
 * malformed rows simply yield an empty (or partial) list so a single
 * bad row can never take down a whole page.
 */
export function parseProductIds(raw: string | null | undefined): string[] {
  const s = (raw ?? '').trim();
  if (!s) return [];
  if (s.startsWith('[')) {
    try {
      const arr = JSON.parse(s);
      if (Array.isArray(arr)) return arr.map((x) => String(x).trim()).filter(Boolean);
    } catch {
      /* not real JSON — fall through to comma split */
    }
  }
  return s.split(',').map((x) => x.trim()).filter(Boolean);
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

/**
 * Join brand + model without repeating the brand.
 * Some rows store the brand inside `products.name` ("Honda Activa E",
 * "TVS Raider 125", "Royal Enfield Hunter 350"), so a naive
 * `${brand} ${name}` becomes "Honda Honda Activa E".
 *
 * Use this everywhere the public UI shows "Brand Model".
 * The model-only form (card title under a brand label, H1 on the model
 * page) should use `modelDisplayName` instead.
 */
export function displayName(brand: string | null | undefined, name: string | null | undefined): string {
  const b = (brand || '').trim();
  const n = (name || '').trim();
  if (!b) return n;
  if (!n) return b;
  if (n.toLowerCase().startsWith(b.toLowerCase())) {
    const rest = n.slice(b.length).replace(/^[\s-]+/, '');
    return rest ? `${b} ${rest}` : n;
  }
  return `${b} ${n}`;
}

/** Model name with a leading brand stripped — for H1 / card title under a brand label. */
export function modelDisplayName(brand: string | null | undefined, name: string | null | undefined): string {
  const b = (brand || '').trim();
  const n = (name || '').trim();
  if (!n) return '';
  if (b && n.toLowerCase().startsWith(b.toLowerCase())) {
    const rest = n.slice(b.length).replace(/^[\s-]+/, '');
    return rest || n;
  }
  return n;
}

/**
 * Canonical model name for storage in `products.name`.
 * Always store the model WITHOUT the brand prefix so
 *   brand.label + " " + products.name  never doubles up.
 * CSV / AI may send "Hero Xtreme 125R" — this returns "Xtreme 125R".
 */
export function cleanModelName(brand: string | null | undefined, name: string | null | undefined): string {
  return modelDisplayName(brand, name) || (name || '').trim();
}

/** Parse a stored text field into a clean string array.
 *  Handles: real JSON arrays, JSON strings, the literal 'null' (form bug), and plain newline text. */
export function toStrArray(v: unknown): string[] {
  if (v == null || v === '') return [];
  if (Array.isArray(v)) return v.map((x) => String(x).trim()).filter(Boolean);
  const s = String(v).trim();
  if (s === 'null' || s === 'NULL' || s === 'undefined') return [];
  if (s.startsWith('[')) {
    try {
      const p = JSON.parse(s);
      return Array.isArray(p) ? p.map((x) => String(x).trim()).filter(Boolean) : [];
    } catch { /* fall through to line-split */ }
  }
  return s.split('\n').map((x) => x.trim().replace(/^[-•*]\s*/, '')).filter(Boolean);
}
