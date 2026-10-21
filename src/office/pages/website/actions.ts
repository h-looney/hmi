/**
 * Changes made in the Website section. Like the rest of HMI mode they're saved in this browser; product-list
 * changes are marked "goes live on next publish (simulated)" — in production they'd be committed to
 * src/data/products.ts (or a CMS) and go out with the next deploy.
 */
import type { ProductEdit } from '../../data/types';
import { now } from '../../lib/dates';
import { me, mutate, uid } from '../../store';

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

/** Simulated publish: mark everything pending as live. Nothing on the real site changes in this concept. */
export function publishPending(): number {
  let changes = 0;
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
    d.website = { ...d.website, edits, linkUrls, drafts, publishes: [{ id: uid('pub'), at, by: who(), changes }, ...d.website.publishes] };
  });
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
