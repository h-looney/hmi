/**
 * Changes made in the Website section. Like the rest of HMI mode they're saved in this browser; product-list
 * changes are marked "goes live on next publish (simulated)" — in production they'd be committed to
 * src/data/products.ts (or a CMS) and go out with the next deploy.
 */
import { productById, products } from '../../../data/products';
import type { SitePhoto } from '../../bridge';
import type { Listing, PhotoPlace, ProductEdit, ProductPhotoMeta, WebsiteState } from '../../data/types';
import { now } from '../../lib/dates';
import { db, deletePhotos, me, mutate, putPhoto, setSiteListings, setSitePhotos, uid } from '../../store';
import { brandName } from './data';
import { isListingPending, listingFromProduct, sameListing, siteListings, tidySpecs } from './listings';
import { photoCaption, preparePhoto, samePhotos } from './photos';

const who = () => me.value?.id ?? 'cheryl';

export function editProduct(id: string, patch: Omit<ProductEdit, 'by' | 'at' | 'publishedAt'>) {
  mutate((d) => {
    const prev = d.website.edits[id];
    d.website = { ...d.website, edits: { ...d.website.edits, [id]: { ...(prev?.publishedAt ? {} : prev), ...patch, by: who(), at: now() } } };
  });
}

export function undoEdit(id: string) {
  mutate((d) => {
    const edits = { ...d.website.edits };
    delete edits[id];
    d.website = { ...d.website, edits };
  });
}

/** Store a new URL for a link — e.g. "update the stored URL" with the checker's new address for a moved link. */
export function setLinkUrl(slug: string, url: string) {
  mutate((d) => {
    d.website = { ...d.website, linkUrls: { ...d.website.linkUrls, [slug]: { url, by: who(), at: now() } } };
  });
}

export function undoLinkUrl(slug: string) {
  mutate((d) => {
    const linkUrls = { ...d.website.linkUrls };
    delete linkUrls[slug];
    d.website = { ...d.website, linkUrls };
  });
}

export function dismiss(suggestionId: string) {
  mutate((d) => {
    if (!d.website.dismissed.includes(suggestionId)) d.website = { ...d.website, dismissed: [...d.website.dismissed, suggestionId] };
  });
}

export function restoreDismissed() {
  mutate((d) => {
    d.website = { ...d.website, dismissed: [] };
  });
}

/* ---------- Listings ---------- */

export const newListingId = () => uid('NEW-');

/** How the public site shows a model on the list that nobody has changed in HMI mode */
const productListing = (id: string) => {
  const p = productById(id);
  return p ? listingFromProduct(p) : undefined;
};

/** Changed since the last publish (simulated)? */
export const listingPending = (w: WebsiteState, id: string) => isListingPending(w.listings[id], w.listingsLive[id], productListing(id));

/** Save a listing — a new one, or changes to a model on the list. It goes live on the next publish (simulated). */
export function saveListing(listing: Omit<Listing, 'by' | 'at'>) {
  const l: Listing = {
    ...listing,
    model: listing.model.trim(),
    type: listing.type.trim(),
    summary: listing.summary.trim(),
    specs: tidySpecs(listing.specs),
    url: listing.url?.trim() || undefined,
    by: who(),
    at: now(),
  };
  if (!l.url) delete l.url;
  mutate((d) => {
    const listings = { ...d.website.listings };
    // A model on the list put back the way the site already shows it: nothing to publish
    if (!l.isNew && !d.website.listingsLive[l.id] && sameListing(l, productListing(l.id))) delete listings[l.id];
    else listings[l.id] = l;
    d.website = { ...d.website, listings };
  });
}

/** Back to the listing as last published. A new listing that was never published goes, with its photos. */
export function undoListing(id: string) {
  const live = db.value?.website.listingsLive[id];
  mutate((d) => {
    const listings = { ...d.website.listings };
    if (live) listings[id] = structuredClone(live);
    else delete listings[id];
    d.website = { ...d.website, listings };
  });
  if (!live) undoPhotos(id);
}

/** Take a new listing off the list — and off the public site on the next publish (simulated), if it was there */
export function removeListing(id: string) {
  const live = db.value?.website.listingsLive[id];
  mutate((d) => {
    const listings = { ...d.website.listings };
    delete listings[id];
    d.website = { ...d.website, listings };
  });
  if (live) setPhotos(id, []);
  else undoPhotos(id);
}

/** Add a model the sitemap watch found: a new listing, kept as a draft until someone fills it in and shows it */
export function addDraft(draft: { brand: string; model: string; url: string; category?: string; suggestionId?: string }) {
  const id = newListingId();
  saveListing({
    id,
    isNew: true,
    brand: draft.brand,
    model: draft.model,
    type: '',
    category: draft.category ?? '',
    summary: '',
    specs: [],
    url: draft.url,
    status: 'hidden',
    display: { 'osage-beach': 0, nixa: 0 },
    suggestionId: draft.suggestionId,
  });
  return id;
}

/* ---------- Model photos ---------- */

const photosOf = (productId: string) => db.value?.website.photos[productId] ?? [];
const livePhotoIds = () => new Set(Object.values(db.value?.website.photosLive ?? {}).flatMap((list) => list.map((p) => p.id)));

function setPhotos(productId: string, list: ProductPhotoMeta[]) {
  mutate((d) => {
    const photos = { ...d.website.photos };
    if (list.length) photos[productId] = list;
    else delete photos[productId];
    d.website = { ...d.website, photos };
  });
}

