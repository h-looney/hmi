/**
 * The shop section's brand filter, and listings published from HMI mode previewed on the public pages in this browser
 * (simulated: they're kept in this browser's storage, not on the site — production would rebuild the pages).
 *
 * - Category pages: filter the listings by brand (?brand=<id> opens on one); new listings join the grid as cards
 *   marked "Preview", and the brand counts follow.
 * - Model pages and cards: HMI's changes to a model on the list (name, what it is, description, specs).
 * - /products/preview/?id=…: a new listing's page.
 * Everything is built with DOM APIs and textContent — what staff typed is never parsed as HTML.
 */
import { readPublishedListings, type SiteListing } from '../office/bridge';
import { placeholderSvg } from '../data/productArt';
import type { ProductCategory, ProductFuel } from '../data/products';
import { previewPhotosIn } from './productPhotos';
import { withBase } from './url';

let listings: Promise<Record<string, SiteListing>> | null = null;
const published = () => (listings ??= readPublishedListings());

const STORES = [
  ['osage-beach', 'Osage Beach'],
  ['nixa', 'Nixa'],
] as const;

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

/** The fuel a listing's "Fuel" spec names (for the placeholder drawing) */
function fuelOf(l: SiteListing): ProductFuel | undefined {
  const v = l.specs.find((s) => s.label.trim().toLowerCase() === 'fuel')?.value.toLowerCase() ?? '';
  return /pellet/.test(v) ? 'pellet' : /electric/.test(v) ? 'electric' : /wood/.test(v) ? 'wood' : /gas|propane/.test(v) ? 'gas' : undefined;
}

