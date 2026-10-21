/**
 * Fetch a page the way a browser would: normal browser headers, redirects followed one hop at a
 * time (so the chain is recorded), cookies carried along the chain, a hard timeout and a cap on
 * how much of the body is read.
 */

export const USER_AGENT =
  process.env.LINK_HEALTH_UA ?? 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36';

export const BROWSER_HEADERS: Record<string, string> = {
  'user-agent': USER_AGENT,
  accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'accept-language': 'en-US,en;q=0.9',
  'cache-control': 'no-cache',
  'upgrade-insecure-requests': '1',
  'sec-fetch-dest': 'document',
  'sec-fetch-mode': 'navigate',
  'sec-fetch-site': 'none',
  'sec-fetch-user': '?1',
};

export const TIMEOUT_MS = 25_000;
const MAX_HOPS = 10;
const MAX_BODY = 2_000_000;

export interface Hop {
  url: string;
  status: number;
}

/** What a request came back with — the classifier's only input, so saved copies make test fixtures. */
export interface FetchResult {
  /** The URL that was requested */
  url: string;
  /** Final HTTP status (0 when no response arrived) */
  status: number;
  /** Where the redirects ended */
  finalUrl: string;
  /** Every response along the way, the last one included */
  chain: Hop[];
  contentType: string;
  /** A few response headers that help recognise bot checks (server, cf-mitigated…) */
  headers?: Record<string, string>;
  /** The start of the body (HTML pages only) */
  body: string;
  /** Network-level failure: DNS, TLS, refused connection, timeout… */
  error?: { code: string; message: string };
  /** 'fetch' for plain HTTP, 'browser' for the headless-browser retry */
  via: 'fetch' | 'browser';
  ms: number;
}

/** Network error codes, flattened from fetch's nested causes */
export function errorCode(e: unknown): { code: string; message: string } {
  const err = e as { name?: string; message?: string; code?: string; cause?: { code?: string; message?: string; name?: string; cause?: { code?: string } } };
  if (err?.name === 'TimeoutError' || err?.name === 'AbortError') return { code: 'TIMEOUT', message: `No response within ${TIMEOUT_MS / 1000} seconds` };
  const code = err?.cause?.code ?? err?.cause?.cause?.code ?? err?.code ?? err?.cause?.name ?? err?.name ?? 'ERROR';
  return { code, message: err?.cause?.message ?? err?.message ?? String(e) };
}

async function readCapped(res: Response, cap = MAX_BODY): Promise<string> {
  if (!res.body) return '';
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (size < cap) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      size += value.byteLength;
    }
  } finally {
    await reader.cancel().catch(() => {});
  }
  return new TextDecoder('utf-8', { fatal: false }).decode(Buffer.concat(chunks).subarray(0, cap));
}

const KEPT_HEADERS = ['server', 'cf-mitigated', 'cf-ray', 'x-datadome', 'x-iinfo', 'x-sucuri-id', 'x-vercel-mitigated', 'akamai-grn', 'retry-after'];

/** The headers worth keeping, from a fetch() response or a browser's (lower-cased) header record. */
export function pickHeaders(h: Headers | Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const k of KEPT_HEADERS) {
    const v = h instanceof Headers ? h.get(k) : h[k];
    if (v) out[k] = v;
  }
  return out;
}

/** A tiny per-chain cookie jar: enough for sites that set a cookie on the first hop and expect it back. */
class Jar {
  private cookies = new Map<string, Map<string, string>>();
  store(url: string, headers: Headers) {
    const host = new URL(url).hostname;
    for (const line of headers.getSetCookie?.() ?? []) {
      const [pair, ...attrs] = line.split(';');
      const eq = pair.indexOf('=');
      if (eq < 1) continue;
      const domain = attrs.map((a) => a.trim()).find((a) => /^domain=/i.test(a))?.slice(7).replace(/^\./, '') ?? host;
      if (!this.cookies.has(domain)) this.cookies.set(domain, new Map());
      this.cookies.get(domain)!.set(pair.slice(0, eq).trim(), pair.slice(eq + 1).trim());
    }
  }
  header(url: string) {
    const host = new URL(url).hostname;
    const parts: string[] = [];
    for (const [domain, values] of this.cookies) {
      if (host === domain || host.endsWith(`.${domain}`)) for (const [k, v] of values) parts.push(`${k}=${v}`);
    }
    return parts.join('; ');
  }
}

/** GET a URL like a browser, following redirects. Never throws. */
export async function fetchPage(url: string, opts: { timeoutMs?: number; accept?: string; maxBody?: number } = {}): Promise<FetchResult> {
  const started = Date.now();
  const chain: Hop[] = [];
  const jar = new Jar();
  const signal = AbortSignal.timeout(opts.timeoutMs ?? TIMEOUT_MS);
  let current = url;
  try {
    for (let hop = 0; hop <= MAX_HOPS; hop++) {
      const cookie = jar.header(current);
      const res = await fetch(current, {
        method: 'GET',
        redirect: 'manual',
        signal,
        headers: { ...BROWSER_HEADERS, ...(opts.accept ? { accept: opts.accept } : {}), ...(cookie ? { cookie } : {}) },
      });
      chain.push({ url: current, status: res.status });
      jar.store(current, res.headers);
      const location = res.headers.get('location');
      if (res.status >= 300 && res.status < 400 && location) {
        await res.body?.cancel().catch(() => {});
        current = new URL(location, current).toString();
        continue;
      }
      const contentType = res.headers.get('content-type') ?? '';
      const headers = pickHeaders(res.headers);
      const textual = /html|xml|text|json/i.test(contentType) || contentType === '';
      const body = textual ? await readCapped(res, opts.maxBody ?? MAX_BODY) : (await res.body?.cancel().catch(() => {}), '');
      return { url, status: res.status, finalUrl: current, chain, contentType, headers, body, via: 'fetch', ms: Date.now() - started };
    }
    return { url, status: 0, finalUrl: current, chain, contentType: '', body: '', error: { code: 'REDIRECT_LOOP', message: `More than ${MAX_HOPS} redirects` }, via: 'fetch', ms: Date.now() - started };
  } catch (e) {
    return { url, status: 0, finalUrl: current, chain, contentType: '', body: '', error: errorCode(e), via: 'fetch', ms: Date.now() - started };
  }
}

/** GET raw bytes (sitemaps can be gzipped files rather than gzip-encoded responses). */
export async function fetchBytes(url: string, opts: { timeoutMs?: number; maxBytes?: number } = {}): Promise<{ status: number; finalUrl: string; bytes: Buffer; contentType: string; error?: string }> {
  try {
    const res = await fetch(url, {
      redirect: 'follow',
      signal: AbortSignal.timeout(opts.timeoutMs ?? TIMEOUT_MS),
      headers: { ...BROWSER_HEADERS, accept: 'application/xml,text/xml;q=0.9,*/*;q=0.8' },
    });
    const cap = opts.maxBytes ?? 40_000_000;
    const chunks: Uint8Array[] = [];
    let size = 0;
    if (res.body) {
      const reader = res.body.getReader();
      while (size < cap) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        size += value.byteLength;
      }
      await reader.cancel().catch(() => {});
    }
    return { status: res.status, finalUrl: res.url || url, bytes: Buffer.concat(chunks), contentType: res.headers.get('content-type') ?? '' };
  } catch (e) {
    return { status: 0, finalUrl: url, bytes: Buffer.alloc(0), contentType: '', error: errorCode(e).code };
  }
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
