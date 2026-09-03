/**
 * Server-side AI image generation (Gemini image models) for the admin
 * "generate model images" flow. Uses the Gemini key pool (GEMINI_API_KEY,
 * GEMINI_API_KEY_2, GEMINI_API_KEY_3 — Vercel env) with automatic failover
 * when a key's rate limit is hit.
 * Generated images are ORIGINAL illustrations (no OEM copyright) and are
 * labelled "AI illustration" everywhere they appear.
 */
import { geminiKeys, geminiImageModels } from './ai-keys';
export class OemImageQuotaError extends Error {
  constructor(msg: string) { super(msg); this.name = 'OemImageQuotaError'; }
}

type ImgRequest = { model: string; brand: string; color: string; view?: string; label?: string };
type ImgResult = { buffer: Buffer; mime: string; provider: string };

function buildPrompt(o: ImgRequest): string {
  const base = (o.label || `${o.brand} ${o.model}`).toUpperCase();
  const color = (o.color || '').toUpperCase();
  // Model name + colour name printed on the image, e.g. "TVS RAIDER 125 — FIERY YELLOW"
  const label = color ? `${base} — ${color}` : base;
  return (
    `Professional studio product photograph of the ${o.brand} ${o.model} motorcycle, ` +
    `${o.color} body colour, ${o.view || 'perfect side profile view facing left'}, ` +
    `centered on a clean light-grey seamless studio background, soft realistic shadow under the bike, ` +
    `crisp detail, no people, no props, no watermark. ` +
    `Print the text "${label.slice(0, 60)}" in clean bold black sans-serif font at the bottom left corner. ` +
    `The printed text must be exactly that, perfectly legible, no extra words.`
  );
}

