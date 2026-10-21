/** Retry logic, report history and /go/ targets — with fake fetchers, no network. */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { FetchResult } from '../../scripts/link-health/http.ts';
import { HostQueue } from '../../scripts/link-health/queue.ts';
import { buildReport, changedSince, checkLink, type Checked } from '../../scripts/link-health/run.ts';
import { resolveTarget, type LinkReport, type LinkResult, type OutboundLink } from '../../src/data/links.ts';

const link = (over: Partial<OutboundLink> = {}): OutboundLink => ({
  slug: 'example-aurora-36',
  kind: 'model',
  url: 'https://www.example-hearth.com/products/aurora-36/',
  label: 'Example Aurora 36',
  brand: 'example',
  productId: 'EX-AURORA36',
  fingerprint: ['Aurora 36'],
  hosts: ['example-hearth.com'],
  fallbacks: ['/products/gas-fireplaces/example-aurora-36/'],
  ...over,
});

const res = (over: Partial<FetchResult>): FetchResult => {
  const url = over.url ?? 'https://www.example-hearth.com/products/aurora-36/';
  return { url, status: 200, finalUrl: url, chain: [{ url, status: over.status ?? 200 }], contentType: 'text/html', body: '', via: 'fetch', ms: 50, ...over };
};
const good = res({ body: '<title>Aurora 36 | Example</title><h1>Aurora 36</h1>' });
const challenge = res({ status: 403, body: '<title>Access Denied</title><h1>Access Denied</h1>You don\'t have permission. Reference #18.6f2d3b17.1729526400.1a2b3c' });
const fast = () => new HostQueue({ perHost: 1, delayMs: 0 });

describe('checkLink: one request, one retry', () => {
  it('stops after one request when the link works', async () => {
    let calls = 0;
    const c = await checkLink(link(), { queue: fast(), browser: false, fetcher: async () => (calls++, good) });
    assert.equal(c.verdict.status, 'ok');
    assert.equal(calls, 1);
  });

  it('retries a failure once, and keeps the second answer', async () => {
    let calls = 0;
    const c = await checkLink(link(), { queue: fast(), browser: false, retryDelayMs: 0, fetcher: async () => (calls++ ? good : res({ status: 0, error: { code: 'ECONNRESET', message: 'reset' } })) });
    assert.equal(c.verdict.status, 'ok');
    assert.equal(calls, 2);
  });

  it('a bot check goes to the browser; if the browser gets through, the link is ok', async () => {
    const c = await checkLink(link(), { queue: fast(), browser: true, fetcher: async () => challenge, browserFetcher: async () => ({ ...good, via: 'browser' }) });
    assert.equal(c.verdict.status, 'ok');
    assert.equal(c.verdict.via, 'browser');
  });

  it('still blocked in the browser → unverified, never dead', async () => {
    const c = await checkLink(link(), { queue: fast(), browser: true, fetcher: async () => challenge, browserFetcher: async () => ({ ...challenge, via: 'browser' }) });
    assert.equal(c.verdict.status, 'unverified');
  });

  it('a check the browser can’t clear either (Vercel Security Checkpoint) → unverified, not wrong page', async () => {
    const page = '<title>Vercel Security Checkpoint</title><h1>We’re verifying your browser</h1>';
    const c = await checkLink(link({ kind: 'brand', url: 'https://www.example-hearth.com', fingerprint: ['Example Hearth'] }), {
      queue: fast(),
      browser: true,
      fetcher: async () => res({ url: 'https://www.example-hearth.com', status: 429, headers: { 'x-vercel-mitigated': 'challenge' }, body: page }),
      browserFetcher: async () => res({ url: 'https://www.example-hearth.com', status: 200, body: page, via: 'browser' }),
    });
    assert.equal(c.verdict.status, 'unverified');
    assert.match(c.verdict.reason, /Vercel/);
    assert.match(c.firstTry ?? '', /^blocked: HTTP 429/);
  });

  it('no browser installed → a bot check is unverified', async () => {
    const c = await checkLink(link(), { queue: fast(), browser: false, fetcher: async () => challenge });
    assert.equal(c.verdict.status, 'unverified');
    assert.match(c.verdict.reason, /no browser/);
  });

  it('a dead link stays dead after its retry', async () => {
    const c = await checkLink(link(), { queue: fast(), browser: false, retryDelayMs: 0, fetcher: async () => res({ status: 404, body: '<title>Not found</title>' }) });
    assert.equal(c.verdict.status, 'dead');
    assert.equal(c.attempts, 2);
  });
});

