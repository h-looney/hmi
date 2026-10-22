/**
 * Browser tests — `npm run test:browser` (after `npm run build -- --site https://h-looney.github.io --base /hmi`).
 *
 * Serves the build under /hmi like GitHub Pages and drives headless Chrome (CHROME_PATH, or the usual install paths):
 *   - model pages, category pages and the quote / service prefill, axe-clean at 1440 px and 390 px, no sideways scroll
 *   - /go/ redirects: normal, moved and every kind of fallback, with the click recorded for HMI mode
 *   - HMI mode's Website section: products, edits, link health, suggestions, clicks, weekly summary, tags, permissions
 *   - the existing public pages and HMI mode sections still load without console errors
 *
 * Fallbacks need links that fail, so a second build is made from a synthetic link report (DIST stays untouched).
 * No request leaves the machine: external navigations and assets are stubbed.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { crc32, deflateSync } from 'node:zlib';
import type { Page } from 'puppeteer-core';
import { buildReport, type Checked } from '../../scripts/link-health/run.ts';
import { outboundLinks } from '../../src/data/links.ts';
import { productPath, products, productsIn, publicProducts } from '../../src/data/products.ts';
import type { SitemapFeed } from '../../src/data/sitemapFeed.ts';
import { assert, axe, closeBrowser, goto, launch, noSideScroll, officeReady, open, results, signIn, sleep, tabStops, test } from './harness.ts';
import { serve } from './server.ts';

const DIST = process.env.DIST ?? 'dist';
assert(existsSync(join(DIST, 'index.html')) && readFileSync(join(DIST, 'index.html'), 'utf8').includes('/hmi/favicon.svg'), `Build ${DIST}/ first with --base /hmi`);

/* ---------- A second build with known failures, for the fallbacks ---------- */

const fixDir = mkdtempSync(join(tmpdir(), 'hmi-browser-'));
function writeFixtures() {
  const fail: Record<string, Partial<Checked['verdict']>> = {
    'heat-glo-mezzo-48': { status: 'dead', reason: 'HTTP 404 Not Found', httpStatus: 404 },
    'quadra-fire': { status: 'dead', reason: 'the domain no longer exists (DNS lookup failed)', httpStatus: 0 },
    'lopi-support': { status: 'wrong-page', reason: 'sends visitors to the lopistoves.com homepage' },
    'thermo-rite': { status: 'moved', reason: 'the page now lives at tkfireside.com — update the stored URL', finalUrl: 'https://tkfireside.com/' },
    'cultured-stone': { status: 'moved', reason: 'the page now lives at westlakeroyalbuildingproducts.com/stone/cultured-stone — update the stored URL', finalUrl: 'https://www.westlakeroyalbuildingproducts.com/stone/cultured-stone' },
    dimplex: { status: 'unverified', reason: 'still behind a bot check in a real browser (access denied)' },
  };
  const checked: Checked[] = outboundLinks().map((link) => ({ link, attempts: 1, verdict: { status: 'ok', reason: 'loads', finalUrl: link.url, httpStatus: 200, via: 'fetch', ...fail[link.slug] } as Checked['verdict'] }));
  writeFileSync(join(fixDir, 'report.json'), JSON.stringify(buildReport(checked, null, { trigger: 'nightly', startedAt: Date.now() - 20_000, browser: true })));
  const now = new Date().toISOString();
  const feed: SitemapFeed = {
    version: 1,
    generatedAt: now,
    mode: 'diff',
    previousAt: new Date(Date.now() - 7 * 86_400_000).toISOString(),
    durationMs: 60_000,
    brands: [
      { brand: 'lopi', name: 'Lopi', source: 'robots.txt', products: 38, onList: 3, added: 2, removed: 0, notOnList: 35 },
      { brand: 'vermont-castings', name: 'Vermont Castings', source: 'robots.txt', products: 8, onList: 2, added: 0, removed: 1, notOnList: 6 },
    ],
    suggestions: [
      { id: 'test-new-1', type: 'new', brand: 'lopi', url: 'https://www.lopistoves.com/product/test-model-one/', name: 'Test Model One Stove', lastmod: now, seen: now, firstRun: false },
      { id: 'test-new-2', type: 'new', brand: 'lopi', url: 'https://www.lopistoves.com/product/test-model-two/', name: 'Test Model Two Insert', lastmod: now, seen: now, firstRun: false },
      { id: 'test-gone-1', type: 'discontinued', brand: 'vermont-castings', url: 'https://forgenflame.com/products/vermont-castings-radiance-direct-vent-gas-stove', name: 'Radiance Direct Vent', productId: 'VC-RADIANCE', lastmod: null, seen: now, firstRun: false },
    ],
  };
  writeFileSync(join(fixDir, 'sitemap-watch.json'), JSON.stringify(feed));
  writeFileSync(join(fixDir, 'sitemap-snapshot.json'), JSON.stringify({ version: 1, takenAt: now, brands: {} }));
}
writeFixtures();
// FIX_DIST reuses an earlier fixture build (handy while iterating); otherwise build one now
const fixDist = process.env.FIX_DIST ?? join(fixDir, 'dist');
if (!process.env.FIX_DIST || !existsSync(join(fixDist, 'index.html'))) {
  mkdirSync(fixDist, { recursive: true });
  console.log('Building a copy with failing links for the fallback tests…');
  execFileSync('npx', ['astro', 'build', '--site', 'https://h-looney.github.io', '--base', '/hmi', '--outDir', fixDist], { env: { ...process.env, LINK_HEALTH_DIR: fixDir }, stdio: ['ignore', 'ignore', 'inherit'] });
}

