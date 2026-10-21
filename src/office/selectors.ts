/**
 * Derived values shared across HMI mode: invoice math, stock levels, warranty status, revenue.
 * Pure functions of the data — no editing here.
 */
import { installStandards } from './data/catalog';
import { addDays, diffDays, inRange, monthKey, today } from './lib/dates';
import type {
  Customer,
  DB,
  History,
  Invoice,
  Item,
  Job,
  RevenueCategory,
  Staff,
  StoreFilter,
  StoreId,
  Unit,
} from './data/types';

export const STORES: StoreId[] = ['osage-beach', 'nixa'];
export const storeName = (s: StoreId | 'all' | 'both') => (s === 'osage-beach' ? 'Osage Beach' : s === 'nixa' ? 'Nixa' : 'Both stores');
export const matchStore = (filter: StoreFilter, store: StoreId) => filter === 'all' || filter === store;

/* ---------- Lookups ---------- */

const cache = new WeakMap<object, Map<string, unknown>>();
function indexBy<T extends { id: string }>(list: T[]): Map<string, T> {
  let m = cache.get(list) as Map<string, T> | undefined;
  if (!m) {
    m = new Map(list.map((x) => [x.id, x]));
    cache.set(list, m as Map<string, unknown>);
  }
  return m;
}

export const byId = <T extends { id: string }>(list: T[], id: string | undefined): T | undefined => (id ? indexBy(list).get(id) : undefined);
export const customerOf = (d: DB, id?: string) => byId<Customer>(d.customers, id);
export const unitOf = (d: DB, id?: string) => byId<Unit>(d.units, id);
export const itemOf = (d: DB, id?: string) => byId<Item>(d.items, id);
export const staffOf = (d: DB, id?: string) => byId<Staff>(d.staff, id);
export const jobOf = (d: DB, id?: string) => byId<Job>(d.jobs, id);
export const invoiceOf = (d: DB, id?: string) => byId<Invoice>(d.invoices, id);
export const firstName = (d: DB, id?: string) => (id === 'system' ? 'HMI Office' : id === 'customer' ? 'Customer' : staffOf(d, id)?.name.split(' ')[0] ?? '—');
export const itemLabel = (it: Item) => (it.brand === 'HMI Supply' ? it.name : `${it.brand} ${it.name}`);
export const unitLabel = (u: Unit) => (u.brand === 'Other' ? u.model : `${u.brand} ${u.model}`);

/* ---------- Invoices ---------- */

export function invoiceTotals(inv: Invoice) {
  const subtotal = inv.lines.reduce((s, l) => s + l.qty * l.rate, 0);
  const taxable = inv.lines.filter((l) => l.taxable).reduce((s, l) => s + l.qty * l.rate, 0);
  const tax = Math.round(taxable * inv.taxRate * 100) / 100;
  const total = Math.round((subtotal + tax) * 100) / 100;
  const paid = inv.payments.reduce((s, p) => s + p.amount, 0);
  const balance = Math.max(0, Math.round((total - paid) * 100) / 100);
  return { subtotal, tax, total, paid, balance };
}

export type InvoiceStatus = 'draft' | 'open' | 'partial' | 'overdue' | 'paid' | 'void' | 'sent' | 'accepted' | 'declined' | 'expired';

export function invoiceStatus(inv: Invoice, day = today()): InvoiceStatus {
  if (inv.kind === 'estimate') {
    if (inv.status === 'draft' || inv.status === 'accepted' || inv.status === 'declined' || inv.status === 'void') return inv.status;
    return inv.dueOn < day ? 'expired' : 'sent';
  }
  if (inv.status === 'draft' || inv.status === 'void') return inv.status;
  const { paid, balance } = invoiceTotals(inv);
  if (balance <= 0.004) return 'paid';
  if (inv.dueOn < day) return 'overdue';
  return paid > 0 ? 'partial' : 'open';
}

export const daysOverdue = (inv: Invoice, day = today()) => Math.max(0, diffDays(day, inv.dueOn));

