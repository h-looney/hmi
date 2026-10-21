/**
 * Data for the Website section: the product list (src/data/products.ts) with HMI mode's pending edits, the latest
 * link check and sitemap watch (published with the site as /data/*.json by the nightly job), and the /go/ clicks
 * recorded in this browser.
 */
import { computed, signal } from '@preact/signals';
import { brands } from '../../../data/brands';
import { FAILING, goPath, outboundLinks, type LinkReport, type LinkResult, type OutboundLink } from '../../../data/links';
import { brandSites, productPath, products, type Product, type ProductStatus } from '../../../data/products';
import type { SitemapFeed, SitemapSuggestion } from '../../../data/sitemapFeed';
import { CHANNEL, CLICKS_KEY, readClicks, type GoClick } from '../../bridge';
import type { DraftProduct, LinkUrlEdit, ProductEdit, ProductPhotoMeta, StoreId } from '../../data/types';
import { db } from '../../store';
import { samePhotos } from './photos';

const BASE = import.meta.env.BASE_URL.replace(/\/$/, '');

export type Loadable<T> = { state: 'loading' } | { state: 'none'; reason: string } | { state: 'ready'; data: T };

export const report = signal<Loadable<LinkReport>>({ state: 'loading' });
export const feed = signal<Loadable<SitemapFeed>>({ state: 'loading' });
export const clicks = signal<GoClick[]>([]);

async function fetchJson<T>(path: string, valid: (x: unknown) => x is T): Promise<Loadable<T>> {
  try {
    const res = await fetch(`${BASE}${path}`, { cache: 'no-store' });
    if (!res.ok) return { state: 'none', reason: `No file at ${path} (HTTP ${res.status})` };
    const json: unknown = await res.json();
    if (!valid(json)) return { state: 'none', reason: (json as { reason?: string })?.reason ?? 'No results yet' };
    return { state: 'ready', data: json };
  } catch {
    return { state: 'none', reason: 'Couldn’t load the file' };
  }
}

const isReport = (x: unknown): x is LinkReport => !!x && (x as LinkReport).version === 1 && Array.isArray((x as LinkReport).results);
const isFeed = (x: unknown): x is SitemapFeed => !!x && (x as SitemapFeed).version === 1 && Array.isArray((x as SitemapFeed).suggestions);

let started = false;
/** Load the published results once, and keep the click list live across tabs. */
export function loadWebsiteData() {
  if (started) return;
  started = true;
  void fetchJson('/data/link-health.json', isReport).then((r) => (report.value = r));
  void fetchJson('/data/sitemap-watch.json', isFeed).then((f) => (feed.value = f));
  clicks.value = readClicks();
  try {
    const channel = new BroadcastChannel(CHANNEL);
    channel.addEventListener('message', (e: MessageEvent) => {
      if ((e.data as { type?: string })?.type === 'clicks') clicks.value = readClicks();
    });
  } catch {
    /* no cross-tab updates */
  }
  window.addEventListener('storage', (e) => {
    if (e.key === CLICKS_KEY) clicks.value = readClicks();
  });
}

export const refreshClicks = () => (clicks.value = readClicks());

/* ---------- The product list, as HMI mode sees it ---------- */

export const brandName = (id: string) => brandSites[id]?.name ?? brands.find((b) => b.id === id)?.name ?? id;

export interface WebProduct {
  id: string;
  brand: string;
  brandName: string;
  model: string;
  type: string;
  category: string;
  /** Status with any pending edit applied */
  status: ProductStatus;
  /** Status on the public site right now */
  liveStatus: ProductStatus;
  replacement?: { id?: string; name: string };
  /** Manufacturer URL with any pending edit applied */
  url: string;
  liveUrl: string;
  /** HMI's page (site path, before the base) — undefined for drafts and hidden models */
  page?: string;
  /** /go/ slug */
  slug?: string;
  link?: LinkResult;
  display: Record<StoreId, number>;
  edit?: ProductEdit;
  urlEdit?: LinkUrlEdit;
  draft?: DraftProduct;
  /** Photos added in HMI mode, in order (the first one leads) */
  photos: ProductPhotoMeta[];
  /** The photos differ from the ones last published */
  photosPending: boolean;
  /** Has changes waiting for the next publish (simulated) */
  pending: boolean;
  product?: Product;
}

/** On the floor at either showroom */
export const onDisplay = (p: Pick<WebProduct, 'display'>) => p.display['osage-beach'] + p.display.nixa > 0;

const linkBySlug = computed(() => new Map(report.value.state === 'ready' ? report.value.data.results.map((r) => [r.slug, r]) : []));

