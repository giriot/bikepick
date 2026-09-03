import type { OemPage } from './oem-fetch';
import {
  BIKE_SPEC_KEYS, EV_SPEC_KEYS,
  NUMERIC_BIKE, BOOL_BIKE, NUMERIC_EV, BOOL_EV,
} from './spec-fields';
import { geminiKeys, geminiTextModels } from './ai-keys';

export interface OemVariant { name: string; price?: number | null; on_road_price?: number | null; colours?: string | null; new?: boolean }
export interface OemAiResult {
  provider: string;
  specs: Record<string, any>;
  extras: Record<string, string>;
  variants: OemVariant[];
  warnings: string[];
}

const SPEC_PROMPT = (model: string, brand: string, fuelType: string, keys: readonly string[]) => `You are a strict data-extraction tool. Below is the visible text (and JSON data blocks) captured from the official ${brand} website page for the ${model}.

Extract ONLY values that literally appear in the provided page content. Rules:
1. NEVER use memory, training data, estimates or assumptions. If a value is not present in the page content, OMIT that key entirely.
2. Output strict JSON only (no markdown, no comments) with this shape:
{"specs": { ... }, "extras": { ... }, "variants": [ ... ], "warnings": [ ... ]}
3. "specs" keys may ONLY be: ${keys.join(', ')}.
4. Numbers as JSON numbers (124.8, 7500). Indian price formats: "1,23,456" -> 123456, "1.23 Lakh" -> 123000, "83,910" -> 83910.
5. Units: displacement cc, power bhp (convert "PS"/"kW" only when the page also states the exact equivalent, otherwise leave out), torque Nm, mileage kmpl, lengths mm, weight kg, tank litres, ranges km, charge hours/min.
6. "variants" = trim/variant levels listed on the page: {"name": "…", "price": <ex-showroom ₹ or null>, "on_road_price": <₹ or null>, "colours": "comma,separated or null"}. Only variants whose names actually appear in the page.
7. Boolean-ish specs (cbs, drl, bluetooth, fast_charging, home_charging, portable_charger, regen_braking, usb_charging, keyless_start, cruise_control, hill_hold, reverse_mode, navigation, traction_control) use true only when the page explicitly lists the feature for this model.
8. "warnings": short notes for anything ambiguous or unreadable (e.g. "mileage shown as a range 45–52; used 45").
9. "extras": NEW spec fields the page lists that are NOT in the allowed "specs" keys above — important manufacturer specs only (max 8), each as {"Label as on the page": "value exactly as on the page"}. Only fields with values that literally appear in the page.
10. If the page content does not actually describe the ${model} (wrong model, landing page, blocked page), return {"specs": {}, "extras": {}, "variants": [], "warnings": ["Page does not appear to describe the " + "model specs"]}.

PAGE CONTENT:
%s`;

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/** Fetch with a hard timeout — a hung provider must never eat the whole
 *  serverless budget (60 s); the chain fails over to the next provider. */
async function timeoutFetch(url: string, init: RequestInit, ms: number): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } catch (e: any) {
    if (e?.name === 'AbortError') throw new Error(`timed out after ${Math.round(ms / 1000)}s`);
    throw e;
  } finally {
    clearTimeout(t);
  }
}

/** Configured text providers, in failover order (Gemini, then Abacus, then OpenAI, then Hugging Face). */
function providerChain(): string[] {
  const chain: string[] = [];
  if (geminiKeys().length) chain.push('gemini');
  if (process.env.ABACUS_API_KEY) chain.push('abacus');
  if (process.env.OPENAI_API_KEY) chain.push('openai');
  if (process.env.HF_API_KEY) chain.push('hf');
  return chain;
}

/** Prompt that adapts to what the call can actually do — e.g. only mention
 *  the Google Search tool when the tool is really attached to the request
 *  (mentioning a tool that is absent makes the model emit a malformed
 *  function call → empty response). */
export type PromptBuilder = (opts: { search: boolean }) => string;

/**
 * Run a completion prompt through the AI chain (Gemini → OpenAI → Hugging Face).
 * Returns the first provider that succeeds; throws a combined error otherwise.
 * The whole chain is budgeted to 52s (route maxDuration is 60s) so a slow
 * provider triggers failover instead of killing the request.
 */
