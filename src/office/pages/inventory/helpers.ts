/** Inventory-only helpers: purchase-order math, reorder suggestions, labels and CSV export. */
import type { DB, Item, PurchaseOrder, StockMove, StoreFilter, StoreId, Vendor } from '../../data/types';
import { available, matchStore, STORES } from '../../selectors';
import type { Tone } from '../../ui/core';
import type { IconName } from '../../ui/Icon';

type Meta = { label: string; tone: Tone; icon: IconName };

export const poStatusMeta: Record<PurchaseOrder['status'], Meta> = {
  draft: { label: 'Draft', tone: 'neutral', icon: 'edit' },
  ordered: { label: 'Ordered', tone: 'blue', icon: 'send' },
  partial: { label: 'Partly received', tone: 'amber', icon: 'truck' },
  received: { label: 'Received', tone: 'green', icon: 'check-circle' },
  cancelled: { label: 'Cancelled', tone: 'neutral', icon: 'x-circle' },
};

export const moveMeta: Record<StockMove['kind'], Meta> = {
  received: { label: 'Received', tone: 'green', icon: 'download' },
  sold: { label: 'Sold', tone: 'blue', icon: 'receipt' },
  job: { label: 'Used on a job', tone: 'ember', icon: 'wrench' },
  transfer: { label: 'Transfer', tone: 'violet', icon: 'transfer' },
  adjustment: { label: 'Adjustment', tone: 'amber', icon: 'edit' },
};

export const isOpenPO = (po: PurchaseOrder) => po.status === 'draft' || po.status === 'ordered' || po.status === 'partial';
export const poTotal = (po: PurchaseOrder) => po.lines.reduce((s, l) => s + l.qty * l.cost, 0);
export const poOrderedQty = (po: PurchaseOrder) => po.lines.reduce((s, l) => s + l.qty, 0);
export const poReceivedQty = (po: PurchaseOrder) => po.lines.reduce((s, l) => s + Math.min(l.qty, l.received), 0);
export const poOutstanding = (po: PurchaseOrder) => po.lines.reduce((s, l) => s + Math.max(0, l.qty - l.received), 0);

/** Vendors we buy stock from (manufacturers and distributors) */
export const stockVendors = (d: DB): Vendor[] => d.vendors.filter((v) => v.category === 'Inventory purchases');

/** "8 ft", "12 bags", "3 boxes", "2" */
export function qtyLabel(it: Pick<Item, 'uom'>, n: number): string {
  if (it.uom === 'ft') return `${n} ft`;
  if (it.uom === 'bag') return `${n} bag${n === 1 ? '' : 's'}`;
  if (it.uom === 'box') return `${n} box${n === 1 ? '' : 'es'}`;
  return String(n);
}

/** Outstanding quantity of an item on open (ordered or partly received) POs for a store */
export function onOrder(d: DB, itemId: string, store: StoreId): number {
  let n = 0;
  for (const po of d.pos) {
    if (po.store !== store || (po.status !== 'ordered' && po.status !== 'partial')) continue;
    for (const l of po.lines) if (l.itemId === itemId) n += Math.max(0, l.qty - l.received);
  }
  return n;
}

export interface ReorderGroup {
  vendorId: string;
  store: StoreId;
  lines: { itemId: string; qty: number; available: number }[];
}

/**
 * Items below their reorder point that aren't already on an open purchase order,
 * grouped by vendor and store so each group can become one draft PO.
 */
export function reorderSuggestions(d: DB, store: StoreFilter): ReorderGroup[] {
  const covered = new Set<string>();
  for (const po of d.pos) {
    if (!isOpenPO(po)) continue;
    for (const l of po.lines) if (l.received < l.qty) covered.add(`${l.itemId}|${po.store}`);
  }
  const groups = new Map<string, ReorderGroup>();
  for (const it of d.items) {
    if (it.specialOrder || it.reorderQty <= 0) continue;
    for (const s of STORES) {
      if (!matchStore(store, s)) continue;
      const a = available(it, s);
      if (a >= it.reorderPoint || covered.has(`${it.id}|${s}`)) continue;
      const key = `${it.vendorId}|${s}`;
      const group = groups.get(key) ?? { vendorId: it.vendorId, store: s, lines: [] };
      group.lines.push({ itemId: it.id, qty: it.reorderQty + Math.max(0, -a), available: a });
      groups.set(key, group);
    }
  }
  return [...groups.values()].sort((a, b) => b.lines.length - a.lines.length);
}

/** Download rows as a CSV file (client-side; nothing leaves the browser). */
export function downloadCsv(filename: string, rows: (string | number | undefined)[][]) {
  const esc = (v: string | number | undefined) => {
    const s = v === undefined ? '' : String(v);
    return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = rows.map((r) => r.map(esc).join(',')).join('\r\n');
  const url = URL.createObjectURL(new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
