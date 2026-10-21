/**
 * Just enough HTML reading for link checks: the title, headings, JSON-LD and a text sample.
 * Regular expressions instead of a DOM keep the checker dependency-free; pages are capped at 2 MB.
 */

const NAMED: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  ndash: '–',
  mdash: '—',
  hellip: '…',
  reg: '®',
  trade: '™',
  copy: '©',
  rsquo: '’',
  lsquo: '‘',
  rdquo: '”',
  ldquo: '“',
  deg: '°',
  frac12: '½',
  frac14: '¼',
  frac34: '¾',
  times: '×',
  eacute: 'é',
  bull: '•',
  middot: '·',
  laquo: '«',
  raquo: '»',
  pipe: '|',
  vert: '|',
  verbar: '|',
};

export function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z][a-z0-9]*);/gi, (m, e: string) => {
    if (e[0] === '#') {
      const code = e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(code) && code > 0 && code < 0x110000 ? String.fromCodePoint(code) : m;
    }
    return NAMED[e.toLowerCase()] ?? m;
  });
}

export const squash = (s: string) => s.replace(/\s+/g, ' ').trim();
const stripTags = (s: string) => s.replace(/<[^>]*>/g, ' ');
export const cleanText = (s: string) => squash(decodeEntities(stripTags(s)));

export interface PageFacts {
  title: string;
  h1: string[];
  /** Names of JSON-LD Product / ProductGroup / IndividualProduct entries */
  productNames: string[];
  /** Every JSON-LD @type seen (WebPage, CollectionPage, ItemList, Product…) */
  ldTypes: string[];
  /** JSON-LD offer availability values, e.g. https://schema.org/Discontinued */
  availability: string[];
  ogTitle?: string;
  /** The site's own name: og:site_name and JSON-LD Organization / WebSite names */
  siteNames: string[];
  canonical?: string;
  robots?: string;
  /** Visible text, scripts and styles removed (first ~60k characters) */
  text: string;
  /** How many links on the page point into a /products/-style path (rough list-page signal) */
  productLinks: number;
}

function walkLd(node: unknown, out: { names: string[]; types: string[]; availability: string[]; sites: string[] }) {
  if (Array.isArray(node)) {
    node.forEach((n) => walkLd(n, out));
    return;
  }
  if (!node || typeof node !== 'object') return;
  const obj = node as Record<string, unknown>;
  const types = ([] as unknown[]).concat(obj['@type'] ?? []).map(String);
  out.types.push(...types);
  if (types.some((t) => /^(Product|ProductGroup|IndividualProduct|ProductModel|Vehicle)$/i.test(t)) && typeof obj.name === 'string') out.names.push(cleanText(obj.name));
  if (types.some((t) => /^(Organization|Corporation|WebSite|Brand|LocalBusiness)$/i.test(t)) && typeof obj.name === 'string') out.sites.push(cleanText(obj.name));
  const offers = ([] as unknown[]).concat(obj.offers ?? []);
  for (const o of offers) {
    const a = (o as Record<string, unknown>)?.availability;
    if (typeof a === 'string') out.availability.push(a);
  }
  for (const [k, v] of Object.entries(obj)) if (k !== 'offers' && v && typeof v === 'object') walkLd(v, out);
}

export function readPage(html: string): PageFacts {
  // The title and meta tags belong in <head>, but a framework that streams them (Next.js) can send them after
  // everything else instead, near the end of a large page — on some requests and not others. So read them from the
  // whole page, minus the blocks whose markup isn't the page's own: scripts, styles, comments and inline SVG icons
  // (which carry <title>s of their own).
  const markup = html
    .replace(/<script\b[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[\s\S]*?<\/style>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<svg\b[\s\S]*?<\/svg>/gi, ' ');
  const title = cleanText(markup.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? '');
  const h1 = [...html.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi)].map((m) => cleanText(m[1])).filter(Boolean).slice(0, 5);
  const meta = (attr: string, value: string) => {
    const re = new RegExp(`<meta\\b(?=[^>]*\\b${attr}=["']${value}["'])[^>]*\\bcontent=["']([^"']*)["'][^>]*>`, 'i');
    const re2 = new RegExp(`<meta\\b[^>]*\\bcontent=["']([^"']*)["'][^>]*\\b${attr}=["']${value}["'][^>]*>`, 'i');
    const m = markup.match(re) ?? markup.match(re2);
    return m ? cleanText(m[1]) : undefined;
  };
  const ld = { names: [] as string[], types: [] as string[], availability: [] as string[], sites: [] as string[] };
  for (const m of html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    const raw = m[1].trim().replace(/^<!\[CDATA\[|\]\]>$/g, '');
    try {
      walkLd(JSON.parse(raw), ld);
    } catch {
      // Some sites ship invalid JSON-LD (trailing commas, raw newlines); try a forgiving pass
      try {
        walkLd(JSON.parse(raw.replace(/,\s*([}\]])/g, '$1').replace(/[\u0000-\u001f]+/g, ' ')), ld);
      } catch {
        /* ignore */
      }
    }
  }
  const canonical = markup.match(/<link\b(?=[^>]*\brel=["']canonical["'])[^>]*\bhref=["']([^"']+)["']/i)?.[1];
  const body = markup.replace(/<noscript\b[\s\S]*?<\/noscript>/gi, ' ');
  const text = cleanText(body).slice(0, 60_000);
  const productLinks = new Set([...html.matchAll(/href=["']([^"'#?]*\/products?\/[^"'#?]+)["']/gi)].map((m) => m[1])).size;
  return {
    title,
    h1,
    productNames: [...new Set(ld.names)],
    ldTypes: [...new Set(ld.types)],
    availability: [...new Set(ld.availability)],
    ogTitle: meta('property', 'og:title'),
    siteNames: [...new Set([meta('property', 'og:site_name'), ...ld.sites].filter((x): x is string => !!x))],
    canonical: canonical ? decodeEntities(canonical) : undefined,
    robots: meta('name', 'robots'),
    text,
    productLinks,
  };
}

/** Normalize text for fingerprint matching: case, accents, punctuation and ®/™ marks don't matter. */
export function norm(s: string): string {
  return s
    // Marks first: NFKD would turn ™ into "TM" ("Northfield™" → "NorthfieldTM")
    .replace(/[®™©℠]/g, ' ')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** Does `needle` appear in `hay` as whole words, ignoring case and punctuation? ("6000C" matches "6000C Clean Face") */
export function containsWords(hay: string, needle: string): boolean {
  const n = norm(needle);
  if (!n) return false;
  return ` ${norm(hay)} `.includes(` ${n} `);
}
