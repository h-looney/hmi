/**
 * Every outbound manufacturer link on the site, derived from the product list (src/data/products.ts), plus the
 * shapes of the link-health report and the rule for where /go/<slug>/ sends people.
 *
 * Plain TypeScript with no Astro imports: the link checker (Node), the site build and HMI mode all use it.
 */
import { brands } from './brands.ts';
import { brandSites, products, tools, productPath, type Product } from './products.ts';

export type LinkKind = 'model' | 'brand' | 'support' | 'tool';
export type LinkStatus = 'ok' | 'moved' | 'dead' | 'wrong-page' | 'soft-404' | 'unverified';

export interface OutboundLink {
  /** /go/<slug>/ */
  slug: string;
  kind: LinkKind;
  /** The stored address */
  url: string;
  /** What the link is, for people: "Heat & Glo Mezzo 48", "Lopi owner support" */
  label: string;
  brand: string;
  productId?: string;
  /** The page must show one of these in its <title>, an <h1> or a JSON-LD Product name */
  fingerprint: string[];
  /** Hosts the link may legitimately end up on (known moves), besides the stored URL's own */
  hosts: string[];
  /** Where to send people if the link fails: other link slugs (used only if they pass) or site paths ('/…') */
  fallbacks: string[];
}

/** Links customers can see: every brand site, support page and tool, and every model that isn't hidden. */
export function outboundLinks(list: Product[] = products): OutboundLink[] {
  const links: OutboundLink[] = [];
  const brandName = (id: string) => brands.find((b) => b.id === id)?.name ?? id;
  for (const [id, site] of Object.entries(brandSites)) {
    const name = site.name ?? brandName(id);
    links.push({
      slug: id,
      kind: 'brand',
      url: site.url,
      label: name,
      brand: id,
      fingerprint: site.fingerprint,
      hosts: site.hosts ?? [],
      fallbacks: [...(site.parent ? [site.parent] : []), brands.some((b) => b.id === id) ? `/products/#brand-${id}` : '/products/#brands'],
    });
    if (site.support) {
      links.push({
        slug: `${id}-support`,
        kind: 'support',
        url: site.support.url,
        label: `${name} owner support`,
        brand: id,
        fingerprint: site.support.fingerprint,
        hosts: site.hosts ?? [],
        fallbacks: [id, '/resources/#manufacturers'],
      });
    }
  }
  for (const t of tools) {
    links.push({ slug: t.slug, kind: 'tool', url: t.url, label: t.label, brand: t.brand, fingerprint: t.fingerprint, hosts: t.hosts ?? [], fallbacks: [t.brand, '/resources/#tools'] });
  }
  for (const p of list) {
    if (p.status === 'hidden') continue;
    const site = brandSites[p.brand];
    links.push({
      slug: p.slug,
      kind: 'model',
      url: p.url,
      label: `${site?.name ?? brandName(p.brand)} ${p.model}`,
      brand: p.brand,
      productId: p.id,
      fingerprint: p.fingerprint,
      hosts: site?.hosts ?? [],
      fallbacks: [productPath(p)],
    });
  }
  return links;
}

/** /go/<slug>/ (before the base path is added) */
export const goPath = (slug: string) => `/go/${slug}/`;

/* ---------- The report the checker writes (published at /data/link-health.json) ---------- */

export interface LinkResult {
  slug: string;
  kind: LinkKind;
  label: string;
  brand: string;
  productId?: string;
  url: string;
  status: LinkStatus;
  reason: string;
  finalUrl: string;
  httpStatus: number;
  /** 'browser' when the headless-browser retry decided it */
  via: 'fetch' | 'browser';
  checkedAt: string;
  /** Last time it worked (ok or moved), ISO date-time */
  lastOk: string | null;
  /** When the current failure began, ISO date-time */
  firstFailed: string | null;
  /** For moved links: the address to store instead */
  suggestedUrl?: string;
  /** Where /go/<slug>/ sends people after this run */
  target: Target;
}

export interface Target {
  /** An absolute URL, or a site path ('/products/…') that the build prefixes with the base path */
  href: string;
  mode: 'direct' | 'moved' | 'fallback' | 'unchecked';
  /** For fallbacks: the slug or path that was used */
  via?: string;
}

export interface LinkReport {
  version: 1;
  generatedAt: string;
  /** What started the run */
  trigger: 'push' | 'nightly' | 'manual' | 'local';
  durationMs: number;
  /** Was a headless browser available for retries? */
  browser: boolean;
  summary: Record<LinkStatus, number> & { total: number };
  results: LinkResult[];
}

export const WORKING: LinkStatus[] = ['ok', 'moved', 'unverified'];
export const FAILING: LinkStatus[] = ['dead', 'wrong-page', 'soft-404'];
export const isFailing = (s: LinkStatus) => FAILING.includes(s);

/**
 * Where /go/<slug>/ should send people, given the latest results:
 *   ok → the stored URL · moved → the new address · unverified (a bot check we can't see past) → the stored URL
 *   dead / wrong page / soft 404 → the first fallback that is safe: an HMI page, or another link that passed.
 * With no result yet (local builds before the checker has run) the stored URL is used as-is.
 */
export function resolveTarget(link: OutboundLink, results: Map<string, Pick<LinkResult, 'status' | 'finalUrl' | 'suggestedUrl'>>): Target {
  const r = results.get(link.slug);
  if (!r) return { href: link.url, mode: 'unchecked' };
  if (r.status === 'ok' || r.status === 'unverified') return { href: link.url, mode: 'direct' };
  if (r.status === 'moved') return { href: r.suggestedUrl ?? r.finalUrl, mode: 'moved' };
  for (const f of link.fallbacks) {
    if (f.startsWith('/')) return { href: f, mode: 'fallback', via: f };
    const other = results.get(f);
    const otherLink = otherLinks.get(f);
    if (!other || !otherLink) continue;
    if (other.status === 'ok' || other.status === 'unverified') return { href: otherLink.url, mode: 'fallback', via: f };
    if (other.status === 'moved') return { href: other.suggestedUrl ?? other.finalUrl, mode: 'fallback', via: f };
  }
  return { href: '/products/', mode: 'fallback', via: '/products/' };
}

const otherLinks = new Map(outboundLinks().map((l) => [l.slug, l]));
