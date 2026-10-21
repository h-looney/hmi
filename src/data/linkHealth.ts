/**
 * Build-time access to the latest link check and sitemap watch (written by scripts/link-health/ into .link-health/,
 * or wherever LINK_HEALTH_DIR points). Used by the /go/ pages, the model pages and the JSON endpoints that publish
 * the results for HMI mode. Local builds without a report still work: every /go/ page uses its stored URL.
 */
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { outboundLinks, resolveTarget, type LinkReport, type LinkResult, type OutboundLink, type Target } from './links.ts';
import type { SitemapFeed, SitemapSnapshot } from './sitemapFeed.ts';

const DIR = process.env.LINK_HEALTH_DIR ?? '.link-health';

function readJson<T>(file: string): T | null {
  const path = resolve(process.cwd(), DIR, file);
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as T;
  } catch {
    return null;
  }
}

let cached: { report: LinkReport | null; feed: SitemapFeed | null; snapshot: SitemapSnapshot | null } | undefined;

export function linkHealth() {
  cached ??= {
    report: readJson<LinkReport>('report.json'),
    feed: readJson<SitemapFeed>('sitemap-watch.json'),
    snapshot: readJson<SitemapSnapshot>('sitemap-snapshot.json'),
  };
  return cached;
}

/** Every outbound link with its latest result and where /go/ sends people now. */
export function linksWithTargets(): { link: OutboundLink; result?: LinkResult; target: Target }[] {
  const { report } = linkHealth();
  const links = outboundLinks();
  const stored = new Map(links.map((l) => [l.slug, l.url]));
  // A result only counts while its stored URL still matches — if the URL was edited since the check, it's unchecked
  const fresh = new Map((report?.results ?? []).filter((r) => stored.get(r.slug) === r.url).map((r) => [r.slug, r]));
  return links.map((link) => ({ link, result: fresh.get(link.slug), target: resolveTarget(link, fresh) }));
}

export const linkStatus = (slug: string) => linksWithTargets().find((l) => l.link.slug === slug);
