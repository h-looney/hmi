/**
 * Photos of a model: staff add their own (a unit on the showroom floor, or one they installed) and describe each one.
 * They go on the model's page and cards on the next publish (simulated). The images stay in this browser.
 */
import { useEffect, useState } from 'preact/hooks';
import type { PhotoPlace, StoreId } from '../../data/types';
import { plural } from '../../lib/format';
import { getPhoto } from '../../store';
import { toast } from '../../toast';
import { Button, cx, Field } from '../../ui/core';
import { Dialog } from '../../ui/Dialog';
import { Icon } from '../../ui/Icon';
import { addPhoto, movePhoto, removePhoto, updatePhoto } from './actions';
import { webProducts, type WebProduct } from './data';
import { defaultAlt, MAX_PHOTOS, PHOTO_TYPES, PLACE_LABELS } from './photos';

/** A photo kept in this browser, shown from IndexedDB */
export function PhotoImg({ id, alt, class: className }: { id: string; alt: string; class?: string }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    let made: string | null = null;
    void getPhoto(id).then((blob) => {
      if (!live || !blob) return;
      made = URL.createObjectURL(blob);
      setUrl(made);
    });
    return () => {
      live = false;
      if (made) URL.revokeObjectURL(made);
    };
  }, [id]);
  return url ? <img src={url} alt={alt} class={className} /> : <span class={cx(className, 'photo-img--loading')} aria-hidden="true" />;
}

const STORES: StoreId[] = ['osage-beach', 'nixa'];
const storeName = (s: StoreId) => (s === 'nixa' ? 'Nixa' : 'Osage Beach');

/** Put focus back on a control after its row moves (moving a row's DOM node drops focus) */
const refocus = (...ids: string[]) =>
  requestAnimationFrame(() => {
    for (const id of ids) {
      const el = document.getElementById(id);
      if (el) return el.focus();
    }
  });