const REAL = 'http://127.0.0.1:4601';
const FIX = 'http://127.0.0.1:4602';
const servers = [await serve(DIST, '/hmi', 4601), await serve(fixDist, '/hmi', 4602)];
await launch();

const mezzo = products.find((p) => p.id === 'HG-MEZZO48')!;
const mezzoPath = `/hmi${productPath(mezzo)}`;
const clicksIn = async (page: import('puppeteer-core').Page, origin: string) => {
  await page.goto(`${origin}/hmi/robots.txt`);
  return page.evaluate(() => JSON.parse(localStorage.getItem('hmi-go-clicks') ?? '[]') as { slug: string; mode: string; from?: string }[]);
};

/* ---------- Model and category pages ---------- */
console.log('\nModel pages');

await test('Heat & Glo Mezzo 48: heading, specs, displays, quote and “Full specs” links, Product JSON-LD', async () => {
  const { page } = await open();
  await goto(page, `${REAL}${mezzoPath}`);
  assert((await page.$eval('h1', (h) => h.textContent?.trim())) === 'Heat & Glo Mezzo 48', 'wrong h1');
  const specs = await page.$$eval('.specs dt', (d) => d.map((x) => x.textContent?.trim()));
  assert(specs.includes('Heat input') && specs.includes('Fuel'), `specs: ${specs.join(', ')}`);
  const stores = await page.$$eval('.mdisplay a.store-row__name', (a) => a.map((x) => x.getAttribute('href')));
  assert(stores.includes('/hmi/locations/osage-beach/') && stores.includes('/hmi/locations/nixa/'), `display links: ${stores.join(', ')}`);
  const quote = await page.$eval('.mhero__actions a.btn--primary', (a) => a.getAttribute('href'));
  assert(quote === '/hmi/contact/?interest=gas-fireplaces&model=HG-MEZZO48', `quote link: ${quote}`);
  const outbound = await page.$$eval('a[data-outbound]', (a) => a.map((x) => x.getAttribute('href')));
  assert(outbound.length > 0 && outbound.every((h) => h === '/hmi/go/heat-glo-mezzo-48/'), `full specs links: ${outbound.join(', ')}`);
  const ld = await page.$$eval('script[type="application/ld+json"]', (s) => s.map((x) => JSON.parse(x.textContent ?? '{}')));
  const product = ld.find((x) => x['@type'] === 'Product');
  assert(product && product.name === 'Heat & Glo Mezzo 48' && product.brand?.name === 'Heat & Glo' && product.model === 'Mezzo 48' && /photo\.svg$/.test(product.image), `Product JSON-LD: ${JSON.stringify(product)}`);
  assert(!('offers' in product) && !('aggregateRating' in product) && !('review' in product), 'Product JSON-LD has prices or ratings');
  const html = await page.content();
  assert(!/\$\s?\d/.test(await page.$eval('main', (m) => m.textContent ?? '')), 'a price is shown on the page');
  assert(!/heatnglo\.com\/fireplaces/.test(html.replace(/<script type="application\/ld\+json"[\s\S]*?<\/script>/g, '')), 'page links to the manufacturer directly');
  await axe(page, 'Mezzo 48 page (1440 px)');
  const stops = await tabStops(page, 40);
  assert(stops.some((s) => s.includes('/hmi/contact/?interest=gas-fireplaces&model=HG-MEZZO48')), 'Get a quote is not reachable by keyboard');
  assert(stops.some((s) => s.includes('/hmi/go/heat-glo-mezzo-48/')), 'Full specs is not reachable by keyboard');
});

await test('Mezzo 48 at 390 px: axe-clean, no sideways scroll', async () => {
  const { page } = await open({ width: 390 });
  await goto(page, `${REAL}${mezzoPath}`);
  await noSideScroll(page, 'Mezzo 48 page');
  await axe(page, 'Mezzo 48 page (390 px)');
});

await test(`every model page loads (${publicProducts().length}), with its photo`, async () => {
  const { page } = await open();
  for (const p of publicProducts()) {
    const res = await goto(page, `${REAL}/hmi${productPath(p)}`);
    assert(res?.status() === 200, `${p.id}: HTTP ${res?.status()}`);
    const h1 = await page.$eval('h1', (h) => h.textContent ?? '');
    assert(h1.includes(p.model), `${p.id}: h1 “${h1}”`);
    const img = await page.$eval('.gallery__frame img', (i) => ({ ok: (i as HTMLImageElement).complete && (i as HTMLImageElement).naturalWidth > 0, alt: i.getAttribute('alt') }));
    assert(img.ok && img.alt?.includes(p.model), `${p.id}: photo placeholder missing or unlabelled`);
  }
});

await test('discontinued model (Heat & Glo 6000C): notice, no quote button, service & parts, owner’s manual link', async () => {
  for (const width of [1440, 390]) {
    const { page } = await open({ width });
    await goto(page, `${REAL}/hmi/products/gas-fireplaces/heat-glo-6000c/`);
    const notice = await page.$eval('.notice__title', (n) => n.textContent ?? '');
    assert(/no longer makes the 6000C/.test(notice), `notice: ${notice}`);
    const primary = await page.$eval('.mhero__actions a.btn--primary', (a) => ({ text: a.textContent?.trim(), href: a.getAttribute('href') }));
    assert(/service and parts/.test(primary.text ?? '') && primary.href === '/hmi/service-request/?brand=Heat%20%26%20Glo&model=6000C', `primary action: ${JSON.stringify(primary)}`);
    const out = await page.$eval('a[data-outbound]', (a) => ({ text: a.textContent?.trim(), href: a.getAttribute('href') }));
    assert(/Owner’s manual \(PDF\) from Heat & Glo/.test(out.text ?? '') && out.href === '/hmi/go/heat-glo-6000c/', `outbound: ${JSON.stringify(out)}`);
    if (width === 390) await noSideScroll(page, '6000C page');
    await axe(page, `6000C page (${width} px)`);
  }
});

