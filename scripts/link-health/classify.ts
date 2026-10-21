/**
 * Decide what a customer would get from an outbound link, from one saved response.
 *
 *   ok          the right page at the stored address (trivial redirects allowed: https, www, locale root)
 *   moved       the right page at a new address — "update the stored URL", not a failure
 *   dead        DNS / TLS / connection / timeout errors, or HTTP 4xx/5xx
 *   wrong-page  loads, but it's another brand's site, the homepage, a general list, or doesn't mention the model
 *   soft-404    loads, but says "not found" / "no longer available" (or marks the product discontinued)
 *   blocked     a bot check (401/403/429/503 challenge page) — retried in a real browser, then "unverified"
 *
 * "Right page" is decided mainly by fingerprint: each link stores text the page must contain (usually the model
 * name), looked for in the <title>, the <h1>s and any JSON-LD Product name.
 */
import type { FetchResult } from './http.ts';
import { containsWords, norm, readPage, type PageFacts } from './page.ts';
import type { LinkStatus, OutboundLink } from '../../src/data/links.ts';

export type CheckStatus = LinkStatus | 'blocked';

export interface Verdict {
  status: CheckStatus;
  reason: string;
  finalUrl: string;
  httpStatus: number;
  via: FetchResult['via'];
  /** Worth a second look in a real browser (bot check, or a page that renders its headings with JavaScript) */
  needsBrowser?: boolean;
  /** Which fingerprint matched, and where */
  matched?: { text: string; in: 'title' | 'h1' | 'product' | 'site' };
  page?: Pick<PageFacts, 'title' | 'h1' | 'productNames'>;
}

const bare = (host: string) => host.toLowerCase().replace(/^www\d?\./, '');

/** Path segments that don't change which page you're on: locales and "home" aliases. */
const TRIVIAL_SEGMENT = /^([a-z]{2}([-_][a-z]{2})?|home|homepage|index(\.\w+)?|default(\.\w+)?|main)$/i;

const segments = (u: URL) => u.pathname.split('/').filter(Boolean);
export const isHomepage = (u: URL) => segments(u).every((s) => TRIVIAL_SEGMENT.test(s));

/** Same page for a customer: scheme, www, trailing slash, case, query and a locale-root redirect don't count. */
export function sameAddress(stored: URL, final: URL): boolean {
  if (bare(stored.hostname) !== bare(final.hostname)) return false;
  if (isHomepage(stored) && isHomepage(final)) return true;
  const path = (u: URL) => decodeURIComponent(u.pathname).replace(/\/+$/, '').toLowerCase();
  return path(stored) === path(final);
}

/**
 * Category, collection and search pages rather than a single product. The fingerprint is the main test; this only
 * catches the common shapes (Shopify collections, WordPress product categories, bare /products/ indexes).
 */
export function isGenericList(final: URL, page: PageFacts): boolean {
  const p = final.pathname.toLowerCase().replace(/\/+$/, '') || '/';
  if (/\/collections\/[^/]+\/products\/[^/]+$/.test(p)) return false;
  if (/^\/(products|collections|shop|catalog|browse|search|store)$/.test(p)) return true;
  if (/\/collections\/[^/]+$/.test(p) || /\/(product-category|product_cat|category|categories)\//.test(`${p}/`)) return true;
  return page.ldTypes.some((t) => /^(CollectionPage|SearchResultsPage)$/i.test(t)) && page.productNames.length === 0;
}

const NOT_FOUND = /(^|[^a-z0-9])(404|page not found|not found|no longer available|can[’']?t be found|cannot be found|could not be found|does(?:n[’']?t| not) exist|page unavailable|no results found|error page)([^a-z0-9]|$)/i;
const GONE_IN_BODY = /\b(this|the) (product|model|item|page|unit) (is|has been) (discontinued|no longer (available|offered|sold|manufactured))\b/i;

export function softNotFound(page: PageFacts): string | undefined {
  for (const t of [page.title, ...page.h1]) if (t && NOT_FOUND.test(t)) return `the page says “${t.slice(0, 80)}”`;
  if (page.availability.some((a) => /discontinued/i.test(a))) return 'the page marks this product discontinued';
  const m = page.text.slice(0, 20_000).match(GONE_IN_BODY);
  if (m) return `the page says “${m[0]}”`;
  return undefined;
}

