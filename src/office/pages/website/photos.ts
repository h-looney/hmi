/** Model photos added in HMI mode: reading and shrinking the files, captions, and what counts as a change. */
import type { PhotoPlace, ProductPhotoMeta } from '../../data/types';

export const MAX_PHOTOS = 12;
const MAX_EDGE = 1600;
const MAX_MB = 25;
export const PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

/**
 * Read a photo, scale it to at most 1600 px on its long side and re-encode it as a JPEG. Re-encoding also drops the
 * file's metadata, including the GPS location phones add. Throws a message fit to show when the file won't do.
 */
export async function preparePhoto(file: File): Promise<{ blob: Blob; width: number; height: number }> {
  if (file.type && !PHOTO_TYPES.includes(file.type)) throw new Error(`${file.name} isn’t a JPEG, PNG or WebP photo`);
  if (file.size > MAX_MB * 1024 * 1024) throw new Error(`${file.name} is over ${MAX_MB} MB`);
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    throw new Error(`${file.name} couldn’t be read — try saving it as a JPEG`);
  }
  try {
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error(`${file.name} couldn’t be processed`);
    // JPEG has no transparency: put see-through PNGs on white
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(bitmap, 0, 0, width, height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.86));
    if (!blob) throw new Error(`${file.name} couldn’t be processed`);
    return { blob, width, height };
  } finally {
    bitmap.close();
  }
}

const CAPTIONS: Record<PhotoPlace, string> = {
  'osage-beach': 'On the Osage Beach showroom floor',
  nixa: 'On the Nixa showroom floor',
  install: 'Installed by HMI in a customer’s home',
};

export const PLACE_LABELS: Record<PhotoPlace, string> = {
  'osage-beach': 'Osage Beach showroom',
  nixa: 'Nixa showroom',
  install: 'A customer’s home',
};

/** The caption under the photo on the model page */
export const photoCaption = (where?: PhotoPlace) => (where ? CAPTIONS[where] : undefined);

/** A starting description for a new photo: "Heat & Glo Mezzo 48 on the Nixa showroom floor" */
export const defaultAlt = (name: string, where?: PhotoPlace) => (where ? `${name} ${CAPTIONS[where].replace(/^On/, 'on').replace(/^Installed/, 'installed')}` : name);

/** Same photos, in the same order, with the same descriptions and places? */
export const samePhotos = (a: ProductPhotoMeta[] = [], b: ProductPhotoMeta[] = []) =>
  a.length === b.length && a.every((p, i) => p.id === b[i].id && p.alt === b[i].alt && (p.where ?? '') === (b[i].where ?? ''));