await test('category page lists its models (gas fireplaces): cards, and discontinued ones in “still service them”', async () => {
  for (const width of [1440, 390]) {
    const { page } = await open({ width });
    await goto(page, `${REAL}/hmi/products/gas-fireplaces/`);
    const cards = await page.$$eval('#models .model-card a.card__link', (a) => a.map((x) => x.getAttribute('href')));
    const want = productsIn('gas-fireplaces').filter((p) => p.status === 'current');
    assert(cards.length === want.length && want.every((p) => cards.includes(`/hmi${productPath(p)}`)), `cards: ${cards.join(', ')}`);
    const retired = await page.$$eval('.retired__list a', (a) => a.map((x) => x.textContent?.trim()));
    assert(retired.includes('Heat & Glo 6000C') && retired.includes('Heatilator Caliber nXt 36'), `retired: ${retired.join(', ')}`);
    if (width === 390) await noSideScroll(page, 'gas fireplaces page');
    await axe(page, `gas fireplaces page (${width} px)`);
  }
});

await test('“Get a quote on this model” prefills the quote form, and the model can be removed', async () => {
  const { page } = await open({ width: 390 });
  await goto(page, `${REAL}/hmi/contact/?interest=gas-fireplaces&model=HG-MEZZO48`);
  const note = await page.$eval('[data-model-note]', (n) => ({ hidden: (n as HTMLElement).hidden, text: n.textContent ?? '' }));
  assert(!note.hidden && note.text.includes('Heat & Glo Mezzo 48'), `model note: ${JSON.stringify(note)}`);
  assert(await page.$eval('input[name="interests"][value="gas-fireplaces"]', (i) => (i as HTMLInputElement).checked), 'gas fireplaces not pre-checked');
  assert((await page.$eval('[data-model-input]', (i) => (i as HTMLInputElement).value)) === 'Heat & Glo Mezzo 48', 'hidden model field not set');
  await noSideScroll(page, 'contact page');
  await axe(page, 'contact page with a model (390 px)');
  await page.click('[data-model-clear]');
  assert(await page.$eval('[data-model-note]', (n) => (n as HTMLElement).hidden), 'model note still showing after Remove');
});

await test('“Ask us about service and parts” prefills the service form', async () => {
  const { page } = await open();
  await goto(page, `${REAL}/hmi/service-request/?brand=Heat%20%26%20Glo&model=6000C`);
  const v = await page.evaluate(() => ({ brand: (document.querySelector('select[name="brand"]') as HTMLSelectElement).selectedOptions[0]?.text, model: (document.querySelector('input[name="model"]') as HTMLInputElement).value }));
  assert(v.brand === 'Heat & Glo' && v.model === '6000C', JSON.stringify(v));
});

await test('brand directory has an anchor for every brand (brand-link fallback target)', async () => {
  const { page } = await open();
  await goto(page, `${REAL}/hmi/products/`);
  const ids = await page.$$eval('[id^="brand-"]', (e) => e.map((x) => x.id));
  for (const id of ['heat-glo', 'quadra-fire', 'cultured-stone', 'dimplex']) assert(ids.includes(`brand-${id}`), `missing #brand-${id}`);
  const go = await page.$$eval('.brand__link', (a) => a.map((x) => x.getAttribute('href')));
  assert(go.length > 20 && go.every((h) => /^\/hmi\/go\/[a-z0-9-]+\/$/.test(h ?? '')), `brand links: ${go.slice(0, 5).join(', ')}`);
});

/* ---------- /go/ redirects ---------- */
console.log('\n/go/ redirects');

await test('normal: /go/heat-glo-mezzo-48/ goes straight to the stored URL and records the click', async () => {
  const t = await open();
  await t.page.goto(`${REAL}/hmi/go/heat-glo-mezzo-48/`, { referer: `${REAL}${mezzoPath}`, waitUntil: 'networkidle0' });
  await sleep(300);
  assert(t.navigations[0] === mezzo.url, `went to ${t.navigations[0] ?? 'nowhere'}`);
  const clicks = await clicksIn((await open({ context: t.page.browserContext() })).page, REAL);
  const c = clicks.find((x) => x.slug === 'heat-glo-mezzo-48');
  assert(c && c.mode === 'direct' && c.from === mezzoPath, `click: ${JSON.stringify(clicks)}`);
});

await test('moved: /go/thermo-rite/ goes to the new address (tkfireside.com)', async () => {
  const t = await open();
  await t.page.goto(`${REAL}/hmi/go/thermo-rite/`, { waitUntil: 'networkidle0' });
  await sleep(300);
  assert(t.navigations[0] === 'https://tkfireside.com/', `went to ${t.navigations[0]}`);
});

await test('without JavaScript a /go/ page shows a heading and a visible Continue link (axe-clean)', async () => {
  const html = readFileSync(join(DIST, 'go', 'heat-glo-mezzo-48', 'index.html'), 'utf8')
    .replace(/<meta http-equiv="refresh"[^>]*>/, '')
    .replace(/<script\b[\s\S]*?<\/script>/g, '');
  for (const width of [1440, 390]) {
    const { page } = await open({ width });
    await page.setContent(html, { waitUntil: 'load' });
    const link = await page.$eval('a.go__continue', (a) => ({ text: a.textContent?.trim(), href: a.getAttribute('href') }));
    assert(link.href === mezzo.url && /Continue to heatnglo\.com/.test(link.text ?? ''), JSON.stringify(link));
    await noSideScroll(page, '/go/ page');
    await axe(page, `/go/ page (${width} px)`);
  }
});

