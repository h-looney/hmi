/**
 * Accounting helpers: cost of goods, operating expenses, report periods, bills, printing and
 * CSV export. Data changes here go through mutate/edit like the shared actions.
 */
import type { Bill, DB, ExpenseCategory, History, Invoice, RevenueCategory, StoreFilter, StoreId } from '../../data/types';
import { addMonths, diffDays, endOfMonth, inRange, monthKey, now, startOfMonth, startOfYear, today } from '../../lib/dates';
import { monthLong, shortDate } from '../../lib/format';
import { invoiceTotals, jobOf, matchStore, revenueBetween, type RevenueEvent } from '../../selectors';
import { edit, mutate, nextId, uid } from '../../store';

export const REVENUE_CATEGORIES: RevenueCategory[] = ['Equipment', 'Installation', 'Service', 'Parts', 'Retail'];

export const OPEX_CATEGORIES: ExpenseCategory[] = [
  'Payroll',
  'Rent & utilities',
  'Vehicles & fuel',
  'Insurance',
  'Marketing',
  'Supplies & tools',
  'Professional services',
  'Software & fees',
];

export const EXPENSE_CATEGORIES: ExpenseCategory[] = ['Inventory purchases', ...OPEX_CATEGORIES];

export const TXN_CATEGORIES = [
  'Customer payments',
  'Inventory purchases',
  'Payroll',
  'Rent & utilities',
  'Vehicles & fuel',
  'Insurance',
  'Marketing',
  'Supplies & tools',
  'Professional services',
  'Software & fees',
  'Sales tax',
  'Transfer',
  'Other income',
  'Owner contribution',
  'Uncategorized',
];

/** A sensible QuickBooks chart of accounts for the mapping table */
export const CHART_OF_ACCOUNTS: { group: string; accounts: string[] }[] = [
  {
    group: 'Income',
    accounts: ['4000 Sales: Hearth equipment', '4100 Sales: Installation', '4200 Sales: Service', '4300 Sales: Parts & materials', '4400 Sales: Retail', '4900 Other income'],
  },
  { group: 'Cost of goods sold', accounts: ['5000 Cost of goods sold', '5100 Installation materials', '5200 Freight in'] },
  { group: 'Liabilities', accounts: ['2200 Sales tax payable', '2300 Customer deposits', '2400 Accrued warranty'] },
  { group: 'Assets', accounts: ['1000 Operating checking', '1050 Undeposited funds', '1200 Inventory asset', '1300 Warranty claims receivable'] },
];

/* ---------- Cost of goods (recognized like revenue: when the work is done) ---------- */

export interface CostEvent {
  day: string;
  store: StoreId;
  amount: number;
}

const cogsCache = new WeakMap<object, CostEvent[]>();

export function cogsEvents(d: DB, h: History): CostEvent[] {
  const cached = cogsCache.get(d.invoices);
  if (cached && cogsCache.get(h.sales) === cached) return cached;
  const out: CostEvent[] = h.sales.map((s) => ({ day: s.day, store: s.store, amount: s.cost }));
  const items = new Map(d.items.map((i) => [i.id, i]));
  for (const inv of d.invoices) {
    if (inv.kind !== 'invoice' || inv.status === 'draft' || inv.status === 'void') continue;
    const job = inv.jobId ? jobOf(d, inv.jobId) : undefined;
    let day = inv.issuedOn;
    if (job) {
      if (job.status !== 'closed' && job.status !== 'completed') continue;
      day = (job.completedAt ?? inv.issuedOn).slice(0, 10);
    }
    if (day < d.windowStart) continue;
    for (const l of inv.lines) {
      const it = l.itemId ? items.get(l.itemId) : undefined;
      if (it) out.push({ day, store: inv.store, amount: l.qty * it.cost });
    }
  }
  cogsCache.set(d.invoices, out);
  cogsCache.set(h.sales, out);
  return out;
}

export const costBetween = (events: CostEvent[], from: string, to: string, store: StoreFilter) =>
  events.reduce((s, e) => (inRange(e.day, from, to) && matchStore(store, e.store) ? s + e.amount : s), 0);

/** Revenue in a range, split by category */
export function revenueByCategory(events: RevenueEvent[], from: string, to: string, store: StoreFilter): Record<RevenueCategory, number> {
  const out = Object.fromEntries(REVENUE_CATEGORIES.map((c) => [c, 0])) as Record<RevenueCategory, number>;
  for (const e of events) if (inRange(e.day, from, to) && matchStore(store, e.store)) out[e.category] += e.amount;
  return out;
}

