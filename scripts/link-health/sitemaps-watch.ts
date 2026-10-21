/**
 * Weekly sitemap watcher — `npm run links:sitemaps`. Manufacturers publish no product API, but their sitemaps list
 * every product page, so they work as a product feed:
 *
 *   - new product pages since the last snapshot → "Lopi added 3 products — add them?" (name proposed from the title)
 *   - a listed model's page gone from the sitemap → "Discontinued?" on that model
 *   - first run (no snapshot yet): compare with the product list instead, so there's real data right away
 *
 *   node scripts/link-health/sitemaps-watch.ts [--previous <snapshot file|url>] [--out .link-health/sitemap-watch.json]
 *        [--snapshot .link-health/sitemap-snapshot.json] [--brands lopi,kuma]
 *
 * Nothing on the public site changes from this — suggestions wait for someone to approve them in HMI mode.
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { fetchBytes, fetchPage } from './http.ts';
import { cleanText, readPage } from './page.ts';
import { HostQueue } from './queue.ts';
import { collectSitemaps, type SitemapEntry } from './sitemap.ts';
import { brands } from '../../src/data/brands.ts';
import { brandSites, products, type SitemapSource } from '../../src/data/products.ts';
import type { SitemapFeed, SitemapSnapshot, SitemapSuggestion } from '../../src/data/sitemapFeed.ts';

/** Same page for comparison purposes: no scheme, no www, no trailing slash, lower case. */
export const pageKey = (url: string) => {
  try {
    const u = new URL(url);
    return `${u.hostname.toLowerCase().replace(/^www\./, '')}${decodeURIComponent(u.pathname).replace(/\/+$/, '').toLowerCase()}`;
  } catch {
    return url.toLowerCase();
  }
};

const pathOf = (url: string) => {
  try {
    return decodeURIComponent(new URL(url).pathname).replace(/\/+$/, '') || '/';
  } catch {
    return '';
  }
};

export const isProduct = (src: SitemapSource, url: string) => {
  const p = pathOf(url);
  return !!p && src.product.test(p) && !src.exclude?.test(p);
};

/** "/product/answer-nexgen-hybrid/" → "Answer Nexgen Hybrid" (a fallback when the page title can't be read) */
export const nameFromSlug = (url: string) =>
  (pathOf(url).split('/').filter(Boolean).pop() ?? url)
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();