async function geminiImage(prompt: string): Promise<ImgResult> {
  const keys = geminiKeys();
  if (!keys.length) throw new Error('gemini: no API key configured');
  const models = geminiImageModels();
  const MODEL_GONE = /not found|does not exist|unsupported|no longer available|deprecated/i;
  const quota: string[] = [];
  const badModels: string[] = [];
  // Walk MODEL × KEY: a deprecated image model advances to the next model,
  // a rate-limited key (429) advances to the next key.
  for (const model of models) {
    let modelBad = false;
    for (let i = 0; i < keys.length; i++) {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${keys[i]}`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
        },
      );
      if (res.status === 429) { quota.push(`key ${i + 1}: quota`); continue; }
      if (res.status === 404) { modelBad = true; break; }
      if (!res.ok) throw new Error(`gemini HTTP ${res.status}`);
      const d = await res.json();
      if (d.error) {
        if (d.error.code === 429) { quota.push(`key ${i + 1}: ${d.error.message || 'quota'}`); continue; }
        if (MODEL_GONE.test(d.error.message || '')) { modelBad = true; break; }
        throw new Error(`gemini: ${d.error.message || 'error'}`);
      }
      const parts: any[] = d.candidates?.[0]?.content?.parts || [];
      const img = parts.find((p) => p && p.inlineData);
      if (!img) throw new Error('gemini returned no image');
      return { buffer: Buffer.from(img.inlineData.data, 'base64'), mime: img.inlineData.mimeType || 'image/png', provider: `gemini (key ${i + 1})` };
    }
    if (modelBad) { badModels.push(model); continue; }
  }
  if (!quota.length && badModels.length) {
    throw new Error(`gemini image models not available (${badModels.join(', ')}) — set GEMINI_IMAGE_MODEL to a current image model`);
  }
  throw new OemImageQuotaError(`gemini quota exhausted on all ${keys.length} key(s): ${quota.join(' | ')}`);
}

async function openaiImage(prompt: string): Promise<ImgResult> {
  const key = process.env.OPENAI_API_KEY!;
  const model = process.env.OPENAI_IMAGE_MODEL || 'gpt-image-1';
  const res = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
    body: JSON.stringify({ model, prompt, size: '1536x1024', n: 1 }),
  });
  if (res.status === 429) throw new OemImageQuotaError('openai quota exhausted');
  if (!res.ok) {
    const j = await res.json().catch(() => ({}));
    throw new Error(`openai ${res.status}: ${j?.error?.message || 'error'}`);
  }
  const j = await res.json();
  const item = j.data?.[0];
  if (item?.b64_json) return { buffer: Buffer.from(item.b64_json, 'base64'), mime: 'image/png', provider: 'openai' };
  if (item?.url) {
    const imgRes = await fetch(item.url);
    if (!imgRes.ok) throw new Error('openai image download failed');
    return { buffer: Buffer.from(await imgRes.arrayBuffer()), mime: 'image/png', provider: 'openai' };
  }
  throw new Error('openai returned no image');
}

/** Sniff the real image format from magic bytes (data-URL labels can lie —
 *  Abacus returned "data:image/png" for JPEG bytes). */
function sniffMime(buf: Buffer): string {
  if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8) return 'image/jpeg';
  if (buf.length > 8 && buf.readUInt32BE(0) === 0x89504e47) return 'image/png';
  return 'image/png';
}

async function abacusImage(prompt: string): Promise<ImgResult> {
  // Abacus.AI RouteLLM image generation — same chat/completions endpoint as
  // text, with modalities:["image"]. Image models: flux2_pro (default),
  // flux2, flux_pro, gpt_image2, nano_banana2, ideogram, midjourney, …
  // (see https://abacus.ai/help/developer-platform/route-llm/chat-completions/image-analysis)
  const key = process.env.ABACUS_API_KEY!;
  const model = process.env.ABACUS_IMAGE_MODEL || 'flux2_pro';
  const res = await fetch('https://routellm.abacus.ai/v1/chat/completions', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model,
      modalities: ['image'],
      image_config: { aspect_ratio: 'landscape_16_9' },
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  if (res.status === 429) throw new OemImageQuotaError('abacus quota exhausted');
  if (!res.ok) {
    const t = await res.text().catch(() => '');
    throw new Error(`abacus ${res.status}: ${t.slice(0, 140)}`);
  }
  const j = await res.json();
  if (j?.error) throw new Error(`abacus: ${typeof j.error === 'string' ? j.error : j.error.message || 'error'}`);
  const imgs: any[] = j?.choices?.[0]?.message?.images || [];
  const img = imgs.find((i) => i?.type === 'image_url' && i?.image_url?.url);
  if (!img) throw new Error('abacus returned no image');
  const url: string = img.image_url.url;
  if (url.startsWith('data:')) {
    const m = url.match(/^data:[^;]+;base64,(.+)$/s);
    if (!m) throw new Error('abacus returned an unparsable image URL');
    return { buffer: Buffer.from(m[1], 'base64'), mime: sniffMime(Buffer.from(m[1], 'base64')), provider: 'abacus' };
  }
  const imgRes = await fetch(url);
  if (!imgRes.ok) throw new Error('abacus image download failed');
  const buf = Buffer.from(await imgRes.arrayBuffer());
  return { buffer: buf, mime: sniffMime(buf), provider: 'abacus' };
}

async function huggingfaceImage(prompt: string): Promise<ImgResult> {
  // HF Inference Providers router. Free-tier accounts currently expose text
  // models only — this provider engages automatically if/when the account
  // gains image-model access (e.g. HF Pro), with no code change.
  const key = process.env.HF_API_KEY!;
  const model = process.env.HF_IMAGE_MODEL || 'black-forest-labs/FLUX.1-schnell';
  const res = await fetch('https://router.huggingface.co/v1/images/generations', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
    body: JSON.stringify({ model, prompt, n: 1 }),
  });
  if (res.status === 429) throw new OemImageQuotaError('huggingface quota exhausted');
  if (!res.ok) throw new Error(`huggingface ${res.status} (free tier has no image models yet)`);
  const j = await res.json();
  const item = j.data?.[0];
  if (item?.b64_json) return { buffer: Buffer.from(item.b64_json, 'base64'), mime: 'image/png', provider: 'huggingface' };
  if (item?.url) {
    const imgRes = await fetch(item.url);
    if (!imgRes.ok) throw new Error('huggingface image download failed');
    return { buffer: Buffer.from(await imgRes.arrayBuffer()), mime: 'image/png', provider: 'huggingface' };
  }
  throw new Error('huggingface returned no image');
}

/**
 * Generates a bike illustration, failing over across configured providers:
 * Gemini -> Abacus -> OpenAI -> Hugging Face. Throws only when ALL configured
 * providers fail (quota errors are reported with a friendly hint).
 */
export async function generateBikeImage(o: ImgRequest): Promise<ImgResult> {
  const prompt = buildPrompt(o);
  const chain: { name: string; fn: (p: string) => Promise<ImgResult> }[] = [];
  // Gate on the key POOL (not just GEMINI_API_KEY) so a 2nd/3rd key alone
  // still engages Gemini image generation.
  if (geminiKeys().length) chain.push({ name: 'Gemini', fn: geminiImage });
  if (process.env.ABACUS_API_KEY) chain.push({ name: 'Abacus', fn: abacusImage });
  if (process.env.OPENAI_API_KEY) chain.push({ name: 'OpenAI', fn: openaiImage });
  if (process.env.HF_API_KEY) chain.push({ name: 'Hugging Face', fn: huggingfaceImage });
  if (!chain.length) throw new Error('No AI key is configured for image generation (GEMINI_API_KEY or ABACUS_API_KEY).');

  const errors: string[] = [];
  let lastQuota: OemImageQuotaError | null = null;
  for (const p of chain) {
    try {
      return await p.fn(prompt);
    } catch (e: any) {
      if (e instanceof OemImageQuotaError) lastQuota = e;
      errors.push(`${p.name}: ${e?.message || 'failed'}`);
    }
  }
  throw new OemImageQuotaError(
    lastQuota
      ? `All image AIs are quota-limited right now. Every configured provider was tried automatically (Gemini keys GEMINI_API_KEY/_2/_3, then ABACUS_API_KEY) — limits reset per plan (Gemini free tier: daily at 1:30 PM IST): ${errors.join(' | ')}`
      : `Image generation failed on all providers: ${errors.join(' | ')}`,
  );
}
