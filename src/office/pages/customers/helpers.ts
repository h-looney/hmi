/**
 * Customer & warranty helpers: per-customer roll-ups, merged service history (live jobs plus
 * the analytics history), the activity timeline, and adding equipment by hand.
 */
import { issues, legacyGroups } from '../../data/catalog';
import type { Activity, Customer, DB, Fuel, History, ItemCategory, JobFact, JobStatus, JobType, Unit } from '../../data/types';
import { addDays, diffDays, diffMinutes, today } from '../../lib/dates';
import { money, plural } from '../../lib/format';
import { invoiceTotals, itemLabel, itemOf, jobDay, serviceDueOn, unitLabel, unitOf } from '../../selectors';
import { mutate, nextId } from '../../store';

export const kindLabels: Record<Customer['kind'], string> = { homeowner: 'Homeowner', builder: 'Builder', business: 'Business' };
export const contactPrefLabels: Record<Customer['contactPref'], string> = { phone: 'Phone call', email: 'Email', text: 'Text message' };
export const methodLabels = { card: 'card', check: 'check', cash: 'cash', ach: 'bank transfer', financing: 'financing' } as const;

/** Tags offered when editing a customer (plus any already in use) */
export const suggestedTags = ['Lake home', 'Second home', 'Builder', 'Net 30', 'VIP', 'Condo', 'Commercial', 'Pet in home', 'Gate code'];

/* ---------- Roll-ups ---------- */

export interface CustomerSummary {
  units: Unit[];
  lastService?: string;
  /** Balance due now — deposits on installs that haven't happened yet don't count */
  open: number;
  overdue: number;
  /** Next annual service date across their (non-electric) appliances */
  nextServiceDue?: string;
  /** Annual service due within 60 days, or overdue */
  dueForService: boolean;
}

const summaryCache = new WeakMap<DB, Map<string, CustomerSummary>>();

export function customerSummaries(d: DB): Map<string, CustomerSummary> {
  const cached = summaryCache.get(d);
  if (cached) return cached;
  const t = today();
  const horizon = addDays(t, 60);
  const map = new Map<string, CustomerSummary>();
  const get = (id: string) => {
    let s = map.get(id);
    if (!s) {
      s = { units: [], open: 0, overdue: 0, dueForService: false };
      map.set(id, s);
    }
    return s;
  };
  for (const u of d.units) {
    const s = get(u.customerId);
    s.units.push(u);
    if (u.lastServiceOn && (!s.lastService || u.lastServiceOn > s.lastService)) s.lastService = u.lastServiceOn;
    if (u.fuel !== 'Electric') {
      const due = serviceDueOn(u);
      if (!s.nextServiceDue || due < s.nextServiceDue) s.nextServiceDue = due;
      if (due <= horizon) s.dueForService = true;
    }
  }
  const jobs = new Map(d.jobs.map((j) => [j.id, j]));
  for (const inv of d.invoices) {
    if (inv.kind !== 'invoice' || inv.status === 'draft' || inv.status === 'void') continue;
    const { balance } = invoiceTotals(inv);
    if (balance <= 0.004) continue;
    const job = inv.jobId ? jobs.get(inv.jobId) : undefined;
    if (job && job.type === 'install' && job.status !== 'closed' && job.status !== 'completed') continue;
    const s = get(inv.customerId);
    s.open += balance;
    if (inv.dueOn < t) s.overdue += balance;
  }
  summaryCache.set(d, map);
  return map;
}

/** Everything a customer has spent with HMI: invoices on file plus earlier work from the history. */
export function lifetimeSpend(d: DB, h: History, customerId: string) {
  let total = 0;
  for (const inv of d.invoices) {
    if (inv.customerId === customerId && inv.kind === 'invoice' && inv.status !== 'draft' && inv.status !== 'void') total += invoiceTotals(inv).subtotal;
  }
  for (const f of h.jobs) if (f.customerId === customerId) total += f.revenue;
  return total;
}

/* ---------- Service history ---------- */

export interface HistoryRow {
  id: string;
  day: string;
  type: JobType;
  title: string;
  /** Part replaced, for repairs */
  detail?: string;
  techs: string[];
  hours?: number;
  revenue?: number;
  status?: JobStatus;
  /** Live job (links to the job page); history rows are read-only */
  jobId?: string;
}

