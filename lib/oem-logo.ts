/**
 * Pulls the brand logo from the OEM website and converts it to black & white.
 * Heuristics: <header>/<nav> <img src="...logo..."> first, then header img,
 * then apple-touch-icon / favicon links, then og:image.
 * SVG logos are rasterised (resvg); raster logos go through jimp B&W.
 */
import { Resvg } from '@resvg/resvg-js';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

export function findLogoCandidates(html: string, baseUrl: string): string[] {
  const out: string[] = [];
  const abs = (u: string) => {
    try { return new URL(u.trim(), baseUrl).href; } catch { return null; }
  };
  const clean = (u: string) => {
    if (!u || u.startsWith('data:')) return null;
    return abs(u);
  };

  // 1) header / nav images containing "logo"
  for (const tag of ['header', 'nav']) {
    const m = html.match(new RegExp(`<${tag}[^>]*[\\s\\S]{0,30000}?<\\/${tag}>`, 'i'));
    if (!m) continue;
    const block = m[0];
    const logoImgs = [...block.matchAll(/<img[^>]+>/gi)]
      .map((mm) => {
        const src = mm[0].match(/\ssrc=["']([^"']+)["']/i)?.[1];
        return { src, html: mm[0] };
      })
      .filter((x) => x.src && /logo/i.test(x.src + x.html));
    if (logoImgs.length) { const u = clean(logoImgs[0].src || ''); if (u) out.push(u); }
  }
  // 2) first img in header
  {
    const m = html.match(/<header[^>]*[\\s\\S]{0,30000}?<\/header>/i);
    if (m) {
      const img = [...m[0].matchAll(/<img[^>]+>/gi)].map((mm) => mm[0].match(/\ssrc=["']([^"']+)["']/i)?.[1]).find(Boolean);
      if (img) { const u = clean(img); if (u && !out.includes(u)) out.push(u); }
    }
  }
  // 3) link icons (apple-touch first)
  for (const re of [
    /<link[^>]+rel=["'][^"']*apple-touch-icon[^"']*["'][^>]+>/gi,
    /<link[^>]+rel=["'][^"']*(?:shortcut )?icon[^"']*["'][^>]+>/gi,
  ]) {
    for (const mm of html.matchAll(re)) {
      const href = mm[0].match(/\shref=["']([^"']+)["']/i)?.[1];
      if (href) { const u = clean(href); if (u && !out.includes(u)) out.push(u); }
    }
  }
  // 4) og:image
  {
    const og = html.match(/<meta[^>]+property=["']og:image["'][^>]+>/i)?.[0];
    const content = og?.match(/content=["']([^"']+)["']/i)?.[1];
    if (content) { const u = clean(content); if (u && !out.includes(u)) out.push(u); }
  }
  return out.slice(0, 6);
}

async function download(url: string): Promise<{ buf: Buffer; type: string } | null> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 15000);
  try {
    const res = await fetch(url, { signal: ctrl.signal, headers: { 'user-agent': UA, accept: 'image/*,*/*' }, redirect: 'follow' });
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (!buf.length || buf.length > 2_000_000) return null;
    const ct = res.headers.get('content-type') || '';
    return { buf, type: ct.split(';')[0].trim() };
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

/** 2-tone black & white (jimp 1.x API); keeps dark ink on a light background (inverts if needed). */
export async function toBlackAndWhite(buf: Buffer): Promise<Buffer> {
  const mod: any = await import('jimp');
  const Jimp = mod.default || mod.Jimp;
  const JimpMime: any = mod.JimpMime || {};
  const pngMime = JimpMime.png || 'image/png';
  const img = await (Jimp.fromBuffer ? Jimp.fromBuffer(buf) : Jimp.read(buf));
  if (!img || img.width < 40 || img.height < 40) throw new Error('logo too small');
  const d: Uint8ClampedArray = img.bitmap.data;
  const t = 128;
  const total = img.width * img.height;
  let opaque = 0;
  for (let i = 0; i < d.length; i += 4) if (d[i + 3] >= 128) opaque++;
  if (!opaque) throw new Error('image is fully transparent');

  if (opaque < total * 0.9) {
    // logo on a transparent background (often white logo): keep the alpha,
    // recolour the visible ink solid black — reads on any background.
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] < 128) continue;
      d[i] = d[i + 1] = d[i + 2] = 0;
    }
  } else {
    // opaque background: 2-tone, dark ink on light background
    let black = 0;
    for (let i = 0; i < d.length; i += 4) {
      const l = Math.round(0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]);
      const isBlack = l < t;
      d[i] = d[i + 1] = d[i + 2] = isBlack ? 0 : 255;
      d[i + 3] = 255;
      if (isBlack) black++;
    }
    if (black / total > 0.55) {
      for (let i = 0; i < d.length; i += 4) {
        const v = d[i] >= 128 ? 0 : 255;
        d[i] = d[i + 1] = d[i + 2] = v;
      }
    }
  }
  if (img.width > 480) img.resize({ w: 480 });
  const out = await (img.getBuffer ? img.getBuffer(pngMime) : img.getBufferAsync(pngMime));
  return Buffer.from(out);
}

export async function processLogoToBlackAndWhite(buf: Buffer, type: string): Promise<Buffer> {
  let working = buf;
  let isSvg = type === 'image/svg+xml' || buf.subarray(0, 5).toString('utf8').includes('<?xml') || buf.subarray(0, 200).toString('utf8').includes('<svg');
  if (isSvg) {
    const svg = buf.toString('utf8');
    const resvg = new Resvg(svg, { fitTo: { mode: 'width', value: 512 } });
    working = resvg.render().asPng();
  }
  return toBlackAndWhite(working);
}

export async function pullBrandLogo(siteUrl: string): Promise<{ buffer: Buffer; sourceUrl: string }> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 15000);
  let html = '';
  let finalUrl = siteUrl;
  try {
    const res = await fetch(siteUrl, { signal: ctrl.signal, headers: { 'user-agent': UA }, redirect: 'follow' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const text = await res.text();
    if (text.length > 3_500_000) throw new Error('page too large');
    html = text;
    finalUrl = res.url || siteUrl;
  } finally {
    clearTimeout(t);
  }

  const candidates = findLogoCandidates(html, finalUrl);
  if (!candidates.length) throw new Error('No logo image found on that page — upload the logo manually.');
  const errors: string[] = [];
  for (const u of candidates) {
    const dl = await download(u);
    if (!dl) { errors.push(`${u} — download failed`); continue; }
    try {
      const out = await processLogoToBlackAndWhite(dl.buf, dl.type);
      return { buffer: out, sourceUrl: u };
    } catch (e: any) {
      errors.push(`${u} — ${e?.message || 'could not process'}`);
    }
  }
  throw new Error('Found logo candidates but could not process them: ' + errors.slice(0, 3).join(' | '));
}