await test('fallback: a failing model link brings people back to HMI’s page, with a notice', async () => {
  const t = await open();
  await t.page.goto(`${FIX}/hmi/go/heat-glo-mezzo-48/`, { waitUntil: 'networkidle0' });
  await t.page.waitForFunction(() => location.pathname.includes('/products/'), { timeout: 10_000 });
  assert(t.navigations.length === 0, `left the site: ${t.navigations.join(', ')}`);
  const url = new URL(t.page.url());
  assert(url.pathname === mezzoPath && url.search === '?specs=unavailable', `landed on ${t.page.url()}`);
  assert(!(await t.page.$eval('[data-specs-notice]', (n) => (n as HTMLElement).hidden)), 'notice not shown');
  assert((await t.page.$$('a[data-outbound]')).length === 0, 'still offers the failing “Full specs” link');
  await axe(t.page, 'model page after a fallback');
  const clicks = await clicksIn((await open({ context: t.page.browserContext() })).page, FIX);
  assert(clicks.some((c) => c.slug === 'heat-glo-mezzo-48' && c.mode === 'fallback'), `clicks: ${JSON.stringify(clicks)}`);
});

await test('fallback: a failing brand link uses its parent brand’s site (Quadra-Fire → Forge & Flame)', async () => {
  const t = await open();
  await t.page.goto(`${FIX}/hmi/go/quadra-fire/`, { waitUntil: 'networkidle0' });
  await sleep(300);
  assert(t.navigations[0] === new URL('https://forgenflame.com').href, `went to ${t.navigations[0]}`);
});

await test('fallback: a failing support link uses the brand’s main site (Lopi owner support → lopistoves.com)', async () => {
  const t = await open();
  await t.page.goto(`${FIX}/hmi/go/lopi-support/`, { waitUntil: 'networkidle0' });
  await sleep(300);
  assert(t.navigations[0] === new URL('https://www.lopistoves.com').href, `went to ${t.navigations[0]}`);
});

/* ---------- HMI mode: Website ---------- */
console.log('\nHMI mode — Website');

async function website(user = 'cheryl', origin = FIX, width = 1440, query = '') {
  const t = await open({ width });
  await signIn(t.page, origin, user);
  await goto(t.page, `${origin}/hmi/office/website/${query}`);
  await officeReady(t.page);
  return t;
}

await test('owners see Website in the Business group; the dashboard flags failing links', async () => {
  const t = await open();
  await signIn(t.page, FIX, 'cheryl');
  await goto(t.page, `${FIX}/hmi/office/`);
  await officeReady(t.page);
  const groups = await t.page.$$eval('.sidebar__group', (g) => g.map((x) => ({ label: x.querySelector('.sidebar__group-label')?.textContent, links: [...x.querySelectorAll('.sidebar__label')].map((l) => l.textContent) })));
  const business = groups.find((g) => g.label === 'Business');
  assert(business?.links.includes('Website'), `Business group: ${JSON.stringify(business)}`);
  await t.page.waitForFunction(() => document.body.textContent?.includes('manufacturer links failing'), { timeout: 10_000 });
});

await test('Products: every model, its status, pages, link health and displays', async () => {
  const { page } = await website();
  const rows = await page.$$eval('.table tbody tr', (r) => r.length);
  assert(rows === products.length, `${rows} rows, expected ${products.length}`);
  const mezzoRow = await page.$$eval('.table tbody tr', (r) => r.map((x) => x.textContent ?? '').find((t) => t.includes('Mezzo 48')) ?? '');
  assert(/Current/.test(mezzoRow) && /Dead/.test(mezzoRow) && /Osage Beach · Nixa/.test(mezzoRow), `Mezzo row: ${mezzoRow}`);
  const pageLink = await page.$$eval('a.link-btn', (a) => a.map((x) => x.getAttribute('href')).find((h) => h?.includes('heat-glo-mezzo-48')));
  assert(pageLink === mezzoPath, `HMI page link: ${pageLink}`);
});

await test('editing a model marks it “goes live on next publish (simulated)”, and publishing clears it', async () => {
  const { page } = await website();
  const rows = await page.$$('.table tbody tr');
  for (const r of rows) if ((await r.evaluate((x) => x.textContent ?? '')).includes('Radiance Direct Vent')) await r.evaluate((x) => (x.querySelector('.cell-main') as HTMLElement).click());
  await page.waitForSelector('dialog[open]');
  await axe(page, 'edit dialog');
  await page.select('dialog[open] select', 'discontinued');
  const save = await page.$$('dialog[open] .dialog__foot button');
  await save[1].click();
  await page.waitForFunction(() => !document.querySelector('dialog[open]'));
  await page.waitForFunction(() => document.body.textContent?.includes('Goes live on next publish (simulated)'));
  assert(await page.$('.web-pending'), 'no pending banner');
  const publish = await page.$('.web-pending button');
  await publish!.click();
  await page.waitForFunction(() => !document.querySelector('.web-pending'));
});

await test('Link health: fallbacks in effect, and one-click “update stored URL”', async () => {
  const { page } = await website('cheryl', FIX, 1440, '?tab=health');
  const text = await page.$eval('main', (m) => m.textContent ?? '');
  for (const s of ['Fallbacks in effect', 'Heat & Glo Mezzo 48', 'Quadra-Fire', 'Lopi owner support', 'HMI’s own model page', 'Thermo-Rite', 'Couldn’t verify']) assert(text.includes(s), `missing “${s}”`);
  const accept = await page.$$('.web-item__actions .btn--primary');
  assert(accept.length === 2, `${accept.length} Accept buttons (expected Thermo-Rite and Cultured Stone)`);
  await accept[0].click();
  await page.waitForFunction(() => document.querySelectorAll('.web-item__actions .btn--primary').length === 1);
  assert(await page.$('.web-pending'), 'accepting a URL should leave a pending change');
});

