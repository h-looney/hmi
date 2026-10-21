/**
 * The second opinion for pages that turn plain HTTP clients away (bot checks) or render their
 * content with JavaScript: load the page in headless Chrome and hand the rendered HTML to the same
 * classifier. If a challenge page is still showing, the link is "unverified" — never "dead". No
 * attempt is made to solve or get around CAPTCHAs: a JavaScript check that a browser passes on its
 * own (Cloudflare's "Just a moment…", Vercel's Security Checkpoint) is simply given time to finish.
 */
import { existsSync } from 'node:fs';
import puppeteer, { type Browser, type HTTPResponse, type Page } from 'puppeteer-core';
import { SELF_CLEARING_TITLE } from './classify.ts';
import { pickHeaders, TIMEOUT_MS, USER_AGENT, type FetchResult } from './http.ts';

/** How long a self-clearing check gets to reload into the real page */
const CHECK_WAIT_MS = 15_000;

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

/** The page's title, or null while it's between documents (a check reloading into the real page). */
const titleOf = (page: Page) => page.title().catch(() => null);

/** Load `url` in headless Chrome. Same result shape as fetchPage(), with the rendered HTML as the body. */
export async function fetchWithBrowser(url: string, opts: { timeoutMs?: number; settleMs?: number; checkWaitMs?: number } = {}): Promise<FetchResult | null> {
  const browser = await getBrowser();
  if (!browser) return null;
  const started = Date.now();
  const page = await browser.newPage();
  // The document showing at the end: a check that clears itself reloads into the real page, with its own status
  let doc: HTTPResponse | null = null;
  page.on('response', (r) => {
    if (r.request().isNavigationRequest() && r.frame() === page.mainFrame() && (r.status() < 300 || r.status() >= 400)) doc = r;
  });
  const settle = () => page.waitForNetworkIdle({ idleTime: 800, timeout: opts.settleMs ?? 8000 }).catch(() => {});
  try {
    await page.setUserAgent({ userAgent: USER_AGENT });
    await page.setExtraHTTPHeaders({ 'accept-language': 'en-US,en;q=0.9' });
    await page.setViewport({ width: 1366, height: 900 });
    const res = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: opts.timeoutMs ?? TIMEOUT_MS });
    // Give client-rendered pages a moment to fill in their title and headings
    await settle();
    const title = await titleOf(page);
    if (title === null || SELF_CLEARING_TITLE.test(title)) {
      await page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: opts.checkWaitMs ?? CHECK_WAIT_MS }).catch(() => {});
      await settle();
    }
    const last: HTTPResponse | null = doc ?? res;
    const chain = (res?.request().redirectChain() ?? []).map((r) => ({ url: r.url(), status: r.response()?.status() ?? 0 }));
    const finalUrl = page.url();
    chain.push({ url: finalUrl, status: last?.status() ?? 0 });
    const body = await page.content().catch(async () => (await settle(), page.content()));
    return { url, status: last?.status() ?? 0, finalUrl, chain, contentType: last?.headers()['content-type'] ?? 'text/html', headers: last ? pickHeaders(last.headers()) : undefined, body, via: 'browser', ms: Date.now() - started };
  } catch (e) {
    const err = e as Error;
    const code = /timeout/i.test(err.name + err.message) ? 'TIMEOUT' : /ERR_NAME_NOT_RESOLVED/.test(err.message) ? 'ENOTFOUND' : (err.message.match(/net::(ERR_[A-Z_]+)/)?.[1] ?? 'BROWSER_ERROR');
    return { url, status: 0, finalUrl: url, chain: [], contentType: '', body: '', error: { code, message: err.message.slice(0, 200) }, via: 'browser', ms: Date.now() - started };
  } finally {
    await page.close().catch(() => {});
  }
}
