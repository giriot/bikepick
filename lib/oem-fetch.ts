/** Fetch an OEM (manufacturer) web page and reduce it to clean text + structured
 *  data blocks (JSON-LD, Next.js data) that spec/variant extractors can work on.
 *  Server-side only. No AI involved here — this is raw page content. */

export interface OemPage {
  ok: boolean;
  url: string;
  finalUrl: string;
  title: string;
  text: string;
  json: string[];
  error?: string;
}

const MAX_HTML = 3_500_000;
const MAX_TEXT = 26_000;
const MAX_JSON = 9_000;

function decodeEntities(s: string): string {
  return s
    .replace(/&#(\d+);/g, (_, n) => { try { return String.fromCodePoint(Number(n)); } catch { return ''; } })
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => { try { return String.fromCodePoint(parseInt(n, 16)); } catch { return ''; } })
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&nbsp;/g, ' ');
}

/** Visible text of the page — scripts/styles stripped, tags to newlines. */
function visibleText(html: string): string {
  return decodeEntities(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
      .replace(/<svg[\s\S]*?<\/svg>/gi, ' ')
      .replace(/<[^>]+>/g, '\n')
  )
    .split('\n')
    .map((l) => l.replace(/\s+/g, ' ').trim())
    .filter((l) => l.length > 1)
    .join('\n')
    .slice(0, MAX_TEXT);
}

/** Structured data blocks: JSON-LD + __NEXT_DATA__ (OEM sites often embed full spec tables there). */
function jsonBlocks(html: string): string[] {
  const out: string[] = [];
  const re = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const raw = m[1].trim();
    if (raw && raw.length < 40_000) out.push(raw);
  }
  const next = /<script[^>]*id=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i.exec(html);
  if (next && next[1].length < 60_000) out.push(next[1]);
  return out.slice(0, 4).join('').length > MAX_JSON ? out.slice(0, 2) : out;
}

export async function fetchOemPage(rawUrl: string, timeoutMs = 15_000): Promise<OemPage> {
  let url: URL;
  try {
    url = new URL(rawUrl.trim());
    if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new Error('bad protocol');
  } catch {
    return { ok: false, url: rawUrl, finalUrl: '', title: '', text: '', json: [], error: 'Enter a valid https:// URL of the OEM spec page.' };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url.toString(), {
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36',
        accept: 'text/html,application/xhtml+xml',
        'accept-language': 'en-IN,en;q=0.9',
      },
    });
    if (!res.ok) return { ok: false, url: rawUrl, finalUrl: res.url, title: '', text: '', json: [], error: `The OEM site returned HTTP ${res.status}. Try the model's spec page URL directly.` };

    const buf = Buffer.from(await res.arrayBuffer()).subarray(0, MAX_HTML);
    const html = buf.toString('utf8');
    const title = decodeEntities((/<title[^>]*>([\s\S]*?)<\/title>/i.exec(html) || [])[1] || '').replace(/\s+/g, ' ').trim().slice(0, 200);
    const text = visibleText(html);
    if (text.length < 300) {
      return { ok: false, url: rawUrl, finalUrl: res.url, title, text, json: [], error: 'The page loaded but has little readable text — it may be fully JavaScript-rendered. Open the exact spec page on the OEM site and paste that URL.' };
    }
    return { ok: true, url: rawUrl, finalUrl: res.url, title, text, json: jsonBlocks(html) };
  } catch (e: any) {
    const msg = /aborted/i.test(String(e?.message || e)) ? 'The OEM site took too long to respond (15 s limit).' : `Could not reach the OEM site (${String(e?.message || e).slice(0, 120)}).`;
    return { ok: false, url: rawUrl, finalUrl: '', title: '', text: '', json: [], error: msg };
  } finally {
    clearTimeout(timer);
  }
}