/** Unpaid invoice balances grouped by how late they are */
export function arAging(d: DB, store: StoreFilter, day = today()) {
  const buckets = [
    { key: 'current', label: 'Current', amount: 0, count: 0 },
    { key: '1-30', label: '1–30 days', amount: 0, count: 0 },
    { key: '31-60', label: '31–60 days', amount: 0, count: 0 },
    { key: '61-90', label: '61–90 days', amount: 0, count: 0 },
    { key: '90+', label: 'Over 90 days', amount: 0, count: 0 },
  ];
  for (const inv of d.invoices) {
    if (inv.kind !== 'invoice' || inv.status === 'draft' || inv.status === 'void' || !matchStore(store, inv.store)) continue;
    const { balance } = invoiceTotals(inv);
    if (balance <= 0.004) continue;
    // Deposits on installs that haven't happened yet aren't receivables
    const job = inv.jobId ? jobOf(d, inv.jobId) : undefined;
    if (job && job.type === 'install' && job.status !== 'closed' && job.status !== 'completed') continue;
    const late = diffDays(day, inv.dueOn);
    const b = late <= 0 ? buckets[0] : late <= 30 ? buckets[1] : late <= 60 ? buckets[2] : late <= 90 ? buckets[3] : buckets[4];
    b.amount += balance;
    b.count++;
  }
  return buckets;
}

/* ---------- Inventory ---------- */

/** On hand minus reserved for jobs minus showroom displays */
export const available = (it: Item, store: StoreId) => it.stock[store].onHand - it.stock[store].reserved - it.stock[store].display;

export type StockStatus = 'out' | 'low' | 'ok' | 'special';

export function stockStatus(it: Item, store: StoreFilter): StockStatus {
  if (it.specialOrder) return 'special';
  const stores = store === 'all' ? STORES : [store];
  let worst: StockStatus = 'ok';
  for (const s of stores) {
    const a = available(it, s);
    if (a <= 0 && it.reorderPoint > 0) return 'out';
    if (a < it.reorderPoint) worst = 'low';
  }
  return worst;
}

export const lowStock = (d: DB, store: StoreFilter) => d.items.filter((it) => {
  const s = stockStatus(it, store);
  return s === 'low' || s === 'out';
});

export const stockValue = (it: Item, store: StoreFilter) => (store === 'all' ? STORES : [store]).reduce((s, st) => s + it.stock[st].onHand * it.cost, 0);

/* ---------- Units & warranty ---------- */

export type WarrantyState = 'active' | 'expiring' | 'labor-ended' | 'expired' | 'none';

export function warrantyState(u: Unit, day = today()): WarrantyState {
  if (u.installedBy === 'Other' || !u.warranty.partsUntil) return 'none';
  if (u.warranty.partsUntil < day) return 'expired';
  if (diffDays(u.warranty.partsUntil, day) <= 90) return 'expiring';
  if (u.warranty.laborUntil && u.warranty.laborUntil < day) return 'labor-ended';
  return 'active';
}

/** Annual service is due 12 months after the last visit (or the install). */
export const serviceDueOn = (u: Unit) => addDays(u.lastServiceOn ?? u.installedOn, 365);

/* ---------- Jobs ---------- */

export const jobDay = (j: Job) => (j.start ?? j.completedAt ?? j.createdAt).slice(0, 10);
export const isOpenJob = (j: Job) => j.status === 'requested' || j.status === 'scheduled' || j.status === 'in-progress' || j.status === 'on-hold';
export const jobsOn = (d: DB, day: string, store: StoreFilter) =>
  d.jobs.filter((j) => j.start && j.start.slice(0, 10) === day && matchStore(store, j.store) && j.status !== 'cancelled').sort((a, b) => (a.start! < b.start! ? -1 : 1));

/* ---------- Revenue (recognized when the work is done) ---------- */

export interface RevenueEvent {
  day: string;
  store: StoreId;
  category: RevenueCategory;
  amount: number;
}

const revenueCache = new WeakMap<object, RevenueEvent[]>();

