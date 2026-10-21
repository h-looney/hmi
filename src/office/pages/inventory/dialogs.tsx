/** Inventory dialogs: move stock between showrooms, correct a count, and build a purchase order. */
import { useState } from 'preact/hooks';
import { adjustStock, createPO, orderPO, transferStock, updatePO } from '../../actions';
import { useAssets } from '../../assets';
import type { Item, StoreId } from '../../data/types';
import { money } from '../../lib/format';
import { navigate, sectionPath } from '../../router';
import { available, itemLabel, itemOf, storeName, STORES } from '../../selectors';
import { db, ui } from '../../store';
import { toast } from '../../toast';
import { Button, Field, Segmented } from '../../ui/core';
import { Dialog } from '../../ui/Dialog';
import { Icon } from '../../ui/Icon';
import { ItemPicker } from '../../ui/pickers';
import { onOrder, qtyLabel, stockVendors } from './helpers';

const other = (s: StoreId): StoreId => (s === 'osage-beach' ? 'nixa' : 'osage-beach');
const defaultStore = (): StoreId => (ui.value.store === 'all' ? 'osage-beach' : ui.value.store);
const toInt = (v: string) => (v.trim() === '' ? NaN : Math.floor(Number(v)));

/** Small product summary used at the top of each dialog */
export function ItemSummary({ item, onChange }: { item: Item; onChange?: () => void }) {
  const { photos } = useAssets();
  const src = item.photo ? photos[item.photo] : undefined;
  return (
    <div class="inv-pick">
      {src ? (
        <img class="thumb" src={src} alt="" width={40} height={40} />
      ) : (
        <span class="thumb" aria-hidden="true">
          <Icon name={item.kind === 'part' ? 'wrench' : 'box'} size={18} />
        </span>
      )}
      <span class="inv-pick__text">
        <strong>{itemLabel(item)}</strong>
        <span class="muted small">
          {item.id} · {item.category}
        </span>
      </span>
      {onChange && (
        <Button size="sm" variant="ghost" onClick={onChange}>
          Change
        </Button>
      )}
    </div>
  );
}

/* ---------- Transfer ---------- */

