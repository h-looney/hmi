/** Report calculations. Pure functions of the facts, a date range and the store filter. */
import { fuelClass, issues, legacyGroups } from '../../data/catalog';
import type { DB, History, JobFact, StoreFilter, StoreId } from '../../data/types';
import { addDays, diffDays } from '../../lib/dates';
import { available, isOpenJob, matchStore, serviceDueOn, stockStatus, stockValue, STORES } from '../../selectors';
import { avg, groupLabel, median, sum, within, type Facts, type Range } from './facts';
import { reportBrandName, reportItemName } from './standIns';

const SERVICE_TYPES = new Set(['maintenance', 'repair', 'warranty']);
const FIX_TYPES = new Set(['repair', 'warranty']);

/* ---------- Technicians ---------- */

export interface TechRow {
  id: string;
  name: string;
  store: StoreId | 'both';
  title: string;
  installs: number;
  installHours: number;
  installEst: number;
  service: number;
  serviceHours: number;
  serviceEst: number;
  visits: number;
  onTime: number;
  fixes: number;
  callbacks: number;
  revenue: number;
}

export function techStats(d: DB, facts: Facts, range: Range, store: StoreFilter, filter: 'all' | 'install' | 'service' = 'all') {
  const techs = d.staff.filter((s) => s.role === 'tech');
  const rows = new Map<string, TechRow & { _ih: number[]; _ie: number[]; _sh: number[]; _se: number[] }>();
  for (const t of techs) {
    if (store !== 'all' && t.store !== store) continue;
    rows.set(t.id, { id: t.id, name: t.name, store: t.store, title: t.title, installs: 0, installHours: 0, installEst: 0, service: 0, serviceHours: 0, serviceEst: 0, visits: 0, onTime: 0, fixes: 0, callbacks: 0, revenue: 0, _ih: [], _ie: [], _sh: [], _se: [] });
  }
  const inRange = within(facts.jobs, range.from, range.to, store).filter((f) => f.type === 'install' || SERVICE_TYPES.has(f.type));
  const byId = new Map(facts.jobs.map((f) => [f.id, f]));
  for (const f of inRange) {
    const isInstall = f.type === 'install';
    if (filter === 'install' && !isInstall) continue;
    if (filter === 'service' && isInstall) continue;
    f.crew.forEach((techId, i) => {
      const r = rows.get(techId);
      if (!r) return;
      r.visits++;
      if (f.onTime) r.onTime++;
      if (isInstall) {
        r.installs++;
        r._ih.push(f.hours);
        r._ie.push(f.estHours);
      } else {
        r.service++;
        r._sh.push(f.hours);
        r._se.push(f.estHours);
        if (FIX_TYPES.has(f.type) && !f.callback) r.fixes++;
      }
      if (i === 0) r.revenue += f.revenue;
    });
    if (f.callbackOf) {
      const original = byId.get(f.callbackOf);
      const r = original ? rows.get(original.crew[0]) : undefined;
      if (r && original && original.day >= range.from) r.callbacks++;
    }
  }
  return [...rows.values()]
    .map(({ _ih, _ie, _sh, _se, ...r }) => ({ ...r, installHours: avg(_ih), installEst: avg(_ie), serviceHours: avg(_sh), serviceEst: avg(_se) }))
    .filter((r) => r.visits > 0);
}

/* ---------- Reliability (problem units) ---------- */

export interface GroupRow {
  key: string;
  label: string;
  brand: string;
  category: string;
  legacy: boolean;
  base: number;
  calls: number;
  warranty: number;
  callbacks: number;
  per100: number;
  topIssue?: string;
  topIssueShare: number;
}

/** Installed units per model / legacy group at a given day (units outside the registry are split by store share) */
export function installedBase(d: DB, h: History, day: string, store: StoreFilter = 'all') {
  const share = store === 'all' ? 1 : store === 'osage-beach' ? 0.55 : 0.45;
  const counts: Record<string, number> = {};
  for (const [g, n] of Object.entries(h.base)) counts[g] = n * share;
  const storeOf = new Map(d.customers.map((c) => [c.id, c.store]));
  for (const u of d.units) {
    if (u.installedOn > day || (store !== 'all' && storeOf.get(u.customerId) !== store)) continue;
    const g = u.itemId ?? u.legacyGroup;
    if (g) counts[g] = (counts[g] ?? 0) + 1;
  }
  return counts;
}