function factTitle(d: DB, f: JobFact): string {
  const unit = f.unitId ? unitOf(d, f.unitId) : undefined;
  const item = f.group ? itemOf(d, f.group) : undefined;
  const model = unit ? unitLabel(unit) : item ? itemLabel(item) : f.group ? legacyGroups[f.group]?.label : undefined;
  const issue = f.issue ? issues[f.issue]?.label : undefined;
  switch (f.type) {
    case 'install':
      return `Installed ${model ?? 'a new appliance'}`;
    case 'maintenance':
      return `Annual service${model ? ` — ${model}` : ''}`;
    case 'warranty':
      return `Warranty: ${(issue ?? 'repair').toLowerCase()}${model ? ` — ${model}` : ''}`;
    case 'estimate':
      return 'Site visit & measure';
    default:
      return `${f.callback ? 'Return visit: ' : ''}${issue ?? 'Repair'}${model ? ` — ${model}` : ''}`;
  }
}

/** Live jobs plus history facts for a customer or a single appliance, newest first. */
export function serviceHistory(d: DB, h: History, filter: { customerId?: string; unitId?: string }): HistoryRow[] {
  if (!filter.customerId && !filter.unitId) return [];
  const rows: HistoryRow[] = [];
  for (const j of d.jobs) {
    if (filter.customerId && j.customerId !== filter.customerId) continue;
    if (filter.unitId && j.unitId !== filter.unitId) continue;
    if (j.status === 'cancelled') continue;
    const actual = j.startedAt && j.completedAt ? Math.max(0.25, Math.round((diffMinutes(j.completedAt, j.startedAt) / 60) * 4) / 4) : undefined;
    const inv = j.invoiceId ? d.invoices.find((i) => i.id === j.invoiceId) : undefined;
    const part = j.parts.find((p) => itemOf(d, p.itemId)?.kind === 'part');
    rows.push({
      id: j.id,
      day: jobDay(j),
      type: j.type,
      title: j.title,
      detail: part && j.type !== 'install' ? `${part.status === 'used' ? 'Used' : 'Reserved'}: ${itemOf(d, part.itemId)!.name}` : undefined,
      techs: j.crew,
      hours: actual,
      revenue: inv ? invoiceTotals(inv).subtotal : j.value,
      status: j.status,
      jobId: j.id,
    });
  }
  for (const f of h.jobs) {
    if (filter.customerId && f.customerId !== filter.customerId) continue;
    if (filter.unitId && f.unitId !== filter.unitId) continue;
    rows.push({
      id: f.id,
      day: f.day,
      type: f.type,
      title: factTitle(d, f),
      detail: f.part ? `Replaced: ${itemOf(d, f.part)?.name ?? f.part}` : undefined,
      techs: f.crew,
      hours: f.hours,
      revenue: f.revenue,
    });
  }
  return rows.sort((a, b) => (a.day < b.day ? 1 : a.day > b.day ? -1 : 0));
}

/* ---------- Activity timeline ---------- */

export interface TimelineEntry {
  id: string;
  at: string;
  by: string;
  kind: Activity['kind'] | 'payment' | 'invoice' | 'reminder';
  text: string;
  source?: { label: string; to: string; section: 'inbox' | 'jobs' | 'accounting' };
}

