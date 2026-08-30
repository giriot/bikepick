/** Slug + normalisation helpers powering duplicate detection and fuzzy search. */
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

/**
 * Collapse a brand+model string into a comparison key.
 * "Yamaha MT-15", "MT 15", "mt15" -> "mt15"
 */
export function normalizeKey(...parts: (string | null | undefined)[]): string {
  return parts
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '');
}

/**
 * Tokenised form used for search matching.
 * "MT-15" -> ["mt", "15"] and "150cc" -> ["150cc", "150", "cc"], so a query
 * matches whether the user typed the parts joined or separated.
 */
export function searchTokens(input: string): string[] {
  const lower = input.toLowerCase();
  const raw = lower.split(/[^a-z0-9]+/).filter(Boolean);
  const split = lower
    .replace(/([a-z])(\d)/g, '$1 $2')
    .replace(/(\d)([a-z])/g, '$1 $2')
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
  return [...new Set([...raw, ...split])];
}

/** Levenshtein distance, capped for performance. */
export function editDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > 4) return 99;
  const prev = new Array(b.length + 1).fill(0).map((_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let last = prev[0];
    prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = prev[j];
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, last + (a[i - 1] === b[j - 1] ? 0 : 1));
      last = tmp;
    }
  }
  return prev[b.length];
}

/**
 * Typo-tolerant match. Compares the query against the whole target AND each of
 * its tokens, so "aktiva" still finds "Activa 6G" even though the trailing
 * variant name would otherwise blow the edit-distance budget.
 */
export function fuzzyMatches(query: string, target: string): boolean {
  const q = normalizeKey(query);
  if (!q) return false;
  const tolerance = q.length > 8 ? 2 : q.length > 4 ? 1 : 0;

  const whole = normalizeKey(target);
  if (whole.includes(q)) return true;
  if (editDistance(q, whole) <= tolerance) return true;

  for (const token of searchTokens(target)) {
    const t = normalizeKey(token);
    if (!t) continue;
    if (t.startsWith(q) || q.startsWith(t)) return true;
    if (editDistance(q, t) <= tolerance) return true;
  }
  return false;
}