export function reliability(d: DB, h: History, facts: Facts, range: Range, store: StoreFilter, by: 'model' | 'brand' | 'category') {
  const base = installedBase(d, h, range.to, store);
  const calls = within(facts.jobs, range.from, range.to, store).filter((f) => FIX_TYPES.has(f.type) && f.group);
  const keyOf = (g: string) => {
    if (by === 'model') return g;
    const info = groupLabel(d, g);
    return by === 'brand' ? (info.legacy ? 'Installed by others' : info.brand) : info.category;
  };
  const acc = new Map<string, { base: number; calls: number; warranty: number; callbacks: number; issues: Map<string, number>; legacy: boolean; brand: string; category: string; label: string }>();
  const ensure = (g: string) => {
    const k = keyOf(g);
    let a = acc.get(k);
    if (!a) {
      const info = groupLabel(d, g);
      a = { base: 0, calls: 0, warranty: 0, callbacks: 0, issues: new Map(), legacy: info.legacy, brand: by === 'model' ? info.brand : '', category: by === 'model' ? info.category : '', label: by === 'model' ? info.label : k };
      acc.set(k, a);
    }
    return a;
  };
  for (const [g, n] of Object.entries(base)) ensure(g).base += n;
  for (const f of calls) {
    const a = ensure(f.group!);
    a.calls++;
    if (f.type === 'warranty') a.warranty++;
    if (f.callback) a.callbacks++;
    if (f.issue) a.issues.set(f.issue, (a.issues.get(f.issue) ?? 0) + 1);
  }
  const yearFactor = 365 / Math.max(1, range.days);
  const rows: GroupRow[] = [...acc.entries()].map(([key, a]) => {
    const top = [...a.issues.entries()].sort((x, y) => y[1] - x[1])[0];
    return {
      key,
      label: a.label,
      brand: a.brand,
      category: a.category,
      legacy: a.legacy,
      base: Math.round(a.base),
      calls: a.calls,
      warranty: a.warranty,
      callbacks: a.callbacks,
      per100: a.base ? (a.calls / a.base) * 100 * yearFactor : 0,
      topIssue: top ? issues[top[0]]?.label : undefined,
      topIssueShare: top ? top[1] / a.calls : 0,
    };
  });
  const totalBase = sum(rows.map((r) => r.base));
  const fleet = totalBase ? (sum(rows.map((r) => r.calls)) / totalBase) * 100 * yearFactor : 0;
  return { rows: rows.filter((r) => r.base > 0), fleet, calls };
}

export function topCounts(list: JobFact[], key: 'issue' | 'part') {
  const m = new Map<string, number>();
  for (const f of list) {
    const k = f[key];
    if (k) m.set(k, (m.get(k) ?? 0) + 1);
  }
  return [...m.entries()].sort((a, b) => b[1] - a[1]);
}

/** Appliances with 3+ repair or warranty visits in the last 12 months */
export function repeatUnits(d: DB, facts: Facts, today: string, store: StoreFilter) {
  const since = addDays(today, -365);
  const byUnit = new Map<string, JobFact[]>();
  for (const f of facts.jobs) {
    if (!f.unitId || !FIX_TYPES.has(f.type) || f.day < since || f.day > today || !matchStore(store, f.store)) continue;
    byUnit.set(f.unitId, [...(byUnit.get(f.unitId) ?? []), f]);
  }
  return [...byUnit.entries()]
    .filter(([, list]) => list.length >= 3)
    .map(([unitId, list]) => {
      const sorted = [...list].sort((a, b) => (a.day < b.day ? 1 : -1));
      const unit = d.units.find((u) => u.id === unitId)!;
      return { unit, visits: list.length, last: sorted[0], customer: d.customers.find((c) => c.id === unit?.customerId) };
    })
    .filter((r) => r.unit)
    .sort((a, b) => b.visits - a.visits || (a.last.day < b.last.day ? 1 : -1));
}

