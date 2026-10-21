/**
 * Internal problems — things wrong on HMI's side, which always fail a deploy: a model without a valid page or /go/
 * slug, a replacement that doesn't exist, a fingerprint that can't match, HMI mode's catalog out of step with the
 * product list, and so on.
 */
import { brands } from '../../src/data/brands.ts';
import { outboundLinks } from '../../src/data/links.ts';
import { brandSites, products, tools, type ProductCategory } from '../../src/data/products.ts';
import { unitIds } from '../../src/office/data/catalog.ts';
import { usableFingerprint } from './classify.ts';

const CATEGORIES: ProductCategory[] = [
  'wood-fireplaces',
  'gas-fireplaces',
  'electric-fireplaces',
  'outdoor-fireplaces',
  'vent-free-gas',
  'gas-logs',
  'fireplace-inserts',
  'wood-stoves',
  'gas-stoves',
  'pellet-stoves',
  'mantels-surrounds',
  'fireplace-doors',
  'cultured-stone',
  'accessories-care',
];

const bare = (h: string) => h.toLowerCase().replace(/^www\./, '');
const hostOf = (u: string) => {
  try {
    return bare(new URL(u).hostname);
  } catch {
    return '';
  }
};

export function validateProductList(): string[] {
  const problems: string[] = [];
  const brandIds = new Set(brands.map((b) => b.id));
  const ids = new Set<string>();
  const slugs = new Set<string>();

  for (const [id, site] of Object.entries(brandSites)) {
    if (!/^https:\/\//.test(site.url)) problems.push(`brand ${id}: site URL must be https (${site.url})`);
    if (!site.fingerprint.length || !site.fingerprint.every(usableFingerprint)) problems.push(`brand ${id}: needs a usable fingerprint`);
    if (site.parent && !brandSites[site.parent]) problems.push(`brand ${id}: parent "${site.parent}" isn't a brand site`);
    if (site.support && !/^https:\/\//.test(site.support.url)) problems.push(`brand ${id}: support URL must be https`);
    if (!brandIds.has(id) && !site.name) problems.push(`brand ${id}: not in src/data/brands.ts — give it a name`);
  }
  for (const t of tools) if (!brandSites[t.brand]) problems.push(`tool ${t.slug}: unknown brand "${t.brand}"`);

  for (const p of products) {
    const where = `product ${p.id}`;
    if (ids.has(p.id)) problems.push(`${where}: duplicate id`);
    ids.add(p.id);
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(p.slug)) problems.push(`${where}: slug "${p.slug}" must be lowercase words joined by hyphens`);
    if (slugs.has(p.slug)) problems.push(`${where}: duplicate slug "${p.slug}"`);
    slugs.add(p.slug);
    if (!brandIds.has(p.brand)) problems.push(`${where}: unknown brand "${p.brand}"`);
    if (!brandSites[p.brand]) problems.push(`${where}: brand "${p.brand}" has no site in brandSites`);
    if (!CATEGORIES.includes(p.category)) problems.push(`${where}: unknown category "${p.category}"`);
    for (const c of p.alsoIn ?? []) if (!CATEGORIES.includes(c) || c === p.category) problems.push(`${where}: bad alsoIn category "${c}"`);
    if (!['current', 'discontinued', 'hidden'].includes(p.status)) problems.push(`${where}: unknown status "${p.status}"`);
    if (p.replacement?.id && !products.some((x) => x.id === p.replacement!.id && x.id !== p.id)) problems.push(`${where}: replacement "${p.replacement.id}" isn't on the list`);
    if (p.replacement && p.status !== 'discontinued') problems.push(`${where}: only discontinued models have a replacement`);
    if (!/^https:\/\//.test(p.url)) problems.push(`${where}: manufacturer URL must be https`);
    const site = brandSites[p.brand];
    if (site && ![hostOf(site.url), ...(site.hosts ?? []).map(bare)].includes(hostOf(p.url))) problems.push(`${where}: ${hostOf(p.url)} isn't one of ${p.brand}'s hosts`);
    if (!p.fingerprint.length || !p.fingerprint.every(usableFingerprint)) problems.push(`${where}: needs a usable fingerprint`);
    if (!p.model.trim() || !p.type.trim() || !p.summary.trim()) problems.push(`${where}: model, type and summary are required`);
    for (const s of p.specs) if (!s.label.trim() || !s.value.trim()) problems.push(`${where}: empty spec`);
    if (/\$\s?\d|price|msrp|starting at/i.test(JSON.stringify(p.specs) + p.summary)) problems.push(`${where}: prices don't belong on public pages`);
    if (/\b(rating|stars?|reviews?)\b/i.test(JSON.stringify(p.specs) + p.summary)) problems.push(`${where}: ratings and reviews don't belong on public pages`);
    if (!/^https:\/\//.test(p.verified.url) || !/^\d{4}-\d{2}-\d{2}$/.test(p.verified.on)) problems.push(`${where}: verified needs a source URL and an ISO date`);
    for (const [store, n] of Object.entries(p.display)) if (!Number.isInteger(n) || n < 0) problems.push(`${where}: display count at ${store} must be a whole number`);
  }

  const linkSlugs = new Set<string>();
  const links = outboundLinks();
  for (const l of links) {
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(l.slug)) problems.push(`link ${l.slug}: bad /go/ slug`);
    if (linkSlugs.has(l.slug)) problems.push(`link ${l.slug}: two links share this /go/ slug`);
    linkSlugs.add(l.slug);
  }
  for (const l of links) {
    for (const f of l.fallbacks) if (!f.startsWith('/') && !linkSlugs.has(f)) problems.push(`link ${l.slug}: fallback "${f}" isn't a link`);
    if (!l.fallbacks.some((f) => f.startsWith('/'))) problems.push(`link ${l.slug}: needs an HMI page as its last fallback`);
  }

  // HMI mode's catalog and the product list must describe the same models
  const units = new Set(unitIds());
  for (const p of products) if (!units.has(p.id)) problems.push(`product ${p.id}: missing from HMI mode's catalog (src/office/data/catalog.ts)`);
  for (const id of units) if (!ids.has(id)) problems.push(`catalog unit ${id}: not on the product list (src/data/products.ts)`);

  return problems;
}