function placeholder(l: SiteListing): HTMLImageElement {
  const image = el('img');
  image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(placeholderSvg({ category: l.category as ProductCategory, type: l.type, fuel: fuelOf(l), model: l.model }, l.brandName))}`;
  image.alt = `Photo coming soon: ${l.brandName} ${l.model}`;
  image.width = 800;
  image.height = 600;
  return image;
}

const shownAt = (l: SiteListing) => STORES.filter(([id]) => (l.display[id] ?? 0) > 0).map(([, name]) => name);
export const previewHref = (id: string) => withBase(`/products/preview/?id=${encodeURIComponent(id)}`);

/* ---------- Category pages: the shop section ---------- */

let shopStarted = false;

export function initShop() {
  if (shopStarted) return;
  shopStarted = true;
  document.querySelectorAll<HTMLElement>('[data-shop]').forEach(setupShop);
  void cardEdits(document);
}

/** A card for a listing published from HMI mode, like ProductCard's */
function previewCard(l: SiteListing): HTMLElement {
  const item = el('div', 'shop__item');
  item.dataset.brand = l.brand;
  item.dataset.preview = '';
  const card = el('article', 'card card--hover model-card');
  const media = el('div', 'card__media model-card__media');
  media.dataset.productPhoto = l.id;
  media.append(placeholder(l));
  const body = el('div', 'card__body model-card__body');
  const title = el('h3', 'model-card__title');
  const link = el('a', 'card__link', l.model);
  link.href = previewHref(l.id);
  title.append(link);
  const at = shownAt(l);
  body.append(
    el('p', 'model-card__brand', l.brandName),
    title,
    el('p', 'model-card__type', l.type),
    el('p', at.length ? 'model-card__note model-card__note--display' : 'model-card__note', at.length ? `On display in ${at.join(' & ')}` : 'Ask us — we can order it'),
    el('p', 'model-card__preview', 'Preview · listed in HMI mode'),
  );
  card.append(media, body);
  item.append(card);
  return item;
}

function setupShop(shop: HTMLElement) {
  const grid = shop.querySelector<HTMLElement>('[data-shop-grid]')!;
  const filters = shop.querySelector<HTMLElement>('[data-shop-filters]')!;
  const status = shop.querySelector<HTMLElement>('[data-shop-status]')!;
  const empty = shop.querySelector<HTMLElement>('[data-shop-empty]')!;
  const what = shop.dataset.shopName ?? 'models';
  const items = () => [...grid.querySelectorAll<HTMLElement>('.shop__item')];
  const chip = (id: string) => filters.querySelector<HTMLButtonElement>(`[data-shop-brand="${CSS.escape(id)}"]`);
  const names = new Map<string, string>();
  shop.querySelectorAll<HTMLElement>('[data-brand-count]').forEach((n) => names.set(n.dataset.brandCount!, n.dataset.name ?? ''));
  let active = 'all';

  /** Counts on the chips and brand cards follow the cards in the grid (preview cards included) */
  function recount() {
    const counts = new Map<string, number>();
    for (const it of items()) counts.set(it.dataset.brand!, (counts.get(it.dataset.brand!) ?? 0) + 1);
    shop.querySelector('[data-shop-count="all"]')!.textContent = String(items().length);
    for (const [id, n] of counts) {
      let button = chip(id);
      if (!button) {
        // A brand listed only in HMI mode so far
        button = el('button', 'chip');
        button.type = 'button';
        button.dataset.shopBrand = id;
        button.setAttribute('aria-pressed', 'false');
        const n = el('span', 'shop__n');
        n.dataset.shopCount = id;
        button.append(`${names.get(id) ?? id} `, n);
        filters.append(button);
      }
      button.querySelector('.shop__n')!.textContent = String(n);
    }
    filters.hidden = counts.size < 2;
    shop.querySelectorAll<HTMLElement>('[data-brand-card]').forEach((card) => {
      const id = card.dataset.brandCard!;
      const n = counts.get(id) ?? 0;
      const name = names.get(id) ?? id;
      card.classList.toggle('is-listed', n > 0);
      card.querySelector('[data-brand-count]')!.textContent = n ? `${n} ${n === 1 ? 'model' : 'models'} listed here` : 'Ask us about any model';
      const show = card.querySelector<HTMLAnchorElement>('[data-shop-show]');
      if (!show) return;
      if (n) {
        show.href = `?brand=${encodeURIComponent(id)}#models`;
        show.replaceChildren(`Show ${n === 1 ? 'it' : 'them'}`, el('span', 'visually-hidden', ` (${name} ${what})`));
      } else {
        show.href = show.dataset.ask ?? show.href;
        show.textContent = `Ask about ${name}`;
      }
    });
  }

  function apply(brand: string, announce = true) {
    active = brand !== 'all' && chip(brand) ? brand : 'all';
    filters.querySelectorAll<HTMLElement>('[data-shop-brand]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.shopBrand === active)));
    let shown = 0;
    for (const it of items()) {
      const on = active === 'all' || it.dataset.brand === active;
      it.hidden = !on;
      if (on) shown++;
    }
    empty.hidden = shown > 0;
    if (announce) status.textContent = active === 'all' ? `Showing all ${shown} ${what}` : `Showing ${shown} ${names.get(active) ?? ''} ${what}`;
    const url = new URL(location.href);
    if (active === 'all') url.searchParams.delete('brand');
    else url.searchParams.set('brand', active);
    history.replaceState(history.state, '', url.pathname + url.search + url.hash);
  }

  filters.addEventListener('click', (e) => {
    const button = (e.target as Element).closest<HTMLElement>('[data-shop-brand]');
    if (button) apply(button.dataset.shopBrand!);
  });
  // "Show them" on a brand card: filter to it and go back up to the listings
  shop.querySelectorAll<HTMLAnchorElement>('[data-shop-show]').forEach((a) =>
    a.addEventListener('click', (e) => {
      const id = a.dataset.shopShow!;
      if (!items().some((it) => it.dataset.brand === id)) return;
      e.preventDefault();
      apply(id);
      const target = filters.hidden ? grid : chip(id) ?? grid;
      if (target === grid) grid.setAttribute('tabindex', '-1');
      target.focus();
      target.scrollIntoView({ block: 'center' });
    }),
  );

  const wanted = new URLSearchParams(location.search).get('brand');
  if (wanted) apply(wanted, false);

  // New listings published from HMI mode in this browser, for this category
  void published().then((all) => {
    const fresh = Object.values(all).filter((l) => l.isNew && l.category === shop.dataset.shop);
    if (!fresh.length) return;
    const cards = fresh.map(previewCard);
    grid.append(...cards);
    for (const l of fresh) if (!names.has(l.brand)) names.set(l.brand, l.brandName);
    recount();
    apply(wanted ?? active, false);
    void previewPhotosIn(grid);
  });
}

/* ---------- Cards and model pages: changes to a model on the list ---------- */

/** Cards of models on the list show HMI's published changes to their name and what they are */
export async function cardEdits(root: ParentNode) {
  const cards = [...root.querySelectorAll<HTMLElement>('[data-listing-card]')];
  if (!cards.length) return;
  const all = await published();
  for (const card of cards) {
    const l = all[card.dataset.listingCard!];
    if (!l || l.isNew) continue;
    const model = card.querySelector('[data-listing-model]');
    const type = card.querySelector('[data-listing-type]');
    if (model) model.textContent = l.model;
    if (type) type.textContent = l.type;
  }
}

function specRows(specs: SiteListing['specs']): HTMLElement[] {
  return specs.map((s) => {
    const row = el('div');
    row.append(el('dt', undefined, s.label), el('dd', undefined, s.value));
    return row;
  });
}