export function TransferDialog({ itemId, from: fromProp, onClose }: { itemId?: string; from?: StoreId; onClose: () => void }) {
  const d = db.value;
  const [pickedId, setPickedId] = useState<string | undefined>(itemId);
  const item = itemOf(d, pickedId);
  const bestFrom = (it?: Item): StoreId => (it ? (available(it, 'osage-beach') >= available(it, 'nixa') ? 'osage-beach' : 'nixa') : defaultStore());
  const [from, setFrom] = useState<StoreId>(fromProp ?? (ui.value.store !== 'all' ? ui.value.store : bestFrom(item)));
  const [qtyText, setQtyText] = useState('1');
  const [note, setNote] = useState('');
  const to = other(from);
  const max = item ? Math.max(0, available(item, from)) : 0;
  const qty = toInt(qtyText);
  const valid = !!item && qty >= 1 && qty <= max;
  const tooMany = !!item && qty > max && max > 0;

  const submit = (e: Event) => {
    e.preventDefault();
    if (!valid || !item) return;
    transferStock(item.id, from, to, qty, note.trim() || undefined);
    toast(`Moved ${qtyLabel(item, qty)} × ${itemLabel(item)} from ${storeName(from)} to ${storeName(to)}`, { tone: 'success' });
    onClose();
  };

  return (
    <Dialog
      title="Transfer stock"
      description="Move stock from one showroom to the other. Both counts update right away."
      onClose={onClose}
      size="md"
      class="inv-dialog"
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" type="submit" form="inv-transfer-form" icon="transfer" disabled={!valid}>
            {valid ? `Transfer ${qtyLabel(item!, qty)}` : 'Transfer'}
          </Button>
        </>
      }
    >
      <form id="inv-transfer-form" class="stack" onSubmit={submit} noValidate>
        {item ? (
          <ItemSummary item={item} onChange={itemId ? undefined : () => setPickedId(undefined)} />
        ) : (
          <ItemPicker
            store={from}
            label="Item to move"
            filter={(it) => !it.specialOrder}
            onSelect={(it) => {
              setPickedId(it.id);
              if (!fromProp && ui.value.store === 'all') setFrom(bestFrom(it));
              setQtyText('1');
            }}
          />
        )}

        <div class="inv-route">
          <Field label="From">
            <select class="select" value={from} onChange={(e) => setFrom((e.target as HTMLSelectElement).value as StoreId)}>
              {STORES.map((s) => (
                <option key={s} value={s}>
                  {storeName(s)}
                </option>
              ))}
            </select>
          </Field>
          <button type="button" class="btn btn--ghost btn--md btn--icon inv-route__swap" aria-label="Swap direction" title="Swap direction" onClick={() => setFrom(to)}>
            <Icon name="transfer" size={18} />
          </button>
          <Field label="To">
            <select class="select" value={to} onChange={(e) => setFrom(other((e.target as HTMLSelectElement).value as StoreId))}>
              {STORES.map((s) => (
                <option key={s} value={s}>
                  {storeName(s)}
                </option>
              ))}
            </select>
          </Field>
        </div>

        {item && max === 0 ? (
          <div class="callout callout--amber" role="status">
            <Icon name="alert" size={18} />
            <div>
              <p class="callout__title">Nothing free to move from {storeName(from)}</p>
              <p class="callout__text">
                {item.stock[from].onHand} on hand — {item.stock[from].reserved} reserved for jobs and {item.stock[from].display} on display. Try the other direction.
              </p>
            </div>
          </div>
        ) : (
          <Field label="Quantity" hint={item ? `${qtyLabel(item, max)} available at ${storeName(from)} (reserved and display units stay put)` : undefined}>
            <input
              class="input inv-qty"
              type="number"
              inputMode="numeric"
              min={1}
              max={max || undefined}
              step={1}
              value={qtyText}
              disabled={!item}
              aria-invalid={tooMany || undefined}
              onInput={(e) => setQtyText((e.target as HTMLInputElement).value)}
            />
          </Field>
        )}
        {tooMany && (
          <p class="inv-error" role="alert">
            Only {qtyLabel(item!, max)} can move from {storeName(from)}.
          </p>
        )}

        <Field label="Note" optional>
          <input class="input" value={note} placeholder="e.g. Customer picking up in Nixa" onInput={(e) => setNote((e.target as HTMLInputElement).value)} />
        </Field>

        {item && valid && (
          <div class="inv-preview" aria-live="polite">
            <span class="inv-preview__label">After the transfer</span>
            <span>
              {storeName(from)}: {item.stock[from].onHand} → <strong>{item.stock[from].onHand - qty}</strong> on hand
            </span>
            <span>
              {storeName(to)}: {item.stock[to].onHand} → <strong>{item.stock[to].onHand + qty}</strong> on hand
            </span>
          </div>
        )}
      </form>
    </Dialog>
  );
}

/* ---------- Adjust ---------- */

type AdjustMode = 'count' | 'add' | 'remove';
const reasons = ['Cycle count', 'Damaged', 'Found', 'Showroom use', 'Other'] as const;
const defaultReason: Record<AdjustMode, (typeof reasons)[number]> = { count: 'Cycle count', add: 'Found', remove: 'Damaged' };