export function PhotosDialog({ id, onClose }: { id: string; onClose: () => void }) {
  const p = webProducts.value.find((x) => x.id === id) as WebProduct;
  const [busy, setBusy] = useState(0);
  const [status, setStatus] = useState('');
  const [errors, setErrors] = useState<string[]>([]);
  const [dragging, setDragging] = useState(false);
  if (!p) return null;

  const name = `${p.brandName} ${p.model}`;
  const photos = p.photos;
  const room = MAX_PHOTOS - photos.length;
  const shownAt = STORES.filter((s) => p.display[s] > 0);

  async function add(files: File[]) {
    if (!files.length) return;
    const take = files.slice(0, Math.max(0, room));
    const problems = files.length > take.length ? [`Up to ${MAX_PHOTOS} photos per model: ${plural(files.length - take.length, 'photo')} weren’t added`] : [];
    // Where it was taken: the showroom it's on display in, when there's just one
    const where: PhotoPlace | undefined = shownAt.length === 1 ? shownAt[0] : undefined;
    setErrors([]);
    setBusy(take.length);
    setStatus(`Adding ${plural(take.length, 'photo')}…`);
    let added = 0;
    for (const file of take) {
      try {
        await addPhoto(p.id, file, { alt: defaultAlt(name, where), where });
        added++;
      } catch (e) {
        problems.push((e as Error).message);
      }
    }
    setBusy(0);
    setErrors(problems);
    setStatus(added ? `Added ${plural(added, 'photo')}. Check each description below.` : '');
  }

  const onPick = (e: Event) => {
    const input = e.target as HTMLInputElement;
    void add([...(input.files ?? [])]);
    input.value = '';
  };

  return (
    <Dialog
      title={`Photos: ${name}`}
      description="Your own photos of this model: on the showroom floor, or one you installed. They go on its page and cards on the next publish (simulated)."
      size="lg"
      onClose={onClose}
      footer={
        <>
          <span class="muted small photo-footer-note">{p.photosPending ? 'Changes go live on the next publish (simulated)' : photos.length ? 'Published' : ''}</span>
          <Button variant="primary" onClick={onClose}>
            Done
          </Button>
        </>
      }
    >
      <div class="photo-dialog">
        {shownAt.length > 0 && (
          <p class="photo-hint">
            <Icon name="camera" size={16} /> On the floor in {shownAt.map(storeName).join(' and ')}: a few photos of it burning show customers what it looks like before they visit.
          </p>
        )}

        <label
          class={cx('photo-drop', dragging && 'is-dragging', (room <= 0 || busy > 0) && 'is-disabled')}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            if (room > 0 && !busy) void add([...(e.dataTransfer?.files ?? [])]);
          }}
        >
          <Icon name="upload" size={22} />
          <span class="photo-drop__title">{room > 0 ? 'Add photos' : `${MAX_PHOTOS} photos — the most a model can have`}</span>
          <span class="photo-drop__hint">JPEG, PNG or WebP · up to {MAX_PHOTOS} per model · location data is removed</span>
          <input type="file" class="sr-only" accept={PHOTO_TYPES.join(',')} multiple disabled={room <= 0 || busy > 0} onChange={onPick} />
        </label>

        <div role="status" class="photo-status">
          {status && <p>{status}</p>}
          {errors.length > 0 && (
            <ul class="photo-errors">
              {errors.map((m) => (
                <li key={m}>
                  <Icon name="alert" size={14} /> {m}
                </li>
              ))}
            </ul>
          )}
        </div>

        {photos.length > 0 && (
          <ol class="photo-list" aria-label="Photos, in the order they show">
            {photos.map((ph, i) => {
              const n = i + 1;
              const last = i === photos.length - 1;
              return (
                <li key={ph.id} class="photo-row">
                  <div class="photo-row__img">
                    <PhotoImg id={ph.id} alt="" />
                    {i === 0 && <span class="photo-row__main">Main photo</span>}
                  </div>
                  <div class="photo-row__fields">
                    <Field label={`Description of photo ${n}`} hint="What it shows. Screen readers read it aloud.">
                      <input
                        id={`photo-${ph.id}-alt`}
                        class="input"
                        value={ph.alt}
                        maxLength={160}
                        onInput={(e) => updatePhoto(p.id, ph.id, { alt: (e.target as HTMLInputElement).value })}
                      />
                    </Field>
                    {!ph.alt.trim() && <p class="photo-warn">Add a description — without one the photo is described as “{name}”.</p>}
                    <Field label="Where it was taken" hint="Shown under the photo">
                      <select
                        class="select"
                        value={ph.where ?? ''}
                        onChange={(e) => {
                          const where = ((e.target as HTMLSelectElement).value || undefined) as PhotoPlace | undefined;
                          // A description that's still the starting one follows the place
                          updatePhoto(p.id, ph.id, ph.alt === defaultAlt(name, ph.where) ? { where, alt: defaultAlt(name, where) } : { where });
                        }}
                      >
                        <option value="">Don’t say</option>
                        {(Object.keys(PLACE_LABELS) as PhotoPlace[]).map((k) => (
                          <option key={k} value={k}>
                            {PLACE_LABELS[k]}
                          </option>
                        ))}
                      </select>
                    </Field>
                  </div>
                  <div class="photo-row__actions">
                    {i > 0 && (
                      <Button id={`photo-${ph.id}-main`} size="sm" icon="star" onClick={() => (movePhoto(p.id, ph.id, 0), refocus(`photo-${ph.id}-down`, `photo-${ph.id}-alt`))}>
                        Make main<span class="sr-only"> photo: photo {n}</span>
                      </Button>
                    )}
                    {i > 0 && (
                      <Button id={`photo-${ph.id}-up`} size="sm" variant="ghost" icon="sort-up" onClick={() => (movePhoto(p.id, ph.id, i - 1), refocus(`photo-${ph.id}-up`, `photo-${ph.id}-down`))}>
                        Earlier<span class="sr-only">: move photo {n} up</span>
                      </Button>
                    )}
                    {!last && (
                      <Button id={`photo-${ph.id}-down`} size="sm" variant="ghost" icon="sort-down" onClick={() => (movePhoto(p.id, ph.id, i + 1), refocus(`photo-${ph.id}-down`, `photo-${ph.id}-up`))}>
                        Later<span class="sr-only">: move photo {n} down</span>
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      icon="trash"
                      onClick={() => {
                        const next = photos[i + 1] ?? photos[i - 1];
                        removePhoto(p.id, ph.id);
                        toast(`Photo ${n} removed`);
                        if (next) refocus(`photo-${next.id}-alt`);
                      }}
                    >
                      Remove<span class="sr-only"> photo {n}</span>
                    </Button>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </Dialog>
  );
}
