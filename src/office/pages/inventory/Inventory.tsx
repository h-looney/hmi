/** Inventory: stock at both showrooms, purchase orders, and every stock movement. */
import { useState } from 'preact/hooks';
import { createPO, receivePO, updatePO, orderPO } from '../../actions';
import { useAssets } from '../../assets';
import { fuelLabel } from '../../data/catalog';
import type { Item, PurchaseOrder, StockMove, StoreFilter, StoreId } from '../../data/types';
import { today } from '../../lib/dates';
import { dayLabel, money, number, percent, plural, shortDate, time } from '../../lib/format';
import { route, setParams } from '../../router';
import { available, customerOf, firstName, itemLabel, itemOf, lowStock, matchStore, stockStatus, stockValue, storeName, STORES } from '../../selectors';
import { db, ui } from '../../store';
import { toast } from '../../toast';
import { Button, Card, Chips, cx, Details, EmptyState, Link, Meter, PageHeader, SearchInput, Stat, TabPanel, Tabs } from '../../ui/core';
import { Dialog } from '../../ui/Dialog';
import { Icon } from '../../ui/Icon';
import { stockMeta, StatusBadge } from '../../ui/status';
import { DataTable, type Column } from '../../ui/Table';
import { AdjustDialog, PODialog, TransferDialog } from './dialogs';
import { downloadCsv, isOpenPO, moveMeta, onOrder, poOrderedQty, poOutstanding, poReceivedQty, poStatusMeta, poTotal, qtyLabel, reorderSuggestions } from './helpers';

type Tab = 'stock' | 'orders' | 'activity';
type Kind = 'all' | 'units' | 'parts' | 'accessories';
type Sub =
  | { kind: 'transfer'; itemId?: string; from?: StoreId }
  | { kind: 'adjust'; itemId: string; store?: StoreId }
  | { kind: 'po'; poId?: string; preset?: { vendorId?: string; store?: StoreId; itemIds?: string[] } };

const kindOf: Record<Exclude<Kind, 'all'>, Item['kind']> = { units: 'unit', parts: 'part', accessories: 'accessory' };
const orderAsNeeded = { label: 'Order as needed', tone: 'neutral' as const, icon: 'truck' as const };
const discontinued = { label: 'Discontinued', tone: 'neutral' as const, icon: 'archive' as const };

/** Stock badge; items with no reorder point and nothing free read "Order as needed" rather than "In stock". */
function statusMeta(it: Item, store: StoreFilter) {
  // Models the manufacturer no longer makes (src/data/products.ts) can't be reordered
  if (it.productStatus === 'discontinued' && (store === 'all' ? STORES : [store]).every((st) => available(it, st) <= 0)) return discontinued;
  const s = stockStatus(it, store);
  if (s === 'ok' && it.reorderPoint === 0 && (store === 'all' ? STORES : [store]).every((st) => available(it, st) <= 0)) return orderAsNeeded;
  return stockMeta[s];
}
const statusRank = (it: Item, store: StoreFilter) => {
  const meta = statusMeta(it, store);
  return meta === stockMeta.out ? 0 : meta === stockMeta.low ? 1 : meta === stockMeta.ok ? 2 : 3;
};
const closedJob = new Set(['closed', 'completed', 'cancelled']);

function Thumb({ item, size = 40 }: { item: Item; size?: number }) {
  const { photos } = useAssets();
  const src = item.photo ? photos[item.photo] : undefined;
  const style = size === 40 ? undefined : { width: `${size}px`, height: `${size}px` };
  return src ? (
    <img class="thumb" src={src} alt="" width={size} height={size} loading="lazy" style={style} />
  ) : (
    <span class="thumb" aria-hidden="true" style={style}>
      <Icon name={item.kind === 'part' ? 'wrench' : 'box'} size={Math.round(size * 0.45)} />
    </span>
  );
}

function StockCell({ item, store }: { item: Item; store: StoreId }) {
  const s = item.stock[store];
  const extra = [s.reserved ? `${s.reserved} reserved` : '', s.display ? `${s.display} on display` : ''].filter(Boolean).join(' · ');
  return (
    <span class="inv-stock">
      <span>
        <strong class="tabular">{qtyLabel(item, s.onHand)}</strong> on hand
      </span>
      {extra && <span class="cell-sub">{extra}</span>}
    </span>
  );
}

function RefLink({ refId, onOpenPO }: { refId?: string; onOpenPO: (id: string) => void }) {
  if (!refId) return <span class="muted">—</span>;
  if (refId.startsWith('J-')) return <Link to={`/office/jobs/?id=${refId}`}>{refId}</Link>;
  if (refId.startsWith('INV-')) return <Link to={`/office/accounting/?tab=invoices&id=${refId}`}>{refId}</Link>;
  if (refId.startsWith('PO-'))
    return (
      <button type="button" class="link-btn" onClick={() => onOpenPO(refId)}>
        {refId}
      </button>
    );
  return <span>{refId}</span>;
}

function Delta({ qty, item }: { qty: number; item?: Item }) {
  const label = item ? qtyLabel(item, Math.abs(qty)) : String(Math.abs(qty));
  return <span class={cx('inv-delta tabular', qty > 0 ? 'is-good' : 'is-bad')}>{qty > 0 ? `+${label}` : `−${label}`}</span>;
}

/* ---------- Stock tab ---------- */