/** Month keys (YYYY-MM) covering a day range */
export function monthKeys(from: string, to: string): string[] {
  const keys: string[] = [];
  for (let d = startOfMonth(from); d <= to; d = addMonths(d, 1)) keys.push(monthKey(d));
  return keys;
}

/** Operating expenses by category for whole months (the current month is to date) */
export function opexFor(h: History, months: string[], store: StoreFilter): Record<ExpenseCategory, number> {
  const set = new Set(months);
  const out = Object.fromEntries(OPEX_CATEGORIES.map((c) => [c, 0])) as Record<ExpenseCategory, number>;
  for (const m of h.months) {
    if (!set.has(m.month) || !matchStore(store, m.store)) continue;
    for (const [k, v] of Object.entries(m.opex)) out[k as ExpenseCategory] = (out[k as ExpenseCategory] ?? 0) + (v ?? 0);
  }
  return out;
}

export const sum = (values: Iterable<number>) => {
  let s = 0;
  for (const v of values) s += v;
  return s;
};

/** Profit & loss for a period and store */
export function profitAndLoss(h: History, revenue: RevenueEvent[], cogs: CostEvent[], from: string, to: string, store: StoreFilter) {
  const rev = revenueByCategory(revenue, from, to, store);
  const revenueTotal = sum(Object.values(rev));
  const cost = costBetween(cogs, from, to, store);
  const opex = opexFor(h, monthKeys(from, to), store);
  const opexTotal = sum(Object.values(opex));
  const gross = revenueTotal - cost;
  return { rev, revenueTotal, cost, gross, opex, opexTotal, net: gross - opexTotal };
}

/** Income and expenses (operating + cost of goods) for one calendar month */
export function monthTotals(h: History, revenue: RevenueEvent[], cogs: CostEvent[], key: string, store: StoreFilter, until = today()) {
  const from = `${key}-01`;
  const to = endOfMonth(from) < until ? endOfMonth(from) : until;
  const income = revenueBetween(revenue, from, to, store);
  const expenses = costBetween(cogs, from, to, store) + sum(Object.values(opexFor(h, [key], store)));
  return { income, expenses };
}

/* ---------- Report periods ---------- */

export type PeriodKey = 'month' | 'last-month' | 'quarter' | 'ytd';

export const PERIODS: { key: PeriodKey; label: string }[] = [
  { key: 'month', label: 'This month' },
  { key: 'last-month', label: 'Last month' },
  { key: 'quarter', label: 'This quarter' },
  { key: 'ytd', label: 'Year to date' },
];

export function periodRange(key: PeriodKey, t = today()): { from: string; to: string; label: string } {
  switch (key) {
    case 'last-month': {
      const s = addMonths(startOfMonth(t), -1);
      return { from: s, to: endOfMonth(s), label: monthLong(monthKey(s)) };
    }
    case 'quarter': {
      const q = Math.floor((+t.slice(5, 7) - 1) / 3);
      return { from: `${t.slice(0, 4)}-${String(q * 3 + 1).padStart(2, '0')}-01`, to: t, label: `Q${q + 1} ${t.slice(0, 4)} to date` };
    }
    case 'ytd':
      return { from: startOfYear(t), to: t, label: `${t.slice(0, 4)} year to date` };
    default:
      return { from: startOfMonth(t), to: t, label: `${monthLong(monthKey(t))} to date` };
  }
}

/* ---------- Receivables ---------- */

/** Is this invoice a real receivable? (Deposits on installs that haven't happened yet aren't.) */
export function isReceivable(d: DB, inv: Invoice) {
  if (inv.kind !== 'invoice' || inv.status === 'draft' || inv.status === 'void') return false;
  if (invoiceTotals(inv).balance <= 0.004) return false;
  const job = inv.jobId ? jobOf(d, inv.jobId) : undefined;
  return !(job && job.type === 'install' && job.status !== 'closed' && job.status !== 'completed');
}

export const isDeposit = (d: DB, inv: Invoice) => {
  const job = inv.jobId ? jobOf(d, inv.jobId) : undefined;
  return !!job && job.type === 'install' && job.status !== 'closed' && job.status !== 'completed' && inv.kind === 'invoice';
};

/* ---------- Bills ---------- */