/** "Answer NexGen-Hybrid™ Stove | Steel Wood Stoves | Made in USA | Lopi Stoves®" → "Answer NexGen-Hybrid™ Stove" */
export function nameFromTitle(title: string, h1: string[], brandName: string): string {
  const pick = h1.find((h) => h.length >= 3 && h.length <= 90) ?? title;
  const first = pick.split(/\s+[|–—]\s+|\s+-\s+/)[0] ?? pick;
  return cleanText(first.replace(new RegExp(`\\b${brandName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i'), '').replace(/\s{2,}/g, ' ')) || pick;
}

/** First run: how many of the newest pages not on the list to suggest per brand */
const FIRST_RUN_PER_BRAND = 5;

const suggestionId = (type: string, url: string) => createHash('sha1').update(`${type}:${pageKey(url)}`).digest('hex').slice(0, 12);

/** Read one site's product pages from its sitemaps (or listing pages). */
async function readSource(src: SitemapSource, queue: HostQueue): Promise<{ entries: SitemapEntry[]; source: string; maps: number; partial: boolean; error?: string }> {
  const get = (u: string) => queue.run(u, () => fetchBytes(u));
  if (src.kind === 'listing') {
    const entries = new Map<string, SitemapEntry>();
    let failed = 0;
    for (const page of src.urls ?? []) {
      const res = await queue.run(page, () => fetchPage(page));
      if (res.status !== 200) {
        failed++;
        continue;
      }
      for (const m of res.body.matchAll(/href=["']([^"'#]+)["']/gi)) {
        try {
          const abs = new URL(m[1], page).toString();
          if (new URL(abs).hostname.replace(/^www\./, '') === new URL(src.origin).hostname.replace(/^www\./, '')) entries.set(pageKey(abs), { loc: abs });
        } catch {
          /* not a URL */
        }
      }
    }
    return { entries: [...entries.values()], source: 'listing pages', maps: (src.urls ?? []).length, partial: failed > 0, error: failed === (src.urls ?? []).length ? 'listing pages unavailable' : undefined };
  }
  const res = await collectSitemaps(src.origin, { get, roots: src.urls, childFilter: src.child, maxMaps: 40 });
  const error = res.source === 'none' ? 'no sitemap found' : res.maps.every((m) => m.status !== 200) ? 'sitemap unavailable' : undefined;
  return { entries: res.entries, source: res.source, maps: res.maps.length, partial: res.partial, error };
}

async function main() {
  const { values: args } = parseArgs({
    options: {
      previous: { type: 'string' },
      out: { type: 'string', default: '.link-health/sitemap-watch.json' },
      snapshot: { type: 'string', default: '.link-health/sitemap-snapshot.json' },
      brands: { type: 'string' },
      'max-titles': { type: 'string', default: '8' },
    },
  });
  const started = Date.now();
  const now = new Date().toISOString();
  const queue = new HostQueue({ perHost: 1, delayMs: 1500, globalLimit: 6 });
  const maxTitles = Number(args['max-titles']);

  let previous: SitemapSnapshot | null = null;
  if (args.previous) {
    try {
      const text = /^https?:/.test(args.previous) ? await (await fetch(args.previous, { signal: AbortSignal.timeout(20_000) })).text() : existsSync(args.previous) ? readFileSync(args.previous, 'utf8') : '';
      const json = JSON.parse(text) as SitemapSnapshot;
      if (json?.version === 1 && json.brands) previous = json;
    } catch {
      previous = null;
    }
  }
  console.log(previous ? `Previous snapshot: ${previous.takenAt}` : 'No previous snapshot — first run: comparing with the product list');

  const wanted = args.brands ? new Set(args.brands.split(',')) : null;
  const watched = Object.entries(brandSites).filter(([id, s]) => s.sitemap && (!wanted || wanted.has(id)));
  const brandName = (id: string) => brandSites[id]?.name ?? brands.find((b) => b.id === id)?.name ?? id;

  // One read per site, shared by brands on the same site (Quadra-Fire, Harman and Vermont Castings)
  const bySite = new Map<string, Promise<Awaited<ReturnType<typeof readSource>>>>();
  for (const [, s] of watched) {
    const key = `${s.sitemap!.origin}|${s.sitemap!.kind ?? 'sitemap'}|${(s.sitemap!.urls ?? []).join(',')}|${s.sitemap!.child ?? ''}`;
    if (!bySite.has(key)) bySite.set(key, readSource(s.sitemap!, queue));
  }
  const siteKey = (src: SitemapSource) => `${src.origin}|${src.kind ?? 'sitemap'}|${(src.urls ?? []).join(',')}|${src.child ?? ''}`;

  const snapshot: SitemapSnapshot = { version: 1, takenAt: now, brands: {} };
  const feed: SitemapFeed = { version: 1, generatedAt: now, mode: previous ? 'diff' : 'first-run', previousAt: previous?.takenAt ?? null, durationMs: 0, brands: [], suggestions: [] };

  for (const [id, site] of watched) {
    const src = site.sitemap!;
    const read = await bySite.get(siteKey(src))!;
    const productUrls = [...new Map(read.entries.filter((e) => isProduct(src, e.loc)).map((e) => [pageKey(e.loc), e])).values()];
    const prev = previous?.brands[id];
    const listed = products.filter((p) => p.brand === id && p.status !== 'hidden');
    const listedKeys = new Map(listed.map((p) => [pageKey(p.url), p]));
    const currentKeys = new Set(productUrls.map((e) => pageKey(e.loc)));

    // A sitemap that vanished or shrank sharply is a problem on their side, not a wave of discontinued products
    const shrank = !!prev && prev.urls.length >= 10 && productUrls.length < prev.urls.length * 0.5;
    const broken = !!read.error || (productUrls.length === 0 && (prev?.urls.length ?? 0) > 0);
    if (broken || shrank) {
      snapshot.brands[id] = prev ?? { source: read.source, urls: [], lastmod: {} };
      feed.brands.push({ brand: id, name: brandName(id), source: read.source, products: productUrls.length, onList: listed.length, added: 0, removed: 0, notOnList: 0, note: broken ? `${read.error ?? 'no product pages found'} — kept last week’s snapshot` : `sitemap shrank from ${prev!.urls.length} to ${productUrls.length} product pages — kept last week’s snapshot; check by hand` });
      continue;
    }

    // A partial read (one sitemap file failed) can't prove anything is gone: keep last week's pages in the snapshot
    const kept = read.partial && prev ? prev.urls.filter((u) => !currentKeys.has(pageKey(u))) : [];
    snapshot.brands[id] = {
      source: read.source,
      urls: [...productUrls.map((e) => e.loc), ...kept].sort(),
      lastmod: { ...(read.partial ? prev?.lastmod : {}), ...Object.fromEntries(productUrls.filter((e) => e.lastmod).map((e) => [e.loc, e.lastmod!])) },
    };

    let added: SitemapEntry[];
    let removedUrls: string[];
    if (prev) {
      const before = new Set(prev.urls.map(pageKey));
      added = productUrls.filter((e) => !before.has(pageKey(e.loc)) && !listedKeys.has(pageKey(e.loc)));
      removedUrls = prev.urls.filter((u) => !currentKeys.has(pageKey(u)));
    } else {
      // First run: no snapshot to compare with, so compare with the product list. Every page not on the list would be
      // thousands of suggestions (Realstone alone lists 580 tiles), so suggest only the newest few, and only for
      // brands HMI lists models from; the rest become this week's baseline and show up as counts.
      added = listed.length ? productUrls.filter((e) => !listedKeys.has(pageKey(e.loc))).sort((a, b) => (b.lastmod ?? '').localeCompare(a.lastmod ?? '')).slice(0, FIRST_RUN_PER_BRAND) : [];
      removedUrls = listed.filter((p) => p.status === 'current' && !currentKeys.has(pageKey(p.url))).map((p) => p.url);
    }
    if (read.partial) removedUrls = [];
    // Some sitemaps list only series pages, never the model pages HMI links to (Dimplex): if none of the brand's
    // current models are in it, "missing" means nothing — note it instead of flagging every model
    const currentListed = listed.filter((p) => p.status === 'current');
    const seesModels = currentListed.some((p) => currentKeys.has(pageKey(p.url)));
    let note: string | undefined = read.partial ? 'Part of its sitemap couldn’t be read this week, so nothing is flagged as gone' : undefined;
    if (!prev && currentListed.length && !seesModels) {
      removedUrls = [];
      note = 'Its sitemap doesn’t list the model pages HMI links to, so models can’t be watched for removal there — the nightly link check still covers them';
    }

    // Propose names from page titles for the first few new pages (politely — one page at a time per site)
    for (const [i, e] of added.entries()) {
      let name = nameFromSlug(e.loc);
      if (i < maxTitles) {
        const res = await queue.run(e.loc, () => fetchPage(e.loc));
        if (res.status === 200) {
          const pg = readPage(res.body);
          if (pg.title || pg.h1.length) name = nameFromTitle(pg.title, pg.h1, brandName(id));
        }
      }
      feed.suggestions.push({ id: suggestionId('new', e.loc), type: 'new', brand: id, url: e.loc, name, lastmod: e.lastmod ?? null, seen: now, firstRun: !prev });
    }
    for (const u of removedUrls) {
      const p = listedKeys.get(pageKey(u));
      if (p) feed.suggestions.push({ id: suggestionId('discontinued', u), type: 'discontinued', brand: id, url: u, name: p.model, productId: p.id, lastmod: null, seen: now, firstRun: !prev });
    }
    const notOnList = productUrls.filter((e) => !listedKeys.has(pageKey(e.loc))).length;
    feed.brands.push({ brand: id, name: brandName(id), source: read.source, products: productUrls.length, onList: listed.length, added: added.length, removed: removedUrls.length, notOnList, ...(note ? { note } : {}) });
    console.log(`${id.padEnd(20)} ${String(productUrls.length).padStart(4)} product pages · ${listed.length} on the list · ${added.length} ${prev ? 'new' : 'not on the list'} · ${removedUrls.length} ${prev ? 'gone' : 'listed but missing'}`);
  }

  feed.durationMs = Date.now() - started;
  for (const file of [args.out!, args.snapshot!]) mkdirSync(dirname(file), { recursive: true });
  writeFileSync(args.out!, JSON.stringify(feed, null, 1));
  writeFileSync(args.snapshot!, JSON.stringify(snapshot));
  const news = feed.suggestions.filter((s) => s.type === 'new').length;
  const gone = feed.suggestions.filter((s) => s.type === 'discontinued').length;
  console.log(`\n${feed.brands.length} brands · ${news} ${previous ? 'new product pages' : 'product pages not on the list'} · ${gone} listed models missing from their sitemap · ${Math.round(feed.durationMs / 1000)} s`);
  console.log(`Feed: ${args.out}  Snapshot: ${args.snapshot}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();

export type { SitemapSuggestion };