export const webProducts = computed<WebProduct[]>(() => {
  const d = db.value;
  if (!d) return [];
  const edits = d.website?.edits ?? {};
  const urls = d.website?.linkUrls ?? {};
  const photos = d.website?.photos ?? {};
  const live = d.website?.photosLive ?? {};
  const items = new Map(d.items.map((i) => [i.id, i]));
  const list: WebProduct[] = products.map((p) => {
    const e = edits[p.id];
    const ue = urls[p.slug];
    const photosPending = !samePhotos(photos[p.id], live[p.id]);
    const pendingEdit = (e && !e.publishedAt) || (ue && !ue.publishedAt) || photosPending;
    const status = e?.status ?? p.status;
    const repId = e?.replacement ?? p.replacement?.id;
    const rep = repId ? products.find((x) => x.id === repId) : undefined;
    const item = items.get(p.id);
    return {
      id: p.id,
      brand: p.brand,
      brandName: brandName(p.brand),
      model: p.model,
      type: p.type,
      category: p.category,
      status,
      liveStatus: p.status,
      replacement: rep ? { id: rep.id, name: `${brandName(rep.brand)} ${rep.model}` } : p.replacement && !e?.replacement ? { name: p.replacement.name } : undefined,
      url: ue?.url ?? p.url,
      liveUrl: p.url,
      page: p.status === 'hidden' ? undefined : productPath(p),
      slug: p.status === 'hidden' ? undefined : p.slug,
      link: linkBySlug.value.get(p.slug),
      display: { 'osage-beach': item?.stock['osage-beach'].display ?? p.display['osage-beach'], nixa: item?.stock.nixa.display ?? p.display.nixa },
      edit: e,
      urlEdit: ue,
      photos: photos[p.id] ?? [],
      photosPending,
      pending: !!pendingEdit,
      product: p,
    };
  });
  for (const dr of d.website?.drafts ?? []) {
    list.push({
      id: dr.id,
      brand: dr.brand,
      brandName: brandName(dr.brand),
      model: dr.model,
      type: 'New model (draft)',
      category: dr.category ?? '',
      status: 'hidden',
      liveStatus: 'hidden',
      url: dr.url,
      liveUrl: dr.url,
      display: { 'osage-beach': 0, nixa: 0 },
      draft: dr,
      photos: [],
      photosPending: false,
      pending: !dr.publishedAt,
    });
  }
  return list;
});

export const pendingCount = computed(() => {
  const w = db.value?.website;
  if (!w) return 0;
  const photoSets = new Set([...Object.keys(w.photos ?? {}), ...Object.keys(w.photosLive ?? {})]);
  return (
    Object.values(w.edits).filter((e) => !e.publishedAt).length +
    Object.values(w.linkUrls).filter((e) => !e.publishedAt).length +
    w.drafts.filter((dr) => !dr.publishedAt).length +
    [...photoSets].filter((id) => !samePhotos(w.photos?.[id], w.photosLive?.[id])).length
  );
});

/* ---------- Links ---------- */

export const allLinks = (): OutboundLink[] => outboundLinks();

export const failingLinks = computed(() => (report.value.state === 'ready' ? report.value.data.results.filter((r) => FAILING.includes(r.status)) : []));
/** Moved links whose new address hasn't been accepted yet */
export const movedLinks = computed(() => {
  if (report.value.state !== 'ready') return [];
  const urls = db.value?.website?.linkUrls ?? {};
  return report.value.data.results.filter((r) => r.status === 'moved' && urls[r.slug]?.url !== r.suggestedUrl && !(db.value?.website?.dismissed ?? []).includes(`url:${r.slug}`));
});
export const unverifiedLinks = computed(() => (report.value.state === 'ready' ? report.value.data.results.filter((r) => r.status === 'unverified') : []));

/* ---------- Sitemap suggestions ---------- */

export const openSuggestions = computed<SitemapSuggestion[]>(() => {
  if (feed.value.state !== 'ready') return [];
  const w = db.value?.website;
  const handled = new Set([...(w?.dismissed ?? []), ...(w?.drafts ?? []).map((dr) => dr.suggestionId ?? '')]);
  const edits = w?.edits ?? {};
  return feed.value.data.suggestions.filter((s) => !handled.has(s.id) && !(s.type === 'discontinued' && s.productId && edits[s.productId]?.status === 'discontinued'));
});

/** Suggestions worth a nudge: week-to-week changes and possible discontinuations (not the first run's baseline) */
export const actionableSuggestions = computed(() => openSuggestions.value.filter((s) => !(s.type === 'new' && s.firstRun)));

/** Sidebar badge and dashboard: things a person should look at */
export const websiteAttention = computed(() => failingLinks.value.length + movedLinks.value.length + actionableSuggestions.value.length);

/* ---------- Clicks ---------- */

export interface ClickRow {
  key: string;
  label: string;
  productId?: string;
  kind: GoClick['kind'];
  count: number;
  fallback: number;
  last: string;
}

export const clickRows = computed<ClickRow[]>(() => {
  const map = new Map<string, ClickRow>();
  for (const c of clicks.value) {
    const row = map.get(c.slug) ?? { key: c.slug, label: c.label, productId: c.productId, kind: c.kind, count: 0, fallback: 0, last: c.at };
    row.count++;
    if (c.mode === 'fallback') row.fallback++;
    if (c.at > row.last) row.last = c.at;
    map.set(c.slug, row);
  }
  return [...map.values()].sort((a, b) => b.count - a.count || (a.last < b.last ? 1 : -1));
});

export const siteHref = (path: string) => `${BASE}${path}`;
export const goHref = (slug: string) => `${BASE}${goPath(slug)}`;
