/**
 * The second opinion for pages that turn plain HTTP clients away (bot checks) or render their
 * content with JavaScript: load the page in headless Chrome and hand the rendered HTML to the same
 * classifier. If a challenge page is still showing, the link is "unverified" — never "dead". No
 * attempt is made to solve or get around CAPTCHAs.
 */
import { existsSync } from 'node:fs';
import puppeteer, { type Browser } from 'puppeteer-core';
import { TIMEOUT_MS, USER_AGENT, type FetchResult } from './http.ts';

const CANDIDATES = [
  process.env.CHROME_PATH,
  process.env.PUPPETEER_EXECUTABLE_PATH,
  '/usr/bin/google-chrome-stable',
  '/usr/bin/google-chrome',
  '/bin/google-chrome',
  '/usr/bin/chromium-browser',
  '/usr/bin/chromium',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
];

export function findChrome(): string | undefined {
  return CANDIDATES.find((p): p is string => !!p && existsSync(p));
}

let launched: Promise<Browser | null> | null = null;

/** One shared headless Chrome per run, started on first use. Resolves to null when Chrome isn't installed. */
export function getBrowser(): Promise<Browser | null> {
  launched ??= (async () => {
    const executablePath = findChrome();
    if (!executablePath) return null;
    try {
      return await puppeteer.launch({ executablePath, headless: true, args: ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage'] });
    } catch {
      return null;
    }
  })();
  return launched;
}

export async function closeBrowser() {
  const b = await launched;
  launched = null;
  await b?.close().catch(() => {});
}

/** Load `url` in headless Chrome. Same result shape as fetchPage(), with the rendered HTML as the body. */
export async function fetchWithBrowser(url: string, opts: { timeoutMs?: number; settleMs?: number } = {}): Promise<FetchResult | null> {
  const browser = await getBrowser();
  if (!browser) return null;
  const started = Date.now();
  const page = await browser.newPage();
  try {
    await page.setUserAgent({ userAgent: USER_AGENT });
    await page.setExtraHTTPHeaders({ 'accept-language': 'en-US,en;q=0.9' });
    await page.setViewport({ width: 1366, height: 900 });
    const res = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: opts.timeoutMs ?? TIMEOUT_MS });
    // Give client-rendered pages a moment to fill in their title and headings
    await page.waitForNetworkIdle({ idleTime: 800, timeout: opts.settleMs ?? 8000 }).catch(() => {});
    const chain = (res?.request().redirectChain() ?? []).map((r) => ({ url: r.url(), status: r.response()?.status() ?? 0 }));
    const finalUrl = page.url();
    chain.push({ url: finalUrl, status: res?.status() ?? 0 });
    const body = await page.content();
    return { url, status: res?.status() ?? 0, finalUrl, chain, contentType: res?.headers()['content-type'] ?? 'text/html', body, via: 'browser', ms: Date.now() - started };
  } catch (e) {
    const err = e as Error;
    const code = /timeout/i.test(err.name + err.message) ? 'TIMEOUT' : /ERR_NAME_NOT_RESOLVED/.test(err.message) ? 'ENOTFOUND' : (err.message.match(/net::(ERR_[A-Z_]+)/)?.[1] ?? 'BROWSER_ERROR');
    return { url, status: 0, finalUrl: url, chain: [], contentType: '', body: '', error: { code, message: err.message.slice(0, 200) }, via: 'browser', ms: Date.now() - started };
  } finally {
    await page.close().catch(() => {});
  }
}