await test('New & discontinued: add a suggested model as a draft, dismiss one, mark one discontinued', async () => {
  const { page } = await website('cheryl', FIX, 1440, '?tab=suggestions');
  assert((await page.$eval('main', (m) => m.textContent ?? '')).includes('Lopi added 2 products — add them?'), 'no Lopi group');
  const addButtons = await page.$$('.web-groups .web-item__actions .btn--secondary');
  await addButtons[0].click();
  await page.waitForSelector('dialog[open]');
  await axe(page, 'add-model dialog');
  const btns = await page.$$('dialog[open] .dialog__foot button');
  await btns[1].click();
  await page.waitForFunction(() => !document.querySelector('dialog[open]'));
  await page.waitForFunction(() => document.querySelectorAll('.web-groups .web-item').length === 1);
  // (a toast from the last step may sit over the list, so these buttons are clicked directly)
  const dismiss = await page.$$('.web-groups .web-item__actions .btn--ghost');
  await dismiss[0].evaluate((b) => (b as HTMLButtonElement).click());
  await page.waitForFunction(() => !document.querySelector('.web-groups .web-item'));
  const mark = await page.$('.card .web-item__actions .btn--secondary');
  await mark!.evaluate((b) => (b as HTMLButtonElement).click());
  await page.waitForFunction(() => document.body.textContent?.includes('Nothing missing'));
  await page.click('#web-tab-products');
  await page.waitForFunction(() => document.body.textContent?.includes('New model (draft)'));
});

await test('Clicks: a /go/ visit in this browser shows up per product, with the server-side note', async () => {
  const t = await open();
  await t.page.goto(`${FIX}/hmi/go/heat-glo-escape-35/`, { waitUntil: 'networkidle0' });
  await signIn(t.page, FIX, 'cheryl');
  await goto(t.page, `${FIX}/hmi/office/website/?tab=clicks`);
  await officeReady(t.page);
  const text = await t.page.$eval('main', (m) => m.textContent ?? '');
  assert(text.includes('Heat & Glo Escape-35') && /server-side/.test(text), 'click not listed or note missing');
});

await test('Weekly summary: pick Gabe, preview the Monday email, send (simulated)', async () => {
  const { page } = await website('cheryl', FIX, 1440, '?tab=summary');
  await page.select('.web-digest-grid select', 'gabe');
  const subject = await page.$eval('.web-email__head strong', (s) => s.textContent ?? '');
  assert(/fixed automatically/.test(subject) && /new Lopi models to review/.test(subject), `subject: ${subject}`);
  assert((await page.$eval('.web-email__head', (h) => h.textContent ?? '')).includes('Gabe Kurtz'), 'not addressed to Gabe');
  const send = await page.$('.web-digest-grid .btn--primary');
  await send!.click();
  await page.waitForFunction(() => document.querySelector('.toaster')?.textContent?.includes('Gabe Kurtz'), { timeout: 5_000 });
});

await test('Showroom tags: one per displayed model, each with a labelled QR code for HMI’s page', async () => {
  const { page } = await website('cheryl', FIX, 1440, '?tab=tags');
  const tags = await page.$$eval('.tag', (t) => t.map((x) => ({ qr: !!x.querySelector('svg.qr path'), label: x.querySelector('svg.qr')?.getAttribute('aria-label'), url: x.querySelector('.tag__url')?.textContent })));
  assert(tags.length > 5 && tags.every((t) => t.qr && t.label?.startsWith('QR code for') && t.url?.includes('/hmi/products/')), `tags: ${JSON.stringify(tags.slice(0, 2))}`);
});

await test('no report yet (local dev): a friendly empty state', async () => {
  const t = await open();
  await signIn(t.page, REAL, 'cheryl');
  t.page.removeAllListeners('request');
  t.page.on('request', (req) => {
    if (new URL(req.url()).pathname === '/favicon.ico') return void req.respond({ status: 204, body: '' });
    if (req.url().endsWith('/hmi/data/link-health.json')) return void req.respond({ status: 200, contentType: 'application/json', body: JSON.stringify({ none: true, reason: 'test' }) });
    if (!req.url().startsWith('http://127.0.0.1')) return void req.respond({ status: 204, body: '' });
    return void req.continue();
  });
  await goto(t.page, `${REAL}/hmi/office/website/?tab=health`);
  await officeReady(t.page);
  await t.page.waitForFunction(() => document.body.textContent?.includes('No link report yet'));
  await axe(t.page, 'link health empty state');
});

await test('permissions: store managers have Website, coordinators don’t; Settings shows the column', async () => {
  const gabe = await website('gabe', REAL);
  assert(await gabe.page.$$eval('.sidebar__label', (l) => l.some((x) => x.textContent === 'Website')), 'Gabe has no Website link');
  const amanda = await website('amanda', REAL);
  assert(!(await amanda.page.$$eval('.sidebar__label', (l) => l.some((x) => x.textContent === 'Website'))), 'Amanda sees Website');
  assert((await amanda.page.$eval('main', (m) => m.textContent ?? '')).includes('Not part of this role'), 'no “not part of this role” page');
  const t = await open();
  await signIn(t.page, REAL, 'cheryl');
  await goto(t.page, `${REAL}/hmi/office/settings/?tab=team`);
  await officeReady(t.page);
  assert(await t.page.$$eval('.perm-table thead th', (th) => th.some((x) => x.textContent === 'Website')), 'no Website column in permissions');
});

