/**
 * Read a site's sitemaps: find them (robots.txt `Sitemap:` lines, then the usual paths), expand
 * sitemap indexes, unwrap CDATA and gzip, and return every page URL with its lastmod.
 */
import { gunzipSync } from 'node:zlib';
import { fetchBytes } from './http.ts';
import { decodeEntities } from './page.ts';

export interface SitemapEntry {
  loc: string;
  lastmod?: string;
}

export interface ParsedSitemap {
  kind: 'index' | 'urlset' | 'unknown';
  entries: SitemapEntry[];
}

/** Parse sitemap XML (urlset or sitemapindex). Tolerates CDATA-wrapped <loc>s and stray whitespace. */
export function parseSitemap(xml: string): ParsedSitemap {
  const text = xml.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1');
  const kind = /<(\w+:)?sitemapindex\b/i.test(text) ? 'index' : /<(\w+:)?urlset\b/i.test(text) ? 'urlset' : 'unknown';
  const tag = kind === 'index' ? 'sitemap' : 'url';
  const entries: SitemapEntry[] = [];
  for (const block of text.matchAll(new RegExp(`<(?:\\w+:)?${tag}\\b[^>]*>([\\s\\S]*?)<\\/(?:\\w+:)?${tag}>`, 'gi'))) {
    const loc = block[1].match(/<(?:\w+:)?loc\b[^>]*>\s*([\s\S]*?)\s*<\/(?:\w+:)?loc>/i)?.[1];
    if (!loc) continue;
    const lastmod = block[1].match(/<(?:\w+:)?lastmod\b[^>]*>\s*([^<\s]+)\s*<\/(?:\w+:)?lastmod>/i)?.[1];
    entries.push({ loc: decodeEntities(loc.trim()), lastmod });
  }
  // Some generators skip the <url> wrapper; fall back to bare <loc>s
  if (!entries.length && kind !== 'index') {
    for (const m of text.matchAll(/<(?:\w+:)?loc\b[^>]*>\s*([^<\s]+)\s*<\/(?:\w+:)?loc>/gi)) entries.push({ loc: decodeEntities(m[1]) });
  }
  return { kind, entries };
}

export function bytesToXml(bytes: Buffer): string {
  // Gzipped sitemap files start with the gzip magic number
  if (bytes.length > 2 && bytes[0] === 0x1f && bytes[1] === 0x8b) {
    try {
      return gunzipSync(bytes).toString('utf8');
    } catch {
      return '';
    }
  }
  return bytes.toString('utf8');
}

/** Sitemap URLs a site advertises in robots.txt */
export function sitemapsFromRobots(robots: string): string[] {
  return [...robots.matchAll(/^\s*sitemap\s*:\s*(\S+)/gim)].map((m) => m[1].trim());
}

export interface CollectOptions {
  /** Called for every request so callers can schedule them politely */
  get?: (url: string) => Promise<{ status: number; finalUrl: string; bytes: Buffer; contentType: string; error?: string }>;
  /** Only expand child sitemaps whose URL matches (e.g. product sitemaps) */
  childFilter?: RegExp;
  /** Stop after reading this many sitemap files */
  maxMaps?: number;
  /** Wait before retrying a 202/429/503 answer (default 4 s) */
  retryDelayMs?: number;
}

export interface CollectResult {
  /** Where the sitemap list came from */
  source: 'robots.txt' | 'sitemap.xml' | 'none';
  /** Some sitemap files couldn't be read, so the list of pages may be incomplete */
  partial: boolean;
  maps: { url: string; status: number; kind: ParsedSitemap['kind']; count: number; error?: string }[];
  entries: SitemapEntry[];
}

/** Find and read every sitemap for `origin`, following indexes up to three levels deep. */
export async function collectSitemaps(origin: string, opts: CollectOptions & { roots?: string[] } = {}): Promise<CollectResult> {
  const fetchOnce = opts.get ?? ((url: string) => fetchBytes(url));
  // Some servers build big sitemaps on demand and answer 202 (or 429/503) until they're ready: wait, then try once more
  const get = async (url: string) => {
    const first = await fetchOnce(url);
    if (![0, 202, 429, 503].includes(first.status)) return first;
    await new Promise((r) => setTimeout(r, opts.retryDelayMs ?? 4000));
    return fetchOnce(url);
  };
  let roots = opts.roots ?? [];
  let source: CollectResult['source'] = roots.length ? 'robots.txt' : 'none';
  if (!roots.length) {
    const robots = await get(`${origin}/robots.txt`);
    if (robots.status === 200) roots = sitemapsFromRobots(robots.bytes.toString('utf8'));
    if (roots.length) source = 'robots.txt';
  }
  const maps: CollectResult['maps'] = [];
  const entries = new Map<string, SitemapEntry>();
  const queue: { url: string; depth: number }[] = [];
  const seen = new Set<string>();
  const pushRoot = (url: string) => queue.push({ url, depth: 0 });
  if (roots.length) roots.forEach(pushRoot);
  else {
    for (const path of ['/sitemap.xml', '/sitemap_index.xml', '/wp-sitemap.xml']) {
      const res = await get(origin + path);
      const xml = res.status === 200 ? bytesToXml(res.bytes) : '';
      if (/<(\w+:)?(urlset|sitemapindex)\b/i.test(xml)) {
        source = 'sitemap.xml';
        pushRoot(origin + path);
        break;
      }
    }
  }
  const maxMaps = opts.maxMaps ?? 80;
  while (queue.length && maps.length < maxMaps) {
    const { url, depth } = queue.shift()!;
    if (seen.has(url)) continue;
    seen.add(url);
    const res = await get(url);
    const xml = res.status === 200 ? bytesToXml(res.bytes) : '';
    const parsed = parseSitemap(xml);
    maps.push({ url, status: res.status, kind: parsed.kind, count: parsed.entries.length, error: res.error });
    if (parsed.kind === 'index') {
      if (depth >= 3) continue;
      for (const child of parsed.entries) if (!opts.childFilter || opts.childFilter.test(child.loc)) queue.push({ url: child.loc, depth: depth + 1 });
    } else {
      for (const e of parsed.entries) if (!entries.has(e.loc)) entries.set(e.loc, e);
    }
  }
  const partial = maps.some((m) => m.status !== 200 || m.kind === 'unknown');
  return { source, partial, maps, entries: [...entries.values()] };
}