/** A model page shows HMI's published changes to it, with a note saying they're a preview */
export async function initModelEdits() {
  const page = document.querySelector<HTMLElement>('[data-listing-page]');
  if (!page) return;
  const l = (await published())[page.dataset.listingPage!];
  if (!l || l.isNew) return;
  const set = (selector: string, text: string) => {
    const node = page.querySelector(selector);
    if (node && text) node.textContent = text;
  };
  set('[data-listing-name]', `${l.brandName} ${l.model}`);
  set('[data-listing-summary]', l.summary);
  set('[data-listing-page-type]', l.type);
  // A manufacturer/distributor link changed in HMI mode: straight there (production would update its /go/ page)
  if (l.url) {
    document.querySelectorAll<HTMLAnchorElement>('[data-outbound]').forEach((a) => {
      a.href = l.url!;
      a.rel = 'noopener noreferrer';
    });
    // "See it on Heat & Glo's site" may not be true of a distributor's page
    document.querySelectorAll('[data-outbound-site]').forEach((t) => (t.textContent = 'online'));
  }
  if (l.linkText) document.querySelectorAll('[data-outbound-text]').forEach((t) => (t.textContent = l.linkText!));
  const wrap = document.querySelector<HTMLElement>('[data-listing-specs]');
  if (wrap) {
    const dl = el('dl', 'specs');
    dl.append(...specRows(l.specs));
    wrap.replaceChildren(...(l.specs.length ? [dl] : [el('p', 'muted', 'Ask us for the spec sheet.')]));
  }
  document.querySelectorAll<HTMLElement>('[data-listing-note]').forEach((n) => (n.hidden = false));
}

/* ---------- /products/preview/?id=… : a new listing's page ---------- */

export async function initPreviewPage() {
  const page = document.querySelector<HTMLElement>('[data-preview-page]');
  if (!page) return;
  const id = new URLSearchParams(location.search).get('id') ?? '';
  const l = id ? (await published())[id] : undefined;
  const missing = page.querySelector<HTMLElement>('[data-preview-missing]')!;
  const found = page.querySelector<HTMLElement>('[data-preview-found]')!;
  if (!l || !l.isNew) {
    missing.hidden = false;
    found.hidden = true;
    return;
  }
  const categories = JSON.parse(page.querySelector('[data-categories]')?.textContent ?? '{}') as Record<string, string>;
  const category = categories[l.category] ?? 'Products';
  const name = `${l.brandName} ${l.model}`;
  document.title = `${name} ${l.type} | HMI Fireplace Shops`;
  const text = (selector: string, value: string) => page.querySelectorAll(selector).forEach((n) => (n.textContent = value));
  text('[data-preview-brand]', l.brandName);
  text('[data-preview-name]', name);
  text('[data-preview-model]', l.model);
  text('[data-preview-summary]', l.summary);
  text('[data-preview-type]', l.type);
  text('[data-preview-category]', category);
  page.querySelectorAll<HTMLAnchorElement>('[data-preview-category-link]').forEach((a) => (a.href = withBase(`/products/${l.category}/`)));
  const crumbs = page.querySelectorAll<HTMLElement>('.crumbs li');
  const categoryCrumb = crumbs[2]?.querySelector('a');
  if (categoryCrumb) {
    categoryCrumb.textContent = category;
    categoryCrumb.href = withBase(`/products/${l.category}/`);
  }
  const here = crumbs[3]?.querySelector('[aria-current]');
  if (here) here.textContent = l.model;
  page.querySelectorAll<HTMLAnchorElement>('[data-preview-quote]').forEach((a) => (a.href = withBase(`/contact/?interest=${encodeURIComponent(l.category)}&model=${encodeURIComponent(l.id)}`)));
  page.querySelectorAll<HTMLAnchorElement>('[data-preview-outbound]').forEach((a) => {
    if (!l.url) return void a.remove();
    a.href = l.url;
    a.querySelector('[data-preview-outbound-text]')!.textContent = l.linkText ?? `Full specs at ${l.brandName}`;
  });

  const wrap = page.querySelector<HTMLElement>('[data-preview-specs]')!;
  if (l.specs.length) {
    const dl = el('dl', 'specs');
    dl.append(...specRows(l.specs));
    wrap.replaceChildren(dl);
  }

  // On display: the store rows rendered on the page, switched on where the listing says
  for (const [store] of STORES) {
    const row = page.querySelector<HTMLElement>(`[data-store-row="${store}"]`);
    const n = l.display[store] ?? 0;
    if (!row) continue;
    row.classList.toggle('is-on', n > 0);
    row.querySelector('[data-store-state]')!.textContent = n > 1 ? `${n} on the showroom floor` : n === 1 ? 'On the showroom floor' : 'Not on display — we can order one';
  }

  // Photos published with it, or its labelled placeholder
  const gallery = page.querySelector<HTMLElement>('[data-preview-gallery]')!;
  gallery.dataset.galleryFor = l.id;
  gallery.querySelector('.gallery__frame')!.replaceChildren(placeholder(l));
  await previewPhotosIn(page);
  if (!gallery.hasAttribute('data-preview')) {
    const note = el('p', 'gallery__note');
    note.textContent = `No photos yet — see it on the showroom floor${shownAt(l).length ? ` in ${shownAt(l).join(' and ')}` : ''}, or ask us.`;
    gallery.append(note);
  }
  found.hidden = false;
  missing.hidden = true;
}