export function AdjustDialog({ itemId, store: storeProp, onClose }: { itemId: string; store?: StoreId; onClose: () => void }) {
  const item = itemOf(db.value, itemId);
  const [store, setStore] = useState<StoreId>(storeProp ?? defaultStore());
  const [mode, setMode] = useState<AdjustMode>('count');
  const [amountText, setAmountText] = useState(String(item?.stock[storeProp ?? defaultStore()].onHand ?? 0));
  const [reason, setReason] = useState<string>(defaultReason.count);
  const [note, setNote] = useState('');
  if (!item) return null;

  const level = item.stock[store];
  const current = level.onHand;
  const amount = toInt(amountText);
  const delta = !Number.isFinite(amount) ? 0 : mode === 'add' ? amount : mode === 'remove' ? -amount : amount - current;
  const next = current + delta;
  const valid = Number.isFinite(amount) && (mode === 'count' ? amount >= 0 && delta !== 0 : amount >= 1) && next >= 0;
  const committed = level.reserved + level.display;

  const switchMode = (m: AdjustMode) => {
    setMode(m);
    setReason(defaultReason[m]);
    setAmountText(m === 'count' ? String(current) : '1');
  };
  const switchStore = (s: StoreId) => {
    setStore(s);
    if (mode === 'count') setAmountText(String(item.stock[s].onHand));
  };

  const submit = (e: Event) => {
    e.preventDefault();
    if (!valid) return;
    adjustStock(item.id, store, delta, note.trim() ? `${reason} — ${note.trim()}` : reason);
    toast(`${itemLabel(item)} at ${storeName(store)}: now ${qtyLabel(item, next)} on hand`, { tone: 'success' });
    onClose();
  };

  return (
    <Dialog
      title="Adjust stock"
      description="Correct an on-hand count after a count, damage or a found item."
      onClose={onClose}
      size="md"
      class="inv-dialog"
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" type="submit" form="inv-adjust-form" disabled={!valid}>
            Save adjustment
          </Button>
        </>
      }
    >
      <form id="inv-adjust-form" class="stack" onSubmit={submit} noValidate>
        <ItemSummary item={item} />
        <div class="form-grid">
          <Field label="Showroom">
            <select class="select" value={store} onChange={(e) => switchStore((e.target as HTMLSelectElement).value as StoreId)}>
              {STORES.map((s) => (
                <option key={s} value={s}>
                  {storeName(s)} — {qtyLabel(item, item.stock[s].onHand)} on hand
                </option>
              ))}
            </select>
          </Field>
          <div class="field">
            <span class="field__label" aria-hidden="true">
              Change
            </span>
            <Segmented<AdjustMode>
              label="Type of change"
              size="sm"
              value={mode}
              onChange={switchMode}
              items={[
                { key: 'count', label: 'Set count' },
                { key: 'add', label: 'Add' },
                { key: 'remove', label: 'Remove' },
              ]}
            />
          </div>
          <Field label={mode === 'count' ? 'Counted on hand' : mode === 'add' ? 'Quantity to add' : 'Quantity to remove'}>
            <input class="input inv-qty" type="number" inputMode="numeric" min={mode === 'count' ? 0 : 1} step={1} value={amountText} onInput={(e) => setAmountText((e.target as HTMLInputElement).value)} />
          </Field>
          <Field label="Reason">
            <select class="select" value={reason} onChange={(e) => setReason((e.target as HTMLSelectElement).value)}>
              {reasons.map((r) => (
                <option key={r}>{r}</option>
              ))}
            </select>
          </Field>
          <Field label="Note" optional class="span-2">
            <input class="input" value={note} placeholder="e.g. Cracked glass found during receiving" onInput={(e) => setNote((e.target as HTMLInputElement).value)} />
          </Field>
        </div>

        {mode === 'remove' && Number.isFinite(amount) && next < 0 && (
          <p class="inv-error" role="alert">
            There are only {qtyLabel(item, current)} on hand at {storeName(store)}.
          </p>
        )}
        {valid && (
          <div class="inv-preview" aria-live="polite">
            <span class="inv-preview__label">After saving</span>
            <span>
              {storeName(store)}: {current} → <strong>{next}</strong> on hand ({delta > 0 ? `+${delta}` : `−${Math.abs(delta)}`})
            </span>
            {next < committed && (
              <span class="inv-warn">
                <Icon name="alert" size={14} /> That’s fewer than the {committed} reserved for jobs or on display.
              </span>
            )}
          </div>
        )}
      </form>
    </Dialog>
  );
}

/* ---------- Purchase order ---------- */

interface Line {
  itemId: string;
  qty: string;
}