/**
 * Every dollar of revenue with the day it was earned: installs and service on the day the job
 * was completed, counter sales on the invoice date. History facts cover the months before the
 * detailed records begin.
 */
export function revenueEvents(d: DB, h: History): RevenueEvent[] {
  const cached = revenueCache.get(d.invoices);
  if (cached && revenueCache.get(h.jobs) === cached) return cached;
  const out: RevenueEvent[] = [];

  const salesByRef = new Map<string, { equipment: number; parts: number; retail: number }>();
  for (const s of h.sales) {
    const ref = s.id.slice(0, s.id.lastIndexOf('-l'));
    const e = salesByRef.get(ref) ?? { equipment: 0, parts: 0, retail: 0 };
    if (s.channel === 'install') e.equipment += s.revenue;
    else e.parts += s.revenue;
    salesByRef.set(ref, e);
  }
  for (const f of h.jobs) {
    if (!f.revenue) continue;
    const s = salesByRef.get(f.id);
    if (f.type === 'install') {
      const equipment = s?.equipment ?? 0;
      // Match live invoices, which bill materials as Parts: use the standard materials for the model
      const cat = d.items.find((i) => i.id === f.group)?.category;
      const materials = Math.min(Math.max(0, f.revenue - equipment), (cat && installStandards[cat]?.materials) || 0);
      out.push({ day: f.day, store: f.store, category: 'Equipment', amount: equipment });
      if (materials) out.push({ day: f.day, store: f.store, category: 'Parts', amount: materials });
      out.push({ day: f.day, store: f.store, category: 'Installation', amount: f.revenue - equipment - materials });
    } else {
      const parts = s?.parts ?? 0;
      if (parts) out.push({ day: f.day, store: f.store, category: 'Parts', amount: parts });
      out.push({ day: f.day, store: f.store, category: 'Service', amount: f.revenue - parts });
    }
  }
  const jobRefs = new Set(h.jobs.map((f) => f.id));
  for (const s of h.sales) {
    if (s.channel !== 'counter') continue;
    const ref = s.id.slice(0, s.id.lastIndexOf('-l'));
    if (jobRefs.has(ref)) continue; // parts already counted with their service visit
    out.push({ day: s.day, store: s.store, category: 'Retail', amount: s.revenue });
  }

  for (const inv of d.invoices) {
    if (inv.kind !== 'invoice' || inv.status === 'draft' || inv.status === 'void') continue;
    const job = inv.jobId ? jobOf(d, inv.jobId) : undefined;
    let day = inv.issuedOn;
    if (job) {
      if (job.status !== 'closed' && job.status !== 'completed') continue;
      day = (job.completedAt ?? inv.issuedOn).slice(0, 10);
    }
    if (day < d.windowStart) continue;
    for (const l of inv.lines) out.push({ day, store: inv.store, category: l.category, amount: l.qty * l.rate });
  }
  revenueCache.set(d.invoices, out);
  revenueCache.set(h.jobs, out);
  return out;
}

export function revenueBetween(events: RevenueEvent[], from: string, to: string, store: StoreFilter) {
  let total = 0;
  for (const e of events) if (inRange(e.day, from, to) && matchStore(store, e.store)) total += e.amount;
  return total;
}

/** Revenue per month (oldest first) for the last `count` months, split by store */
export function monthlyRevenue(events: RevenueEvent[], endDay: string, count: number) {
  const keys: string[] = [];
  let d = `${monthKey(endDay)}-01`;
  for (let i = 0; i < count; i++) {
    keys.unshift(monthKey(d));
    d = addDays(d, -1);
    d = `${monthKey(d)}-01`;
  }
  const rows = keys.map((key) => ({ key, 'osage-beach': 0, nixa: 0 }));
  const idx = new Map(keys.map((k, i) => [k, i]));
  for (const e of events) {
    const i = idx.get(e.day.slice(0, 7));
    if (i !== undefined && e.day <= endDay) rows[i][e.store] += e.amount;
  }
  return rows;
}