/* ---------- Best sellers ---------- */

export interface SellerRow {
  key: string;
  label: string;
  brand: string;
  category: string;
  units: number;
  revenue: number;
  cost: number;
  margin: number;
  avgPrice: number;
  byStore: Record<StoreId, number>;
  available?: number;
  daysOfSupply?: number;
  itemId?: string;
}

export function bestSellers(d: DB, facts: Facts, range: Range, store: StoreFilter, by: 'model' | 'brand' | 'category', kind: 'unit' | 'all' = 'unit') {
  const itemById = new Map(d.items.map((i) => [i.id, i]));
  const acc = new Map<string, SellerRow>();
  for (const s of within(facts.sales, range.from, range.to, store)) {
    const it = itemById.get(s.itemId);
    if (!it || (kind === 'unit' && it.kind !== 'unit')) continue;
    const key = by === 'model' ? it.id : by === 'brand' ? it.brand : it.category;
    let r = acc.get(key);
    if (!r) {
      // Models and brands under their stand-in names: the sales are invented (standIns.ts)
      const label = by === 'model' ? reportItemName(d, it) : by === 'brand' ? reportBrandName(d, it.brand) : key;
      r = { key, label, brand: by === 'model' ? reportBrandName(d, it.brand) : '', category: by === 'model' ? it.category : '', units: 0, revenue: 0, cost: 0, margin: 0, avgPrice: 0, byStore: { 'osage-beach': 0, nixa: 0 }, itemId: by === 'model' ? it.id : undefined };
      acc.set(key, r);
    }
    r.units += s.qty;
    r.revenue += s.revenue;
    r.cost += s.cost;
    r.byStore[s.store] += s.qty;
  }
  const rows = [...acc.values()].map((r) => {
    const it = r.itemId ? itemById.get(r.itemId) : undefined;
    const avail = it ? (store === 'all' ? STORES : [store]).reduce((n, st) => n + Math.max(0, available(it, st)), 0) : undefined;
    const perDay = r.units / Math.max(1, range.days);
    return { ...r, margin: r.revenue ? (r.revenue - r.cost) / r.revenue : 0, avgPrice: r.units ? r.revenue / r.units : 0, available: avail, daysOfSupply: avail !== undefined && perDay > 0 ? avail / perDay : undefined };
  });
  return rows;
}

/* ---------- Leads ---------- */

export function leadStats(facts: Facts, range: Range, store: StoreFilter) {
  const list = within(facts.leads, range.from, range.to, store);
  const decided = (l: typeof list) => l.filter((x) => x.outcome === 'won' || x.outcome === 'lost' || x.outcome === 'closed');
  const winRate = (l: typeof list) => {
    const dd = decided(l);
    return dd.length ? dd.filter((x) => x.outcome === 'won').length / dd.length : 0;
  };
  const responses = list.filter((l) => l.responseMins !== undefined).map((l) => l.responseMins!);
  const sources = new Map<string, typeof list>();
  for (const l of list) sources.set(l.source, [...(sources.get(l.source) ?? []), l]);
  const quotes = list.filter((l) => l.kind === 'quote' && l.responseMins !== undefined);
  const buckets = [
    { key: '1h', label: 'Within an hour', test: (m: number) => m <= 60 },
    { key: '4h', label: '1–4 hours', test: (m: number) => m > 60 && m <= 240 },
    { key: '24h', label: '4–24 hours', test: (m: number) => m > 240 && m <= 1440 },
    { key: 'later', label: 'More than a day', test: (m: number) => m > 1440 },
  ].map((b) => {
    const inB = quotes.filter((l) => b.test(l.responseMins!));
    return { ...b, count: inB.length, winRate: winRate(inB), decided: decided(inB).length };
  });
  return {
    list,
    total: list.length,
    quotes: list.filter((l) => l.kind === 'quote').length,
    service: list.filter((l) => l.kind === 'service').length,
    winRate: winRate(list.filter((l) => l.kind !== 'question')),
    quoteWinRate: winRate(list.filter((l) => l.kind === 'quote')),
    medianResponse: median(responses),
    wonValue: sum(list.filter((l) => l.outcome === 'won' && l.kind === 'quote').map((l) => l.value)),
    open: list.filter((l) => l.outcome === 'open').length,
    bySource: [...sources.entries()].map(([source, l]) => ({
      source,
      total: l.length,
      won: l.filter((x) => x.outcome === 'won').length,
      lost: l.filter((x) => x.outcome === 'lost').length,
      closed: l.filter((x) => x.outcome === 'closed').length,
      open: l.filter((x) => x.outcome === 'open').length,
      winRate: winRate(l.filter((x) => x.kind !== 'question')),
      medianResponse: l.some((x) => x.responseMins !== undefined) ? median(l.filter((x) => x.responseMins !== undefined).map((x) => x.responseMins!)) : undefined,
      wonValue: sum(l.filter((x) => x.outcome === 'won' && x.kind === 'quote').map((x) => x.value)),
    })),
    buckets,
  };
}