export type BillState = 'open' | 'scheduled' | 'overdue' | 'paid';

export const billState = (b: Bill, t = today()): BillState => (b.status === 'paid' ? 'paid' : b.status === 'scheduled' ? 'scheduled' : b.dueOn < t ? 'overdue' : 'open');

export function createBill(input: Omit<Bill, 'id' | 'status'>): string {
  let id = '';
  mutate((d) => {
    id = nextId(d, 'bill', 'B');
    const bill: Bill = { ...input, id, status: 'open', amount: Math.round(input.amount * 100) / 100 };
    if (d.books.connected && d.books.autoSync && d.books.sync.bills) {
      bill.syncedAt = now();
      const vendor = d.vendors.find((v) => v.id === input.vendorId)?.name ?? 'vendor';
      d.books = { ...d.books, lastSyncAt: now(), log: [{ id: uid('q'), at: now(), level: 'ok' as const, text: `Bill ${input.number} from ${vendor} sent to QuickBooks` }, ...d.books.log].slice(0, 60) };
    }
    d.bills = [bill, ...d.bills];
  });
  return id;
}

/* ---------- Invoices ---------- */

/** Attach a new invoice to the job it bills, closing the job once it's done. */
export function linkInvoiceToJob(invoiceId: string, jobId: string) {
  mutate((d) =>
    edit(d.jobs, jobId, (j) => {
      j.invoiceId = invoiceId;
      if (j.status === 'completed') j.status = 'closed';
      j.notes.push({ id: uid('a'), at: now(), by: 'system', kind: 'status', text: `Invoice ${invoiceId} created` });
    }),
  );
}

/** Record a QuickBooks sync for a document when auto-sync is on. */
export function markSynced(invoiceId: string, text: string) {
  mutate((d) => {
    if (!d.books.connected || !d.books.autoSync || !d.books.sync.invoices) return;
    const at = now();
    d.books = { ...d.books, lastSyncAt: at, log: [{ id: uid('q'), at, level: 'ok' as const, text }, ...d.books.log].slice(0, 60) };
    edit(d.invoices, invoiceId, (i) => (i.syncedAt = at));
  });
}

/* ---------- Banking ---------- */

/** Mark everything on an account through a date as reviewed (simulated reconciliation). */
export function reconcileAccount(accountId: string, through: string) {
  mutate((d) => {
    d.txns = d.txns.map((t) => (t.accountId === accountId && t.date <= through && !t.reviewed ? { ...t, reviewed: true, category: t.category ?? 'Uncategorized' } : t));
  });
}

/* ---------- Files ---------- */

const csvCell = (v: string | number | undefined) => {
  const s = String(v ?? '');
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export function downloadCsv(filename: string, rows: (string | number | undefined)[][]) {
  const csv = rows.map((r) => r.map(csvCell).join(',')).join('\r\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const escapeHtml = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

/** Print one element on its own (invoice, estimate or report) via a hidden frame. */
export function printElement(el: HTMLElement, title: string) {
  const styles = Array.from(document.querySelectorAll('link[rel="stylesheet"], style'))
    .map((n) => n.outerHTML)
    .join('\n');
  const frame = document.createElement('iframe');
  frame.setAttribute('aria-hidden', 'true');
  frame.tabIndex = -1;
  Object.assign(frame.style, { position: 'fixed', right: '0', bottom: '0', width: '0', height: '0', border: '0', visibility: 'hidden' });
  frame.addEventListener('load', () =>
    setTimeout(() => {
      frame.contentWindow?.focus();
      frame.contentWindow?.print();
      setTimeout(() => frame.remove(), 1500);
    }, 300),
  );
  frame.srcdoc = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${escapeHtml(title)}</title>${styles}<style>html,body{background:#fff !important;margin:0}body{padding:28px}.no-print{display:none !important}</style></head><body class="print-frame">${el.outerHTML}</body></html>`;
  document.body.append(frame);
}

/** Days between two dates, shown as "in 5 days" style text elsewhere — kept here for CSV */
export const isoDay = (s?: string) => (s ? s.slice(0, 10) : '');

/** Day-level "when" for date-only values: today · yesterday · 3 days ago · Oct 12 */
export function whenDay(day: string, t = today()) {
  const n = diffDays(t, day);
  if (n <= 0) return 'today';
  if (n === 1) return 'yesterday';
  if (n < 7) return `${n} days ago`;
  return shortDate(day);
}
