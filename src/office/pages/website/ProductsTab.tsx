/** Products: the one list behind every model page and manufacturer link, with edits pending the next publish. */
import { useMemo, useState } from 'preact/hooks';
import { categories } from '../../../data/categories';
import { productById, products, type ProductStatus } from '../../../data/products';
import { plural } from '../../lib/format';
import { setParams } from '../../router';
import { toast } from '../../toast';
import { Button, Card, Chips, EmptyState, Field, Menu, SearchInput } from '../../ui/core';
import { Dialog } from '../../ui/Dialog';
import { Icon } from '../../ui/Icon';
import { DataTable, type Column } from '../../ui/Table';
import { editProduct, removeDraft, setLinkUrl, undoEdit, undoLinkUrl } from './actions';
import { goHref, report, siteHref, webProducts, type WebProduct } from './data';
import { ago, LinkBadge, PendingBadge, ProductBadge, shortUrl } from './helpers';

type Filter = 'all' | 'current' | 'discontinued' | 'hidden' | 'attention' | 'pending';

const categoryName = (slug: string) => categories.find((c) => c.slug === slug)?.name ?? slug;
const failing = (p: WebProduct) => !!p.link && ['dead', 'wrong-page', 'soft-404'].includes(p.link.status);

function EditDialog({ p, onClose }: { p: WebProduct; onClose: () => void }) {
  const [status, setStatus] = useState<ProductStatus>(p.status);
  const [replacement, setReplacement] = useState(p.edit?.replacement ?? p.product?.replacement?.id ?? '');
  const [url, setUrl] = useState(p.url);
  const candidates = products.filter((x) => x.id !== p.id && x.status === 'current' && x.category === p.category);
  const valid = /^https:\/\/[^\s]+\.[^\s]+/.test(url);
  const product = p.product!;

  const save = () => {
    const changedStatus = status !== product.status || (status === 'discontinued' && (replacement || undefined) !== product.replacement?.id);
    if (changedStatus) editProduct(p.id, { status, replacement: status === 'discontinued' && replacement ? replacement : undefined });
    else if (p.edit) undoEdit(p.id);
    if (url !== product.url) setLinkUrl(product.slug, url.trim());
    else if (p.urlEdit) undoLinkUrl(product.slug);
    toast(`${p.brandName} ${p.model} saved — goes live on the next publish (simulated)`, { tone: 'success' });
    onClose();
  };

  return (
    <Dialog
      title={`${p.brandName} ${p.model}`}
      description="Changes are saved in this browser and go live on the next publish (simulated)."
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" disabled={!valid} onClick={save}>
            Save change
          </Button>
        </>
      }
    >
      <div class="form-grid">
        <Field label="Status" class="span-2" hint={status === 'discontinued' ? 'The page stays up with a “no longer made” notice and service & parts help.' : status === 'hidden' ? 'Taken off the public site: no page, no /go/ link.' : 'Shown on the public site.'}>
          <select class="select" value={status} onChange={(e) => setStatus((e.target as HTMLSelectElement).value as ProductStatus)}>
            <option value="current">Current</option>
            <option value="discontinued">Discontinued</option>
            <option value="hidden">Hidden</option>
          </select>
        </Field>
        {status === 'discontinued' && (
          <Field label="Replacement" optional class="span-2" hint="Only if the manufacturer names one.">
            <select class="select" value={replacement} onChange={(e) => setReplacement((e.target as HTMLSelectElement).value)}>
              <option value="">None named</option>
              {candidates.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.model}
                </option>
              ))}
            </select>
          </Field>
        )}
        <Field label="Manufacturer page" class="span-2" hint="The checker tests it every night; customers reach it through /go/.">
          <input class="input" type="url" value={url} onInput={(e) => setUrl((e.target as HTMLInputElement).value)} spellcheck={false} />
        </Field>
      </div>
      {!valid && <p class="field__error">Enter a full https:// address.</p>}
    </Dialog>
  );
}

