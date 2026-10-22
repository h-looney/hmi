/**
 * Product listings written in HMI mode: the specs staff can opt into, tidying and checking a listing, what counts as
 * a change waiting to be published, and what the public pages show once it is (simulated).
 */
import type { Product, ProductFuel } from '../../../data/products';
import type { SiteListing } from '../../bridge';
import type { Listing, ListingSpec } from '../../data/types';

/** Specs most listings need, one click away. `values` are offered as suggestions where there's a usual set. */
export const COMMON_SPECS: { label: string; example: string; values?: string[] }[] = [
  { label: 'Fuel', example: 'Gas', values: ['Gas', 'Wood', 'Pellet', 'Electric', 'Natural gas or propane'] },
  { label: 'Heat input', example: '40,000 BTU/hr' },
  { label: 'Heat output', example: 'Up to 60,000 BTU' },
  { label: 'Heating area', example: 'Up to 2,000 sq ft' },
  { label: 'Sizes', example: '36″, 42″ and 48″' },
  { label: 'Venting', example: 'Direct vent', values: ['Direct vent', 'Vent-free', 'B-vent', 'Power vent', 'Masonry or factory-built chimney'] },
  { label: 'Viewing area', example: '47-1/2″ × 12-1/2″' },
  { label: 'Efficiency', example: 'Up to 80%' },
  { label: 'Burn time', example: 'Up to 8 hours' },
  { label: 'Ignition', example: 'Electronic, with remote' },
  { label: 'Dimensions', example: '36″ W × 30″ H × 18″ D' },
  { label: 'Finish', example: 'Matte black' },
];

export const MAX_SPECS = 20;

/** As the model pages write it (src/data/categories.ts fuelLabels; not imported, so Node can run this file) */
const FUEL: Record<ProductFuel, string> = { wood: 'Wood', gas: 'Gas', electric: 'Electric', pellet: 'Pellet' };

const key = (label: string) => label.trim().toLowerCase();

/** The row with this label, if the listing has one (labels match whatever their case or spacing) */
export const specIndex = (specs: ListingSpec[], label: string) => specs.findIndex((s) => key(s.label) === key(label));

/** Suggested values for a label, e.g. the usual venting types */
export const valuesFor = (label: string) => COMMON_SPECS.find((c) => key(c.label) === key(label))?.values;

/** Trimmed, without rows left completely empty */
export const tidySpecs = (specs: ListingSpec[]): ListingSpec[] =>
  specs.map((s) => ({ label: s.label.trim(), value: s.value.trim() })).filter((s) => s.label || s.value);

/** What has to be fixed before a listing can be saved — each a message fit to show */
export function listingProblems(l: Pick<Listing, 'isNew' | 'brand' | 'model' | 'type' | 'category' | 'specs' | 'url'>): string[] {
  const problems: string[] = [];
  if (l.isNew && !l.brand) problems.push('Pick the brand.');
  if (!l.model.trim()) problems.push('Give it a model name.');
  if (!l.type.trim()) problems.push('Say what it is, e.g. “Linear gas fireplace”.');
  if (l.isNew && !l.category) problems.push('Pick the category page it goes on.');
  const specs = tidySpecs(l.specs);
  specs.forEach((s, i) => {
    if (!s.label) problems.push(`Spec ${i + 1} has a value but no label.`);
    else if (!s.value) problems.push(`Add a value for “${s.label}”, or remove it.`);
  });
  const seen = new Set<string>();
  for (const s of specs) {
    if (s.label && seen.has(key(s.label))) problems.push(`“${s.label}” is listed twice.`);
    seen.add(key(s.label));
  }
  if (l.url?.trim() && !/^https:\/\/[^\s/]+\.[^\s]+$/.test(l.url.trim())) problems.push('The manufacturer page has to be a full https:// address.');
  return problems;
}

/** A model on the product list, as a listing: its page's specs, with the fuel row the page shows first */
export function listingFromProduct(p: Product, by = '', at = ''): Listing {
  return {
    id: p.id,
    isNew: false,
    brand: p.brand,
    model: p.model,
    type: p.type,
    category: p.category,
    summary: p.summary,
    specs: [...(p.fuel ? [{ label: 'Fuel', value: FUEL[p.fuel] }] : []), ...p.specs.map((s) => ({ ...s }))],
    status: 'current',
    display: { 'osage-beach': p.display['osage-beach'], nixa: p.display.nixa },
    by,
    at,
  };
}

/** Same content: what the public pages would show is identical */
export function sameListing(a?: Listing, b?: Listing): boolean {
  if (!a || !b) return a === b;
  return (
    a.brand === b.brand &&
    a.model === b.model &&
    a.type === b.type &&
    a.category === b.category &&
    a.summary === b.summary &&
    (a.url ?? '') === (b.url ?? '') &&
    (a.linkText ?? '') === (b.linkText ?? '') &&
    a.status === b.status &&
    a.display['osage-beach'] === b.display['osage-beach'] &&
    a.display.nixa === b.display.nixa &&
    a.specs.length === b.specs.length &&
    a.specs.every((s, i) => s.label === b.specs[i].label && s.value === b.specs[i].value)
  );
}

/**
 * Waiting for the next publish? `live` is the listing as last published; `base` is how the product list has a model
 * that was never changed (none for a new listing).
 */
export function isListingPending(l: Listing | undefined, live: Listing | undefined, base: Listing | undefined): boolean {
  if (!l) return !!live;
  if (live) return !sameListing(l, live);
  return l.isNew || !sameListing(l, base);
}

/** The fuel a listing's "Fuel" spec names, for the placeholder drawing and filters */
export function fuelOf(specs: ListingSpec[]): ProductFuel | undefined {
  const v = specs[specIndex(specs, 'Fuel')]?.value.toLowerCase() ?? '';
  if (/pellet/.test(v)) return 'pellet';
  if (/electric/.test(v)) return 'electric';
  if (/wood/.test(v)) return 'wood';
  if (/gas|propane/.test(v)) return 'gas';
  return undefined;
}

/** The link's words when nobody has changed them — what a model page says */
export const defaultLinkText = (brand: string) => `Full specs at ${brand}`;

/**
 * What the public pages show after a publish (simulated): live new listings, and every change to a model on the list.
 * `links` are models' changed manufacturer/distributor links (by product id) — kept with the other outbound links.
 */
export function siteListings(listings: Record<string, Listing>, brandName: (id: string) => string, links: Record<string, { url: string; base: Listing }> = {}): Record<string, SiteListing> {
  const all = { ...Object.fromEntries(Object.entries(links).map(([id, { base }]) => [id, base])), ...listings };
  return Object.fromEntries(
    Object.values(all)
      .filter((l) => !l.isNew || (l.status === 'current' && l.category))
      .map((l) => [
        l.id,
        {
          id: l.id,
          isNew: l.isNew,
          brand: l.brand,
          brandName: brandName(l.brand),
          model: l.model,
          type: l.type,
          category: l.category,
          summary: l.summary,
          specs: l.specs.map((s) => ({ ...s })),
          ...(links[l.id]?.url || l.url ? { url: links[l.id]?.url ?? l.url } : {}),
          ...(l.linkText ? { linkText: l.linkText } : {}),
          display: { ...l.display },
        },
      ]),
  );
}

/** The public address of a new listing's page in this concept (a preview page that reads it from this browser) */
export const previewPath = (id: string) => `/products/preview/?id=${encodeURIComponent(id)}`;