/** Recognise a bot check / challenge page. Returns a short label, or undefined. */
export function botCheck(res: FetchResult, page: PageFacts): string | undefined {
  // A PDF or image is never a challenge page, whatever firewall served it
  if (res.contentType && !/html|text\/plain/i.test(res.contentType)) return undefined;
  const h = res.headers ?? {};
  const head = res.body.slice(0, 60_000);
  // Firewall headers ride along on every response they serve, so they only count with a blocking status
  const blocking = [401, 403, 429, 503].includes(res.status);
  // AWS WAF answers a challenge with 202 (JavaScript check) or 405 (CAPTCHA) and a near-empty page
  if (/awsWafCookieDomainList|gokuProps|AwsWafIntegration|\.token\.awswaf\.com|captcha\.awswaf\.com/i.test(head)) return 'AWS WAF challenge';
  if ((blocking && h['cf-mitigated'] === 'challenge') || /\/cdn-cgi\/challenge-platform|cf-browser-verification|cf_chl_|Just a moment\.\.\.|Attention Required! \| Cloudflare/i.test(head)) return 'Cloudflare challenge';
  if (/captcha-delivery\.com|geo\.captcha-delivery/i.test(head) || (blocking && h['x-datadome'])) return 'DataDome check';
  if (/_Incapsula_Resource|Incapsula incident ID/i.test(head) || (blocking && h['x-iinfo'])) return 'Imperva check';
  if (/px-captcha|perimeterx|Press & Hold/i.test(head)) return 'PerimeterX check';
  if (/Sucuri WebSite Firewall|sucuri\.net\/privacy-policy/i.test(head) || (blocking && h['x-sucuri-id'])) return 'Sucuri firewall';
  if (/^access denied\b/i.test(page.title) || (/Access Denied/i.test(head) && /Reference\s*#\s*[\d.a-f]+/i.test(head))) return 'access denied (Akamai-style bot block)';
  if (/wordfence|Your access to this site has been limited/i.test(head)) return 'Wordfence firewall';
  if (blocking && /Request blocked\.|The request could not be satisfied/i.test(head) && /cloudfront/i.test(head + (h.server ?? ''))) return 'CloudFront firewall';
  if (blocking && /Sorry, you have been blocked|You are unable to access/i.test(head)) return 'Cloudflare block';
  if (/Access to this page has been denied/i.test(head)) return 'PerimeterX check';
  if (/\b(g-recaptcha|h-captcha|hcaptcha\.com|recaptcha\/api|turnstile)\b/i.test(head) && res.status >= 400) return 'CAPTCHA';
  if (/verify (that )?you are (a )?human|are you a (robot|human)|unusual traffic from your (computer|network)|checking your browser/i.test(page.text.slice(0, 4000))) return 'human-verification page';
  return undefined;
}

const NETWORK_REASONS: Record<string, string> = {
  ENOTFOUND: 'the domain no longer exists (DNS lookup failed)',
  EAI_AGAIN: 'DNS lookup failed',
  ECONNREFUSED: 'the server refused the connection',
  ECONNRESET: 'the connection was reset',
  UND_ERR_CONNECT_TIMEOUT: 'the server didn’t answer (connection timeout)',
  UND_ERR_SOCKET: 'the connection dropped',
  TIMEOUT: 'no response within 25 seconds',
  REDIRECT_LOOP: 'stuck in a redirect loop',
  CERT_HAS_EXPIRED: 'its security certificate has expired',
  ERR_TLS_CERT_ALTNAME_INVALID: 'its security certificate doesn’t match the domain',
  DEPTH_ZERO_SELF_SIGNED_CERT: 'its security certificate isn’t trusted',
  UNABLE_TO_VERIFY_LEAF_SIGNATURE: 'its security certificate isn’t trusted',
  SELF_SIGNED_CERT_IN_CHAIN: 'its security certificate isn’t trusted',
  ERR_SSL_PROTOCOL_ERROR: 'the secure connection failed',
};

const HTTP_REASONS: Record<number, string> = { 400: 'Bad Request', 401: 'Unauthorized', 403: 'Forbidden', 404: 'Not Found', 410: 'Gone', 429: 'Too Many Requests', 500: 'Server Error', 502: 'Bad Gateway', 503: 'Service Unavailable', 504: 'Gateway Timeout' };

/**
 * Look for the link's fingerprint in the title, the <h1>s and JSON-LD Product names. Brand-level links (a brand's
 * home or support page) may also match the site's own name (og:site_name, JSON-LD Organization) — some homepages
 * never print the brand in a heading.
 */
export function matchFingerprint(link: Pick<OutboundLink, 'fingerprint' | 'kind'>, page: PageFacts): Verdict['matched'] {
  for (const fp of link.fingerprint) {
    if (page.title && containsWords(page.title, fp)) return { text: fp, in: 'title' };
    if (page.h1.some((h) => containsWords(h, fp))) return { text: fp, in: 'h1' };
    if (page.productNames.some((n) => containsWords(n, fp))) return { text: fp, in: 'product' };
    if (link.kind !== 'model' && page.siteNames.some((n) => containsWords(n, fp))) return { text: fp, in: 'site' };
  }
  return undefined;
}

const short = (u: URL) => `${bare(u.hostname)}${u.pathname === '/' ? '' : u.pathname.replace(/\/$/, '')}`;

export function classify(link: Pick<OutboundLink, 'url' | 'kind' | 'fingerprint' | 'hosts'>, res: FetchResult): Verdict {
  const base = { finalUrl: res.finalUrl, httpStatus: res.status, via: res.via };
  if (res.error) {
    const why = NETWORK_REASONS[res.error.code] ?? `request failed (${res.error.code})`;
    return { ...base, status: 'dead', reason: why };
  }
  const page = readPage(res.body);
  const facts = { title: page.title, h1: page.h1, productNames: page.productNames };
  const challenge = botCheck(res, page);
  if (challenge && ([202, 401, 403, 405, 429, 503].includes(res.status) || !page.h1.length)) {
    return { ...base, page: facts, status: 'blocked', reason: `HTTP ${res.status} — ${challenge}`, needsBrowser: true };
  }
  if (res.status >= 400 || res.status === 0) {
    return { ...base, page: facts, status: 'dead', reason: `HTTP ${res.status}${HTTP_REASONS[res.status] ? ` ${HTTP_REASONS[res.status]}` : ''}`, needsBrowser: [401, 403, 429, 503].includes(res.status) };
  }
  if (res.status >= 300) return { ...base, page: facts, status: 'dead', reason: `HTTP ${res.status} redirect with no destination` };

  const isHtml = /html|xml/i.test(res.contentType) || /<html|<title/i.test(res.body.slice(0, 2000));
  if (!isHtml) return { ...base, page: facts, status: 'ok', reason: `loads (${res.contentType.split(';')[0] || 'non-HTML'})` };

  const gone = softNotFound(page);
  if (gone) return { ...base, page: facts, status: 'soft-404', reason: gone };

  let stored: URL;
  let final: URL;
  try {
    stored = new URL(link.url);
    final = new URL(res.finalUrl);
  } catch {
    return { ...base, page: facts, status: 'dead', reason: 'not a valid address' };
  }
  const finalHost = bare(final.hostname);
  const knownHost = finalHost === bare(stored.hostname) || link.hosts.map(bare).includes(finalHost);
  const toHome = isHomepage(final) && !isHomepage(stored);
  const toList = link.kind === 'model' && isGenericList(final, page);
  const same = sameAddress(stored, final);
  const matched = matchFingerprint(link, page);
  const want = `“${link.fingerprint[0]}”`;

  if (!matched) {
    if (!page.title && !page.h1.length && !page.productNames.length && !(link.kind !== 'model' && page.siteNames.length)) {
      return { ...base, page: facts, status: 'wrong-page', reason: 'the page has no title or heading to check (it may render with JavaScript)', needsBrowser: true };
    }
    if (!knownHost) return { ...base, page: facts, status: 'wrong-page', reason: `lands on ${short(final)} — another site that doesn’t mention ${want}` };
    if (toHome) return { ...base, page: facts, status: 'wrong-page', reason: `sends visitors to the ${finalHost} homepage` };
    if (toList) return { ...base, page: facts, status: 'wrong-page', reason: `lands on a general list (${short(final)}) instead of the model` };
    if (!same) return { ...base, page: facts, status: 'wrong-page', reason: `redirects to ${short(final)}, which doesn’t mention ${want}` };
    return { ...base, page: facts, status: 'wrong-page', reason: `the page no longer mentions ${want} in its title or heading`, needsBrowser: true };
  }
  if (toList) return { ...base, page: facts, matched, status: 'wrong-page', reason: `lands on a general list (${short(final)}) instead of the model` };
  if (toHome && link.kind === 'model') return { ...base, page: facts, matched, status: 'wrong-page', reason: `sends visitors to the ${finalHost} homepage` };
  if (same) return { ...base, page: facts, matched, status: 'ok', reason: res.chain.length > 1 ? 'loads after a routine redirect' : 'loads' };
  return {
    ...base,
    page: facts,
    matched,
    status: 'moved',
    reason: `the page now lives at ${short(final)}${knownHost ? '' : ` (a different site, but it still shows ${want})`} — update the stored URL`,
  };
}

/** For the report: did a fingerprint string survive normalization? (guards against empty/punctuation-only entries) */
export const usableFingerprint = (fp: string) => norm(fp).length >= 2;