describe('report history', () => {
  const checked = (status: Checked['verdict']['status'], l = link()): Checked => ({ link: l, attempts: 1, verdict: { status, reason: status, finalUrl: l.url, httpStatus: status === 'dead' ? 404 : 200, via: 'fetch' } });
  const prevReport = (r: Partial<LinkResult>): LinkReport => ({
    version: 1,
    generatedAt: '2026-10-19T08:00:00.000Z',
    trigger: 'nightly',
    durationMs: 1,
    browser: true,
    summary: { total: 1, ok: 0, moved: 0, dead: 1, 'wrong-page': 0, 'soft-404': 0, unverified: 0 },
    results: [{ ...(buildReport([checked('dead')], null, { trigger: 'nightly', startedAt: 0, browser: true }).results[0]), ...r }],
  });

  it('a new failure starts today; an ongoing one keeps its first-failed date', () => {
    const now = new Date('2026-10-21T08:00:00Z');
    const fresh = buildReport([checked('dead')], null, { trigger: 'nightly', startedAt: 0, browser: true, now });
    assert.equal(fresh.results[0].firstFailed, now.toISOString());
    const ongoing = buildReport([checked('dead')], prevReport({ firstFailed: '2026-10-19T08:00:00.000Z', lastOk: '2026-10-18T08:00:00.000Z' }), { trigger: 'nightly', startedAt: 0, browser: true, now });
    assert.equal(ongoing.results[0].firstFailed, '2026-10-19T08:00:00.000Z');
    assert.equal(ongoing.results[0].lastOk, '2026-10-18T08:00:00.000Z');
  });

  it('working again clears first-failed and sets last-ok', () => {
    const now = new Date('2026-10-21T08:00:00Z');
    const r = buildReport([checked('ok')], prevReport({ firstFailed: '2026-10-19T08:00:00.000Z' }), { trigger: 'nightly', startedAt: 0, browser: true, now }).results[0];
    assert.equal(r.firstFailed, null);
    assert.equal(r.lastOk, now.toISOString());
  });

  it('a changed stored URL starts a fresh history', () => {
    const l = link({ url: 'https://www.example-hearth.com/inserts/aurora-36/' });
    const r = buildReport([checked('dead', l)], prevReport({ firstFailed: '2026-10-01T08:00:00.000Z' }), { trigger: 'nightly', startedAt: 0, browser: true, now: new Date('2026-10-21T08:00:00Z') }).results[0];
    assert.equal(r.firstFailed, '2026-10-21T08:00:00.000Z');
  });

  it('counts statuses and gives every result a /go/ target', () => {
    const rep = buildReport([checked('ok'), checked('dead', link({ slug: 'other', url: 'https://www.example-hearth.com/x' }))], null, { trigger: 'local', startedAt: 0, browser: false });
    assert.equal(rep.summary.ok, 1);
    assert.equal(rep.summary.dead, 1);
    assert.ok(rep.results.every((r) => r.target.href));
  });
});

describe('what counts as changed in a push', () => {
  it('new slugs and changed URLs, compared with the published report', () => {
    const links = [link(), link({ slug: 'b', url: 'https://www.example-hearth.com/b' }), link({ slug: 'c', url: 'https://www.example-hearth.com/c2' })];
    const baseline = new Map([
      ['example-aurora-36', 'https://www.example-hearth.com/products/aurora-36/'],
      ['c', 'https://www.example-hearth.com/c'],
    ]);
    assert.deepEqual([...changedSince(links, baseline)].sort(), ['b', 'c']);
    assert.equal(changedSince(links, null).size, 3);
  });
});

describe('/go/ targets', () => {
  const r = (status: LinkResult['status'], finalUrl = 'https://www.example-hearth.com/new/') => ({ status, finalUrl, ...(status === 'moved' ? { suggestedUrl: finalUrl } : {}) });

  it('ok and unverified links go straight to the stored URL; no result yet means unchecked', () => {
    assert.deepEqual(resolveTarget(link(), new Map([['example-aurora-36', r('ok')]])), { href: link().url, mode: 'direct' });
    assert.equal(resolveTarget(link(), new Map([['example-aurora-36', r('unverified')]])).mode, 'direct');
    assert.equal(resolveTarget(link(), new Map()).mode, 'unchecked');
  });

  it('moved links go to the new address', () => {
    assert.deepEqual(resolveTarget(link(), new Map([['example-aurora-36', r('moved')]])), { href: 'https://www.example-hearth.com/new/', mode: 'moved' });
  });

  it('a failing model link falls back to HMI’s own model page', () => {
    for (const s of ['dead', 'wrong-page', 'soft-404'] as const) {
      const t = resolveTarget(link(), new Map([['example-aurora-36', r(s)]]));
      assert.equal(t.mode, 'fallback');
      assert.equal(t.href, '/products/gas-fireplaces/example-aurora-36/');
    }
  });

  it('a failing brand link uses its parent brand’s page only if that one passes, else HMI’s page', () => {
    // quadra-fire falls back to forge-and-flame (a real entry in the product list), then to /products/#brand-quadra-fire
    const qf: OutboundLink = link({ slug: 'quadra-fire', kind: 'brand', url: 'https://forgenflame.com/pages/quadra-fire', fallbacks: ['forge-and-flame', '/products/#brand-quadra-fire'] });
    const parentOk = resolveTarget(qf, new Map([['quadra-fire', r('dead')], ['forge-and-flame', r('ok')]]));
    assert.deepEqual(parentOk, { href: 'https://forgenflame.com', mode: 'fallback', via: 'forge-and-flame' });
    const parentDown = resolveTarget(qf, new Map([['quadra-fire', r('dead')], ['forge-and-flame', r('dead')]]));
    assert.deepEqual(parentDown, { href: '/products/#brand-quadra-fire', mode: 'fallback', via: '/products/#brand-quadra-fire' });
  });
});