export function ProductsTab({ onTag }: { onTag: (id: string) => void }) {
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [editing, setEditing] = useState<WebProduct | null>(null);
  const list = webProducts.value;
  const checked = report.value.state === 'ready' ? report.value.data.generatedAt : null;

  const counts = useMemo(
    () => ({
      all: list.length,
      current: list.filter((p) => p.status === 'current').length,
      discontinued: list.filter((p) => p.status === 'discontinued').length,
      hidden: list.filter((p) => p.status === 'hidden').length,
      attention: list.filter(failing).length,
      pending: list.filter((p) => p.pending).length,
    }),
    [list],
  );

  const rows = list.filter((p) => {
    const term = q.trim().toLowerCase();
    if (term && !`${p.brandName} ${p.model} ${p.type} ${p.id}`.toLowerCase().includes(term)) return false;
    if (filter === 'attention') return failing(p);
    if (filter === 'pending') return p.pending;
    if (filter !== 'all') return p.status === filter;
    return true;
  });

  const columns: Column<WebProduct>[] = [
    {
      key: 'model',
      label: 'Model',
      sortValue: (p) => `${p.brandName} ${p.model}`,
      render: (p) => (
        <span>
          <span class="cell-sub">{p.brandName}</span>
          <span class="cell-main">{p.model}</span>
          <span class="cell-sub">{p.draft ? 'New model (draft)' : `${p.type} · ${categoryName(p.category)}`}</span>
        </span>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      sortValue: (p) => p.status,
      render: (p) => (
        <span class="web-status">
          <ProductBadge status={p.status} />
          {p.status === 'discontinued' && <span class="cell-sub">{p.replacement ? `Replacement: ${p.replacement.name}` : 'No replacement named'}</span>}
          {p.pending && <PendingBadge />}
        </span>
      ),
    },
    {
      key: 'pages',
      label: 'Pages',
      hide: 'sm',
      render: (p) => (
        <span class="web-pages">
          {p.page ? (
            <a href={siteHref(p.page)} target="_blank" rel="noopener" class="link-btn">
              HMI page<span class="sr-only"> for {p.model} (opens in a new tab)</span>
            </a>
          ) : (
            <span class="cell-sub">No public page</span>
          )}
          <a href={p.url} target="_blank" rel="noopener noreferrer" class="web-url" title={p.url}>
            <Icon name="external" size={13} />
            <span class="web-url__text">{shortUrl(p.url)}</span>
            <span class="sr-only"> (manufacturer page for {p.model}, opens in a new tab)</span>
          </a>
        </span>
      ),
    },
    {
      key: 'health',
      label: 'Link health',
      sortValue: (p) => p.link?.status ?? 'zz',
      render: (p) => (
        <span class="web-health">
          {p.draft ? <span class="cell-sub">Checked after publish</span> : p.status === 'hidden' ? <span class="cell-sub">Not checked (hidden)</span> : <LinkBadge result={p.link} />}
          {p.link && <span class="cell-sub">checked {ago(p.link.checkedAt)}</span>}
        </span>
      ),
    },
    {
      key: 'display',
      label: 'On display at',
      hide: 'md',
      sortValue: (p) => p.display['osage-beach'] + p.display.nixa,
      render: (p) => {
        const at = [p.display['osage-beach'] ? `Osage Beach${p.display['osage-beach'] > 1 ? ` (${p.display['osage-beach']})` : ''}` : '', p.display.nixa ? `Nixa${p.display.nixa > 1 ? ` (${p.display.nixa})` : ''}` : ''].filter(Boolean);
        return at.length ? at.join(' · ') : <span class="cell-sub">Not on display</span>;
      },
    },
    {
      key: 'actions',
      label: <span class="sr-only">Actions</span>,
      align: 'right',
      render: (p) =>
        p.draft ? (
          <Menu
            label={`Actions for ${p.model}`}
            size="sm"
            items={[{ label: 'Remove draft', icon: 'trash', danger: true, onSelect: () => (removeDraft(p.id), toast(`Draft ${p.model} removed`)) }]}
          />
        ) : (
          <Menu
            label={`Actions for ${p.model}`}
            size="sm"
            items={[
              { label: 'Edit status or link…', icon: 'edit', onSelect: () => setEditing(p) },
              ...(p.page ? [{ label: 'Print showroom tag', icon: 'printer' as const, onSelect: () => onTag(p.id) }] : []),
              ...(p.slug ? [{ label: 'Open the /go/ link', icon: 'link' as const, onSelect: () => window.open(goHref(p.slug!), '_blank', 'noopener') }] : []),
              ...(p.pending
                ? [
                    'divider' as const,
                    {
                      label: 'Undo pending change',
                      icon: 'undo' as const,
                      onSelect: () => {
                        undoEdit(p.id);
                        if (p.product) undoLinkUrl(p.product.slug);
                        toast('Pending change undone');
                      },
                    },
                  ]
                : []),
            ]}
          />
        ),
    },
  ];

  return (
    <div class="stack">
      <Card
        title="Products"
        subtitle={`${plural(products.length, 'model')} on the list${checked ? ` · links checked ${ago(checked)}` : ''} — the same list drives the model pages, /go/ links, the nightly checker, the sitemap watcher and HMI mode’s catalog.`}
        flush
      >
        <div class="toolbar web-toolbar">
          <SearchInput value={q} onInput={setQ} label="Search products" placeholder="Search brand or model" />
          <Chips<Filter>
            label="Show"
            value={filter}
            onChange={setFilter}
            items={[
              { key: 'all', label: 'All', count: counts.all },
              { key: 'current', label: 'Current', count: counts.current },
              { key: 'discontinued', label: 'Discontinued', count: counts.discontinued },
              { key: 'hidden', label: 'Hidden', count: counts.hidden },
              { key: 'attention', label: 'Link failing', count: counts.attention },
              { key: 'pending', label: 'Pending', count: counts.pending },
            ]}
          />
        </div>
        <DataTable
          rows={rows}
          columns={columns}
          rowKey={(p) => p.id}
          caption="Product list"
          initialSort={{ key: 'model', dir: 'asc' }}
          pageSize={50}
          onRowClick={(p) => !p.draft && setEditing(p)}
          empty={<EmptyState icon="search" title="No products match" action={<Button onClick={() => (setQ(''), setFilter('all'))}>Clear filters</Button>} />}
        />
      </Card>
      <p class="demo-footnote">
        Displays come from Inventory (the same counts the public “On display at” shows).{' '}
        <button type="button" class="link-btn" onClick={() => setParams({ tab: 'health' })}>
          See link health
        </button>
      </p>
      {editing && <EditDialog p={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

export const productLabel = (id: string) => {
  const p = productById(id);
  return p ? p.model : id;
};
