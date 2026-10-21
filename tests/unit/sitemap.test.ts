/** Sitemap reading and the watcher's matching rules — no network. */
import assert from 'node:assert/strict';
import { gzipSync } from 'node:zlib';
import { describe, it } from 'node:test';
import { bytesToXml, collectSitemaps, parseSitemap, sitemapsFromRobots } from '../../scripts/link-health/sitemap.ts';
import { isProduct, nameFromSlug, nameFromTitle, pageKey } from '../../scripts/link-health/sitemaps-watch.ts';
import { brandSites } from '../../src/data/products.ts';

describe('parseSitemap', () => {
  it('reads a urlset with lastmod', () => {
    const r = parseSitemap('<?xml version="1.0"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>https://www.lopistoves.com/product/northfield/</loc><lastmod>2026-09-25T19:20:20+00:00</lastmod></url><url><loc> https://www.lopistoves.com/product/cedar/ </loc></url></urlset>');
    assert.equal(r.kind, 'urlset');
    assert.deepEqual(r.entries, [
      { loc: 'https://www.lopistoves.com/product/northfield/', lastmod: '2026-09-25T19:20:20+00:00' },
      { loc: 'https://www.lopistoves.com/product/cedar/', lastmod: undefined },
    ]);
  });

  it('unwraps CDATA <loc>s (as Lopi’s and Fireplace Xtrordinair’s sitemaps do) and decodes entities', () => {
    const r = parseSitemap('<urlset><url><loc><![CDATA[https://www.fireplacex.com/product/42-apex/]]></loc></url><url><loc>https://x.example/a?b=1&amp;c=2</loc></url></urlset>');
    assert.deepEqual(r.entries.map((e) => e.loc), ['https://www.fireplacex.com/product/42-apex/', 'https://x.example/a?b=1&c=2']);
  });

  it('reads a sitemap index, including namespaced tags', () => {
    const r = parseSitemap('<sm:sitemapindex xmlns:sm="http://www.sitemaps.org/schemas/sitemap/0.9"><sm:sitemap><sm:loc>https://forgenflame.com/sitemap_products_1.xml</sm:loc></sm:sitemap></sm:sitemapindex>');
    assert.equal(r.kind, 'index');
    assert.equal(r.entries[0].loc, 'https://forgenflame.com/sitemap_products_1.xml');
  });

  it('gunzips .xml.gz sitemaps', () => {
    assert.match(bytesToXml(gzipSync('<urlset><url><loc>https://a.example/p</loc></url></urlset>')), /<urlset>/);
  });

  it('finds Sitemap: lines in robots.txt', () => {
    assert.deepEqual(sitemapsFromRobots('User-agent: *\nDisallow: /cart\nSitemap: https://a.example/sitemap.xml\nsitemap:https://a.example/news.xml\n'), ['https://a.example/sitemap.xml', 'https://a.example/news.xml']);
  });

  it('follows robots.txt → index → child maps, filtered to product sitemaps', async () => {
    const files: Record<string, string> = {
      'https://shop.example/robots.txt': 'Sitemap: https://shop.example/sitemap.xml',
      'https://shop.example/sitemap.xml': '<sitemapindex><sitemap><loc>https://shop.example/sitemap_products_1.xml</loc></sitemap><sitemap><loc>https://shop.example/sitemap_blogs_1.xml</loc></sitemap></sitemapindex>',
      'https://shop.example/sitemap_products_1.xml': '<urlset><url><loc>https://shop.example/products/harman-p43-pellet-stove</loc></url></urlset>',
    };
    const seen: string[] = [];
    const get = async (u: string) => (seen.push(u), { status: files[u] ? 200 : 404, finalUrl: u, bytes: Buffer.from(files[u] ?? ''), contentType: 'application/xml' });
    const r = await collectSitemaps('https://shop.example', { get, childFilter: /sitemap_products_/ });
    assert.equal(r.source, 'robots.txt');
    assert.deepEqual(r.entries.map((e) => e.loc), ['https://shop.example/products/harman-p43-pellet-stove']);
    assert.ok(!seen.includes('https://shop.example/sitemap_blogs_1.xml'), 'blog sitemap should not be fetched');
  });
});

describe('product URL patterns (worked out from each brand’s real sitemap)', () => {
  const yes = (brand: string, url: string) => assert.ok(isProduct(brandSites[brand].sitemap!, url), `${brand} should treat ${url} as a product`);
  const no = (brand: string, url: string) => assert.ok(!isProduct(brandSites[brand].sitemap!, url), `${brand} should not treat ${url} as a product`);

  it('Heat & Glo: model pages yes, category pages and overseas models no', () => {
    yes('heat-glo', 'https://www.heatnglo.com/fireplaces/gas/indoor/mezzo-gas-fireplace');
    yes('heat-glo', 'https://www.heatnglo.com/fireplaces/gas/gas-log-set-collections/indoor/duzy-2');
    no('heat-glo', 'https://www.heatnglo.com/fireplaces/gas/gas-log-set-collections/indoor');
    no('heat-glo', 'https://www.heatnglo.com/fireplaces/gas/indoor');
    no('heat-glo', 'https://www.heatnglo.com/fireplaces/global/australia-and-new-zealand/mezzo-series-gas-fireplace');
  });

  it('Forge & Flame: each brand only sees its own products', () => {
    yes('harman', 'https://forgenflame.com/products/harman-p43-pellet-stove');
    no('quadra-fire', 'https://forgenflame.com/products/harman-p43-pellet-stove');
    yes('vermont-castings', 'https://forgenflame.com/products/vermont-castings-defiant-wood-stove');
  });

  it('Lopi: /product/<model> yes, /products/<category> no', () => {
    yes('lopi', 'https://www.lopistoves.com/product/northfield/');
    no('lopi', 'https://www.lopistoves.com/products/gas-inserts/');
  });

  it('Kuma (listing pages, no sitemap): model pages yes, parts no', () => {
    yes('kuma', 'https://www.kumastoves.com/Store/ProductDetails/aspen-le');
    no('kuma', 'https://www.kumastoves.com/store/products/replacement-parts');
  });

  it('HPC: fire features yes, replacement parts no', () => {
    no('hpc', 'https://hpcfire.com/product/replacement-remote-small-tank-kit-lp-fppk-mlfpk');
    no('hpc', 'https://hpcfire.com/product/lava-rock-for-fire-pits');
  });
});

describe('naming and matching', () => {
  it('proposes a model name from the title or heading, without the brand or site name', () => {
    assert.equal(nameFromTitle('Answer NexGen-Hybrid™ Stove | Steel Wood Stoves | Made in USA | Lopi Stoves®', ['Answer NexGen-Hybrid™ Stove'], 'Lopi'), 'Answer NexGen-Hybrid™ Stove');
    assert.equal(nameFromTitle('Callaway 72 Gas Fireplaces | Kozy Heat Fireplaces', [], 'Kozy Heat'), 'Callaway 72 Gas Fireplaces');
    assert.equal(nameFromSlug('https://www.lopistoves.com/product/answer-nexgen-hybrid/'), 'Answer Nexgen Hybrid');
  });

  it('compares pages without scheme, www, trailing slash or case', () => {
    assert.equal(pageKey('https://www.Lopistoves.com/product/Northfield/'), pageKey('http://lopistoves.com/product/northfield'));
  });
});
