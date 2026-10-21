/**
 * Changes made in the Website section. Like the rest of HMI mode they're saved in this browser; product-list
 * changes are marked "goes live on next publish (simulated)" — in production they'd be committed to
 * src/data/products.ts (or a CMS) and go out with the next deploy.
 */
import { productById } from '../../../data/products';
import type { SitePhoto } from '../../bridge';
import type { PhotoPlace, ProductEdit, ProductPhotoMeta } from '../../data/types';
import { now } from '../../lib/dates';
import { db, deletePhotos, me, mutate, putPhoto, setSitePhotos, uid } from '../../store';
import { brandName } from './data';
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

/** Add a model from a sitemap suggestion — a draft until the next publish (simulated). */
export function addDraft(draft: { brand: string; model: string; url: string; category?: string; suggestionId?: string }) {
  const id = uid('NEW-');
  mutate((d) => {
    d.website = { ...d.website, drafts: [...d.website.drafts, { id, ...draft, by: who(), at: now() }] };
  });
  return id;
}

export function removeDraft(id: string) {
  mutate((d) => {
    d.website = { ...d.website, drafts: d.website.drafts.filter((x) => x.id !== id) };
  });
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
      const p = productById(productId);
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
    const drafts = d.website.drafts.map((x) => {
      if (!x.publishedAt) changes++;
      return x.publishedAt ? x : { ...x, publishedAt: at };
    });
    for (const id of new Set([...Object.keys(d.website.photos), ...Object.keys(d.website.photosLive)])) {
      if (!samePhotos(d.website.photos[id], d.website.photosLive[id])) changes++;
    }
    const photosLive = structuredClone(d.website.photos);
    d.website = { ...d.website, edits, linkUrls, drafts, photosLive, publishes: [{ id: uid('pub'), at, by: who(), changes }, ...d.website.publishes] };
  });
  // The public pages in this browser now show the published photos; images taken off the site can go
  const photos = db.value?.website.photos ?? {};
  void setSitePhotos(sitePhotos(photos));
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