export function customerTimeline(d: DB, c: Customer, h?: History): TimelineEntry[] {
  const out: TimelineEntry[] = [];
  // Earlier visits from the history, so long-time customers don't look brand new
  for (const f of h?.jobs ?? []) {
    if (f.customerId !== c.id) continue;
    const techs = f.crew.map((t) => d.staff.find((s) => s.id === t)?.name.split(' ')[0]).filter(Boolean).join(' & ');
    out.push({ id: `hist-${f.id}`, at: `${f.day}T16:00`, by: f.crew[0] ?? 'system', kind: 'job', text: `${factTitle(d, f)} — completed${techs ? ` by ${techs}` : ''}` });
  }
  for (const a of c.activity ?? []) out.push({ ...a });
  for (const l of d.leads) {
    if (l.customerId !== c.id) continue;
    for (const a of l.activity) out.push({ ...a, id: `${l.id}-${a.id}`, source: { label: `Request ${l.id}`, to: `/office/inbox/?id=${l.id}`, section: 'inbox' } });
  }
  for (const j of d.jobs) {
    if (j.customerId !== c.id) continue;
    for (const a of j.notes) out.push({ ...a, id: `${j.id}-${a.id}`, source: { label: j.id, to: `/office/jobs/?id=${j.id}`, section: 'jobs' } });
  }
  for (const inv of d.invoices) {
    if (inv.customerId !== c.id || inv.status === 'draft') continue;
    const to = `/office/accounting/?tab=${inv.kind === 'estimate' ? 'estimates' : 'invoices'}&id=${inv.id}`;
    out.push({
      id: `${inv.id}-sent`,
      at: inv.sentAt ?? `${inv.issuedOn}T09:00`,
      by: inv.salesperson ?? 'system',
      kind: 'invoice',
      text: `${inv.kind === 'estimate' ? 'Estimate' : 'Invoice'} ${inv.id} sent — ${money(invoiceTotals(inv).total)}`,
      source: { label: inv.id, to, section: 'accounting' },
    });
    for (const p of inv.payments) {
      out.push({ id: `${inv.id}-${p.id}`, at: `${p.date}T12:00`, by: 'customer', kind: 'payment', text: `Paid ${money(p.amount)} by ${methodLabels[p.method]}`, source: { label: inv.id, to, section: 'accounting' } });
    }
  }
  const units = new Map(d.units.filter((u) => u.customerId === c.id).map((u) => [u.id, u]));
  for (const r of d.reminders) {
    const u = units.get(r.unitId);
    if (u) out.push({ id: `rem-${r.unitId}-${r.at}`, at: r.at, by: r.by, kind: 'reminder', text: `Annual service reminder emailed — ${unitLabel(u)}` });
  }
  return out.sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));
}

/* ---------- Dates ---------- */

/** "3 years" · "about a year" · "8 months" · "45 days" */
export function timeLeft(days: number) {
  if (days >= 700) return `${Math.round(days / 365)} years`;
  if (days >= 330) return 'about a year';
  if (days >= 60) return `${Math.round(days / 30.4)} months`;
  return plural(Math.max(0, days), 'day');
}

export const daysUntil = (day: string) => diffDays(day, today());

/* ---------- Adding equipment ---------- */

/** Group used by the reliability report for appliances HMI didn't sell */
function legacyGroupFor(category: ItemCategory, fuel: Fuel): string | undefined {
  if (category === 'Gas logs') return 'legacy-vent-free';
  if (fuel === 'Pellet') return 'legacy-pellet';
  if (fuel === 'Wood') return 'legacy-wood';
  if (fuel === 'Natural gas' || fuel === 'Propane') return 'legacy-builder-gas';
  return undefined;
}

export interface NewUnit {
  customerId: string;
  installedBy: 'HMI' | 'Other';
  /** Catalog model (HMI installs) */
  itemId?: string;
  brand: string;
  model: string;
  category: ItemCategory;
  fuel: Fuel;
  serial: string;
  installedOn: string;
  room?: string;
}

/** Add an appliance to a customer's equipment list (e.g. one that came with the house). */
export function addUnit(input: NewUnit): string {
  let id = '';
  mutate((d) => {
    id = nextId(d, 'unit', 'U');
    const it = input.itemId ? d.items.find((i) => i.id === input.itemId) : undefined;
    const w = input.installedBy === 'HMI' ? it?.warranty : undefined;
    d.units.push({
      id,
      customerId: input.customerId,
      itemId: it?.id,
      legacyGroup: it ? undefined : legacyGroupFor(input.category, input.fuel),
      model: it?.name ?? input.model,
      brand: it?.brand ?? (input.brand.trim() || 'Other'),
      category: it?.category ?? input.category,
      fuel: input.fuel,
      serial: input.serial.trim() || '—',
      room: input.room || undefined,
      installedOn: input.installedOn,
      installedBy: input.installedBy,
      warranty: w
        ? {
            terms: `${w.fireboxLifetime ? 'Limited lifetime firebox · ' : ''}${w.partsYears} yr parts · ${w.laborYears} yr HMI labor`,
            partsUntil: addDays(input.installedOn, Math.round(w.partsYears * 365.25)),
            laborUntil: addDays(input.installedOn, Math.round(w.laborYears * 365.25)),
            fireboxLifetime: w.fireboxLifetime,
            registered: false,
          }
        : { terms: 'No HMI warranty — installed by others', fireboxLifetime: false, registered: false },
    });
  });
  return id;
}
