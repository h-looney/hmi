/**
 * Facts behind the reports: the analytics history (older months) plus the same shapes derived
 * from today's live records, so edits made in the demo show up in the numbers.
 */
import { legacyGroups } from '../../data/catalog';
import type { DB, History, JobFact, LeadFact, RangeKey, SaleFact, StoreFilter, StoreId } from '../../data/types';
import { addDays, diffDays, diffMinutes, monthKey, startOfWeek, startOfYear } from '../../lib/dates';
import { monthShort, shortDate } from '../../lib/format';
import { invoiceTotals, itemLabel, matchStore } from '../../selectors';

export interface Facts {
  jobs: JobFact[];
  sales: SaleFact[];
  leads: LeadFact[];
}

const cache = new WeakMap<object, { key: unknown[]; facts: Facts }>();

export function allFacts(d: DB, h: History): Facts {
  const key = [d.jobs, d.invoices, d.leads, h];
  const hit = cache.get(h);
  if (hit && hit.key.every((k, i) => k === key[i])) return hit.facts;

  const jobs: JobFact[] = [...h.jobs];
  const unitById = new Map(d.units.map((u) => [u.id, u]));
  const itemById = new Map(d.items.map((i) => [i.id, i]));
  const invoiceById = new Map(d.invoices.map((i) => [i.id, i]));

  for (const j of d.jobs) {
    if ((j.status !== 'completed' && j.status !== 'closed') || !j.completedAt) continue;
    const day = j.completedAt.slice(0, 10);
    if (day < d.windowStart) continue;
    const started = j.startedAt ?? j.start ?? j.completedAt;
    const unit = j.unitId ? unitById.get(j.unitId) : undefined;
    const inv = j.invoiceId ? invoiceById.get(j.invoiceId) : undefined;
    const usedPart = j.parts.find((p) => p.status === 'used' && itemById.get(p.itemId)?.kind === 'part');
    jobs.push({
      id: j.id,
      day,
      store: j.store,
      type: j.type,
      crew: j.crew,
      hours: Math.max(0.25, Math.round((diffMinutes(j.completedAt, started) / 60) * 4) / 4),
      estHours: j.hours,
      onTime: j.start ? diffMinutes(started, j.start) <= 15 : true,
      unitId: j.unitId,
      customerId: j.customerId,
      group: unit ? unit.itemId ?? unit.legacyGroup : j.itemId,
      issue: j.issue,
      part: usedPart?.itemId,
      callback: !!j.callbackOf,
      callbackOf: j.callbackOf,
      revenue: inv ? invoiceTotals(inv).subtotal : j.value ?? 0,
    });
  }

  const sales: SaleFact[] = [...h.sales];
  const jobById = new Map(d.jobs.map((j) => [j.id, j]));
  for (const inv of d.invoices) {
    if (inv.kind !== 'invoice' || inv.status === 'draft' || inv.status === 'void') continue;
    const job = inv.jobId ? jobById.get(inv.jobId) : undefined;
    let day = inv.issuedOn;
    if (job) {
      if (job.status !== 'completed' && job.status !== 'closed') continue;
      day = (job.completedAt ?? inv.issuedOn).slice(0, 10);
    }
    if (day < d.windowStart) continue;
    for (const l of inv.lines) {
      if (!l.itemId) continue;
      const it = itemById.get(l.itemId);
      if (!it) continue;
      sales.push({ id: `${inv.id}-${l.id}`, day, store: inv.store, itemId: it.id, qty: l.qty, revenue: l.qty * l.rate, cost: l.qty * it.cost, channel: job?.type === 'install' ? 'install' : 'counter' });
    }
  }

  const leads: LeadFact[] = [...h.leads];
  for (const l of d.leads) {
    const day = l.receivedAt.slice(0, 10);
    if (day < d.windowStart) continue;
    const instant = l.source === 'phone' || l.source === 'walk-in';
    leads.push({
      id: l.id,
      day,
      store: l.store,
      source: l.source,
      kind: l.kind,
      outcome: l.stage === 'won' ? 'won' : l.stage === 'lost' ? 'lost' : l.stage === 'closed' ? 'closed' : 'open',
      responseMins: instant ? undefined : l.firstResponseAt ? Math.max(0, diffMinutes(l.firstResponseAt, l.receivedAt)) : undefined,
      value: l.value ?? 0,
    });
  }

  const facts = { jobs, sales, leads };
  cache.set(h, { key, facts });
  return facts;
}

/* ---------- Date ranges ---------- */

export interface Range {
  from: string;
  to: string;
  label: string;
  days: number;
  /** Same dates a year earlier, when the data covers them */
  prev?: { from: string; to: string };
}

