/**
 * The browser retry, against a local server (no outside network): a bot check that clears itself gets time to reload
 * into the real page, and one that never clears is still a bot check. Skipped when Chrome isn't installed.
 */
import assert from 'node:assert/strict';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { after, before, describe, it } from 'node:test';
import { closeBrowser, fetchWithBrowser, findChrome } from '../../scripts/link-health/browser.ts';
import { classify } from '../../scripts/link-health/classify.ts';

const checkpoint = (script = '') =>
  `<!DOCTYPE html><html><head><title>Vercel Security Checkpoint</title></head><body><h1>We’re verifying your browser</h1>${script}</body></html>`;
const real = '<!DOCTYPE html><html><head><title>Aurora 36 | Example Hearth</title></head><body><h1>Aurora 36</h1></body></html>';
const link = (url: string) => ({ kind: 'model' as const, url, fingerprint: ['Aurora 36'], hosts: [] });

describe('browser retry (local server)', { skip: !findChrome() && 'Chrome isn’t installed' }, () => {
  let server: Server;
  let base = '';

  before(async () => {
    server = createServer((req, res) => {
      const passed = /passed=1/.test(req.headers.cookie ?? '');
      if (req.url?.startsWith('/never/') || (req.url?.startsWith('/clears/') && !passed)) {
        res.writeHead(429, { 'content-type': 'text/html; charset=utf-8', 'x-vercel-mitigated': 'challenge' });
        // Like a JavaScript check: after a moment it sets its cookie and reloads. The /never/ one doesn't.
        const clears = req.url.startsWith('/clears/');
        return res.end(checkpoint(clears ? '<script>setTimeout(() => { document.cookie = "passed=1; path=/"; location.reload(); }, 1200);</script>' : ''));
      }
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      res.end(real);
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  after(async () => {
    await closeBrowser();
    server.closeAllConnections();
    server.close();
  });

  it('a check that clears itself gets time to reload into the real page', async () => {
    const res = await fetchWithBrowser(`${base}/clears/`, { settleMs: 3000 });
    assert.ok(res);
    assert.equal(res.status, 200);
    assert.equal(classify(link(`${base}/clears/`), res).status, 'ok');
  });

  it('a check that never clears is still a bot check (→ unverified, never dead)', async () => {
    const res = await fetchWithBrowser(`${base}/never/`, { settleMs: 2000, checkWaitMs: 2000 });
    assert.ok(res);
    assert.equal(classify(link(`${base}/never/`), res).status, 'blocked');
  });
});
