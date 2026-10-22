/** New & discontinued: what the weekly sitemap watch found. Nothing changes on the public site until approved here. */
import { useState } from 'preact/hooks';
import { categories } from '../../../data/categories';
import type { SitemapSuggestion } from '../../../data/sitemapFeed';
import { plural } from '../../lib/format';
import { setParams } from '../../router';
import { toast } from '../../toast';
import { Button, Card, EmptyState, Field } from '../../ui/core';
import { Dialog } from '../../ui/Dialog';
import { Icon } from '../../ui/Icon';
import { DataTable, type Column } from '../../ui/Table';
import { addDraft, dismiss, editProduct, restoreDismissed } from './actions';
import { brandName, feed, openSuggestions } from './data';
import { when } from './helpers';
import { NoReport } from './HealthTab';
import { db } from '../../store';

function AddDialog({ s, onClose }: { s: SitemapSuggestion; onClose: () => void }) {
  const [model, setModel] = useState(s.name.replace(/[™®]/g, '').trim());
  const [category, setCategory] = useState('');
  return (
    <Dialog
      title={`Add a ${brandName(s.brand)} model`}
      description="It joins the product list as a draft listing. Fill in what it is, its specs and your photos, switch it on, and it goes live on the next publish (simulated)."
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            disabled={!model.trim()}
            onClick={() => {
              const id = addDraft({ brand: s.brand, model: model.trim(), url: s.url, category: category || undefined, suggestionId: s.id });
              toast(`${brandName(s.brand)} ${model.trim()} added as a draft listing`, { tone: 'success', action: { label: 'Fill it in', run: () => setParams({ tab: undefined, listing: id }) } });
              onClose();
            }}
          >
            Add to the list
          </Button>
        </>
      }
    >
      <div class="form-grid">
        <Field label="Model name" class="span-2" hint="Proposed from the manufacturer’s page title — tidy it up if needed.">
          <input class="input" value={model} onInput={(e) => setModel((e.target as HTMLInputElement).value)} />
        </Field>
        <Field label="Category" optional class="span-2">
          <select class="select" value={category} onChange={(e) => setCategory((e.target as HTMLSelectElement).value)}>
            <option value="">Decide later</option>
            {categories.map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <p class="muted small">
        Manufacturer page:{' '}
        <a href={s.url} target="_blank" rel="noopener noreferrer" class="link-btn">
          {s.url}
        </a>
      </p>
    </Dialog>
  );
}

const SHOW = 6;

function BrandGroup({ brand, items, firstRun, total, onAdd }: { brand: string; items: SitemapSuggestion[]; firstRun: boolean; total?: number; onAdd: (s: SitemapSuggestion) => void }) {
  const [all, setAll] = useState(false);
  const name = brandName(brand);
  const shown = all ? items : items.slice(0, SHOW);
  const count = Math.max(total ?? 0, items.length);
  const title = firstRun ? `${name} lists ${plural(count, 'product page')} that aren’t on your list` : `${name} added ${plural(items.length, 'product')} — add ${items.length === 1 ? 'it' : 'them'}?`;
  const subtitle = firstRun
    ? `First run — compared with the product list. ${count > items.length ? `The newest ${items.length} are shown; next week only genuinely new pages appear.` : 'Newest first.'}`
    : 'New since last week’s sitemap';
  return (
    <Card title={title} subtitle={subtitle} level={3} flush>
      <ul class="web-list" role="list">
        {shown.map((s) => (
          <li key={s.id} class="web-item">
            <div class="web-item__main">
              <p class="web-item__title">{s.name}</p>
              <p class="web-item__meta">
                <a href={s.url} target="_blank" rel="noopener noreferrer" class="link-btn">
                  {s.url.replace(/^https?:\/\/(www\.)?/, '')}
                  <span class="sr-only"> (opens in a new tab)</span>
                </a>
                {s.lastmod && <> · updated {when(s.lastmod)}</>}
              </p>
            </div>
            <div class="web-item__actions">
              <Button size="sm" icon="plus" onClick={() => onAdd(s)}>
                Add<span class="sr-only"> {s.name}</span>
              </Button>
              <Button size="sm" variant="ghost" onClick={() => (dismiss(s.id), toast(`Dismissed ${s.name}`))}>
                Dismiss<span class="sr-only"> {s.name}</span>
              </Button>
            </div>
          </li>
        ))}
      </ul>
      {items.length > SHOW && (
        <div class="web-more">
          <Button size="sm" variant="ghost" onClick={() => setAll(!all)} aria-expanded={all}>
            {all ? 'Show fewer' : `Show all ${items.length}`}
          </Button>
        </div>
      )}
    </Card>
  );
}

