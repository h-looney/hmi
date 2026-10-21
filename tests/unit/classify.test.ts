/**
 * Classifier tests — no network. Fixtures in tests/fixtures/link-health/ are real responses saved on 2026-10-21 with
 * scripts/link-health/capture-fixture.ts: status, redirect chain and headers as received, with the body reduced to what
 * the classifier reads (title, a few meta tags, headings, JSON-LD and a short text sample — bot-check pages whole), so
 * no site copy is kept. The synthetic cases below cover shapes that are hard to catch live.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { classify, isGenericList, isHomepage, sameAddress } from '../../scripts/link-health/classify.ts';
import type { FetchResult } from '../../scripts/link-health/http.ts';
import { readPage } from '../../scripts/link-health/page.ts';
import type { OutboundLink } from '../../src/data/links.ts';

const fixture = (name: string): FetchResult => JSON.parse(readFileSync(new URL(`../fixtures/link-health/${name}.json`, import.meta.url), 'utf8'));

type L = Pick<OutboundLink, 'url' | 'kind' | 'fingerprint' | 'hosts'>;
const brand = (url: string, fingerprint: string[], hosts: string[] = []): L => ({ kind: 'brand', url, fingerprint, hosts });
const model = (url: string, fingerprint: string[], hosts: string[] = []): L => ({ kind: 'model', url, fingerprint, hosts });

function page(html: string, over: Partial<FetchResult> = {}): FetchResult {
  const url = over.url ?? 'https://www.example-hearth.com/products/aurora-36/';
  return { url, status: 200, finalUrl: url, chain: [{ url, status: 200 }], contentType: 'text/html; charset=utf-8', body: html, via: 'fetch', ms: 120, ...over };
}

describe('audit links from 2026-10-21 (saved responses)', () => {
  it('Avalon → lands on Lopi’s homepage: wrong page', () => {
    const v = classify(brand('http://www.avalonproduct.com', ['Avalon'], ['avalonproduct.com']), fixture('avalon-to-lopi'));
    assert.equal(v.status, 'wrong-page');
    assert.match(v.reason, /lopistoves\.com/);
  });

  it('Heatilator Eco Choice → lands on Forge & Flame’s Quadra-Fire page: wrong page', () => {
    const v = classify(brand('http://www.heatilatorecochoice.com/', ['Eco Choice', 'EcoChoice'], ['heatilatorecochoice.com']), fixture('ecochoice-to-quadrafire'));
    assert.equal(v.status, 'wrong-page');
    assert.match(v.reason, /forgenflame\.com\/pages\/quadra-fire/);
  });

  it('retired Fireplaces.com syndicated catalog: dead', () => {
    const v = classify(model('http://www.fireplaces.com/Syndicated/Catalog/Browse.aspx?did=0013000000MqUbdAAF&type=fireplace&fuel=wood&brand=hng', ['Heat & Glo']), fixture('fireplaces-com-404'));
    assert.equal(v.status, 'dead');
    assert.equal(v.reason, 'HTTP 404 Not Found');
  });

  it('Hearthstone FAQ: dead (404)', () => {
    assert.equal(classify(brand('https://www.hearthstonestoves.com/hearthstone/en/FAQ', ['FAQ']), fixture('hearthstone-faq-404')).status, 'dead');
  });

  it('boralamerica.com doesn’t answer: dead (timeout)', () => {
    const v = classify(brand('http://www.boralamerica.com/stone/cultured-stone', ['Cultured Stone']), fixture('boral-timeout'));
    assert.equal(v.status, 'dead');
    assert.match(v.reason, /timeout|didn’t answer/);
  });

  it('Cultured Stone → Westlake Royal’s Cultured Stone page: moved', () => {
    const v = classify(brand('https://www.culturedstone.com', ['Cultured Stone'], ['culturedstone.com']), fixture('cultured-stone-moved'));
    assert.equal(v.status, 'moved');
    assert.equal(v.finalUrl, 'https://www.westlakeroyalbuildingproducts.com/stone/cultured-stone');
    assert.match(v.reason, /update the stored URL/);
  });

  it('Thermo-Rite → TK Fireside (a rebrand): moved', () => {
    const v = classify(brand('https://www.thermo-rite.com', ['Thermo-Rite', 'TK Fireside'], ['thermo-rite.com', 'tkfireside.com']), fixture('thermo-rite-moved'));
    assert.equal(v.status, 'moved');
    assert.equal(new URL(v.finalUrl).hostname, 'tkfireside.com');
  });

  it('quadrafire.com → forgenflame.com/pages/quadra-fire (a known move): moved, not wrong page', () => {
    const v = classify(brand('http://www.quadrafire.com/', ['Quadra-Fire'], ['quadrafire.com', 'forgenflame.com']), fixture('quadrafire-to-ff'));
    assert.equal(v.status, 'moved');
  });

  it('Dimplex root → /en-us is a routine redirect: ok', () => {
    const v = classify(brand('https://www.dimplex.com', ['Dimplex'], ['dimplex.com']), fixture('dimplex-root'));
    assert.equal(v.status, 'ok');
  });

  it('Cultured Stone behind an AWS WAF JavaScript challenge (HTTP 202): blocked, never dead', () => {
    const v = classify(brand('https://www.culturedstone.com', ['Cultured Stone'], ['culturedstone.com']), fixture('cultured-stone-awswaf-202'));
    assert.equal(v.status, 'blocked');
    assert.match(v.reason, /AWS WAF/);
  });

  it('Dimplex answering a plain HTTP client with 403 “Access denied”: blocked, retry in a browser', () => {
    const v = classify(brand('http://www.dimplex.com/en/', ['Dimplex'], ['dimplex.com']), fixture('dimplex-en'));
    assert.equal(v.status, 'blocked');
    assert.equal(v.needsBrowser, true);
  });

  it('Forge & Flame brand collection → generic /collections/wood-stoves: wrong page', () => {
    const v = classify(model('https://forgenflame.com/collections/quadra-fire-wood-stoves', ['Quadra-Fire'], ['forgenflame.com']), fixture('ff-collection-redirect'));
    assert.equal(v.status, 'wrong-page');
    assert.match(v.reason, /general list/);
  });

  it('Fireplace Xtrordinair product information → /products/: wrong page', () => {
    assert.equal(classify(model('http://www.fireplacex.com/Support/ProductInformation.aspx', ['Product Information']), fixture('fpx-products-redirect')).status, 'wrong-page');
  });

  it('a live model page that shows its name: ok', () => {
    const v = classify(model('https://forgenflame.com/products/quadra-fire-3100-millennium-wood-stove', ['3100 Millennium'], ['forgenflame.com']), fixture('ff-3100-ok'));
    assert.equal(v.status, 'ok');
    assert.equal(v.matched?.in, 'title');
  });

  it('a client-rendered page with an empty <title> still matches on its <h1>', () => {
    const v = classify(model('https://www.heatnglo.com/fireplaces/gas/indoor/mezzo-gas-fireplace', ['Mezzo']), fixture('heatnglo-mezzo-ssr'));
    assert.equal(v.status, 'ok');
    assert.equal(v.matched?.in, 'h1');
  });

  it('a brand homepage that only names itself in og:site_name / Organization: ok for brand links', () => {
    assert.equal(classify(brand('https://www.montigo.com', ['Montigo']), fixture('montigo-home')).status, 'ok');
  });
});

describe('synthetic cases', () => {
  const productHtml = (title: string, h1 = title, extra = '') => `<html><head><title>${title}</title></head><body><h1>${h1}</h1>${extra}<p>Specs and options.</p></body></html>`;

  it('DNS failure: dead with a plain reason', () => {
    const v = classify(model('https://gone.example', ['Aurora']), page('', { status: 0, error: { code: 'ENOTFOUND', message: 'getaddrinfo ENOTFOUND' } }));
    assert.equal(v.status, 'dead');
    assert.match(v.reason, /DNS/);
  });

  it('TLS failure: dead', () => {
    assert.equal(classify(model('https://bad-cert.example', ['Aurora']), page('', { status: 0, error: { code: 'CERT_HAS_EXPIRED', message: 'certificate has expired' } })).status, 'dead');
  });

  it('HTTP 500: dead', () => {
    assert.equal(classify(model('https://www.example-hearth.com/p', ['Aurora']), page('<title>Error</title>', { status: 500 })).status, 'dead');
  });

  it('403 without a bot-check page: dead, but worth a browser retry', () => {
    const v = classify(model('https://www.example-hearth.com/p', ['Aurora']), page('<title>Forbidden</title>', { status: 403 }));
    assert.equal(v.status, 'dead');
    assert.equal(v.needsBrowser, true);
  });

  it('Cloudflare challenge (503 “Just a moment…”): blocked', () => {
    const v = classify(model('https://www.example-hearth.com/p', ['Aurora']), page('<html><head><title>Just a moment...</title></head><body><script src="/cdn-cgi/challenge-platform/h/b/orchestrate/chl_page/v1"></script></body></html>', { status: 503, headers: { server: 'cloudflare', 'cf-mitigated': 'challenge' } }));
    assert.equal(v.status, 'blocked');
    assert.match(v.reason, /Cloudflare/);
  });

  it('429 with a CAPTCHA: blocked', () => {
    assert.equal(classify(model('https://www.example-hearth.com/p', ['Aurora']), page('<html><head><title>Hold on</title></head><body><div class="g-recaptcha"></div></body></html>', { status: 429 })).status, 'blocked');
  });

  it('200 page titled “Page not found”: soft 404', () => {
    const v = classify(model('https://www.example-hearth.com/products/aurora-36/', ['Aurora 36']), page(productHtml('Page Not Found | Example Hearth', 'Oops! That page can’t be found.')));
    assert.equal(v.status, 'soft-404');
  });

  it('“This product has been discontinued” in the body: soft 404', () => {
    const v = classify(model('https://www.example-hearth.com/products/aurora-36/', ['Aurora 36']), page(productHtml('Aurora 36 | Example Hearth', 'Aurora 36', '<div class="notice">This product has been discontinued.</div>')));
    assert.equal(v.status, 'soft-404');
  });

  it('JSON-LD offer availability Discontinued: soft 404', () => {
    const ld = '<script type="application/ld+json">{"@context":"https://schema.org","@type":"Product","name":"Aurora 36","offers":{"@type":"Offer","availability":"https://schema.org/Discontinued"}}</script>';
    assert.equal(classify(model('https://www.example-hearth.com/products/aurora-36/', ['Aurora 36']), page(productHtml('Aurora 36', 'Aurora 36', ld))).status, 'soft-404');
  });

  it('fingerprint only in a JSON-LD Product name: ok', () => {
    const ld = '<script type="application/ld+json">[{"@type":"BreadcrumbList"},{"@type":"Product","name":"Aurora&trade; 36 Gas Insert"}]</script>';
    const v = classify(model('https://www.example-hearth.com/products/aurora-36/', ['Aurora 36']), page(productHtml('Example Hearth', 'Gas inserts', ld)));
    assert.equal(v.status, 'ok');
    assert.equal(v.matched?.in, 'product');
  });

  it('model link redirected to the brand homepage: wrong page', () => {
    const v = classify(
      model('https://www.example-hearth.com/products/aurora-36/', ['Aurora 36']),
      page(productHtml('Example Hearth — Fireplaces & Stoves', 'Find your fire'), { finalUrl: 'https://www.example-hearth.com/', chain: [{ url: 'https://www.example-hearth.com/products/aurora-36/', status: 301 }, { url: 'https://www.example-hearth.com/', status: 200 }] }),
    );
    assert.equal(v.status, 'wrong-page');
    assert.match(v.reason, /homepage/);
  });

  it('model page at a new path on the same site, still showing the model: moved', () => {
    const v = classify(
      model('https://www.example-hearth.com/products/aurora-36/', ['Aurora 36']),
      page(productHtml('Aurora 36 Gas Insert | Example Hearth'), { finalUrl: 'https://www.example-hearth.com/inserts/gas/aurora-36-insert/' }),
    );
    assert.equal(v.status, 'moved');
  });

  it('page that loads at the same address but no longer mentions the model: wrong page, recheck in a browser', () => {
    const v = classify(model('https://www.example-hearth.com/products/aurora-36/', ['Aurora 36']), page(productHtml('Gas Inserts | Example Hearth', 'Gas inserts')));
    assert.equal(v.status, 'wrong-page');
    assert.equal(v.needsBrowser, true);
    assert.match(v.reason, /it shows “Gas Inserts \| Example Hearth”/);
  });

  it('page with no title or heading at all (JavaScript-rendered shell): wrong page for now, recheck in a browser', () => {
    const v = classify(model('https://www.example-hearth.com/products/aurora-36/', ['Aurora 36']), page('<html><head></head><body><div id="root"></div></body></html>'));
    assert.equal(v.needsBrowser, true);
  });

  it('http → https and www are routine: ok', () => {
    const v = classify(
      model('http://example-hearth.com/products/aurora-36', ['Aurora 36']),
      page(productHtml('Aurora 36'), { finalUrl: 'https://www.example-hearth.com/products/aurora-36/', chain: [{ url: 'http://example-hearth.com/products/aurora-36', status: 301 }, { url: 'https://www.example-hearth.com/products/aurora-36/', status: 200 }] }),
    );
    assert.equal(v.status, 'ok');
  });

  // heatilator.com (Next.js) sends its <title> and meta tags in <head> on some requests and after ~900 KB of page
  // data on others; on 2026-10-21 GitHub's runner got the late version and the check missed the title
  it('a <title> streamed at the end of a large page is still read: ok', () => {
    const data = `<script>self.__next_f.push([1,"${'x'.repeat(600_000)}"])</script>`;
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${'.a{color:red}'.repeat(25_000)}</style></head><body><h1>Introducing the IntelliFire App</h1>${data}<title>Heatilator Home Page | Heatilator</title><meta property="og:site_name" content="Heatilator"/></body></html>`;
    const v = classify(brand('https://www.heatilator.com', ['Heatilator'], ['heatilator.com']), page(html, { url: 'https://www.heatilator.com' }));
    assert.equal(v.status, 'ok');
    assert.equal(v.matched?.in, 'title');
    assert.deepEqual(readPage(html).siteNames, ['Heatilator']);
  });

  it('an icon’s <title> inside an inline SVG is never taken for the page title', () => {
    const facts = readPage('<html><head></head><body><svg viewBox="0 0 24 24"><title>Search</title><path d="M0 0"/></svg><h1>Gas inserts</h1></body></html>');
    assert.equal(facts.title, '');
    assert.equal(readPage('<html><body><svg><title>Menu</title></svg><h1>Aurora 36</h1><title>Aurora 36 | Example</title></body></html>').title, 'Aurora 36 | Example');
  });

  it('fingerprints ignore case, ™/® marks and punctuation, but need whole words', () => {
    const u = 'https://www.example-hearth.com/products/aurora-36/';
    assert.equal(classify(model(u, ['Northfield GSR2']), page(productHtml('NORTHFIELD™ GSR2 | Example'))).status, 'ok');
    assert.notEqual(classify(model(u, ['Aurora 3']), page(productHtml('Aurora 36 | Example'))).status, 'ok');
  });
});

describe('address helpers', () => {
  it('locale roots count as the homepage', () => {
    assert.ok(isHomepage(new URL('https://www.dimplex.com/en-us')));
    assert.ok(isHomepage(new URL('https://www.dimplex.com/en-us/homepage')));
    assert.ok(isHomepage(new URL('https://www.monessenshop.com/default.asp')));
    assert.ok(!isHomepage(new URL('https://www.lopistoves.com/product/northfield/')));
  });

  it('sameAddress ignores scheme, www, trailing slash and query', () => {
    assert.ok(sameAddress(new URL('http://lopistoves.com/product/northfield'), new URL('https://www.lopistoves.com/product/northfield/?utm_source=x')));
    assert.ok(!sameAddress(new URL('https://www.lopistoves.com/product/northfield/'), new URL('https://www.lopistoves.com/product/northfield-radiant-mv/')));
  });

  it('recognises collection and category pages', () => {
    const empty = readPage('<html></html>');
    assert.ok(isGenericList(new URL('https://forgenflame.com/collections/wood-stoves'), empty));
    assert.ok(isGenericList(new URL('https://empirehearth.com/product-category/gas/'), empty));
    assert.ok(!isGenericList(new URL('https://forgenflame.com/products/vermont-castings-defiant-wood-stove'), empty));
    assert.ok(!isGenericList(new URL('https://forgenflame.com/collections/wood-stoves/products/vermont-castings-defiant-wood-stove'), empty));
  });
});

describe('firewall block pages count as bot checks (never dead)', () => {
  const url = 'https://www.example-hearth.com/products/aurora-36/';
  const blocked = (status: number, body: string, headers: Record<string, string> = {}) =>
    classify({ kind: 'model', url, fingerprint: ['Aurora 36'], hosts: [] }, { url, status, finalUrl: url, chain: [{ url, status }], contentType: 'text/html', headers, body, via: 'fetch', ms: 90 });

  it('Wordfence “Your access to this site has been limited”', () => {
    assert.equal(blocked(503, '<html><head><title>Your access to this site has been limited by the site owner</title></head><body><h1>Your access to this site has been limited by the site owner</h1><p>Generated by Wordfence</p></body></html>').status, 'blocked');
  });

  it('CloudFront “Request blocked”', () => {
    assert.equal(blocked(403, '<HTML><HEAD><TITLE>ERROR: The request could not be satisfied</TITLE></HEAD><BODY><H1>403 ERROR</H1><H2>The request could not be satisfied.</H2>Request blocked. Generated by cloudfront (CloudFront)</BODY></HTML>', { server: 'CloudFront' }).status, 'blocked');
  });

  it('Cloudflare “Sorry, you have been blocked”', () => {
    assert.equal(blocked(403, '<html><head><title>Attention Required!</title></head><body><h1>Sorry, you have been blocked</h1><h2>You are unable to access example-hearth.com</h2></body></html>').status, 'blocked');
  });

  // Vercel's firewall can show datacenter traffic (CI runners included) this page instead of the site
  const checkpoint = (extra = '') =>
    `<!DOCTYPE html><html lang="en"><head><title>Vercel Security Checkpoint</title><meta name="robots" content="noindex"></head><body>${extra}<noscript>Please enable JavaScript to continue.</noscript><script src="/.well-known/vercel/security/static/challenge.v2.min.js"></script></body></html>`;

  it('Vercel Security Checkpoint (429, x-vercel-mitigated: challenge)', () => {
    const v = blocked(429, checkpoint(), { server: 'Vercel', 'x-vercel-mitigated': 'challenge' });
    assert.equal(v.status, 'blocked');
    assert.match(v.reason, /Vercel Security Checkpoint/);
  });

  it('the same checkpoint as a browser renders it (200, with a heading of its own)', () => {
    assert.equal(blocked(200, checkpoint('<h1>We’re verifying your browser</h1>')).status, 'blocked');
  });

  it('a normal page that only loads a firewall script is not a bot check', () => {
    const v = blocked(200, '<html><head><title>Aurora 36 | Example Hearth</title></head><body><h1>Aurora 36</h1><script src="/cdn-cgi/challenge-platform/scripts/jsd/main.js"></script></body></html>', { server: 'cloudflare' });
    assert.equal(v.status, 'ok');
  });

  it('a plain 404 is still dead', () => {
    assert.equal(blocked(404, '<html><head><title>Page not found</title></head><body><h1>Page not found</h1></body></html>').status, 'dead');
  });
});

describe('firewall headers on normal responses', () => {
  it('a PDF served through Imperva (x-iinfo header) is a working link, not a bot check', () => {
    const url = 'https://downloads.hearthnhome.com/installManuals/2502_981-6000CIFT_8000CIFT-owner.pdf';
    const v = classify(
      { kind: 'model', url, fingerprint: ['6000C'], hosts: ['downloads.hearthnhome.com'] },
      { url, status: 200, finalUrl: url, chain: [{ url, status: 200 }], contentType: 'application/pdf', headers: { 'x-iinfo': '12-14836975-14836979 NNNN CT(7 12 0)' }, body: '', via: 'fetch', ms: 90 },
    );
    assert.equal(v.status, 'ok');
  });

  it('the same header on a 403 is a bot check', () => {
    const url = 'https://www.example-hearth.com/products/aurora-36/';
    const v = classify({ kind: 'model', url, fingerprint: ['Aurora 36'], hosts: [] }, { url, status: 403, finalUrl: url, chain: [{ url, status: 403 }], contentType: 'text/html', headers: { 'x-iinfo': '1-2-3 NNNN' }, body: '<html><body></body></html>', via: 'fetch', ms: 90 });
    assert.equal(v.status, 'blocked');
  });
});