await test('Website tabs: keyboard (arrow keys move between tabs) and axe at 1440 and 390 px, no sideways scroll', async () => {
  for (const width of [1440, 390]) {
    const t = await website('cheryl', FIX, width);
    await t.page.focus('#web-tab-products');
    await t.page.keyboard.press('ArrowRight');
    await t.page.waitForFunction(() => document.activeElement?.id === 'web-tab-health' && location.search.includes('tab=health'));
    for (const tab of ['products', 'health', 'suggestions', 'clicks', 'summary', 'tags']) {
      await goto(t.page, `${FIX}/hmi/office/website/?tab=${tab}`);
      await officeReady(t.page);
      if (width === 390) await noSideScroll(t.page, `Website → ${tab}`);
      await axe(t.page, `Website → ${tab} (${width} px)`);
    }
  }
});

/* ---------- Existing pages ---------- */
console.log('\nModel photos');

/** A small striped PNG, made on the spot so no image files live in the repo */
function pngFile(name: string, w: number, h: number, [r, g, b]: [number, number, number]) {
  const stride = 1 + w * 3;
  const raw = Buffer.alloc(stride * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const k = (x + y) % 48 < 24 ? 1 : 0.8;
      raw.set([r * k, g * k, b * k], y * stride + 1 + x * 3);
    }
  }
  const chunk = (type: string, data: Buffer) => {
    const body = Buffer.concat([Buffer.from(type), data]);
    const out = Buffer.alloc(8 + data.length + 4);
    out.writeUInt32BE(data.length, 0);
    body.copy(out, 4);
    out.writeUInt32BE(crc32(body), 8 + data.length);
    return out;
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr.set([8, 2, 0, 0, 0], 8);
  const file = join(fixDir, name);
  writeFileSync(file, Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]));
  return file;
}
const landscape = pngFile('artisan-floor.png', 640, 480, [176, 82, 31]);
const portrait = pngFile('artisan-close.png', 480, 640, [47, 109, 176]);
const artisan = products.find((p) => p.id === 'MON-ART42')!;
const artisanPath = `/hmi${productPath(artisan)}`;

await test('a category with a single model keeps its card the usual size', async () => {
  const { page } = await open();
  await goto(page, `${REAL}/hmi/products/vent-free-gas/`);
  const w = await page.$eval('#models .model-card', (c) => c.getBoundingClientRect().width);
  assert(w < 460, `the only model card is ${Math.round(w)}px wide`);
});

await test('a model without photos says where to see it: the maker’s site (through /go/) or the showroom', async () => {
  const { page } = await open();
  await goto(page, `${REAL}${artisanPath}`);
  const note = await page.$eval('.gallery__note', (n) => ({ text: n.textContent?.replace(/\s+/g, ' ').trim(), links: [...n.querySelectorAll('a')].map((a) => a.getAttribute('href')) }));
  assert(note.text === 'See it on Monessen’s site (opens in a new tab) or on the showroom floor in Osage Beach.', `note says “${note.text}”`);
  assert(note.links[0] === '/hmi/go/monessen-artisan-42/' && note.links[1] === '/hmi/locations/osage-beach/', `note links: ${note.links.join(', ')}`);
});

