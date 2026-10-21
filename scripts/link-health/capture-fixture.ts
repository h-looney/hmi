/**
 * Save a real response as a classifier test fixture (tests/fixtures/link-health/<name>.json).
 * Scripts (except JSON-LD), styles and SVGs are stripped so fixtures stay small; nothing else is changed.
 *
 *   node scripts/link-health/capture-fixture.ts <name> <url> [--browser]
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { closeBrowser, fetchWithBrowser } from './browser.ts';
import { fetchPage, type FetchResult } from './http.ts';

const [name, url, flag] = process.argv.slice(2);
if (!name || !url) {
  console.error('usage: node scripts/link-health/capture-fixture.ts <name> <url> [--browser]');
  process.exit(2);
}

/**
 * Keep only what the classifier reads — the title, a few meta tags, every <h1>, JSON-LD (long strings shortened) and a
 * short text sample — so fixtures don't carry the sites' copy. Bot-check pages are kept whole: their scripts are the
 * evidence, and they carry no site content.
 */
function slim(body: string): string {
  if (body.length < 3_000 || /awsWafCookieDomainList|gokuProps|_Incapsula_Resource|cf_chl_|challenge-platform|captcha-delivery/i.test(body)) return body;
  const head = body.match(/<head\b[^>]*>([\s\S]*?)<\/head>/i)?.[1] ?? '';
  const title = head.match(/<title\b[^>]*>[\s\S]*?<\/title>/i)?.[0] ?? '';
  const metas = [...head.matchAll(/<meta\b[^>]*(?:og:site_name|og:title|name=["']robots["'])[^>]*>/gi)].map((m) => m[0]);
  const canonical = head.match(/<link\b[^>]*rel=["']canonical["'][^>]*>/i)?.[0] ?? '';
  const shorten = (v: unknown): unknown =>
    typeof v === 'string' ? (v.length > 120 ? `${v.slice(0, 117)}…` : v) : Array.isArray(v) ? v.map(shorten) : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, shorten(x)])) : v;
  const ld = [...body.matchAll(/<script\b[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)].map((m) => {
    try {
      return `<script type="application/ld+json">${JSON.stringify(shorten(JSON.parse(m[1])))}</script>`;
    } catch {
      return '';
    }
  });
  const h1s = [...body.matchAll(/<h1\b[\s\S]*?<\/h1>/gi)].map((m) => m[0].replace(/<(?!\/?h1\b)[^>]+>/g, ''));
  const text = body
    .replace(/<head\b[\s\S]*?<\/head>/i, '')
    .replace(/<(script|style)\b[\s\S]*?<\/\1>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 400);
  return `<html><head>${title}${metas.join('')}${canonical}</head><body>${h1s.join('\n')}\n${ld.join('\n')}\n<p>${text}</p></body></html>`;
}

const res: FetchResult | null = flag === '--browser' ? await fetchWithBrowser(url) : await fetchPage(url);
await closeBrowser();
if (!res) {
  console.error('No browser available');
  process.exit(1);
}
const fixture = { capturedAt: new Date().toISOString(), ...res, body: slim(res.body) };
mkdirSync('tests/fixtures/link-health', { recursive: true });
writeFileSync(`tests/fixtures/link-health/${name}.json`, JSON.stringify(fixture, null, 1));
console.log(`${name}: ${res.status} ${res.finalUrl} (${res.chain.map((h) => h.status).join('→')}) ${res.error?.code ?? ''} — ${fixture.body.length} chars`);
