/**
 * Photos of a model: a gallery on its page, and the first one on its cards and in its structured data. Put the files
 * in src/assets/products/<product id>/ (e.g. src/assets/products/HG-MEZZO48/1-nixa-floor.jpg). They're picked up
 * automatically in file-name order, the first one leading. Describe each one in `notes` below.
 *
 * Only photos HMI may publish: its own showroom and install photos, or images from a manufacturer's dealer media kit
 * (with whatever credit the kit asks for). Nothing is copied or hotlinked from manufacturers' websites. A model with no
 * photo shows a labelled placeholder (src/data/productArt.ts).
 */
import type { ImageMetadata } from 'astro';
import { brands } from './brands';
import { brandSites, type Product } from './products';

export interface ProductPhoto {
  src: ImageMetadata;
  /** What the photo shows, for people who can't see it */
  alt: string;
  /** Shown under the photo on the model page, e.g. "On the Nixa showroom floor" */
  caption?: string;
  /** e.g. "Photo: Heat & Glo" for a media-kit image */
  credit?: string;
}

/** Alt text, captions and credits, by file: its path under src/assets/products/. */
const notes: Record<string, Omit<ProductPhoto, 'src'>> = {
  // 'HG-MEZZO48/1-nixa-floor.jpg': { alt: 'A Mezzo 48 burning on the Nixa showroom floor', caption: 'On the Nixa showroom floor' },
};

const files = import.meta.glob<{ default: ImageMetadata }>('../assets/products/*/*.{jpg,jpeg,png,webp,avif}', { eager: true });

const byProduct = new Map<string, [file: string, src: ImageMetadata][]>();
for (const [path, mod] of Object.entries(files)) {
  const file = path.replace('../assets/products/', '');
  const id = file.split('/')[0];
  byProduct.set(id, [...(byProduct.get(id) ?? []), [file, mod.default]]);
}

export function photosFor(p: Pick<Product, 'id' | 'brand' | 'model'>): ProductPhoto[] {
  const list = [...(byProduct.get(p.id) ?? [])].sort(([a], [b]) => a.localeCompare(b, 'en', { numeric: true }));
  // Without a note, a photo is described by the model's name (the gallery numbers its thumbnails)
  const name = `${brandSites[p.brand]?.name ?? brands.find((b) => b.id === p.brand)?.name ?? p.brand} ${p.model}`;
  return list.map(([file, src]) => ({
    src,
    alt: notes[file]?.alt ?? name,
    caption: notes[file]?.caption,
    credit: notes[file]?.credit,
  }));
}
