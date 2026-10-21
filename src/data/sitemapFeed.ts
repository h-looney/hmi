/**
 * Shapes of the weekly sitemap watcher's output (scripts/link-health/sitemaps-watch.ts), published next to the link
 * report as /data/sitemap-watch.json (suggestions) and /data/sitemap-snapshot.json (the state the next run compares
 * with). HMI mode's Website section reads the feed.
 */

export interface SitemapSuggestion {
  /** Stable across runs, so a dismissal in HMI mode sticks */
  id: string;
  /** new: a product page not on the list · discontinued: a listed model's page is gone from the sitemap */
  type: 'new' | 'discontinued';
  brand: string;
  url: string;
  /** Proposed model name (from the page title), or the listed model's name */
  name: string;
  productId?: string;
  lastmod: string | null;
  seen: string;
  /** Found on the first run, comparing with the product list (no earlier snapshot) */
  firstRun: boolean;
}

export interface SitemapBrandSummary {
  brand: string;
  name: string;
  /** robots.txt · sitemap.xml · listing pages */
  source: string;
  /** Product pages in the brand's sitemap */
  products: number;
  /** Models of this brand on HMI's list */
  onList: number;
  added: number;
  removed: number;
  /** Product pages not on HMI's list */
  notOnList: number;
  /** Something to check by hand (sitemap unavailable, shrank…) */
  note?: string;
}

export interface SitemapFeed {
  version: 1;
  generatedAt: string;
  mode: 'first-run' | 'diff';
  previousAt: string | null;
  durationMs: number;
  brands: SitemapBrandSummary[];
  suggestions: SitemapSuggestion[];
}

export interface SitemapSnapshot {
  version: 1;
  takenAt: string;
  brands: Record<string, { source: string; urls: string[]; lastmod: Record<string, string> }>;
}