function StockTab({ onOpen }: { onOpen: (id: string) => void }) {
  const d = db.value;
  const store = ui.value.store;
  const params = route.value.params;
  const filterParam = params.get('filter') ?? '';
  const kindParam = (params.get('kind') ?? (['units', 'parts', 'accessories'].includes(filterParam) ? filterParam : 'all')) as Kind;
  const stockFilter = filterParam === 'low' || filterParam === 'out' ? filterParam : '';
  const [q, setQ] = useState('');
  const [category, setCategory] = useState('');

  const stores = store === 'all' ? STORES : [store];
  const categories = [...new Set(d.items.map((i) => i.category))];
  const term = q.trim().toLowerCase();
  const rows = d.items.filter((it) => {
    if (kindParam !== 'all' && it.kind !== kindOf[kindParam]) return false;
    if (category && it.category !== category) return false;
    if (stockFilter) {
      const s = stockStatus(it, store);
      if (stockFilter === 'out' ? s !== 'out' : s !== 'low' && s !== 'out') return false;
    }
    return !term || it.name.toLowerCase().includes(term) || it.brand.toLowerCase().includes(term) || it.id.toLowerCase().includes(term);
  });

  const setKind = (k: Kind) => setParams({ kind: k === 'all' ? undefined : k, filter: stockFilter || undefined }, { replace: true });
  const toggleLow = () => setParams({ filter: stockFilter ? undefined : 'low', kind: kindParam === 'all' ? undefined : kindParam }, { replace: true });
  const clear = () => {
    setQ('');
    setCategory('');
    setParams({ filter: undefined, kind: undefined }, { replace: true });
  };

  const columns: Column<Item>[] = [
    {
      key: 'product',
      label: 'Product',
      sortValue: (it) => itemLabel(it).toLowerCase(),
      render: (it) => (
        <div class="item-cell">
          <Thumb item={it} />
          <span class="inv-product">
            <button type="button" class="inv-link" onClick={() => onOpen(it.id)}>
              {itemLabel(it)}
            </button>
            <span class="cell-sub">
              {it.id} · {it.category}
            </span>
          </span>
        </div>
      ),
    },
    ...stores.map(
      (s): Column<Item> => ({
        key: s,
        label: storeName(s),
        sortValue: (it) => it.stock[s].onHand,
        render: (it) => <StockCell item={it} store={s} />,
      }),
    ),
    {
      key: 'available',
      label: 'Available',
      align: 'right',
      sortValue: (it) => stores.reduce((n, s) => n + available(it, s), 0),
      render: (it) => <span class="tabular">{qtyLabel(it, stores.reduce((n, s) => n + available(it, s), 0))}</span>,
    },
    { key: 'reorder', label: 'Reorder point', align: 'right', hide: 'sm', sortValue: (it) => it.reorderPoint, render: (it) => <span class="tabular">{qtyLabel(it, it.reorderPoint)}</span> },
    { key: 'status', label: 'Status', sortValue: (it) => statusRank(it, store), render: (it) => <StatusBadge meta={statusMeta(it, store)} /> },
    { key: 'price', label: 'Price', align: 'right', hide: 'sm', sortValue: (it) => it.price, render: (it) => <span class="tabular">{money(it.price)}</span> },
  ];

  const filtered = !!(term || category || stockFilter || kindParam !== 'all');

  return (
    <>
      <div class="toolbar">
        <SearchInput value={q} onInput={setQ} label="Search inventory" placeholder="Search name, brand or SKU" />
        <label class="inv-select">
          <span class="sr-only">Category</span>
          <select class="select" value={category} onChange={(e) => setCategory((e.target as HTMLSelectElement).value)}>
            <option value="">All categories</option>
            {categories.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
        <Chips<Kind>
          label="Item type"
          value={kindParam}
          onChange={setKind}
          items={[
            { key: 'all', label: 'All' },
            { key: 'units', label: 'Appliances' },
            { key: 'parts', label: 'Parts' },
            { key: 'accessories', label: 'Accessories' },
          ]}
        />
        <button type="button" class="chip" aria-pressed={!!stockFilter} onClick={toggleLow}>
          <Icon name="alert" size={14} /> {stockFilter === 'out' ? 'Out of stock' : 'Low stock'}
        </button>
        <span class="toolbar__spacer" />
        <span class="muted small" aria-live="polite">
          {plural(rows.length, 'item')}
        </span>
      </div>
      <Card flush>
        <DataTable
          rows={rows}
          columns={columns}
          rowKey={(it) => it.id}
          caption="Inventory items"
          onRowClick={(it) => onOpen(it.id)}
          pageSize={30}
          rowClass={(it) => (stockStatus(it, store) === 'out' ? 'inv-row--out' : undefined)}
          empty={
            <EmptyState icon="box" title="No items match" action={filtered ? <Button onClick={clear}>Clear filters</Button> : undefined}>
              Try a different search or filter.
            </EmptyState>
          }
        />
      </Card>
    </>
  );
}

/* ---------- Item drawer ---------- */

function ItemDrawer({ item, onClose, onAction, onOpenPO }: { item: Item; onClose: () => void; onAction: (s: Sub) => void; onOpenPO: (id: string) => void }) {
  const d = db.value;
  const filter = ui.value.store;
  const vendor = d.vendors.find((v) => v.id === item.vendorId);
  const margin = item.price ? (item.price - item.cost) / item.price : 0;
  const reservedFor = d.jobs
    .filter((j) => !closedJob.has(j.status))
    .flatMap((j) => j.parts.filter((p) => p.itemId === item.id && p.status === 'reserved').map((p) => ({ job: j, part: p })))
    .sort((a, b) => ((a.job.start ?? '9') < (b.job.start ?? '9') ? -1 : 1));
  const openPOs = d.pos.filter((p) => isOpenPO(p) && p.lines.some((l) => l.itemId === item.id && l.received < l.qty));
  const moves = d.moves.filter((m) => m.itemId === item.id).slice(0, 12);

  return (
    <Dialog drawer size="lg" title={itemLabel(item)} description={`${item.id} · ${item.category}`} onClose={onClose} headerExtra={<StatusBadge meta={statusMeta(item, filter)} />}>
      <div class="inv-head">
        <Thumb item={item} size={72} />
        <Details
          columns={2}
          items={[
            ['Brand', item.brand],
            ['Fuel', item.fuel ? fuelLabel(item.fuel) : undefined],
            ['Vendor', vendor ? `${vendor.name} · ${vendor.terms}` : '—'],
            ['Sold by', item.uom === 'ea' ? 'Each' : item.uom === 'ft' ? 'The foot' : item.uom === 'bag' ? 'The bag' : 'The box'],
          ]}
        />
      </div>

      <div class="inv-money">
        <div>
          <span class="inv-money__label">Price</span>
          <span class="inv-money__value">{money(item.price)}</span>
        </div>
        <div>
          <span class="inv-money__label">Cost</span>
          <span class="inv-money__value">{money(item.cost)}</span>
        </div>
        <div>
          <span class="inv-money__label">Margin</span>
          <span class="inv-money__value">{percent(margin)}</span>
        </div>
      </div>

      <h3 class="section-label">Stock by showroom</h3>
      <div class="inv-stores">
        {STORES.map((s) => {
          const level = item.stock[s];
          const a = available(item, s);
          const incoming = onOrder(d, item.id, s);
          return (
            <section key={s} class={cx('inv-store', filter === s && 'is-current')} aria-label={storeName(s)}>
              <header class="inv-store__head">
                <h4 class="inv-store__name">{storeName(s)}</h4>
                <StatusBadge meta={statusMeta(item, s)} />
              </header>
              <p class="inv-store__avail">
                <strong>{qtyLabel(item, Math.max(0, a))}</strong> available to sell
              </p>
              <dl class="inv-store__dl">
                <div>
                  <dt>On hand</dt>
                  <dd>{qtyLabel(item, level.onHand)}</dd>
                </div>
                <div>
                  <dt>Reserved for jobs</dt>
                  <dd>{qtyLabel(item, level.reserved)}</dd>
                </div>
                <div>
                  <dt>On display</dt>
                  <dd>{qtyLabel(item, level.display)}</dd>
                </div>
                <div>
                  <dt>Reorder at / qty</dt>
                  <dd>
                    {item.specialOrder ? 'Special order' : `${qtyLabel(item, item.reorderPoint)} / ${qtyLabel(item, item.reorderQty)}`}
                  </dd>
                </div>
                {incoming > 0 && (
                  <div>
                    <dt>On order</dt>
                    <dd>{qtyLabel(item, incoming)}</dd>
                  </div>
                )}
              </dl>
              <div class="inv-store__actions">
                <Button size="sm" icon="edit" onClick={() => onAction({ kind: 'adjust', itemId: item.id, store: s })} aria-label={`Adjust stock at ${storeName(s)}`}>
                  Adjust
                </Button>
                <Button size="sm" icon="transfer" disabled={a <= 0} onClick={() => onAction({ kind: 'transfer', itemId: item.id, from: s })} aria-label={`Transfer from ${storeName(s)}`}>
                  Transfer
                </Button>
                <Button size="sm" icon="plus" onClick={() => onAction({ kind: 'po', preset: { vendorId: item.vendorId, store: s, itemIds: [item.id] } })} aria-label={`Reorder for ${storeName(s)}`}>
                  Reorder
                </Button>
              </div>
            </section>
          );
        })}
      </div>

      {item.warranty && (
        <>
          <h3 class="section-label">Manufacturer warranty</h3>
          <p class="inv-warranty">
            <Icon name="shield" size={16} />
            {item.warranty.fireboxLifetime ? 'Limited lifetime firebox · ' : ''}
            {item.warranty.partsYears} yr parts · {item.warranty.laborYears} yr HMI labor <span class="muted">(sample terms)</span>
          </p>
        </>
      )}

      <h3 class="section-label">Reserved for jobs</h3>
      {reservedFor.length === 0 ? (
        <p class="muted">Nothing reserved right now.</p>
      ) : (
        <ul class="inv-list" role="list">
          {reservedFor.map(({ job, part }) => (
            <li key={`${job.id}-${part.store}`}>
              <Link to={`/office/jobs/?id=${job.id}`} class="inv-list__row">
                <span class="inv-list__main">
                  <span class="inv-list__title">
                    {job.id} · {job.title}
                  </span>
                  <span class="cell-sub">
                    {customerOf(d, job.customerId)?.name ?? 'Customer'} · {job.start ? dayLabel(job.start) : 'Not scheduled yet'}
                  </span>
                </span>
                <span class="inv-list__meta">
                  {qtyLabel(item, part.qty)} · {storeName(part.store)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <h3 class="section-label">On order</h3>
      {openPOs.length === 0 ? (
        <p class="muted">Not on any open purchase order.</p>
      ) : (
        <ul class="inv-list" role="list">
          {openPOs.map((p) => {
            const line = p.lines.find((l) => l.itemId === item.id)!;
            return (
              <li key={p.id}>
                <button type="button" class="inv-list__row" onClick={() => onOpenPO(p.id)}>
                  <span class="inv-list__main">
                    <span class="inv-list__title">
                      {p.id} · {d.vendors.find((v) => v.id === p.vendorId)?.name}
                    </span>
                    <span class="cell-sub">
                      {poStatusMeta[p.status].label}
                      {p.expectedOn ? ` · expected ${shortDate(p.expectedOn)}` : ''}
                    </span>
                  </span>
                  <span class="inv-list__meta">
                    {qtyLabel(item, line.qty - line.received)} · {storeName(p.store)}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <h3 class="section-label">Recent movements</h3>
      {moves.length === 0 ? (
        <p class="muted">No stock movements in the last five weeks.</p>
      ) : (
        <div class="table-wrap">
          <table class="table table--dense inv-moves">
            <caption class="sr-only">Recent stock movements for {itemLabel(item)}</caption>
            <thead>
              <tr>
                <th scope="col">When</th>
                <th scope="col">Showroom</th>
                <th scope="col" class="is-right">
                  Change
                </th>
                <th scope="col">Type</th>
                <th scope="col" class="hide-sm">
                  Reference
                </th>
              </tr>
            </thead>
            <tbody>
              {moves.map((m) => (
                <tr key={m.id}>
                  <td class="nowrap">
                    {shortDate(m.at)}
                    <span class="cell-sub">
                      {time(m.at)} · {firstName(d, m.by)}
                    </span>
                  </td>
                  <td>{storeName(m.store)}</td>
                  <td class="is-right">
                    <Delta qty={m.qty} item={item} />
                  </td>
                  <td>
                    <StatusBadge meta={moveMeta[m.kind]} />
                    {m.note && <span class="cell-sub">{m.note}</span>}
                  </td>
                  <td class="hide-sm">
                    <RefLink refId={m.ref} onOpenPO={onOpenPO} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Dialog>
  );
}

/* ---------- Orders tab ---------- */

type POFilter = 'open' | 'received' | 'cancelled' | 'all';

function OrdersTab({ onOpenPO, onOpenItem }: { onOpenPO: (id: string) => void; onOpenItem: (id: string) => void }) {
  const d = db.value;
  const store = ui.value.store;
  const [filter, setFilter] = useState<POFilter>('open');
  const t = today();
  const pos = d.pos.filter((p) => matchStore(store, p.store));
  const counts: Record<POFilter, number> = {
    open: pos.filter(isOpenPO).length,
    received: pos.filter((p) => p.status === 'received').length,
    cancelled: pos.filter((p) => p.status === 'cancelled').length,
    all: pos.length,
  };
  const rows = pos.filter((p) => filter === 'all' || (filter === 'open' ? isOpenPO(p) : p.status === filter));
  const suggestions = reorderSuggestions(d, store);
  const vendorName = (id: string) => d.vendors.find((v) => v.id === id)?.name ?? id;

  const columns: Column<PurchaseOrder>[] = [
    {
      key: 'po',
      label: 'Order',
      sortValue: (p) => p.id,
      render: (p) => (
        <>
          <button type="button" class="inv-link" onClick={() => onOpenPO(p.id)}>
            {p.id}
          </button>
          <span class="cell-sub">{vendorName(p.vendorId)}</span>
        </>
      ),
    },
    { key: 'store', label: 'Deliver to', hide: 'sm', sortValue: (p) => p.store, render: (p) => storeName(p.store) },
    { key: 'status', label: 'Status', sortValue: (p) => p.status, render: (p) => <StatusBadge meta={poStatusMeta[p.status]} /> },
    { key: 'created', label: 'Created', hide: 'md', sortValue: (p) => p.createdAt, render: (p) => <span class="nowrap">{shortDate(p.createdAt)}</span> },
    {
      key: 'expected',
      label: 'Expected',
      sortValue: (p) => p.expectedOn ?? '',
      render: (p) => {
        if (p.status === 'received') return <span class="muted nowrap">Received {p.receivedOn ? shortDate(p.receivedOn) : ''}</span>;
        if (!p.expectedOn || p.status === 'cancelled' || p.status === 'draft') return <span class="muted">—</span>;
        const late = p.expectedOn < t;
        return (
          <span class={cx('nowrap inv-inline', late && 'is-bad')}>
            {late && <Icon name="alert" size={13} />}
            {shortDate(p.expectedOn)}
            {late ? ' · late' : ''}
          </span>
        );
      },
    },
    { key: 'lines', label: 'Lines', align: 'right', hide: 'sm', sortValue: (p) => p.lines.length, render: (p) => <span class="tabular">{p.lines.length}</span> },
    { key: 'total', label: 'Total', align: 'right', sortValue: poTotal, render: (p) => <span class="tabular">{money(poTotal(p))}</span> },
    {
      key: 'received',
      label: 'Received',
      hide: 'sm',
      sortValue: (p) => poReceivedQty(p) / Math.max(1, poOrderedQty(p)),
      render: (p) => (
        <span class="inv-progress">
          <Meter value={poReceivedQty(p)} max={poOrderedQty(p)} tone={p.status === 'received' ? 'green' : 'blue'} label={`${poReceivedQty(p)} of ${poOrderedQty(p)} received`} />
          <span class="cell-sub tabular">
            {poReceivedQty(p)} of {poOrderedQty(p)}
          </span>
        </span>
      ),
    },
  ];

  return (
    <div class="stack">
      {suggestions.length > 0 && (
        <Card title="Suggested reorders" subtitle="Items below their reorder point that aren’t on an order yet. Each group becomes one draft order.">
          <ul class="inv-suggest" role="list">
            {suggestions.map((g) => (
              <li key={`${g.vendorId}-${g.store}`} class="inv-suggest__group">
                <div class="inv-suggest__head">
                  <div>
                    <p class="inv-suggest__vendor">{vendorName(g.vendorId)}</p>
                    <p class="muted small">
                      For {storeName(g.store)} · {plural(g.lines.length, 'item')}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    icon="file"
                    onClick={() => {
                      const id = createPO({ vendorId: g.vendorId, store: g.store, lines: g.lines.map((l) => ({ itemId: l.itemId, qty: l.qty })), notes: 'Suggested from low-stock alerts.' });
                      toast(`Draft ${id} created for ${vendorName(g.vendorId)}`, { tone: 'success' });
                      onOpenPO(id);
                    }}
                  >
                    Create draft order
                  </Button>
                </div>
                <ul class="inv-suggest__items" role="list">
                  {g.lines.map((l) => {
                    const it = itemOf(d, l.itemId)!;
                    return (
                      <li key={l.itemId}>
                        <button type="button" class="link-btn inv-suggest__item" onClick={() => onOpenItem(it.id)}>
                          {itemLabel(it)}
                        </button>
                        <span class="muted small">
                          {qtyLabel(it, Math.max(0, l.available))} free · reorder at {qtyLabel(it, it.reorderPoint)} · order {qtyLabel(it, l.qty)}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <div class="toolbar">
        <Chips<POFilter>
          label="Order status"
          value={filter}
          onChange={setFilter}
          items={[
            { key: 'open', label: 'Open', count: counts.open },
            { key: 'received', label: 'Received', count: counts.received },
            { key: 'cancelled', label: 'Cancelled', count: counts.cancelled },
            { key: 'all', label: 'All', count: counts.all },
          ]}
        />
      </div>
      <Card flush>
        <DataTable
          rows={rows}
          columns={columns}
          rowKey={(p) => p.id}
          caption="Purchase orders"
          onRowClick={(p) => onOpenPO(p.id)}
          initialSort={{ key: 'created', dir: 'desc' }}
          empty={<EmptyState icon="file" title={filter === 'open' ? 'No open purchase orders' : 'No purchase orders here'} />}
        />
      </Card>
    </div>
  );
}

/* ---------- Purchase order drawer ---------- */

const toInt = (v: string | undefined) => (v === undefined || v.trim() === '' ? 0 : Math.max(0, Math.floor(Number(v)) || 0));

function PODrawer({ po, onClose, onEdit, onOpenItem }: { po: PurchaseOrder; onClose: () => void; onEdit: () => void; onOpenItem: (id: string) => void }) {
  const d = db.value;
  const vendor = d.vendors.find((v) => v.id === po.vendorId);
  const [receiving, setReceiving] = useState(false);
  const remaining = (p: PurchaseOrder) => Object.fromEntries(p.lines.map((l) => [l.itemId, String(Math.max(0, l.qty - l.received))]));
  const [qtys, setQtys] = useState<Record<string, string>>(() => remaining(po));
  const [confirmCancel, setConfirmCancel] = useState(false);
  const bills = d.bills.filter((b) => b.poId === po.id);
  const outstanding = poOutstanding(po);
  const late = !!po.expectedOn && po.expectedOn < today() && (po.status === 'ordered' || po.status === 'partial');
  const selectedQty = po.lines.reduce((s, l) => s + Math.min(Math.max(0, l.qty - l.received), toInt(qtys[l.itemId])), 0);

  const receive = (all: boolean) => {
    const before = poReceivedQty(po);
    receivePO(po.id, all ? undefined : Object.fromEntries(po.lines.map((l) => [l.itemId, toInt(qtys[l.itemId])])));
    const after = db.value.pos.find((p) => p.id === po.id)!;
    const n = poReceivedQty(after) - before;
    const bill = db.value.bills.find((b) => b.poId === po.id);
    toast(`Received ${plural(n, 'item')} into ${storeName(po.store)} stock${bill ? ` — bill ${bill.id} is waiting in Accounting` : ''}`, { tone: 'success' });
    setQtys(remaining(after));
    setReceiving(false);
  };

  const footer =
    po.status === 'draft' ? (
      <>
        <Button variant="ghost" icon="x-circle" onClick={() => setConfirmCancel(true)}>
          Cancel order
        </Button>
        <span class="spacer" />
        <Button icon="edit" onClick={onEdit}>
          Edit
        </Button>
        <Button
          variant="primary"
          icon="send"
          onClick={() => {
            orderPO(po.id);
            toast(`${po.id} placed with ${vendor?.name ?? 'the vendor'}`, { tone: 'success' });
          }}
        >
          Place order
        </Button>
      </>
    ) : (po.status === 'ordered' || po.status === 'partial') && !receiving ? (
      <>
        <Button variant="ghost" icon="x-circle" onClick={() => setConfirmCancel(true)}>
          Cancel order
        </Button>
        <span class="spacer" />
        <Button variant="primary" icon="download" onClick={() => setReceiving(true)}>
          Receive items
        </Button>
      </>
    ) : receiving ? (
      <>
        <Button variant="ghost" onClick={() => setReceiving(false)}>
          Back
        </Button>
        <span class="spacer" />
        <Button disabled={selectedQty === 0} onClick={() => receive(false)}>
          Receive {selectedQty ? plural(selectedQty, 'item') : 'selected'}
        </Button>
        <Button variant="primary" icon="check" onClick={() => receive(true)}>
          Receive all {outstanding}
        </Button>
      </>
    ) : undefined;

  return (
    <>
      <Dialog
        drawer
        size="lg"
        title={`${po.id} · ${vendor?.name ?? 'Vendor'}`}
        description={`Deliver to ${storeName(po.store)} · created ${shortDate(po.createdAt)} by ${firstName(d, po.createdBy)}`}
        onClose={onClose}
        headerExtra={<StatusBadge meta={poStatusMeta[po.status]} />}
        footer={footer}
      >
        <div class="stack">
          {receiving && (
            <div class="callout callout--blue" role="status">
              <Icon name="info" size={18} />
              <div>
                <p class="callout__title">Check in what arrived</p>
                <p class="callout__text">Set how many of each line came in. Stock goes up at {storeName(po.store)} and the vendor’s bill lands in Accounting for what you received.</p>
              </div>
            </div>
          )}
          <Details
            columns={2}
            items={[
              ['Vendor', vendor ? `${vendor.name} · ${vendor.terms}` : '—'],
              ['Deliver to', storeName(po.store)],
              ['Ordered', po.orderedOn ? shortDate(po.orderedOn) : 'Not yet'],
              ['Expected', po.expectedOn ? <span class={late ? 'is-bad' : undefined}>{`${shortDate(po.expectedOn)}${late ? ' · late' : ''}`}</span> : '—'],
              ['Received', po.receivedOn ? shortDate(po.receivedOn) : po.status === 'partial' ? `${poReceivedQty(po)} of ${poOrderedQty(po)} so far` : '—'],
              ['Total', money(poTotal(po))],
            ]}
          />
          {po.status !== 'draft' && po.status !== 'cancelled' && (
            <div class="inv-progress inv-progress--wide">
              <Meter value={poReceivedQty(po)} max={poOrderedQty(po)} tone={po.status === 'received' ? 'green' : 'blue'} label={`${poReceivedQty(po)} of ${poOrderedQty(po)} items received`} />
              <span class="muted small">
                {poReceivedQty(po)} of {poOrderedQty(po)} items received
              </span>
            </div>
          )}

          <div class="table-wrap">
            <table class="table table--dense inv-po-lines">
              <caption class="sr-only">Lines on {po.id}</caption>
              <thead>
                <tr>
                  <th scope="col">Item</th>
                  <th scope="col" class="is-right">
                    Ordered
                  </th>
                  <th scope="col" class="is-right">
                    Received
                  </th>
                  {receiving && (
                    <th scope="col" class="is-right">
                      Receive now
                    </th>
                  )}
                  <th scope="col" class="is-right hide-sm">
                    Cost
                  </th>
                  <th scope="col" class="is-right">
                    Line total
                  </th>
                </tr>
              </thead>
              <tbody>
                {po.lines.map((l) => {
                  const it = itemOf(d, l.itemId)!;
                  const left = Math.max(0, l.qty - l.received);
                  return (
                    <tr key={l.itemId}>
                      <td>
                        <button type="button" class="inv-link" onClick={() => onOpenItem(it.id)}>
                          {itemLabel(it)}
                        </button>
                        <span class="cell-sub">{it.id}</span>
                      </td>
                      <td class="is-right tabular">{qtyLabel(it, l.qty)}</td>
                      <td class="is-right tabular">
                        {l.received >= l.qty ? (
                          <span class="is-good inv-inline">
                            <Icon name="check" size={13} /> {qtyLabel(it, l.received)}
                          </span>
                        ) : (
                          qtyLabel(it, l.received)
                        )}
                      </td>
                      {receiving && (
                        <td class="is-right">
                          {left > 0 ? (
                            <input
                              class="input input--sm inv-qty inv-qty--sm"
                              type="number"
                              inputMode="numeric"
                              min={0}
                              max={left}
                              step={1}
                              value={qtys[l.itemId] ?? ''}
                              aria-label={`Quantity of ${itemLabel(it)} received now (up to ${left})`}
                              onInput={(e) => setQtys({ ...qtys, [l.itemId]: (e.target as HTMLInputElement).value })}
                            />
                          ) : (
                            <span class="muted small">Done</span>
                          )}
                        </td>
                      )}
                      <td class="is-right tabular hide-sm">{money(l.cost)}</td>
                      <td class="is-right tabular">{money(l.qty * l.cost)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {po.notes && (
            <div>
              <h3 class="section-label">Notes</h3>
              <p>{po.notes}</p>
            </div>
          )}

          {bills.length > 0 && (
            <div>
              <h3 class="section-label">Vendor bills</h3>
              <ul class="inv-list" role="list">
                {bills.map((b) => (
                  <li key={b.id}>
                    <Link to="/office/accounting/?tab=bills" class="inv-list__row">
                      <span class="inv-list__main">
                        <span class="inv-list__title">
                          {b.id} · {b.number}
                        </span>
                        <span class="cell-sub">
                          Due {shortDate(b.dueOn)} · {b.status === 'paid' ? `paid ${b.paidOn ? shortDate(b.paidOn) : ''}` : b.status === 'scheduled' ? 'payment scheduled' : 'open'}
                        </span>
                      </span>
                      <span class="inv-list__meta tabular">{money(b.amount)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </Dialog>
      {confirmCancel && (
        <Dialog
          title={`Cancel ${po.id}?`}
          size="sm"
          class="inv-dialog"
          onClose={() => setConfirmCancel(false)}
          footer={
            <>
              <Button onClick={() => setConfirmCancel(false)}>Keep order</Button>
              <Button
                variant="danger"
                data-autofocus
                onClick={() => {
                  updatePO(po.id, { status: 'cancelled' });
                  setConfirmCancel(false);
                  toast(`${po.id} cancelled`);
                }}
              >
                Cancel order
              </Button>
            </>
          }
        >
          <p>
            {poReceivedQty(po) > 0
              ? `Items already received stay in stock. The remaining ${plural(outstanding, 'item')} won’t be expected anymore.`
              : `${vendor?.name ?? 'The vendor'} won’t be expecting this order. You can always start a new one.`}
          </p>
        </Dialog>
      )}
    </>
  );
}

/* ---------- Activity tab ---------- */

type MoveFilter = 'all' | StockMove['kind'];

function ActivityTab({ onOpenItem, onOpenPO }: { onOpenItem: (id: string) => void; onOpenPO: (id: string) => void }) {
  const d = db.value;
  const store = ui.value.store;
  const [kind, setKind] = useState<MoveFilter>('all');
  const [q, setQ] = useState('');
  const term = q.trim().toLowerCase();
  const rows = d.moves.filter((m) => {
    if (!matchStore(store, m.store) || (kind !== 'all' && m.kind !== kind)) return false;
    if (!term) return true;
    const it = itemOf(d, m.itemId);
    return m.itemId.toLowerCase().includes(term) || (it && itemLabel(it).toLowerCase().includes(term)) || (m.ref ?? '').toLowerCase().includes(term) || (m.note ?? '').toLowerCase().includes(term);
  });

  const exportCsv = () => {
    downloadCsv(`hmi-stock-activity-${today()}.csv`, [
      ['Date', 'Time', 'SKU', 'Item', 'Showroom', 'Change', 'Type', 'Reference', 'By', 'Note'],
      ...rows.map((m) => {
        const it = itemOf(d, m.itemId);
        return [m.at.slice(0, 10), m.at.slice(11, 16), m.itemId, it ? itemLabel(it) : '', storeName(m.store), m.qty, moveMeta[m.kind].label, m.ref ?? '', firstName(d, m.by), m.note ?? ''];
      }),
    ]);
    toast(`Downloaded ${plural(rows.length, 'movement')} as CSV`);
  };

  const columns: Column<StockMove>[] = [
    {
      key: 'when',
      label: 'When',
      sortValue: (m) => m.at,
      render: (m) => (
        <span class="nowrap">
          {shortDate(m.at)}
          <span class="cell-sub">{time(m.at)}</span>
        </span>
      ),
    },
    {
      key: 'item',
      label: 'Item',
      sortValue: (m) => itemLabel(itemOf(d, m.itemId)!),
      render: (m) => {
        const it = itemOf(d, m.itemId);
        return it ? (
          <>
            <button type="button" class="inv-link" onClick={() => onOpenItem(it.id)}>
              {itemLabel(it)}
            </button>
            <span class="cell-sub">{it.id}</span>
          </>
        ) : (
          m.itemId
        );
      },
    },
    { key: 'store', label: 'Showroom', hide: 'sm', sortValue: (m) => m.store, render: (m) => storeName(m.store) },
    { key: 'qty', label: 'Change', align: 'right', sortValue: (m) => m.qty, render: (m) => <Delta qty={m.qty} item={itemOf(d, m.itemId)} /> },
    { key: 'kind', label: 'Type', sortValue: (m) => m.kind, render: (m) => <StatusBadge meta={moveMeta[m.kind]} /> },
    { key: 'ref', label: 'Reference', hide: 'sm', sortValue: (m) => m.ref ?? '', render: (m) => <RefLink refId={m.ref} onOpenPO={onOpenPO} /> },
    { key: 'by', label: 'By', hide: 'md', sortValue: (m) => firstName(d, m.by), render: (m) => firstName(d, m.by) },
    { key: 'note', label: 'Note', hide: 'md', render: (m) => (m.note ? <span class="inv-note">{m.note}</span> : <span class="muted">—</span>) },
  ];

  return (
    <>
      <div class="toolbar">
        <SearchInput value={q} onInput={setQ} label="Search stock movements" placeholder="Item, SKU, job or PO number" />
        <label class="inv-select">
          <span class="sr-only">Movement type</span>
          <select class="select" value={kind} onChange={(e) => setKind((e.target as HTMLSelectElement).value as MoveFilter)}>
            <option value="all">All movements</option>
            {(Object.keys(moveMeta) as StockMove['kind'][]).map((k) => (
              <option key={k} value={k}>
                {moveMeta[k].label}
              </option>
            ))}
          </select>
        </label>
        <span class="toolbar__spacer" />
        <Button icon="download" onClick={exportCsv} disabled={!rows.length}>
          Download CSV
        </Button>
      </div>
      <Card flush>
        <DataTable
          rows={rows}
          columns={columns}
          rowKey={(m) => m.id}
          caption="Stock movements"
          initialSort={{ key: 'when', dir: 'desc' }}
          empty={<EmptyState icon="transfer" title="No movements match" />}
        />
      </Card>
    </>
  );
}

/* ---------- Page ---------- */

export default function Inventory() {
  const d = db.value;
  const store = ui.value.store;
  const params = route.value.params;
  const tabParam = params.get('tab');
  const tab: Tab = tabParam === 'orders' || tabParam === 'activity' ? tabParam : 'stock';
  const item = itemOf(d, params.get('id') ?? undefined);
  const po = d.pos.find((p) => p.id === params.get('po'));
  const [sub, setSub] = useState<Sub | null>(null);

  const stores = store === 'all' ? STORES : [store];
  const value = d.items.reduce((s, it) => s + stockValue(it, store), 0);
  const low = lowStock(d, store);
  const out = low.filter((it) => stockStatus(it, store) === 'out').length;
  const openOrders = d.pos.filter((p) => matchStore(store, p.store) && (p.status === 'ordered' || p.status === 'partial'));
  const drafts = d.pos.filter((p) => matchStore(store, p.store) && p.status === 'draft').length;
  const incoming = openOrders.reduce((s, p) => s + poOutstanding(p), 0);
  const incomingUnits = openOrders.reduce((s, p) => s + p.lines.reduce((n, l) => n + (itemOf(d, l.itemId)?.kind === 'unit' ? Math.max(0, l.qty - l.received) : 0), 0), 0);
  const displays = d.items.reduce((s, it) => s + stores.reduce((n, st) => n + it.stock[st].display, 0), 0);
  const onHandLines = d.items.filter((it) => stores.some((s) => it.stock[s].onHand > 0)).length;

  const openItem = (id: string) => setParams({ id });
  const openPO = (id: string) => setParams({ tab: 'orders', po: id, id: undefined });

  return (
    <div class="inventory">
      <PageHeader
        eyebrow={store === 'all' ? 'Both showrooms' : storeName(store)}
        title="Inventory"
        description="What’s on the shelves at each showroom, what’s set aside for jobs, and what’s on the way."
        actions={
          <>
            <Button icon="transfer" onClick={() => setSub({ kind: 'transfer' })}>
              Transfer stock
            </Button>
            <Button variant="primary" icon="plus" onClick={() => setSub({ kind: 'po' })}>
              New purchase order
            </Button>
          </>
        }
      />

      <div class="stats">
        <Stat label="Stock value at cost" icon="dollar" value={money(value, false)} hint={`${plural(onHandLines, 'product')} on the shelves`} />
        <Stat label="Low or out of stock" icon="alert" value={number(low.length)} hint={out ? <span class="is-bad">{out} out of stock</span> : 'Nothing out of stock'} to="/office/inventory/?filter=low" />
        <Stat label="On order" icon="truck" value={number(incoming)} hint={`${plural(openOrders.length, 'open order')}${incomingUnits ? ` · ${plural(incomingUnits, 'appliance')}` : ''}${drafts ? ` · ${plural(drafts, 'draft')}` : ''}`} to="/office/inventory/?tab=orders" />
        <Stat label="Showroom displays" icon="store" value={number(displays)} hint="Set up on the floor (not for sale)" />
      </div>

      <Tabs<Tab>
        label="Inventory views"
        idBase="inv"
        value={tab}
        onChange={(k) => setParams({ tab: k === 'stock' ? undefined : k, id: undefined, po: undefined, filter: k === 'stock' ? params.get('filter') ?? undefined : undefined, kind: k === 'stock' ? params.get('kind') ?? undefined : undefined }, { replace: true })}
        items={[
          { key: 'stock', label: 'Stock', icon: 'box' },
          { key: 'orders', label: 'Purchase orders', icon: 'file', count: d.pos.filter((p) => matchStore(store, p.store) && isOpenPO(p)).length },
          { key: 'activity', label: 'Activity', icon: 'transfer' },
        ]}
      />
      <TabPanel idBase="inv" active={tab}>
        {tab === 'stock' && <StockTab onOpen={openItem} />}
        {tab === 'orders' && <OrdersTab onOpenPO={openPO} onOpenItem={openItem} />}
        {tab === 'activity' && <ActivityTab onOpenItem={openItem} onOpenPO={openPO} />}
      </TabPanel>

      {po && <PODrawer key={po.id} po={po} onClose={() => setParams({ po: undefined }, { replace: true })} onEdit={() => setSub({ kind: 'po', poId: po.id })} onOpenItem={openItem} />}
      {item && <ItemDrawer key={item.id} item={item} onClose={() => setParams({ id: undefined }, { replace: true })} onAction={setSub} onOpenPO={openPO} />}
      {sub?.kind === 'transfer' && <TransferDialog itemId={sub.itemId} from={sub.from} onClose={() => setSub(null)} />}
      {sub?.kind === 'adjust' && <AdjustDialog itemId={sub.itemId} store={sub.store} onClose={() => setSub(null)} />}
      {sub?.kind === 'po' && <PODialog poId={sub.poId} preset={sub.preset} onClose={() => setSub(null)} />}
    </div>
  );
}