export function PODialog({ poId, preset, onClose }: { poId?: string; preset?: { vendorId?: string; store?: StoreId; itemIds?: string[] }; onClose: () => void }) {
  const d = db.value;
  const existing = poId ? d.pos.find((p) => p.id === poId) : undefined;
  const vendors = stockVendors(d);
  const firstPresetItem = preset?.itemIds?.length ? itemOf(d, preset.itemIds[0]) : undefined;
  const [vendorId, setVendorId] = useState<string>(existing?.vendorId ?? preset?.vendorId ?? firstPresetItem?.vendorId ?? '');
  const [store, setStore] = useState<StoreId>(existing?.store ?? preset?.store ?? defaultStore());
  const [lines, setLines] = useState<Line[]>(() =>
    existing
      ? existing.lines.map((l) => ({ itemId: l.itemId, qty: String(l.qty) }))
      : (preset?.itemIds ?? []).filter((id) => itemOf(d, id)).map((id) => ({ itemId: id, qty: String(Math.max(1, itemOf(d, id)!.reorderQty)) })),
  );
  const [notes, setNotes] = useState(existing?.notes ?? '');
  const [notice, setNotice] = useState('');

  if (existing && existing.status !== 'draft') {
    return (
      <Dialog title={`${existing.id} can’t be edited`} onClose={onClose} size="sm" class="inv-dialog" footer={<Button onClick={onClose}>Close</Button>}>
        <p>This order has already been placed with the vendor. Receive it or cancel it from the order instead.</p>
      </Dialog>
    );
  }

  const vendor = vendors.find((v) => v.id === vendorId);
  const parsed = lines.map((l) => ({ itemId: l.itemId, qty: toInt(l.qty), item: itemOf(d, l.itemId)! }));
  const total = parsed.reduce((s, l) => s + (Number.isFinite(l.qty) ? l.qty : 0) * l.item.cost, 0);
  const units = parsed.reduce((s, l) => s + (Number.isFinite(l.qty) ? l.qty : 0), 0);
  const badQty = parsed.some((l) => !(l.qty >= 1));
  const valid = !!vendor && parsed.length > 0 && !badQty;

  const addItem = (it: Item) => {
    setNotice('');
    if (!vendorId) setVendorId(it.vendorId);
    setLines((ls) => (ls.some((l) => l.itemId === it.id) ? ls.map((l) => (l.itemId === it.id ? { ...l, qty: String((toInt(l.qty) || 0) + 1) } : l)) : [...ls, { itemId: it.id, qty: String(Math.max(1, it.reorderQty)) }]));
  };

  const changeVendor = (id: string) => {
    const keep = lines.filter((l) => itemOf(d, l.itemId)?.vendorId === id);
    const removed = lines.length - keep.length;
    setVendorId(id);
    setLines(keep);
    setNotice(removed ? `Removed ${removed} item${removed === 1 ? '' : 's'} that ${removed === 1 ? 'comes' : 'come'} from a different vendor.` : '');
  };

  const save = (order: boolean) => {
    if (!valid || !vendor) return;
    const clean = parsed.map((l) => ({ itemId: l.itemId, qty: l.qty }));
    let id = existing?.id ?? '';
    if (existing) {
      updatePO(existing.id, { vendorId, store, notes: notes.trim() || undefined, lines: clean.map((l) => ({ ...l, received: 0, cost: itemOf(d, l.itemId)!.cost })) });
      if (order) orderPO(existing.id);
    } else {
      id = createPO({ vendorId, store, lines: clean, notes: notes.trim() || undefined, order });
    }
    toast(order ? `${id} placed with ${vendor.name} — expected in about a week` : `${id} saved as a draft`, { tone: 'success' });
    onClose();
    navigate(sectionPath('inventory', { tab: 'orders', po: id }), { scroll: false });
  };

  return (
    <Dialog
      title={existing ? `Edit ${existing.id}` : 'New purchase order'}
      description="Order stock from a manufacturer or distributor for one showroom."
      onClose={onClose}
      size="lg"
      class="inv-dialog"
      footer={
        <>
          <span class="inv-po-total">
            {parsed.length ? `${parsed.length} line${parsed.length === 1 ? '' : 's'} · ${units} items · ` : ''}
            <strong>{money(total)}</strong>
          </span>
          <span class="spacer" />
          <Button onClick={onClose}>Cancel</Button>
          <Button disabled={!valid} onClick={() => save(false)}>
            Save draft
          </Button>
          <Button variant="primary" icon="send" disabled={!valid} onClick={() => save(true)}>
            Place order
          </Button>
        </>
      }
    >
      <div class="stack">
        <div class="form-grid">
          <Field label="Vendor">
            <select class="select" value={vendorId} onChange={(e) => changeVendor((e.target as HTMLSelectElement).value)}>
              <option value="">Choose a vendor…</option>
              {vendors.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Deliver to">
            <select class="select" value={store} onChange={(e) => setStore((e.target as HTMLSelectElement).value as StoreId)}>
              {STORES.map((s) => (
                <option key={s} value={s}>
                  {storeName(s)}
                </option>
              ))}
            </select>
          </Field>
        </div>
        {vendor && (
          <p class="muted small">
            {vendor.terms}
            {vendor.account ? ` · Account ${vendor.account}` : ''}
          </p>
        )}

        <div class="inv-po-add">
          <ItemPicker
            store={store}
            label={vendor ? `Add an item from ${vendor.name}` : 'Add an item'}
            placeholder={vendor ? 'Search this vendor’s catalog' : 'Search by name, brand or SKU — picks the vendor for you'}
            filter={(it) => !vendorId || it.vendorId === vendorId}
            onSelect={addItem}
          />
        </div>
        {notice && (
          <p class="muted small" role="status">
            {notice}
          </p>
        )}

        {parsed.length === 0 ? (
          <p class="inv-empty-lines">No items yet. Search above to add what you need.</p>
        ) : (
          <div class="table-wrap">
            <table class="table table--dense inv-po-lines">
              <caption class="sr-only">Items on this order</caption>
              <thead>
                <tr>
                  <th scope="col">Item</th>
                  <th scope="col" class="is-right">
                    Quantity
                  </th>
                  <th scope="col" class="is-right hide-sm">
                    Unit cost
                  </th>
                  <th scope="col" class="is-right">
                    Line total
                  </th>
                  <th scope="col">
                    <span class="sr-only">Remove</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {parsed.map((l, i) => {
                  const label = itemLabel(l.item);
                  const a = available(l.item, store);
                  const incoming = onOrder(d, l.item.id, store);
                  const drafted = d.pos
                    .filter((p) => p.status === 'draft' && p.store === store && p.id !== poId)
                    .flatMap((p) => p.lines.filter((x) => x.itemId === l.item.id).map((x) => ({ po: p.id, qty: x.qty })));
                  return (
                    <tr key={l.itemId}>
                      <td>
                        <span class="cell-main">{label}</span>
                        <span class="cell-sub">
                          {l.item.id} · {a} available at {storeName(store)}
                          {incoming ? ` · ${incoming} already on order` : ''}
                          {drafted.length ? ` · ${drafted.map((x) => `${x.qty} on draft ${x.po}`).join(', ')}` : ''}
                        </span>
                      </td>
                      <td class="is-right">
                        <input
                          class="input input--sm inv-qty inv-qty--sm"
                          type="number"
                          inputMode="numeric"
                          min={1}
                          step={1}
                          value={lines[i].qty}
                          aria-label={`Quantity of ${label}`}
                          aria-invalid={!(l.qty >= 1) || undefined}
                          onInput={(e) => {
                            const v = (e.target as HTMLInputElement).value;
                            setLines((ls) => ls.map((x, j) => (j === i ? { ...x, qty: v } : x)));
                          }}
                        />
                      </td>
                      <td class="is-right tabular hide-sm">{money(l.item.cost)}</td>
                      <td class="is-right tabular">{money((Number.isFinite(l.qty) ? l.qty : 0) * l.item.cost)}</td>
                      <td class="is-right">
                        <button type="button" class="btn btn--ghost btn--sm btn--icon" aria-label={`Remove ${label}`} onClick={() => setLines((ls) => ls.filter((_, j) => j !== i))}>
                          <Icon name="close" size={16} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr>
                  <td>Total</td>
                  <td />
                  <td class="hide-sm" />
                  <td class="is-right tabular">{money(total)}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
        {badQty && parsed.length > 0 && (
          <p class="inv-error" role="alert">
            Every line needs a quantity of at least 1.
          </p>
        )}

        <Field label="Notes for the order" optional>
          <textarea class="textarea" rows={2} value={notes} placeholder="e.g. Ship with the next truck to Nixa" onInput={(e) => setNotes((e.target as HTMLTextAreaElement).value)} />
        </Field>
      </div>
    </Dialog>
  );
}
