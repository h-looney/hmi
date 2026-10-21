/** HMI mode's model photos: starting descriptions, captions, and what counts as a change waiting to be published. */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { ProductPhotoMeta } from '../../src/office/data/types.ts';
import { defaultAlt, photoCaption, samePhotos } from '../../src/office/pages/website/photos.ts';

const photo = (id: string, over: Partial<ProductPhotoMeta> = {}): ProductPhotoMeta => ({ id, alt: 'Artisan 42', width: 1600, height: 1200, by: 'cheryl', at: '2026-10-21T09:00', ...over });

describe('model photos', () => {
  it('a new photo’s description starts from where it was taken', () => {
    assert.equal(defaultAlt('Monessen Artisan 42', 'nixa'), 'Monessen Artisan 42 on the Nixa showroom floor');
    assert.equal(defaultAlt('Monessen Artisan 42', 'install'), 'Monessen Artisan 42 installed by HMI in a customer’s home');
    assert.equal(defaultAlt('Monessen Artisan 42'), 'Monessen Artisan 42');
  });

  it('the place becomes the caption; no place, no caption', () => {
    assert.equal(photoCaption('osage-beach'), 'On the Osage Beach showroom floor');
    assert.equal(photoCaption(undefined), undefined);
  });

  it('a change is a photo added, removed, moved, re-described or re-placed', () => {
    const live = [photo('a'), photo('b', { where: 'nixa' })];
    assert.ok(samePhotos(structuredClone(live), live));
    assert.ok(samePhotos(undefined, []));
    assert.ok(!samePhotos([...live, photo('c')], live));
    assert.ok(!samePhotos([live[0]], live));
    assert.ok(!samePhotos([live[1], live[0]], live));
    assert.ok(!samePhotos([{ ...live[0], alt: 'Up close' }, live[1]], live));
    assert.ok(!samePhotos([live[0], { ...live[1], where: undefined }], live));
  });
});
