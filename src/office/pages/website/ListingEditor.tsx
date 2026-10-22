/**
 * A product listing, written in HMI mode: a new one, or changes to the page of a model already on the product list.
 * Staff write what it is, the specs (the common ones are a click away; any other label can be typed in), a short
 * description and where it's on display, and add their own photos from the showroom floor or an install. Saving
 * keeps it in this browser; it goes live on the next publish (simulated).
 *   /office/website/?listing=new[&category=<slug>]   ·   /office/website/?listing=<id>
 */
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { brands } from '../../../data/brands';
import { categories, groups } from '../../../data/categories';
import { placeholderSvg } from '../../../data/productArt';
import { goPath } from '../../../data/links';
import { productById, products } from '../../../data/products';
import type { Listing, ListingSpec, StoreId } from '../../data/types';
import { param } from '../../router';
import { db } from '../../store';
import { toast } from '../../toast';
import { Button, Card, cx, Field, Switch } from '../../ui/core';
import { Confirm } from '../../ui/Dialog';
import { Icon } from '../../ui/Icon';
import { newListingId, saveListing, setLinkUrl, undoLinkUrl, undoPhotos } from './actions';
import { brandName, webProducts } from './data';
import { ago, LinkBadge } from './helpers';
import { COMMON_SPECS, defaultLinkText, fuelOf, listingFromProduct, listingProblems, MAX_SPECS, sameListing, specIndex, valuesFor } from './listings';
import { PhotoImg, PhotoManager, refocus, STORES } from './PhotosDialog';

type Row = ListingSpec & { key: string };
type Form = Omit<Listing, 'by' | 'at' | 'specs'> & { specs: Row[] };

let rowSeq = 0;
const row = (s: ListingSpec): Row => ({ ...s, key: `r${++rowSeq}` });
const STORE_NAMES: Record<StoreId, string> = { 'osage-beach': 'Osage Beach', nixa: 'Nixa' };

/** Labels and types already on the product list, offered as suggestions so listings stay consistent */
const knownLabels = [...new Set([...COMMON_SPECS.map((c) => c.label), ...products.flatMap((p) => p.specs.map((s) => s.label))])].sort();
const knownTypes = [...new Set(products.map((p) => p.type))].sort();

function startingForm(id: string, isNewId: string): Form {
  const w = db.value.website;
  // A new listing taken off since the last publish still opens as it was
  const saved = w.listings[id] ?? w.listingsLive[id];
  const product = productById(id);
  // A model on the list: its link lives with the other outbound links (what the nightly check tests)
  const link = product ? (w.linkUrls[product.slug]?.url ?? product.url) : undefined;
  if (saved) return { ...saved, ...(product ? { url: link } : {}), specs: saved.specs.map(row) };
  if (product) {
    const l = listingFromProduct(product);
    return { ...l, url: link, specs: l.specs.map(row) };
  }
  const category = categories.some((c) => c.slug === param('category')) ? (param('category') as string) : '';
  return { id: isNewId, isNew: true, brand: '', model: '', type: '', category, summary: '', specs: [], url: '', status: 'current', display: { 'osage-beach': 0, nixa: 0 } };
}

const asListing = (f: Form): Omit<Listing, 'by' | 'at'> => ({ ...f, specs: f.specs.map(({ label, value }) => ({ label, value })) });

/* ---------- Specs ---------- */