export function SuggestionsTab() {
  const [adding, setAdding] = useState<SitemapSuggestion | null>(null);
  const f = feed.value;
  if (f.state === 'loading') return <Card title="New & discontinued"><p class="muted">Loading the latest sitemap watch…</p></Card>;
  if (f.state === 'none') return <NoReport what="sitemap results" />;

  const data = f.data;
  const open = openSuggestions.value;
  const gone = open.filter((s) => s.type === 'discontinued');
  const fresh = open.filter((s) => s.type === 'new');
  const byBrand = new Map<string, SitemapSuggestion[]>();
  for (const s of fresh) byBrand.set(s.brand, [...(byBrand.get(s.brand) ?? []), s]);
  const dismissed = db.value.website.dismissed.filter((x) => !x.startsWith('url:')).length;

  const summaryCols: Column<(typeof data.brands)[number]>[] = [
    { key: 'brand', label: 'Brand', sortValue: (b) => b.name, render: (b) => <span class="cell-main">{b.name}</span> },
    { key: 'source', label: 'Read from', hide: 'sm', render: (b) => <span class="cell-sub">{b.source}</span> },
    { key: 'products', label: 'Product pages', align: 'right', sortValue: (b) => b.products, render: (b) => b.products },
    { key: 'onList', label: 'On your list', align: 'right', sortValue: (b) => b.onList, render: (b) => b.onList },
    { key: 'changes', label: data.mode === 'first-run' ? 'Not on your list' : 'New · gone', align: 'right', render: (b) => (data.mode === 'first-run' ? b.notOnList : `${b.added} · ${b.removed}`) },
    { key: 'note', label: 'Note', hide: 'md', render: (b) => <span class="cell-sub">{b.note ?? ''}</span> },
  ];

  return (
    <div class="stack">
      <div class="callout callout--blue">
        <Icon name="info" size={18} />
        <div>
          <p class="callout__title">Manufacturers’ sitemaps, read weekly</p>
          <p class="callout__text">
            No manufacturer offers a product feed, but their sitemaps list every product page. Last read {when(data.generatedAt)} ·{' '}
            {data.mode === 'first-run' ? 'first run, so it’s compared with your product list' : `compared with the snapshot from ${when(data.previousAt)}`}. Nothing on the public site changes until
            you approve it here.
          </p>
        </div>
      </div>

      <Card title="Discontinued?" subtitle={gone.length ? 'These models’ pages are no longer in their manufacturer’s sitemap.' : 'Every listed model is still in its manufacturer’s sitemap.'} flush>
        {gone.length === 0 ? (
          <EmptyState icon="check-circle" title="Nothing missing" />
        ) : (
          <ul class="web-list" role="list">
            {gone.map((s) => (
              <li key={s.id} class="web-item">
                <div class="web-item__main">
                  <p class="web-item__title">
                    {brandName(s.brand)} {s.name}
                  </p>
                  <p class="web-item__meta">
                    Gone from the sitemap:{' '}
                    <a href={s.url} target="_blank" rel="noopener noreferrer" class="link-btn">
                      {s.url.replace(/^https?:\/\/(www\.)?/, '')}
                    </a>
                  </p>
                </div>
                <div class="web-item__actions">
                  <Button
                    size="sm"
                    icon="archive"
                    onClick={() => {
                      if (s.productId) editProduct(s.productId, { status: 'discontinued' });
                      dismiss(s.id);
                      toast(`${s.name} marked discontinued — goes live on the next publish (simulated)`, { tone: 'success' });
                    }}
                  >
                    Mark discontinued<span class="sr-only"> {s.name}</span>
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => (dismiss(s.id), toast(`Kept ${s.name} as current`))}>
                    Dismiss<span class="sr-only"> {s.name}</span>
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <div class="web-groups">
        {byBrand.size === 0 ? (
          <Card title={data.mode === 'first-run' ? 'Not on your list' : 'New product pages'}>
            <EmptyState icon="check-circle" title="No new product pages" />
          </Card>
        ) : (
          [...byBrand].map(([brand, items]) => (
            <BrandGroup key={brand} brand={brand} items={items} firstRun={data.mode === 'first-run'} total={data.brands.find((b) => b.brand === brand)?.notOnList} onAdd={setAdding} />
          ))
        )}
      </div>
      {dismissed > 0 && (
        <p class="demo-footnote">
          {plural(dismissed, 'suggestion')} dismissed.{' '}
          <button type="button" class="link-btn" onClick={() => (restoreDismissed(), toast('Dismissed suggestions restored'))}>
            Show them again
          </button>
        </p>
      )}

      <Card title="Brands watched" subtitle={`${plural(data.brands.length, 'brand')} · how many product pages each sitemap lists`} flush>
        <DataTable rows={data.brands} columns={summaryCols} rowKey={(b) => b.brand} caption="Brand sitemaps" initialSort={{ key: 'brand', dir: 'asc' }} pageSize={40} dense />
      </Card>

      {adding && <AddDialog s={adding} onClose={() => setAdding(null)} />}
    </div>
  );
}