/* ---------- Inventory health ---------- */

export function inventoryHealth(d: DB, facts: Facts, range: Range, store: StoreFilter, today: string) {
  const sold = new Map<string, number>();
  const lastSale = new Map<string, string>();
  for (const s of facts.sales) {
    if (!matchStore(store, s.store) || s.day > today) continue;
    if (s.day >= range.from && s.day <= range.to) sold.set(s.itemId, (sold.get(s.itemId) ?? 0) + s.qty);
    if ((lastSale.get(s.itemId) ?? '') < s.day) lastSale.set(s.itemId, s.day);
  }
  const stores = store === 'all' ? STORES : [store];
  return d.items.map((it) => {
    const onHand = stores.reduce((n, s) => n + it.stock[s].onHand, 0);
    const avail = stores.reduce((n, s) => n + Math.max(0, available(it, s)), 0);
    const qty = sold.get(it.id) ?? 0;
    const perDay = qty / Math.max(1, range.days);
    const last = lastSale.get(it.id);
    const idle = last ? diffDays(today, last) : 999;
    const status = stockStatus(it, store);
    const daysOfSupply = perDay > 0 ? avail / perDay : undefined;
    const health: 'out' | 'low' | 'slow' | 'overstock' | 'healthy' | 'special' =
      status === 'special' ? 'special' : status === 'out' ? 'out' : status === 'low' ? 'low' : onHand > 0 && idle > 120 ? 'slow' : daysOfSupply !== undefined && daysOfSupply > 180 && it.kind === 'unit' ? 'overstock' : 'healthy';
    return { item: it, onHand, available: avail, sold: qty, lastSale: last, idle, value: stockValue(it, store), daysOfSupply, health, byStore: Object.fromEntries(stores.map((s) => [s, it.stock[s].onHand])) as Partial<Record<StoreId, number>> };
  });
}

/* ---------- Maintenance due ---------- */

export function serviceDue(d: DB, today: string, store: StoreFilter) {
  const scheduled = new Map<string, string>();
  for (const j of d.jobs) if (j.unitId && j.type === 'maintenance' && isOpenJob(j)) scheduled.set(j.unitId, j.start ?? '');
  const reminders = new Map<string, string>();
  for (const r of d.reminders) if ((reminders.get(r.unitId) ?? '') < r.at) reminders.set(r.unitId, r.at);
  const prices = d.settings.annualService;
  return d.units
    .filter((u) => fuelClass(u.fuel) !== 'electric')
    .map((u) => {
      const customer = d.customers.find((c) => c.id === u.customerId)!;
      const due = serviceDueOn(u);
      const fc = fuelClass(u.fuel);
      return {
        unit: u,
        customer,
        due,
        days: diffDays(due, today),
        scheduledFor: scheduled.get(u.id),
        remindedAt: reminders.get(u.id),
        price: fc === 'wood' ? prices.wood : fc === 'pellet' ? prices.pellet : prices.gas,
        legacy: !!(u.legacyGroup && legacyGroups[u.legacyGroup]),
      };
    })
    .filter((r) => r.customer && matchStore(store, r.customer.store));
}