/** Shrink and keep a photo in this browser, and add it to the model's photos. Throws a message fit to show. */
export async function addPhoto(productId: string, file: File, meta: { alt: string; where?: PhotoPlace }) {
  const { blob, width, height } = await preparePhoto(file);
  const id = uid('ph');
  await putPhoto(id, blob);
  setPhotos(productId, [...photosOf(productId), { id, alt: meta.alt, where: meta.where, width, height, by: who(), at: now() }]);
  return id;
}

export function updatePhoto(productId: string, id: string, patch: Partial<Pick<ProductPhotoMeta, 'alt' | 'where'>>) {
  setPhotos(
    productId,
    photosOf(productId).map((p) => (p.id === id ? { ...p, ...patch } : p)),
  );
}

/** Move a photo to position `to` (0 makes it the main photo) */
export function movePhoto(productId: string, id: string, to: number) {
  const list = [...photosOf(productId)];
  const from = list.findIndex((p) => p.id === id);
  if (from < 0) return;
  const [photo] = list.splice(from, 1);
  list.splice(Math.max(0, Math.min(to, list.length)), 0, photo);
  setPhotos(productId, list);
}

export function removePhoto(productId: string, id: string) {
  setPhotos(
    productId,
    photosOf(productId).filter((p) => p.id !== id),
  );
  // A published photo is kept until the next publish takes it off the site
  if (!livePhotoIds().has(id)) void deletePhotos([id]);
}

/** Back to the photos as last published */
export function undoPhotos(productId: string) {
  const live = db.value?.website.photosLive[productId] ?? [];
  const keep = new Set(live.map((p) => p.id));
  const added = photosOf(productId).filter((p) => !keep.has(p.id));
  setPhotos(productId, structuredClone(live));
  void deletePhotos(added.map((p) => p.id));
}

/** What the public pages show for each model after a publish (simulated) */
function sitePhotos(photos: Record<string, ProductPhotoMeta[]>): Record<string, SitePhoto[]> {
  return Object.fromEntries(
    Object.entries(photos).map(([productId, list]) => {
      const p = productById(productId) ?? db.value?.website.listings[productId];
      const name = p ? `${brandName(p.brand)} ${p.model}` : 'Fireplace';
      return [productId, list.map((ph) => ({ id: ph.id, alt: ph.alt.trim() || name, caption: photoCaption(ph.where), width: ph.width, height: ph.height }))];
    }),
  );
}

/** Simulated publish: mark everything pending as live. Nothing on the real site changes in this concept. */
export function publishPending(): number {
  let changes = 0;
  const wasLive = livePhotoIds();
  mutate((d) => {
    const at = now();
    const edits = Object.fromEntries(
      Object.entries(d.website.edits).map(([id, e]) => {
        if (!e.publishedAt) changes++;
        return [id, e.publishedAt ? e : { ...e, publishedAt: at }];
      }),
    );
    const linkUrls = Object.fromEntries(
      Object.entries(d.website.linkUrls).map(([slug, e]) => {
        if (!e.publishedAt) changes++;
        return [slug, e.publishedAt ? e : { ...e, publishedAt: at }];
      }),
    );
    for (const id of new Set([...Object.keys(d.website.listings), ...Object.keys(d.website.listingsLive)])) {
      if (listingPending(d.website, id)) changes++;
    }
    // Photos go out with their listing: a new listing's photos wait until it's saved
    const known = (id: string) => !!productById(id) || !!d.website.listings[id] || !!d.website.listingsLive[id];
    const photoIds = [...new Set([...Object.keys(d.website.photos), ...Object.keys(d.website.photosLive)])].filter(known);
    for (const id of photoIds) {
      if (!samePhotos(d.website.photos[id], d.website.photosLive[id])) changes++;
    }
    const listingsLive = structuredClone(d.website.listings);
    const photosLive = Object.fromEntries(Object.entries(structuredClone(d.website.photos)).filter(([id]) => known(id)));
    d.website = { ...d.website, edits, linkUrls, listingsLive, photosLive, publishes: [{ id: uid('pub'), at, by: who(), changes }, ...d.website.publishes] };
  });
  // The public pages in this browser now show the published listings and photos; images taken off the site can go
  const photos = db.value?.website.photos ?? {};
  const w = db.value?.website;
  // Models whose manufacturer/distributor link was changed here: their pages link there too (a preview, like the rest)
  const links = Object.fromEntries(
    products.filter((p) => w?.linkUrls[p.slug]).map((p) => [p.id, { url: w!.linkUrls[p.slug].url, base: w!.listings[p.id] ?? listingFromProduct(p) }]),
  );
  void setSiteListings(siteListings(w?.listings ?? {}, brandName, links));
  void setSitePhotos(sitePhotos(db.value?.website.photosLive ?? {}));
  const kept = new Set(Object.values(photos).flatMap((list) => list.map((p) => p.id)));
  void deletePhotos([...wasLive].filter((id) => !kept.has(id)));
  return changes;
}

export function setDigestTo(staffId: string) {
  mutate((d) => {
    d.website = { ...d.website, digestTo: staffId };
  });
}

export function markDigestSent() {
  mutate((d) => {
    d.website = { ...d.website, digestSentAt: now() };
  });
}
