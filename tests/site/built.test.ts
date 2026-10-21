/**
 * Checks on the built site (run after `npm run build`; the deploy runs it before publishing):
 *   - no page links straight to a manufacturer — every manufacturer link goes through /go/<slug>/
 *   - every outbound link has its /go/ page (meta refresh, location.replace, a visible link, noindex)
 *   - every /go/ link on the site, and every fallback a /go/ page uses, points at a page that exists
 *   - every public model has its page; /go/ pages stay out of the sitemap and robots.txt disallows them
 * DIST overrides the build folder (default: dist).
 */
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, it } from 'node:test';
import { outboundLinks } from '../../src/data/links.ts';
import { brandSites, productPath, publicProducts, tools } from '../../src/data/products.ts';

const DIST = process.env.DIST ?? 'dist';
assert.ok(existsSync(join(DIST, 'index.html')), `No build in ${DIST}/ — run npm run build first`);

/** The base path the site was built for, read from the home page ('' at the root, '/hmi' on GitHub Pages) */
const BASE = (readFileSync(join(DIST, 'index.html'), 'utf8').match(/<link rel="icon" href="([^"]*)\/favicon\.svg"/)?.[1] ?? '').replace(/\/$/, '');

function htmlFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) return htmlFiles(p);
    return name.endsWith('.html') ? [p] : [];
  });
}

const all = htmlFiles(DIST);
const goDir = join(DIST, 'go');
const isGoPage = (f: string) => relative(DIST, f).startsWith(`go/`);
const pages = all.filter((f) => !isGoPage(f));
const links = outboundLinks();
const bare = (h: string) => h.toLowerCase().replace(/^www\./, '');

/** Every manufacturer host the product list knows about (sites, model pages, support pages, tools, known moves) */
const manufacturerHosts = new Set<string>([
  ...links.map((l) => bare(new URL(l.url).hostname)),
  ...links.flatMap((l) => l.hosts.map(bare)),
  ...Object.values(brandSites).flatMap((s) => [bare(new URL(s.url).hostname), ...(s.hosts ?? []).map(bare)]),
  ...tools.map((t) => bare(new URL(t.url).hostname)),
]);
const isManufacturer = (host: string) => {
  const h = bare(host);
  return [...manufacturerHosts].some((m) => h === m || h.endsWith(`.${m}`));
};

