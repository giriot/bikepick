/**
 * Gemini API key pool + model fallback lists.
 *
 * Keys: the site can carry several keys — GEMINI_API_KEY, GEMINI_API_KEY_2,
 * GEMINI_API_KEY_3 — and (NEW) a single comma-separated GEMINI_API_KEYS var
 * for convenience. When one key hits its rate limit (429) the caller
 * automatically fails over to the next key.
 *
 * Models: Google retires Gemini models on a rolling schedule (e.g. the whole
 * gemini-2.0-flash family was shut down in mid-2026). So instead of a single
 * model name we carry an ORDERED list — the configured model first, then a
 * list of current models — and the caller walks the list when a model comes
 * back 404 / "not found" / "no longer available". This means a Google model
 * deprecation no longer bricks the admin AI tools.
 */

/** All configured Gemini keys, in order, de-duplicated. */
export function geminiKeys(): string[] {
  const keys: string[] = [];
  const csv = process.env.GEMINI_API_KEYS;
  if (csv && csv.trim()) {
    for (const part of csv.split(',')) {
      const k = part.trim();
      if (k) keys.push(k);
    }
  }
  for (const v of [process.env.GEMINI_API_KEY, process.env.GEMINI_API_KEY_2, process.env.GEMINI_API_KEY_3]) {
    if (v && v.trim()) keys.push(v.trim());
  }
  return [...new Set(keys)];
}

function dedupe(list: string[]): string[] {
  return [...new Set(list.map((s) => s.trim()).filter(Boolean))];
}

/**
 * Ordered Gemini TEXT model candidates. The configured GEMINI_MODEL (if any)
 * is tried first, then the current GA Flash models newest-first. If a model
 * is 404/“not found”/deprecated the next one is tried automatically.
 */
export function geminiTextModels(): string[] {
  const configured = process.env.GEMINI_MODEL;
  const fallbacks = [
    'gemini-3.8-flash',
    'gemini-3.6-flash',
    'gemini-3.5-flash',
    'gemini-3.1-flash-lite',
  ];
  return dedupe(configured ? [configured, ...fallbacks] : fallbacks);
}

/**
 * Ordered Gemini IMAGE model candidates. The configured GEMINI_IMAGE_MODEL
 * (if any) is tried first, then the current GA native-image models.
 */
export function geminiImageModels(): string[] {
  const configured = process.env.GEMINI_IMAGE_MODEL;
  const fallbacks = [
    'gemini-3.1-flash-image', // Nano Banana 2 (GA)
    'gemini-2.5-flash-image', // Nano Banana (original)
    'gemini-3-pro-image',     // Nano Banana Pro
  ];
  return dedupe(configured ? [configured, ...fallbacks] : fallbacks);
}