await test('Photos: add two to a model on display, describe and reorder them; a publish shows them on its page and cards', async () => {
  const t = await website();
  const { page } = t;
  const row = async (text: string) => {
    for (const r of await page.$$('.table tbody tr')) if ((await r.evaluate((x) => x.textContent ?? '')).includes(text)) return r;
    throw new Error(`no row for ${text}`);
  };
  const add = await (await row('Artisan 42')).$('.btn');
  assert(add && (await add.evaluate((b) => b.textContent)).includes('Add photos'), 'no “Add photos” button for a model on display');
  await add.click();
  await page.waitForSelector('dialog[open] input[type=file]');
  await axe(page, 'photos dialog (empty)');
  const input = (await page.$('dialog[open] input[type=file]')) as import('puppeteer-core').ElementHandle<HTMLInputElement>;
  await input.uploadFile(landscape, portrait);
  await page.waitForFunction(() => document.querySelectorAll('dialog[open] .photo-row img').length === 2, { timeout: 20_000 });
  const alts = () => page.$$eval('dialog[open] .photo-row input.input', (xs) => xs.map((x) => (x as HTMLInputElement).value));
  const first = await alts();
  assert(first.every((a) => a === 'Monessen Artisan 42 on the Osage Beach showroom floor'), `descriptions start as ${JSON.stringify(first)}`);
  // Shrunk and re-encoded as JPEG in the browser
  const kinds = await page.$$eval('dialog[open] .photo-row img', (xs) => xs.map((x) => (x as HTMLImageElement).src.slice(0, 5)));
  assert(kinds.every((k) => k === 'blob:'), 'photos aren’t shown from this browser');
  const second = (await page.$$('dialog[open] .photo-row input.input'))[1];
  await second.click({ count: 3 });
  await second.type('Artisan 42 with its logs lit, up close');
  const makeMain = await page.$$('dialog[open] .photo-row:nth-child(2) .photo-row__actions .btn');
  await makeMain[0].click();
  await page.waitForFunction(() => (document.querySelector('dialog[open] .photo-row input.input') as HTMLInputElement | null)?.value === 'Artisan 42 with its logs lit, up close');
  // A description that's still the starting one follows the place
  await page.select('dialog[open] .photo-row:nth-child(2) select', 'nixa');
  await page.waitForFunction(() => (document.querySelectorAll('dialog[open] .photo-row input.input')[1] as HTMLInputElement | undefined)?.value === 'Monessen Artisan 42 on the Nixa showroom floor');
  await axe(page, 'photos dialog (two photos)');
  await page.$eval('dialog[open] .dialog__foot .btn--primary', (b) => (b as HTMLButtonElement).click());
  await page.waitForFunction(() => !document.querySelector('dialog[open]'));
  assert((await (await row('Artisan 42')).evaluate((x) => x.textContent ?? '')).includes('2 photos'), 'the row doesn’t say “2 photos”');
  await page.$eval('.web-pending button', (b) => (b as HTMLButtonElement).click());
  await page.waitForFunction(() => !document.querySelector('.web-pending'));

  // Same browser, public model page: the published photos take the placeholder's place, marked as a preview
  for (const width of [1440, 390]) {
    const pub = await open({ context: page.browserContext(), width, label: `photos ${width}` });
    await goto(pub.page, `${FIX}${artisanPath}`);
    await pub.page.waitForSelector('.gallery[data-preview]');
    const g = await pub.page.$eval('.gallery', (el) => ({
      slides: el.querySelectorAll('[data-slide]').length,
      shown: [...el.querySelectorAll<HTMLElement>('[data-slide]')].filter((s) => !s.hidden).map((s) => s.querySelector('img')?.alt),
      caption: el.querySelector('[data-slide]:not([hidden]) figcaption')?.textContent,
      thumbs: el.querySelectorAll('.gallery__thumb').length,
      note: el.querySelector('.gallery__note--preview')?.textContent ?? '',
    }));
    assert(g.slides === 2 && g.thumbs === 2, `${g.slides} slides, ${g.thumbs} thumbnails`);
    assert(g.shown.length === 1 && g.shown[0] === 'Artisan 42 with its logs lit, up close', `showing ${JSON.stringify(g.shown)}`);
    assert(g.caption === 'On the Osage Beach showroom floor', `caption “${g.caption}”`);
    assert(g.note.includes('Preview'), 'no preview note');
    await pub.page.$eval('.gallery__thumb[data-show="1"]', (b) => (b as HTMLButtonElement).click());
    const now = await pub.page.$eval('.gallery', (el) => ({
      alt: el.querySelector<HTMLElement>('[data-slide]:not([hidden]) img')?.getAttribute('alt'),
      caption: el.querySelector('[data-slide]:not([hidden]) figcaption')?.textContent,
      pressed: [...el.querySelectorAll('.gallery__thumb')].map((b) => b.getAttribute('aria-pressed')),
    }));
    assert(now.alt === 'Monessen Artisan 42 on the Nixa showroom floor' && now.caption === 'On the Nixa showroom floor', `second photo: ${JSON.stringify(now)}`);
    assert(now.pressed.join() === 'false,true', `thumbnail states ${now.pressed.join()}`);
    await axe(pub.page, `model page with published photos (${width}px)`);
    await noSideScroll(pub.page, `model page with published photos (${width}px)`);
    const stops = await tabStops(pub.page);
    // (on a short page the 80 Tab presses go round more than once)
    assert(new Set(stops.filter((s) => s.startsWith('button|Photo '))).size === 2, `thumbnails aren’t reachable by keyboard:\n${stops.join('\n')}`);
  }
  const cat = await open({ context: page.browserContext() });
  await goto(cat.page, `${FIX}/hmi/products/vent-free-gas/`);
  await cat.page.waitForSelector('.model-card__media[data-preview] img');
  const card = await cat.page.$eval('.model-card__media[data-preview] img', (i) => ({ src: (i as HTMLImageElement).src.slice(0, 5), alt: i.getAttribute('alt') }));
  assert(card.src === 'blob:' && card.alt === 'Artisan 42 with its logs lit, up close', `card image ${JSON.stringify(card)}`);

  // Removing one and publishing again leaves a single photo (no thumbnails). Back in HMI mode's tab, which has to be
  // in front: background tabs pause the animation frames the waits poll on
  await page.bringToFront();
  await (await (await row('Artisan 42')).$('.web-photos'))!.click();
  await page.waitForSelector('dialog[open] .photo-row');
  const remove = await page.$$('dialog[open] .photo-row:nth-child(2) .photo-row__actions .btn');
  await remove[remove.length - 1].click();
  await page.waitForFunction(() => document.querySelectorAll('dialog[open] .photo-row').length === 1);
  await page.$eval('dialog[open] .dialog__foot .btn--primary', (b) => (b as HTMLButtonElement).click());
  await page.$eval('.web-pending button', (b) => (b as HTMLButtonElement).click());
  await page.waitForFunction(() => !document.querySelector('.web-pending'));
  const again = await open({ context: page.browserContext() });
  await goto(again.page, `${FIX}${artisanPath}`);
  await again.page.waitForSelector('.gallery[data-preview]');
  const one = await again.page.$eval('.gallery', (el) => [el.querySelectorAll('[data-slide]').length, el.querySelectorAll('.gallery__thumb').length]);
  assert(one.join() === '1,0', `after removing one: ${one.join()} (slides, thumbnails)`);
});

await test('Photos: a fresh browser still sees the placeholder (nothing is published to the site)', async () => {
  const { page } = await open();
  await goto(page, `${FIX}${artisanPath}`);
  await sleep(400);
  assert(!(await page.$('.gallery[data-preview]')), 'a fresh browser shows preview photos');
  assert((await page.$eval('.gallery__frame img', (i) => i.getAttribute('alt'))) === 'Photo coming soon: Monessen Artisan 42', 'placeholder missing');
});

console.log('\nExisting pages');

const sitemap = readFileSync(join(DIST, 'sitemap.xml'), 'utf8');
const paths = [...sitemap.matchAll(/<loc>https?:\/\/[^<]*?(\/hmi\/[^<]*)<\/loc>/g)].map((m) => m[1]);

await test(`every page in the sitemap loads (${paths.length})`, async () => {
  const { page } = await open();
  for (const p of paths) {
    const res = await goto(page, `${REAL}${p}`);
    assert(res?.status() === 200, `${p}: HTTP ${res?.status()}`);
    assert((await page.title()).length > 5, `${p}: no title`);
  }
});