function SpecsEditor({ specs, onChange }: { specs: Row[]; onChange: (rows: Row[]) => void }) {
  const full = specs.length >= MAX_SPECS;
  const add = (label = '') => {
    if (full) return;
    const r = row({ label, value: '' });
    onChange([...specs, r]);
    refocus(label ? `spec-${r.key}-value` : `spec-${r.key}-label`);
  };
  const set = (key: string, patch: Partial<ListingSpec>) => onChange(specs.map((s) => (s.key === key ? { ...s, ...patch } : s)));
  const move = (i: number, to: number) => {
    const next = [...specs];
    const [r] = next.splice(i, 1);
    next.splice(to, 0, r);
    onChange(next);
    const dir = to < i ? 'up' : 'down';
    const other = dir === 'up' ? 'down' : 'up';
    refocus(...(to === 0 || to === specs.length - 1 ? [`spec-${r.key}-${other}`] : [`spec-${r.key}-${dir}`, `spec-${r.key}-${other}`]), `spec-${r.key}-label`);
  };
  const remove = (i: number) => {
    const next = specs[i + 1] ?? specs[i - 1];
    onChange(specs.filter((_, j) => j !== i));
    refocus(next ? `spec-${next.key}-label` : 'spec-add');
  };
  const name = (s: Row, i: number) => s.label.trim() || `spec ${i + 1}`;

  return (
    <div class="spec-editor">
      <div class="spec-common">
        <p class="spec-common__label" id="spec-common-label">
          Common specs <span class="muted">— click to add one, then fill in its value</span>
        </p>
        <ul class="spec-common__list" role="list" aria-labelledby="spec-common-label">
          {COMMON_SPECS.map((c) => {
            const at = specIndex(specs, c.label);
            const on = at >= 0;
            return (
              <li key={c.label}>
                <button
                  type="button"
                  class={cx('spec-chip', on && 'is-on')}
                  aria-pressed={on}
                  disabled={!on && full}
                  onClick={() => (on ? refocus(`spec-${specs[at].key}-value`) : add(c.label))}
                >
                  <Icon name={on ? 'check' : 'plus'} size={14} />
                  {c.label}
                  {on && <span class="sr-only"> (added — go to its value)</span>}
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      {specs.length > 0 ? (
        <ol class="spec-rows" aria-label="Specs, in the order they show">
          {specs.map((s, i) => {
            const values = valuesFor(s.label);
            const example = COMMON_SPECS.find((c) => c.label.toLowerCase() === s.label.trim().toLowerCase())?.example;
            return (
              <li key={s.key} class="spec-row">
                <span class="spec-row__n" aria-hidden="true">
                  {i + 1}
                </span>
                <div class="spec-row__field">
                  <label class="spec-row__label" for={`spec-${s.key}-label`}>
                    Label<span class="sr-only"> of spec {i + 1}</span>
                  </label>
                  <input id={`spec-${s.key}-label`} class="input" value={s.label} maxLength={40} list="spec-labels" placeholder="e.g. Log length" onInput={(e) => set(s.key, { label: (e.target as HTMLInputElement).value })} />
                </div>
                <div class="spec-row__field spec-row__field--value">
                  <label class="spec-row__label" for={`spec-${s.key}-value`}>
                    Value<span class="sr-only"> of {name(s, i)}</span>
                  </label>
                  <input
                    id={`spec-${s.key}-value`}
                    class="input"
                    value={s.value}
                    maxLength={120}
                    list={values ? `spec-${s.key}-values` : undefined}
                    placeholder={example ? `e.g. ${example}` : ''}
                    onInput={(e) => set(s.key, { value: (e.target as HTMLInputElement).value })}
                  />
                  {values && (
                    <datalist id={`spec-${s.key}-values`}>
                      {values.map((v) => (
                        <option key={v} value={v} />
                      ))}
                    </datalist>
                  )}
                </div>
                <div class="spec-row__actions">
                  <Button id={`spec-${s.key}-up`} size="sm" variant="ghost" icon="sort-up" disabled={i === 0} aria-label={`Move ${name(s, i)} up`} onClick={() => move(i, i - 1)} />
                  <Button id={`spec-${s.key}-down`} size="sm" variant="ghost" icon="sort-down" disabled={i === specs.length - 1} aria-label={`Move ${name(s, i)} down`} onClick={() => move(i, i + 1)} />
                  <Button size="sm" variant="ghost" icon="trash" aria-label={`Remove ${name(s, i)}`} onClick={() => remove(i)} />
                </div>
              </li>
            );
          })}
        </ol>
      ) : (
        <p class="muted small spec-empty">No specs yet. Add the common ones above, or a custom one below.</p>
      )}
      <datalist id="spec-labels">
        {knownLabels.map((l) => (
          <option key={l} value={l} />
        ))}
      </datalist>
      <div class="spec-add">
        <Button id="spec-add" icon="plus" disabled={full} onClick={() => add()}>
          Add a custom spec
        </Button>
        {full && <span class="muted small">{MAX_SPECS} specs is the most a listing can have.</span>}
      </div>
    </div>
  );
}

/* ---------- Preview ---------- */

function CardPreview({ form }: { form: Form }) {
  const photos = db.value.website.photos[form.id] ?? [];
  const brand = form.brand ? brandName(form.brand) : 'Brand';
  const model = form.model.trim() || 'Model name';
  const art = useMemo(
    () => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(placeholderSvg({ category: form.category as never, type: form.type, fuel: fuelOf(form.specs), model }, brand))}`,
    [form.category, form.type, form.specs, model, brand],
  );
  const at = STORES.filter((s) => form.display[s] > 0).map((s) => STORE_NAMES[s]);
  const specs = form.specs.filter((s) => s.label.trim() && s.value.trim());
  return (
    <div class="listing-preview">
      <p class="listing-preview__label">
        <Icon name="eye" size={15} /> How it looks on the site
      </p>
      <div class="listing-card">
        <div class="listing-card__media">{photos.length ? <PhotoImg id={photos[0].id} alt="" /> : <img src={art} alt="" />}</div>
        <div class="listing-card__body">
          <p class="listing-card__brand">{brand}</p>
          <p class="listing-card__model">{model}</p>
          <p class="listing-card__type">{form.type.trim() || 'What it is'}</p>
          <p class={cx('listing-card__note', at.length > 0 && 'is-on')}>{at.length ? `On display in ${at.join(' & ')}` : 'Ask us — we can order it'}</p>
        </div>
      </div>
      {specs.length > 0 && (
        <dl class="listing-specs">
          {specs.map((s) => (
            <div key={s.key}>
              <dt>{s.label}</dt>
              <dd>{s.value}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}

/* ---------- The editor ---------- */

export function ListingEditor({ id: requested, onClose }: { id: string; onClose: () => void }) {
  const [newId] = useState(newListingId);
  const id = requested === 'new' ? newId : requested;
  const [form, setForm] = useState<Form>(() => startingForm(id, newId));
  const [start] = useState(() => asListing(form));
  const [problems, setProblems] = useState<string[]>([]);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const saved = useRef(false);
  const errorsRef = useRef<HTMLDivElement>(null);
  const product = productById(id);
  const web = webProducts.value.find((p) => p.id === id);
  const isNew = form.isNew;
  const name = `${form.brand ? brandName(form.brand) : ''} ${form.model.trim()}`.trim() || 'this listing';
  const linkBrand = form.brand ? brandName(form.brand) : 'the brand';
  const shownAt = isNew ? STORES.filter((s) => form.display[s] > 0) : STORES.filter((s) => (web?.display[s] ?? 0) > 0);

  // A new listing that's never saved leaves no photos behind
  useEffect(
    () => () => {
      if (requested === 'new' && !saved.current && !db.value.website.listings[newId]) undoPhotos(newId);
    },
    [],
  );

  const set = (patch: Partial<Form>) => setForm((f) => ({ ...f, ...patch }));
  const dirty = !sameListing({ ...asListing(form), by: '', at: '' }, { ...start, by: '', at: '' });
  const photosAdded = (db.value.website.photos[id] ?? []).length > 0;

  const save = () => {
    const found = listingProblems(asListing(form));
    if (!isNew && !form.url?.trim()) found.push('Add the page the “Full specs” link goes to — its /go/ link points there.');
    setProblems(found);
    if (found.length) {
      requestAnimationFrame(() => errorsRef.current?.focus());
      return;
    }
    if (!isNew && !dirty) {
      // Nothing to save (photos save as they're added)
      onClose();
      return;
    }
    if (isNew) saveListing(asListing(form));
    else {
      // The words go with the listing; the address with the other outbound links, which the nightly check tests
      const { url, ...content } = asListing(form);
      saveListing(content);
      const slug = product!.slug;
      const link = db.value.website.linkUrls[slug];
      const next = url!.trim();
      if (next !== (link?.url ?? product!.url)) {
        if (next === product!.url && !link?.publishedAt) undoLinkUrl(slug);
        else setLinkUrl(slug, next);
      }
    }
    saved.current = true;
    toast(`${name} saved — ${isNew && form.status === 'hidden' ? 'kept as a draft' : 'it goes live on the next publish (simulated)'}`, { tone: 'success' });
    onClose();
  };
  const leave = () => (dirty || (isNew && photosAdded && !db.value.website.listings[id]) ? setConfirmLeave(true) : onClose());

  const category = categories.find((c) => c.slug === form.category);
  const sortedBrands = [...brands].sort((a, b) => a.name.localeCompare(b.name));
  const forCategory = category ? sortedBrands.filter((b) => category.brands.includes(b.id)) : [];
  const others = category ? sortedBrands.filter((b) => !category.brands.includes(b.id)) : sortedBrands;

  return (
    <div class="listing-editor">
      <button type="button" class="link-btn listing-editor__back" onClick={leave}>
        <Icon name="arrow-left" size={16} /> All products
      </button>
      <header class="listing-editor__head">
        <div>
          <h2 class="listing-editor__title">{isNew ? (requested === 'new' ? 'New listing' : `Listing: ${name}`) : `Listing: ${name}`}</h2>
          <p class="muted small">
            {isNew
              ? 'A model you sell that isn’t on the website yet. Saved in this browser; it goes live on the next publish (simulated).'
              : 'What this model’s page and cards show. Saved in this browser; it goes live on the next publish (simulated).'}
          </p>
        </div>
        <div class="listing-editor__actions">
          <Button onClick={leave}>Cancel</Button>
          <Button variant="primary" icon="check" onClick={save}>
            Save listing
          </Button>
        </div>
      </header>

      {problems.length > 0 && (
        <div class="callout callout--red listing-problems" role="alert" tabIndex={-1} ref={errorsRef}>
          <Icon name="alert" size={18} />
          <div>
            <p class="callout__title">Before saving:</p>
            <ul>
              {problems.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      <div class="listing-editor__grid">
        <div class="listing-editor__main">
          <Card title="The model" level={3}>
            <div class="form-grid">
              {isNew ? (
                <Field label="Category" hint="The page it’s listed on">
                  <select class="select" value={form.category} onChange={(e) => set({ category: (e.target as HTMLSelectElement).value })}>
                    <option value="">Choose…</option>
                    {groups.map((g) => (
                      <optgroup key={g.id} label={g.name}>
                        {categories
                          .filter((c) => c.group === g.id)
                          .map((c) => (
                            <option key={c.slug} value={c.slug}>
                              {c.name}
                            </option>
                          ))}
                      </optgroup>
                    ))}
                  </select>
                </Field>
              ) : (
                <div class="field">
                  <span class="field__label">Category</span>
                  <span class="listing-fixed">{category?.name ?? form.category}</span>
                  <span class="field__hint">Its page address depends on it</span>
                </div>
              )}
              {isNew ? (
                <Field label="Brand" hint={category ? `Brands we carry for ${category.name.toLowerCase()} come first` : 'Brands we carry'}>
                  <select class="select" value={form.brand} onChange={(e) => set({ brand: (e.target as HTMLSelectElement).value })}>
                    <option value="">Choose…</option>
                    {forCategory.length > 0 && (
                      <optgroup label={`${category!.name}`}>
                        {forCategory.map((b) => (
                          <option key={b.id} value={b.id}>
                            {b.name}
                          </option>
                        ))}
                      </optgroup>
                    )}
                    <optgroup label={forCategory.length ? 'Other brands we carry' : 'Brands we carry'}>
                      {others.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name}
                        </option>
                      ))}
                    </optgroup>
                  </select>
                </Field>
              ) : (
                <div class="field">
                  <span class="field__label">Brand</span>
                  <span class="listing-fixed">{brandName(form.brand)}</span>
                </div>
              )}
              <Field label="Model name" hint="As the manufacturer writes it">
                <input class="input" value={form.model} maxLength={60} onInput={(e) => set({ model: (e.target as HTMLInputElement).value })} />
              </Field>
              <Field label="What it is" hint="A few words, e.g. “Linear gas fireplace”">
                <input class="input" value={form.type} maxLength={60} list="listing-types" onInput={(e) => set({ type: (e.target as HTMLInputElement).value })} />
              </Field>
              <datalist id="listing-types">
                {knownTypes.map((t) => (
                  <option key={t} value={t} />
                ))}
              </datalist>
              <Field label="Short description" optional class="span-2" hint={`In HMI’s own words: what it is and who it suits. ${240 - form.summary.length} characters left.`}>
                <textarea class="textarea" rows={3} maxLength={240} value={form.summary} onInput={(e) => set({ summary: (e.target as HTMLTextAreaElement).value })} />
              </Field>
            </div>
          </Card>

          <Card title="Link to the manufacturer or distributor" subtitle="The “Full specs” button on its page: the manufacturer’s page for the model, or a distributor’s." level={3}>
            <div class="form-grid">
              <Field
                label="Page address"
                optional={isNew}
                class="span-2"
                hint={
                  isNew
                    ? 'Once it’s published, customers reach it through a /go/ link that’s checked every night.'
                    : `Customers reach it through ${goPath(product!.slug)}, checked every night — if it ever breaks they’re sent to a safe fallback.`
                }
              >
                <input class="input" type="url" inputMode="url" spellcheck={false} placeholder="https://" value={form.url ?? ''} onInput={(e) => set({ url: (e.target as HTMLInputElement).value })} />
              </Field>
              <Field label="Link text" optional class="span-2" hint={`What the button says. Empty: “${defaultLinkText(linkBrand)}”.`}>
                <input class="input" maxLength={60} placeholder={defaultLinkText(linkBrand)} value={form.linkText ?? ''} onInput={(e) => set({ linkText: (e.target as HTMLInputElement).value || undefined })} />
              </Field>
            </div>
            <div class="listing-link">
              {/^https:\/\/[^\s/]+\.[^\s]+$/.test(form.url?.trim() ?? '') && (
                <a class="link-btn" href={form.url!.trim()} target="_blank" rel="noopener noreferrer">
                  <Icon name="external" size={14} /> Open the page<span class="sr-only"> (opens in a new tab)</span>
                </a>
              )}
              {!isNew && web?.link && (
                <span class="listing-link__health">
                  <LinkBadge result={web.link} /> <span class="muted small">last checked {ago(web.link.checkedAt)}</span>
                </span>
              )}
            </div>
          </Card>

          <Card title="Specs" subtitle="Shown in this order under “Key specs” on its page. Write facts from the manufacturer’s spec sheet." level={3}>
            <SpecsEditor specs={form.specs} onChange={(specs) => set({ specs })} />
          </Card>

          <Card title="On the showroom floor" level={3}>
            {isNew ? (
              <div class="listing-display">
                {STORES.map((s) => (
                  <Field key={s} label={STORE_NAMES[s]} hint="Units on display">
                    <input
                      class="input"
                      type="number"
                      min={0}
                      max={9}
                      inputMode="numeric"
                      value={form.display[s]}
                      onInput={(e) => set({ display: { ...form.display, [s]: Math.max(0, Math.min(9, Number((e.target as HTMLInputElement).value) || 0)) } })}
                    />
                  </Field>
                ))}
              </div>
            ) : (
              <p class="small">
                {shownAt.length ? `On display in ${shownAt.map((s) => STORE_NAMES[s]).join(' and ')}` : 'Not on display'} — from{' '}
                <a class="link-btn" href={`${import.meta.env.BASE_URL.replace(/\/$/, '')}/office/inventory/`}>
                  Inventory
                </a>
                , the same counts the public page shows.
              </p>
            )}
          </Card>

          <Card title="Photos" subtitle="Your own: the one on your showroom floor, or one you installed. They’re saved as you add them." level={3}>
            <PhotoManager id={id} name={name === 'this listing' ? 'This model' : name} shownAt={shownAt} />
          </Card>

          {isNew && (
            <Card title="On the website" level={3}>
              <Switch
                checked={form.status === 'current'}
                onChange={(on) => set({ status: on ? 'current' : 'hidden' })}
                label="Show this listing"
                description={form.status === 'current' ? `After the next publish it’s on the ${category ? category.name.toLowerCase() : 'category'} page with its own page.` : 'Kept as a draft: it stays here until you switch it on.'}
              />
            </Card>
          )}

          <div class="listing-editor__foot">
            <Button onClick={leave}>Cancel</Button>
            <Button variant="primary" icon="check" onClick={save}>
              Save listing
            </Button>
          </div>
        </div>

        <aside class="listing-editor__side" aria-label="Preview">
          <CardPreview form={form} />
        </aside>
      </div>

      {confirmLeave && (
        <Confirm
          title="Leave without saving?"
          confirmLabel="Leave without saving"
          danger
          onClose={() => setConfirmLeave(false)}
          onConfirm={() => {
            setConfirmLeave(false);
            onClose();
          }}
        >
          <p>{isNew ? 'This new listing and any photos you added to it will be discarded.' : 'Your changes to this listing will be lost. Photos you added stay — they save as you go.'}</p>
        </Confirm>
      )}
    </div>
  );
}
