/**
 * Model photos on the public pages.
 *
 * - Galleries: the thumbnails under a model's photo switch the large one.
 * - Preview: photos published from HMI mode in this browser (simulated — they're kept in this browser, not on the
 *   site) take the placeholder's place on model pages and cards, with a note saying so.
 */
import { readPublishedPhotos, type SitePhoto } from '../office/bridge';

type Published = SitePhoto & { url: string };

let started = false;

export function initProductPhotos() {
  if (started) return;
  started = true;
  document.querySelectorAll<HTMLElement>('[data-gallery]').forEach(wire);
  void preview();
}

function wire(gallery: HTMLElement) {
  const slides = [...gallery.querySelectorAll<HTMLElement>('[data-slide]')];
  const thumbs = [...gallery.querySelectorAll<HTMLButtonElement>('[data-show]')];
  for (const thumb of thumbs) {
    thumb.addEventListener('click', () => {
      const i = Number(thumb.dataset.show);
      slides.forEach((s, j) => (s.hidden = j !== i));
      thumbs.forEach((t, j) => t.setAttribute('aria-pressed', String(j === i)));
    });
  }
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

function img(photo: Published, alt: string) {
  const image = el('img');
  image.src = photo.url;
  image.alt = alt;
  image.width = photo.width;
  image.height = photo.height;
  image.decoding = 'async';
  return image;
}

/** Rebuild a model page's gallery from the photos published in this browser. */
function build(gallery: HTMLElement, photos: Published[]) {
  const slides = el('div', 'gallery__slides');
  photos.forEach((photo, i) => {
    const slide = el('figure', 'gallery__slide');
    slide.dataset.slide = String(i);
    slide.hidden = i > 0;
    const frame = el('div', 'gallery__frame');
    frame.append(img(photo, photo.alt));
    slide.append(frame);
    if (photo.caption) slide.append(el('figcaption', 'gallery__caption', photo.caption));
    slides.append(slide);
  });
  const parts: HTMLElement[] = [slides];
  if (photos.length > 1) {
    const thumbs = el('ul', 'gallery__thumbs');
    thumbs.setAttribute('role', 'list');
    photos.forEach((photo, i) => {
      const button = el('button', 'gallery__thumb');
      button.type = 'button';
      button.dataset.show = String(i);
      button.setAttribute('aria-pressed', String(i === 0));
      button.append(img(photo, ''), el('span', 'visually-hidden', `Photo ${i + 1} of ${photos.length}: ${photo.alt}`));
      const item = el('li');
      item.append(button);
      thumbs.append(item);
    });
    parts.push(thumbs);
  }
  parts.push(el('p', 'gallery__note gallery__note--preview', 'Preview: published from HMI mode in this browser. On the live site these photos would be here for everyone.'));
  gallery.replaceChildren(...parts);
  gallery.dataset.preview = '';
  wire(gallery);
}

async function preview() {
  const galleries = [...document.querySelectorAll<HTMLElement>('[data-gallery-for]')];
  const cards = [...document.querySelectorAll<HTMLElement>('[data-product-photo]')];
  const ids = [...new Set([...galleries.map((g) => g.dataset.galleryFor!), ...cards.map((c) => c.dataset.productPhoto!)])];
  if (!ids.length) return;
  const published = await readPublishedPhotos(ids);
  if (!published.size) return;
  for (const gallery of galleries) {
    const photos = published.get(gallery.dataset.galleryFor!);
    if (photos) build(gallery, photos);
  }
  for (const card of cards) {
    const photos = published.get(card.dataset.productPhoto!);
    if (!photos) continue;
    card.replaceChildren(img(photos[0], photos[0].alt));
    card.dataset.preview = '';
  }
}