export async function aiComplete(prompt: string | PromptBuilder, maxTokens = 8192, useSearch = false): Promise<{ provider: string; text: string }> {
  const chain = providerChain();
  if (!chain.length) throw Object.assign(new Error('No AI key is configured (set GEMINI_API_KEY, ABACUS_API_KEY, OPENAI_API_KEY or HF_API_KEY).'), { code: 'no_key' });
  const deadline = Date.now() + 54_000;
  // First provider gets the big budget; a backup that starts after a fast
  // failure (e.g. a 429 in ~1s) still gets ~40s to actually finish.
  const budgets = [45_000, 40_000, 10_000];
  const errors: string[] = [];
  for (let i = 0; i < chain.length; i++) {
    const p = chain[i];
    const remaining = deadline - Date.now();
    if (remaining < 8_000) break; // not enough budget left for a meaningful attempt
    const budget = Math.min(budgets[i] ?? 15_000, remaining);
    try {
      let text: string;
      try {
        text = await callProviderWithTokens(p, prompt, maxTokens, budget, useSearch);
      } catch (first: any) {
        // A 429 on the free tier is often a per-minute limit — wait 10s and retry once.
        if (p === 'gemini' && /429|quota|resource exhausted/i.test(first?.message || '') && deadline - Date.now() > 25_000) {
          await sleep(10_000);
          text = await callProviderWithTokens(p, prompt, maxTokens, Math.min(budget, deadline - Date.now() - 2_000), useSearch);
        } else {
          throw first;
        }
      }
      if (text && text.trim()) return { provider: p, text: text.trim() };
      throw new Error('empty response');
    } catch (e: any) {
      errors.push(`${p}: ${e?.message || 'failed'}`);
    }
  }
  const msg = `All AI providers failed — ${errors.join(' | ')}`;
  if (/429|quota|resource exhausted|402|credits/i.test(msg)) {
    throw new Error(
      `The AI quota is exhausted right now on every configured provider (free-tier limits). Try again in a few minutes, or add another key (GEMINI_API_KEY_2, ABACUS_API_KEY, OPENAI_API_KEY) to Vercel. Details: ${msg}`,
    );
  }
  throw new Error(msg);
}

async function callProvider(provider: string, prompt: string, timeoutMs = 30_000): Promise<string> {
  if (provider === 'hf') {
    // Hugging Face Inference Providers router (OpenAI-compatible), free-tier text models
    const res = await timeoutFetch('https://router.huggingface.co/v1/chat/completions', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${process.env.HF_API_KEY}` },
      body: JSON.stringify({
        model: process.env.HF_MODEL || 'Qwen/Qwen3.8-27B',
        temperature: 0,
        max_tokens: 4096,
        messages: [{ role: 'user', content: prompt }],
      }),
    }, timeoutMs);
    if (res.status === 429) throw new Error('hf 429 (quota)');
    if (res.status === 402) throw new Error('hf 402 (monthly credits depleted)');
    if (!res.ok) throw new Error(`HF router ${res.status}`);
    const j = await res.json();
    return j?.choices?.[0]?.message?.content || '';
  }
  if (provider === 'openai') {
    const res = await timeoutFetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
        temperature: 0,
        messages: [{ role: 'user', content: prompt }],
      }),
    }, timeoutMs);
    if (!res.ok) throw new Error(`OpenAI API ${res.status}`);
    const j = await res.json();
    return j?.choices?.[0]?.message?.content || '';
  }
  if (provider === 'abacus') {
    const res = await timeoutFetch('https://routellm.abacus.ai/v1/chat/completions', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${process.env.ABACUS_API_KEY}` },
      body: JSON.stringify({
        model: process.env.ABACUS_MODEL || 'route-llm',
        temperature: 0,
        max_tokens: 4096,
        messages: [{ role: 'user', content: prompt }],
      }),
    }, timeoutMs);
    if (res.status === 429) throw new Error('abacus 429 (quota/credits)');
    if (!res.ok) throw new Error(`abacus ${res.status}`);
    const j = await res.json();
    return j?.choices?.[0]?.message?.content || '';
  }
  // Gemini: route through the shared key pool + model fallback so the
  // OEM-extract flow gets the same 429 failover and model-deprecation
  // protection as the template flow (was previously hard-wired to the
  // single GEMINI_API_KEY, which broke failover to GEMINI_API_KEY_2/3).
  return callGemini(() => prompt, 8192, timeoutMs, false);
}

