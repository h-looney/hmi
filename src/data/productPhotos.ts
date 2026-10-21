/**
 * Photos HMI owns, by key (Product.photo in src/data/products.ts). Empty for now: manufacturer images are never copied
 * or hotlinked into this public repo — production would add photos from each manufacturer's dealer media kit, or
 * HMI's own showroom photos, here. Until then model pages show a labelled placeholder (src/data/productArt.ts).
 */
import type { ImageMetadata } from 'astro';

export const productPhotos: Record<string, { src: ImageMetadata; alt: string }> = {};