export const rangeOptions: { key: RangeKey; label: string }[] = [
  { key: '30d', label: 'Last 30 days' },
  { key: '90d', label: 'Last 90 days' },
  { key: 'season', label: 'This heating season' },
  { key: 'ytd', label: 'Year to date' },
  { key: '12m', label: 'Last 12 months' },
  { key: 'custom', label: 'Custom range' },
];

export function resolveRange(key: RangeKey, today: string, dataStart: string, from?: string, to?: string): Range {
  let f: string;
  let t = today;
  let label: string;
  switch (key) {
    case '30d':
      f = addDays(today, -29);
      label = 'Last 30 days';
      break;
    case 'season': {
      const y = +today.slice(0, 4);
      f = +today.slice(5, 7) >= 9 ? `${y}-09-01` : `${y - 1}-09-01`;
      label = `Heating season (since ${shortDate(f)})`;
      break;
    }
    case 'ytd':
      f = startOfYear(today);
      label = 'Year to date';
      break;
    case '12m':
      f = addDays(today, -364);
      label = 'Last 12 months';
      break;
    case 'custom':
      f = from && from >= dataStart ? from : addDays(today, -89);
      t = to && to <= today && to >= f ? to : today;
      label = `${shortDate(f)} – ${shortDate(t)}`;
      break;
    default:
      f = addDays(today, -89);
      label = 'Last 90 days';
  }
  if (f < dataStart) f = dataStart;
  const days = diffDays(t, f) + 1;
  const prevFrom = `${+f.slice(0, 4) - 1}${f.slice(4)}`;
  const prevTo = `${+t.slice(0, 4) - 1}${t.slice(4)}`;
  return { from: f, to: t, label, days, prev: prevFrom >= dataStart ? { from: prevFrom, to: prevTo } : undefined };
}

export const within = <T extends { day: string; store: StoreId }>(list: T[], from: string, to: string, store: StoreFilter) =>
  list.filter((x) => x.day >= from && x.day <= to && matchStore(store, x.store));

/** Buckets for time charts: weeks for short ranges, months otherwise */
export function timeBuckets(from: string, to: string) {
  const days = diffDays(to, from) + 1;
  const buckets: { key: string; label: string; title: string; from: string; to: string }[] = [];
  if (days <= 120) {
    for (let s = startOfWeek(from); s <= to; s = addDays(s, 7)) {
      const e = addDays(s, 6);
      buckets.push({ key: s, label: shortDate(s > from ? s : from).replace(/, \d{4}$/, ''), title: `Week of ${shortDate(s)}`, from: s < from ? from : s, to: e > to ? to : e });
    }
    // Fold a stub first week (a few days) into the next so it doesn't read as a drop
    if (buckets.length > 2 && diffDays(buckets[0].to, buckets[0].from) < 3) {
      const [stub, next] = buckets;
      buckets.splice(0, 2, { ...next, label: shortDate(stub.from).replace(/, \d{4}$/, ''), title: `${shortDate(stub.from)} – ${shortDate(next.to)}`, from: stub.from });
    }
  } else {
    let s = `${monthKey(from)}-01`;
    while (s <= to) {
      const next = `${monthKey(addDays(s, 32))}-01`;
      const e = addDays(next, -1);
      buckets.push({ key: monthKey(s), label: monthShort(monthKey(s)), title: `${monthShort(monthKey(s))} ${s.slice(0, 4)}`, from: s < from ? from : s, to: e > to ? to : e });
      s = next;
    }
  }
  return buckets;
}

export const bucketIndex = (buckets: { from: string; to: string }[], day: string) => buckets.findIndex((b) => day >= b.from && day <= b.to);

/* ---------- Labels ---------- */

export function groupLabel(d: DB, group: string | undefined): { label: string; brand: string; category: string; legacy: boolean } {
  if (!group) return { label: 'Unknown', brand: '—', category: '—', legacy: false };
  const legacy = legacyGroups[group];
  if (legacy) return { label: legacy.label, brand: 'Other', category: legacy.category, legacy: true };
  const it = d.items.find((i) => i.id === group);
  return it ? { label: itemLabel(it), brand: it.brand, category: it.category, legacy: false } : { label: group, brand: '—', category: '—', legacy: false };
}

export const median = (values: number[]) => {
  if (!values.length) return 0;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
};

export const avg = (values: number[]) => (values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0);
export const sum = (values: number[]) => values.reduce((a, b) => a + b, 0);

/** Download rows as a CSV file (client-side only) */
export function downloadCSV(filename: string, rows: (string | number)[][]) {
  const csv = rows.map((r) => r.map((v) => (typeof v === 'number' ? String(v) : `"${String(v).replace(/"/g, '""')}"`)).join(',')).join('\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