/** Gemini call with optional Google Search grounding — the same live-web
 *  grounding gemini.google.com uses. Without it the model answers from
 *  memory only, which under-counts variants for older/obscure models
 *  (e.g. Honda Shine 100's STD + DX).
 *
 *  Generation-3 models are "thinking" models: their thinking tokens count
 *  against maxOutputTokens, so an uncapped think can eat the whole budget
 *  and return an EMPTY text (the "gemini: empty response" bug). We cap the
 *  thinking budget, and degrade gracefully when the configured model or
 *  key does not support a feature (thinkingConfig / google_search) or the
 *  search quota is exhausted. */
async function callGemini(resolve: (search: boolean) => string, maxTokens: number, timeoutMs: number, useSearch: boolean): Promise<string> {
  const models = geminiTextModels();
  const keys = geminiKeys();
  if (!keys.length) throw Object.assign(new Error('No Gemini API key is configured (set GEMINI_API_KEY, optionally GEMINI_API_KEY_2 / GEMINI_API_KEY_3).'), { code: 'no_key' });
  const bodyFor = (search: boolean, thinking: boolean) => JSON.stringify({
    contents: [{ parts: [{ text: resolve(search) }] }],
    ...(search ? { tools: [{ google_search: {} }] } : {}),
    generationConfig: {
      maxOutputTokens: maxTokens,
      temperature: 0,
      ...(thinking ? { thinkingConfig: { thinkingBudget: 4096 } } : {}),
    },
  });
  const readResp = async (res: Response): Promise<{ text: string; finishReason: string | null }> => {
    const j = await res.json();
    const c = j?.candidates?.[0];
    const text = c?.content?.parts?.map((p: any) => p?.text || '').join('') || '';
    return { text, finishReason: c?.finishReason || null };
  };
  const MODEL_GONE = /not found|does not exist|unsupported|no longer available|deprecated|invalid model|is not supported/i;
  // Walk MODEL × KEY. A deprecated model (404 / "not found") advances to the
  // next model; a rate-limited key (429) advances to the next key — so a
  // Google model shutdown never bricks the admin AI tools.
  const quota: string[] = [];
  const badModels: string[] = [];
  for (const model of models) {
    let modelBad = false;
    for (let ki = 0; ki < keys.length; ki++) {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${keys[ki]}`;
      let search = useSearch;
      let thinking = true;
      let outOfQuota = false;
      for (let attempt = 0; attempt < 3; attempt++) {
        const res = await timeoutFetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: bodyFor(search, thinking) }, timeoutMs);
        if (res.status === 429) {
          if (search) { search = false; continue; } // search grounding has its own quota — degrade to the plain call
          outOfQuota = true;
          break; // this key is exhausted — try the next one
        }
        if (res.status === 400 || res.status === 404) {
          const errText = await res.text().catch(() => '');
          if (search && /tool|google_search/i.test(errText)) { search = false; continue; }
          if (thinking && /thinking/i.test(errText)) { thinking = false; continue; }
          if (res.status === 404 || MODEL_GONE.test(errText)) { modelBad = true; break; } // model retired → next model
          throw new Error(`Gemini ${res.status}: ${errText.slice(0, 180)}`);
        }
        if (!res.ok) throw new Error(`Gemini API ${res.status}`);
        const { text, finishReason } = await readResp(res);
        if (text.trim()) return text;
        // Empty candidate: a broken Google Search grounding returns
        // MALFORMED_FUNCTION_CALL with no text — degrade to the plain call once.
        if (search) { search = false; continue; }
        if (thinking) { thinking = false; continue; }
        throw new Error(`Gemini returned no text (finishReason: ${finishReason || 'none'})`);
      }
      if (modelBad) break;
      if (outOfQuota) { quota.push(`${model} key ${ki + 1}: 429`); continue; }
    }
    if (modelBad) { badModels.push(model); continue; }
  }
  const details = [...badModels.map((m) => `${m}: model unavailable`), ...quota];
  throw new Error(
    `Gemini failed on every configured model and key${details.length ? ` — ${details.join(' | ')}` : ''}. Add another key (GEMINI_API_KEY_2) for automatic failover, or check the GEMINI_MODEL setting.`,
  );
}

/** Like callProvider but with a configurable max token budget (large template outputs)
 *  and a hard timeout so the chain can fail over before the route's 60 s limit. */
async function callProviderWithTokens(provider: string, prompt: string | PromptBuilder, maxTokens: number, timeoutMs = 45_000, useSearch = false): Promise<string> {
  const resolve = (search: boolean) => (typeof prompt === 'function' ? prompt({ search }) : prompt);
  if (provider === 'hf') {
    const p = resolve(false);
    const res = await timeoutFetch('https://router.huggingface.co/v1/chat/completions', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${process.env.HF_API_KEY}` },
      body: JSON.stringify({
        model: process.env.HF_MODEL || 'Qwen/Qwen3.8-27B',
        temperature: 0,
        max_tokens: Math.min(maxTokens, 4096),
        messages: [{ role: 'user', content: p }],
      }),
    }, timeoutMs);
    if (res.status === 429) throw new Error('hf 429 (quota)');
    if (res.status === 402) throw new Error('hf 402 (monthly credits depleted)');
    if (!res.ok) throw new Error(`HF router ${res.status}`);
    const j = await res.json();
    return j?.choices?.[0]?.message?.content || '';
  }
  if (provider === 'openai') {
    const p = resolve(false);
    const res = await timeoutFetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
        temperature: 0,
        max_tokens: maxTokens,
        messages: [{ role: 'user', content: p }],
      }),
    }, timeoutMs);
    if (!res.ok) throw new Error(`OpenAI API ${res.status}`);
    const j = await res.json();
    return j?.choices?.[0]?.message?.content || '';
  }
  if (provider === 'abacus') {
    // Abacus.AI RouteLLM — OpenAI-compatible gateway (ABACUS_MODEL defaults to
    // "route-llm" which auto-picks the best available frontier model). Plain
    // chat only: the prompt must NOT mention a Google Search tool for this
    // provider (mentionSearch=false → the PromptBuilder handles it).
    const p = resolve(false);
    const model = process.env.ABACUS_MODEL || 'route-llm';
    const res = await timeoutFetch('https://routellm.abacus.ai/v1/chat/completions', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${process.env.ABACUS_API_KEY}` },
      body: JSON.stringify({
        model,
        temperature: 0,
        max_tokens: maxTokens,
        messages: [{ role: 'user', content: p }],
      }),
    }, timeoutMs);
    if (res.status === 429) throw new Error('abacus 429 (quota/credits)');
    if (!res.ok) {
      const t = await res.text().catch(() => '');
      throw new Error(`abacus ${res.status} ${t.slice(0, 140)}`);
    }
    const j = await res.json();
    return j?.choices?.[0]?.message?.content || '';
  }
  return callGemini(resolve, maxTokens, timeoutMs, useSearch);
}

/** Sanitise the model's JSON against the whitelist. Blanks/unknowns are dropped —
 *  the admin only ever sees values the AI claims are on the page. */
export function sanitiseOemAi(raw: any, fuelType: string): Pick<OemAiResult, 'specs' | 'extras' | 'variants' | 'warnings'> {
  const isEv = fuelType === 'electric';
  const keys = (isEv ? EV_SPEC_KEYS : BIKE_SPEC_KEYS) as readonly string[];
  const numeric = isEv ? NUMERIC_EV : NUMERIC_BIKE;
  const bools = isEv ? BOOL_EV : BOOL_BIKE;
  const src = (raw && typeof raw === 'object' ? raw : {});
  const specSrc = src.specs && typeof src.specs === 'object' ? src.specs : {};

  const specs: Record<string, any> = {};
  for (const k of keys) {
    let v = specSrc[k];
    if (v === undefined || v === null || v === '' || v === 'N/A' || v === 'null') continue;
    if (numeric.has(k)) {
      const n = Number(String(v).replace(/[^0-9.-]/g, ''));
      if (!Number.isFinite(n) || n <= 0) continue;
      specs[k] = Math.round(n * 100) / 100;
    } else if (bools.has(k)) {
      specs[k] = v === true || v === 1 || /^(yes|true|1|enabled)$/i.test(String(v)) ? 1 : 0;
    } else {
      specs[k] = String(v).trim().slice(0, 300);
    }
  }

  const variants: OemVariant[] = [];
  if (Array.isArray(src.variants)) {
    for (const v of src.variants.slice(0, 12)) {
      if (!v || typeof v !== 'object') continue;
      const name = String(v.name || '').trim().slice(0, 120);
      if (!name) continue;
      const price = v.price === null || v.price === undefined ? null : Number(v.price);
      const onRoad = v.on_road_price === null || v.on_road_price === undefined ? null : Number(v.on_road_price);
      variants.push({
        name,
        price: Number.isFinite(price as number) && (price as number) > 0 ? (price as number) : null,
        on_road_price: Number.isFinite(onRoad as number) && (onRoad as number) > 0 ? (onRoad as number) : null,
        colours: v.colours ? String(v.colours).trim().slice(0, 200) : null,
        new: v.new === true,
      });
    }
  }

  const extras: Record<string, string> = {};
  if (src.extras && typeof src.extras === 'object') {
    for (const [k, v] of Object.entries(src.extras)) {
      const key = String(k).trim().slice(0, 40);
      const val = String(v ?? '').trim().slice(0, 120);
      if (!key || !val || /^(n\/a|na|null|not available|tbd)$/i.test(val)) continue;
      if (key.toLowerCase() === 'n/a') continue;
      if (!Object.keys(extras).some((e) => e.toLowerCase() === key.toLowerCase())) extras[key] = val;
      if (Object.keys(extras).length >= 8) break;
    }
  }

  const warnings = Array.isArray(src.warnings) ? src.warnings.slice(0, 5).map((w: any) => String(w).slice(0, 200)) : [];
  return { specs, extras, variants, warnings };
}

export async function extractOemWithAi(
  page: OemPage,
  model: string,
  brand: string,
  fuelType: string,
): Promise<OemAiResult | { error: string }> {
  const chain = providerChain();
  if (!chain.length) return { error: 'no_key' };

  const isEv = fuelType === 'electric';
  const prompt = SPEC_PROMPT(model, brand, fuelType, isEv ? EV_SPEC_KEYS : BIKE_SPEC_KEYS)
    .replace('%s', page.text)
    + (page.json.length ? `\n\nSTRUCTURED DATA BLOCKS FROM THE PAGE:\n${page.json.join('\n---\n').slice(0, 12_000)}` : '');

  // failover: try each configured provider until one succeeds
  const errors: string[] = [];
  let rawText = '';
  let provName = chain[0];
  for (const name of chain) {
    provName = name;
    try {
      rawText = await callProvider(name, prompt);
      if (rawText.indexOf('{') !== -1) break;
      throw new Error('empty response');
    } catch (e: any) {
      errors.push(`${name}: ${e?.message || 'failed'}`);
      if (name === chain[chain.length - 1]) {
        const quota = errors.some((x) => /429|quota|rate/i.test(x));
        return { error: quota
          ? `All AI providers are quota-limited right now (the free tier resets daily at 1:30 PM IST). Try again shortly, or add another AI key for automatic failover. (${errors.join(' | ')})`
          : `AI extraction failed on all providers: ${errors.join(' | ')}` };
      }
    }
  }
  const start = rawText.indexOf('{');
  const end = rawText.lastIndexOf('}');
  if (start === -1 || end <= start) return { error: 'The AI returned an unparseable result. Try again, or copy values from the page text below.' };
  let parsed: any;
  try {
    parsed = JSON.parse(rawText.slice(start, end + 1));
  } catch {
    return { error: 'The AI returned invalid JSON. Try again, or copy values from the page text below.' };
  }
  const clean = sanitiseOemAi(parsed, fuelType);
  if (Object.keys(clean.specs).length === 0 && clean.variants.length === 0) {
    return { error: clean.warnings[0] || 'The AI found no usable spec data on that page. Try the exact spec page URL, or copy values from the page text below.' };
  }
  return { provider: provName, ...clean };
}