/** Absolute URLs in link-like attributes (href, src, action, formaction, srcset, data-*) */
function outboundAttrs(html: string): string[] {
  const urls: string[] = [];
  for (const m of html.matchAll(/\s(?:href|src|action|formaction|data-[a-z-]+)\s*=\s*["']([^"']+)["']/gi)) if (/^(https?:)?\/\//i.test(m[1].trim())) urls.push(m[1].trim());
  for (const m of html.matchAll(/\ssrcset\s*=\s*["']([^"']+)["']/gi)) for (const part of m[1].split(',')) if (/^(https?:)?\/\//i.test(part.trim())) urls.push(part.trim().split(/\s+/)[0]);
  return urls;
}

const pathOf = (href: string) => href.replace(/[?#].*$/, '');
const fileFor = (sitePath: string) => {
  const rel = pathOf(sitePath).replace(new RegExp(`^${BASE}`), '').replace(/^\//, '');
  return rel.endsWith('/') || rel === '' ? join(DIST, rel, 'index.html') : existsSync(join(DIST, rel)) ? join(DIST, rel) : join(DIST, rel, 'index.html');
};

describe(`built site in ${DIST}/ (base "${BASE || '/'}")`, () => {
  it('the direct-link detector recognizes manufacturer links (self-check)', () => {
    assert.deepEqual(outboundAttrs('<a href="https://www.heatnglo.com/x">x</a><img src="/hmi/a.png"><a href="//forgenflame.com/pages/harman">y</a>'), ['https://www.heatnglo.com/x', '//forgenflame.com/pages/harman']);
    assert.ok(isManufacturer('www.heatnglo.com') && isManufacturer('downloads.hearthnhome.com') && isManufacturer('tkfireside.com'));
    assert.ok(!isManufacturer('www.youtube.com') && !isManufacturer('h-looney.github.io'));
  });

  it('no page links straight to a manufacturer (outside /go/)', () => {
    const bad: string[] = [];
    for (const f of pages) {
      for (const url of outboundAttrs(readFileSync(f, 'utf8'))) {
        try {
          if (isManufacturer(new URL(url, 'https://x.invalid').hostname)) bad.push(`${relative(DIST, f)}: ${url}`);
        } catch {
          /* not a URL */
        }
      }
    }
    assert.deepEqual(bad, [], `Manufacturer links must go through /go/<slug>/:\n${bad.join('\n')}`);
  });

  it('every outbound link has a /go/ page with a meta refresh, location.replace, a visible link and noindex', () => {
    for (const l of links) {
      const f = join(goDir, l.slug, 'index.html');
      assert.ok(existsSync(f), `missing /go/${l.slug}/`);
      const html = readFileSync(f, 'utf8');
      assert.match(html, /<meta http-equiv="refresh" content="1; url=/, `/go/${l.slug}/: no meta refresh`);
      assert.match(html, /<meta name="robots" content="noindex/, `/go/${l.slug}/: not noindex`);
      assert.match(html, /location\.replace|data-to=/, `/go/${l.slug}/: no scripted redirect`);
      assert.match(html, /class="go__continue" href="[^"]+"/, `/go/${l.slug}/: no visible Continue link`);
    }
    const extra = readdirSync(goDir).filter((d) => !links.some((l) => l.slug === d));
    assert.deepEqual(extra, [], `/go/ pages for links that aren't on the product list: ${extra.join(', ')}`);
  });

  it('every /go/ page sends people to the stored URL, its new address, or an HMI page that exists', () => {
    for (const l of links) {
      const html = readFileSync(join(goDir, l.slug, 'index.html'), 'utf8');
      const to = html.match(/data-to="([^"]+)"/)?.[1]?.replace(/&amp;/g, '&');
      assert.ok(to, `/go/${l.slug}/: no target`);
      if (to.startsWith('/')) assert.ok(existsSync(fileFor(to)), `/go/${l.slug}/ falls back to ${to}, which doesn't exist`);
      else assert.ok(/^https:\/\//.test(to), `/go/${l.slug}/: target isn't https (${to})`);
    }
  });

  it('every /go/ link on the site points at a /go/ page that exists', () => {
    const missing = new Set<string>();
    const goLink = new RegExp(`href="${BASE}/go/([^/"]+)/"`, 'g');
    for (const f of pages) for (const m of readFileSync(f, 'utf8').matchAll(goLink)) if (!existsSync(join(goDir, m[1], 'index.html'))) missing.add(`${relative(DIST, f)} → /go/${m[1]}/`);
    assert.deepEqual([...missing], []);
  });

  it('every public model has its page, its photo and a /go/ link to the manufacturer', () => {
    for (const p of publicProducts()) {
      const f = fileFor(`${BASE}${productPath(p)}`);
      assert.ok(existsSync(f), `missing model page ${productPath(p)}`);
      assert.ok(existsSync(fileFor(`${BASE}${productPath(p)}photo.svg`)), `missing photo for ${p.id}`);
      const html = readFileSync(f, 'utf8');
      assert.match(html, /"@type":"Product"/, `${p.id}: no Product JSON-LD`);
      assert.doesNotMatch(html, /"(offers|aggregateRating|review)"\s*:/, `${p.id}: Product JSON-LD must not carry prices, ratings or reviews`);
    }
  });

  it('/go/ pages stay out of the sitemap; robots.txt disallows them', () => {
    const sitemap = readFileSync(join(DIST, 'sitemap.xml'), 'utf8');
    assert.doesNotMatch(sitemap, /\/go\//);
    for (const p of publicProducts()) assert.ok(sitemap.includes(`${BASE}${productPath(p)}`), `sitemap is missing ${productPath(p)}`);
    assert.match(readFileSync(join(DIST, 'robots.txt'), 'utf8'), /^Disallow: \/go\/$/m);
  });

  it('publishes the link report and sitemap watch for HMI mode', () => {
    for (const f of ['link-health.json', 'sitemap-watch.json', 'sitemap-snapshot.json']) assert.ok(existsSync(join(DIST, 'data', f)), `missing /data/${f}`);
  });
});