const keyPages = ['/', '/products/', '/products/fireplace-inserts/', '/fireplace-finder/', '/services/', '/service-request/', '/contact/', '/gallery/', '/about/', '/about/team/', '/careers/', '/locations/osage-beach/', '/locations/nixa/', '/resources/', '/does-not-exist/'];
await test(`key public pages: axe at 1440 and 390 px, no sideways scroll (${keyPages.length} pages)`, async () => {
  for (const width of [1440, 390]) {
    const { page } = await open({ width });
    for (const p of keyPages) {
      await goto(page, `${REAL}/hmi${p}`);
      if (width === 390) await noSideScroll(page, p);
      await axe(page, `${p} (${width} px)`);
    }
  }
});

/* ---------- HMI mode: signing in from the public site ---------- */
console.log('\nHMI mode — sign-in');

const pageTitle = (page: Page) => page.$eval('[data-page-title]', (h) => h.textContent?.trim());
async function pickProfile(page: Page, name: string) {
  for (const b of await page.$$('.profile-option')) if ((await b.$eval('.profile-option__name', (el) => el.textContent ?? '')).startsWith(name)) return void (await b.click());
  throw new Error(`no profile called ${name}`);
}
const signedInAs = (page: Page) => page.waitForFunction(() => document.querySelector('.user-btn__name'), { polling: 100, timeout: 15_000 }).then(() => page.$eval('.user-btn__name', (n) => n.textContent?.trim()));

await test('the public site’s “HMI mode” opens the profile picker (last one marked); the pick opens the page it pointed to', async () => {
  const t = await open();
  await signIn(t.page, REAL, 'gabe');
  await goto(t.page, `${REAL}/hmi/office/inventory/`);
  await officeReady(t.page);
  await goto(t.page, `${REAL}/hmi/products/`);
  const href = await t.page.$eval('[data-mode-hmi]', (a) => a.getAttribute('href'));
  assert(href === '/hmi/office/inventory/?signin', `the switch points at ${href}`);
  await Promise.all([t.page.waitForNavigation({ waitUntil: 'networkidle0' }), t.page.click('[data-mode-hmi]')]);
  await officeReady(t.page);
  const screen = await t.page.evaluate(() => ({
    url: location.pathname + location.search,
    last: [...document.querySelectorAll('.profile-option')].filter((b) => b.querySelector('.profile-option__last')).map((b) => b.querySelector('.profile-option__name')?.textContent ?? ''),
  }));
  assert((await pageTitle(t.page)) === 'Sign in to HMI Office', `shows “${await pageTitle(t.page)}”, not the sign-in screen`);
  assert(screen.url === '/hmi/office/inventory/', `the address keeps the flag: ${screen.url}`);
  assert(screen.last.length === 1 && screen.last[0].startsWith('Gabe Kurtz'), `marked as last used: ${screen.last.join(' | ') || 'none'}`);
  await axe(t.page, 'sign-in screen, last profile marked');

  await pickProfile(t.page, 'Cheryl');
  assert((await signedInAs(t.page)) === 'Cheryl', 'not signed in as Cheryl');
  assert((await pageTitle(t.page)) === 'Inventory', `opened “${await pageTitle(t.page)}” instead of Inventory`);
  await t.page.reload({ waitUntil: 'networkidle0' });
  await officeReady(t.page);
  assert((await pageTitle(t.page)) === 'Inventory' && (await signedInAs(t.page)) === 'Cheryl', 'a reload signed out');
});

await test('“Staff sign-in” opens the picker too; a profile without the page it pointed to starts on its own (technician → My day)', async () => {
  const t = await open({ width: 390 });
  await signIn(t.page, REAL, 'cheryl');
  await goto(t.page, `${REAL}/hmi/contact/`);
  const href = await t.page.$eval('footer a[href*="/office/"]', (a) => a.getAttribute('href'));
  assert(href === '/hmi/office/?signin', `“Staff sign-in” points at ${href}`);
  await goto(t.page, `${REAL}/hmi/office/accounting/?signin`);
  await officeReady(t.page);
  assert((await pageTitle(t.page)) === 'Sign in to HMI Office', 'no sign-in screen');
  await noSideScroll(t.page, 'sign-in screen at 390 px');
  await axe(t.page, 'sign-in screen (390 px)');
  await pickProfile(t.page, 'Luis');
  assert((await signedInAs(t.page)) === 'Luis', 'not signed in as Luis');
  await t.page.waitForFunction(() => location.pathname === '/hmi/office/my-day/', { polling: 100, timeout: 10_000 });
});

await test('HMI mode sections still load for the owner: axe at 1440 and 390 px, no sideways scroll', async () => {
  for (const width of [1440, 390]) {
    const t = await open({ width });
    await signIn(t.page, REAL, 'cheryl');
    for (const s of ['', 'my-day/', 'inbox/', 'jobs/', 'customers/', 'warranty/', 'inventory/', 'accounting/', 'analytics/', 'website/', 'settings/']) {
      await goto(t.page, `${REAL}/hmi/office/${s}`);
      await officeReady(t.page);
      if (width === 390) await noSideScroll(t.page, `/office/${s}`);
      await axe(t.page, `/office/${s} (${width} px)`);
    }
  }
});

/* ---------- Report ---------- */

await closeBrowser();
servers.forEach((s) => s.close());
rmSync(fixDir, { recursive: true, force: true });

const errors = [...new Set(results.consoleErrors)];
console.log(`\n${results.passed.length} passed · ${results.failed.length} failed · ${errors.length} console error(s)`);
for (const e of errors.slice(0, 20)) console.log(`  console: ${e}`);
process.exit(results.failed.length || errors.length ? 1 : 0);
