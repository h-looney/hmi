/**
 * Every change to HMI mode's data goes through these actions, so side effects stay the same
 * wherever a change starts — finishing a job on the board or on a technician's phone uses up
 * the same parts, logs the same stock movement and notifies the office the same way.
 *
 * Section-specific helpers can live next to their pages; anything shared belongs here.
 */
import { checklists, fuelClass, installStandards, issues } from './data/catalog';
import type {
  Activity,
  Customer,
  DB,
  Invoice,
  InvoiceLine,
  Job,
  JobStatus,
  JobType,
  Lead,
  LeadKind,
  LeadSource,
  LeadStage,
  Notice,
  PaymentMethod,
  PurchaseOrder,
  Role,
  Section,
  Settings,
  StoreId,
  WarrantyClaim,
} from './data/types';
import { addDays, now, today } from './lib/dates';
import { money } from './lib/format';
import { invoiceTotals } from './selectors';
import { db, edit, markTried, me, mutate, nextId, uid } from './store';

const actor = () => me.value?.id ?? 'system';
const stamp = () => now();

const stageLabels: Record<LeadStage, string> = {
  new: 'New',
  contacted: 'Contacted',
  scheduled: 'Scheduled',
  quoted: 'Quote sent',
  won: 'Won',
  lost: 'Lost',
  closed: 'Closed',
};

const statusLabels: Record<JobStatus, string> = {
  requested: 'Needs scheduling',
  scheduled: 'Scheduled',
  'in-progress': 'In progress',
  'on-hold': 'On hold',
  completed: 'Completed',
  closed: 'Closed',
  cancelled: 'Cancelled',
};

function activity(kind: Activity['kind'], text: string, by = actor()): Activity {
  return { id: uid('a'), at: stamp(), by, kind, text };
}

export function notify(d: DB, kind: Notice['kind'], text: string, href?: string) {
  d.notices = [{ id: uid('n'), at: stamp(), kind, text, href, read: false }, ...d.notices];
}

const syncIfConnected = (d: DB, what: string) => {
  if (!d.books.connected || !d.books.autoSync) return undefined;
  d.books = { ...d.books, lastSyncAt: stamp(), log: [{ id: uid('q'), at: stamp(), level: 'ok' as const, text: what }, ...d.books.log].slice(0, 60) };
  return stamp();
};

/* ======================================================================
   Requests (inbox)
   ====================================================================== */

export function setLeadStage(id: string, stage: LeadStage, note?: string) {
  mutate((d) =>
    edit(d.leads, id, (l) => {
      const prev = l.stage;
      if (prev === stage) return;
      l.stage = stage;
      l.unread = false;
      if (stage !== 'new' && !l.firstResponseAt) l.firstResponseAt = stamp();
      if (stage === 'won' || stage === 'lost' || stage === 'closed') l.closedAt = stamp();
      l.activity.push(activity('status', note ?? `Moved from ${stageLabels[prev]} to ${stageLabels[stage]}`));
    }),
  );
}

export function assignLead(id: string, staffId: string | undefined) {
  mutate((d) =>
    edit(d.leads, id, (l) => {
      l.assignee = staffId;
      const who = d.staff.find((s) => s.id === staffId)?.name ?? 'nobody';
      l.activity.push(activity('assign', `Assigned to ${who}`));
    }),
  );
}

/** Log a call, email, text or note. Reaching out moves a new request to Contacted. */
export function addLeadActivity(id: string, kind: 'note' | 'email' | 'call' | 'text', text: string) {
  mutate((d) =>
    edit(d.leads, id, (l) => {
      l.activity.push(activity(kind, text));
      l.unread = false;
      if (kind !== 'note') {
        if (!l.firstResponseAt) l.firstResponseAt = stamp();
        if (l.stage === 'new') {
          l.stage = 'contacted';
          l.activity.push(activity('status', 'Moved from New to Contacted'));
        }
      }
    }),
  );
}

export function markLeadRead(id: string, read = true) {
  const lead = db.value.leads.find((l) => l.id === id);
  if (!lead || lead.unread === !read) return;
  mutate((d) => edit(d.leads, id, (l) => (l.unread = !read)));
}

export function toggleLeadStar(id: string) {
  mutate((d) => edit(d.leads, id, (l) => (l.starred = !l.starred)));
}

export function linkLeadToCustomer(leadId: string, customerId: string) {
  mutate((d) =>
    edit(d.leads, leadId, (l) => {
      l.customerId = customerId;
      l.activity.push(activity('system', `Linked to customer ${d.customers.find((c) => c.id === customerId)?.name ?? customerId}`));
    }),
  );
}

/** Create a customer record from a request's contact details and link them. */
export function createCustomerFromLead(leadId: string): string {
  let id = '';
  mutate((d) => {
    const l = d.leads.find((x) => x.id === leadId)!;
    id = nextId(d, 'customer', 'C');
    const [street, city] = (l.address ?? '').split(',').map((s) => s.trim());
    d.customers.push({
      id,
      name: l.name.replace(/ — .*/, ''),
      kind: 'homeowner',
      phone: l.phone ?? '',
      email: l.email ?? '',
      address: { street: street ?? '', city: city || l.city || '', state: 'MO', zip: l.zip ?? '' },
      store: l.store,
      since: today(),
      tags: [],
      contactPref: l.fields.some(([k, v]) => k === 'Best way to reach you' && /email/i.test(v)) ? 'email' : 'phone',
    });
    edit(d.leads, leadId, (x) => {
      x.customerId = id;
      x.activity.push(activity('system', `Customer record ${id} created`));
    });
  });
  return id;
}

/** Log a phone call or showroom visit as a request. */
export function logRequest(input: { kind: LeadKind; source: LeadSource; name: string; phone?: string; email?: string; city?: string; store: StoreId; summary: string; message?: string; assignee?: string; customerId?: string }): string {
  let id = '';
  mutate((d) => {
    id = nextId(d, 'lead', 'R');
    const lead: Lead = {
      id,
      kind: input.kind,
      source: input.source,
      receivedAt: stamp(),
      name: input.name,
      phone: input.phone,
      email: input.email,
      city: input.city,
      store: input.store,
      summary: input.summary,
      message: input.message,
      fields: [],
      stage: 'new',
      assignee: input.assignee ?? d.settings.forms.routing[input.kind === 'quote' ? 'quote' : 'service'][input.store],
      customerId: input.customerId,
      unread: false,
      activity: [activity('received', input.source === 'walk-in' ? 'Logged from a showroom visit' : 'Logged from a phone call')],
      firstResponseAt: stamp(),
    };
    d.leads = [lead, ...d.leads];
  });
  return id;
}

/* ======================================================================
   Customers
   ====================================================================== */

export function createCustomer(input: Omit<Customer, 'id' | 'since' | 'tags'> & { tags?: string[] }): string {
  let id = '';
  mutate((d) => {
    id = nextId(d, 'customer', 'C');
    d.customers.push({ ...input, id, since: today(), tags: input.tags ?? [] });
  });
  return id;
}

export function updateCustomer(id: string, patch: Partial<Customer>) {
  mutate((d) => edit(d.customers, id, (c) => Object.assign(c, patch)));
}

export function addCustomerNote(id: string, kind: 'note' | 'call' | 'email' | 'text', text: string) {
  mutate((d) =>
    edit(d.customers, id, (c) => {
      c.activity = [activity(kind, text), ...(c.activity ?? [])];
    }),
  );
}

/* ======================================================================
   Jobs
   ====================================================================== */

export interface NewJob {
  type: JobType;
  customerId: string;
  store: StoreId;
  title?: string;
  description?: string;
  unitId?: string;
  itemId?: string;
  leadId?: string;
  start?: string;
  hours?: number;
  crew?: string[];
  priority?: 'normal' | 'high';
  value?: number;
}

export const defaultHours = (d: DB, type: JobType, itemId?: string, unitId?: string) => {
  if (type === 'install') return installStandards[d.items.find((i) => i.id === itemId)?.category ?? 'Gas fireplaces']?.hours ?? 6;
  if (type === 'estimate') return 1;
  if (type === 'maintenance') {
    const fc = fuelClass(d.units.find((u) => u.id === unitId)?.fuel);
    return fc === 'wood' ? 2 : fc === 'pellet' ? 1.75 : 1.5;
  }
  return 1.5;
};

const checklistFor = (type: JobType, fuel?: string) => {
  const fc = fuelClass(fuel);
  const key = type === 'maintenance' ? (fc === 'wood' ? 'maintenance-wood' : fc === 'pellet' ? 'maintenance-pellet' : 'maintenance') : type;
  return checklists[key].map((label, i) => ({ id: `c${i + 1}`, label, done: false }));
};

function defaultTitle(d: DB, input: NewJob) {
  const unit = d.units.find((u) => u.id === input.unitId);
  const item = d.items.find((i) => i.id === input.itemId);
  const what = unit ? (unit.brand === 'Other' ? unit.model : `${unit.brand} ${unit.model}`) : item ? `${item.brand} ${item.name}` : '';
  switch (input.type) {
    case 'install':
      return `Install ${what || 'new appliance'}`;
    case 'maintenance':
      return `Annual service${what ? ` — ${what}` : ''}`;
    case 'repair':
      return `Service call${what ? ` — ${what}` : ''}`;
    case 'warranty':
      return `Warranty service${what ? ` — ${what}` : ''}`;
    case 'estimate':
      return 'Site visit & measure';
    default:
      return 'Delivery';
  }
}

export function createJob(input: NewJob): string {
  let id = '';
  mutate((d) => {
    id = nextId(d, 'job', 'J');
    const unit = d.units.find((u) => u.id === input.unitId);
    const item = d.items.find((i) => i.id === input.itemId);
    const job: Job = {
      id,
      type: input.type,
      title: input.title?.trim() || defaultTitle(d, input),
      customerId: input.customerId,
      unitId: input.unitId,
      itemId: input.itemId,
      leadId: input.leadId,
      store: input.store,
      status: input.start ? 'scheduled' : 'requested',
      priority: input.priority ?? 'normal',
      start: input.start,
      hours: input.hours ?? defaultHours(d, input.type, input.itemId, input.unitId),
      crew: input.crew ?? [],
      description: input.description ?? '',
      checklist: checklistFor(input.type, unit?.fuel ?? item?.fuel),
      parts: [],
      notes: [activity('system', 'Job created')],
      createdAt: stamp(),
      value: input.value,
    };
    if (item && input.type === 'install') {
      job.parts.push({ itemId: item.id, qty: 1, store: input.store, status: 'reserved' });
      edit(d.items, item.id, (it) => (it.stock[input.store].reserved += 1));
    }
    d.jobs.push(job);
    if (input.leadId) {
      edit(d.leads, input.leadId, (l) => {
        l.jobId = id;
        l.unread = false;
        if (l.stage === 'new' || l.stage === 'contacted') l.stage = 'scheduled';
        if (!l.firstResponseAt) l.firstResponseAt = stamp();
        l.activity.push(activity('job', `${id} created${input.start ? ' and scheduled' : ''}`));
      });
    }
  });
  if (input.start) markTried('schedule');
  return id;
}

export function updateJob(id: string, patch: Partial<Job>) {
  mutate((d) => edit(d.jobs, id, (j) => Object.assign(j, patch)));
}

/** Put a job on the calendar (or take it off) and set the crew. */
export function scheduleJob(id: string, start: string | undefined, crew: string[]) {
  mutate((d) =>
    edit(d.jobs, id, (j) => {
      j.start = start;
      j.crew = crew;
      if (start && (j.status === 'requested' || j.status === 'on-hold')) j.status = 'scheduled';
      if (!start && j.status === 'scheduled') j.status = 'requested';
      const names = crew.map((c) => d.staff.find((s) => s.id === c)?.name.split(' ')[0]).filter(Boolean).join(' & ');
      j.notes.push(activity('job', start ? `Scheduled for ${start.replace('T', ' ')}${names ? ` with ${names}` : ''}` : 'Removed from the schedule'));
    }),
  );
  markTried('schedule');
}

export function setJobStatus(id: string, status: JobStatus, opts: { holdReason?: string } = {}) {
  if (status === 'completed') return completeJob(id);
  mutate((d) =>
    edit(d.jobs, id, (j) => {
      if (j.status === status) return;
      const prev = j.status;
      j.status = status;
      if (status === 'in-progress' && !j.startedAt) j.startedAt = stamp();
      if (status === 'on-hold') j.holdReason = opts.holdReason ?? j.holdReason ?? 'Waiting on parts';
      if (status !== 'on-hold' && prev === 'on-hold') j.holdReason = undefined;
      if (status === 'cancelled') {
        for (const p of j.parts) {
          if (p.status !== 'reserved') continue;
          edit(d.items, p.itemId, (it) => (it.stock[p.store].reserved = Math.max(0, it.stock[p.store].reserved - p.qty)));
        }
        j.parts = j.parts.filter((p) => p.status === 'used');
      }
      j.notes.push(activity('status', `Status changed from ${statusLabels[prev]} to ${statusLabels[status]}${status === 'on-hold' ? ` — ${j.holdReason}` : ''}`));
    }),
  );
  markTried('board');
}

/**
 * Finish a job: record times and signature, use up reserved parts, register the new unit for
 * installs, update the customer's service date, and let the office know.
 */
export function completeJob(id: string, opts: { arrivedAt?: string; finishedAt?: string; signature?: { name: string; image?: string }; note?: string } = {}) {
  mutate((d) => {
    const job = d.jobs.find((j) => j.id === id);
    if (!job || job.status === 'completed' || job.status === 'closed') return;
    const done = edit(d.jobs, id, (j) => {
      j.status = 'completed';
      j.startedAt = opts.arrivedAt ?? j.startedAt ?? j.start ?? stamp();
      j.completedAt = opts.finishedAt ?? stamp();
      j.holdReason = undefined;
      j.checklist = j.checklist.map((c) => ({ ...c, done: true }));
      if (opts.signature) j.signature = { ...opts.signature, at: j.completedAt };
      if (opts.note) j.notes.push(activity('note', opts.note));
      j.notes.push(activity('status', 'Job completed'));
      // Reserved parts are now used
      j.parts = j.parts.map((p) => {
        if (p.status !== 'reserved') return p;
        edit(d.items, p.itemId, (it) => {
          const s = it.stock[p.store];
          s.reserved = Math.max(0, s.reserved - p.qty);
          s.onHand = Math.max(0, s.onHand - p.qty);
        });
        d.moves = [{ id: uid('m'), at: stamp(), itemId: p.itemId, store: p.store, qty: -p.qty, kind: 'job', ref: id, by: actor() }, ...d.moves];
        return { ...p, status: 'used' as const };
      });
    })!;
    // New install → add the appliance to the customer's equipment list
    if (done.type === 'install' && done.itemId && !done.unitId) {
      const it = d.items.find((i) => i.id === done.itemId)!;
      const w = it.warranty ?? { partsYears: 1, laborYears: 1, fireboxLifetime: false };
      const unitId = nextId(d, 'unit', 'U');
      const day = today();
      d.units.push({
        id: unitId,
        customerId: done.customerId,
        itemId: it.id,
        model: it.name,
        brand: it.brand,
        category: it.category,
        fuel: it.fuel === 'Gas' ? 'Natural gas' : (it.fuel ?? 'Natural gas'),
        serial: `${it.brand.split(/[\s&-]+/).map((x) => x[0]).join('').toUpperCase().slice(0, 3)}${day.slice(2, 4)}-${String(Date.now()).slice(-6)}`,
        installedOn: day,
        installedBy: 'HMI',
        warranty: {
          terms: `${w.fireboxLifetime ? 'Limited lifetime firebox · ' : ''}${w.partsYears} yr parts · ${w.laborYears} yr HMI labor`,
          partsUntil: addDays(day, Math.round(w.partsYears * 365.25)),
          laborUntil: addDays(day, Math.round(w.laborYears * 365.25)),
          fireboxLifetime: w.fireboxLifetime,
          registered: false,
        },
      });
      edit(d.jobs, id, (j) => (j.unitId = unitId));
    }
    if (done.unitId && done.type !== 'install' && done.type !== 'estimate') edit(d.units, done.unitId, (u) => (u.lastServiceOn = today()));
    // Warranty work starts a claim with the manufacturer
    if (done.type === 'warranty' && !done.claimId && done.unitId) {
      const unit = d.units.find((u) => u.id === done.unitId);
      const item = unit?.itemId ? d.items.find((i) => i.id === unit.itemId) : undefined;
      if (unit && item) {
        const claimId = nextId(d, 'claim', 'WC');
        const usedPart = done.parts.find((p) => d.items.find((i) => i.id === p.itemId)?.kind === 'part');
        const partItem = usedPart ? d.items.find((i) => i.id === usedPart.itemId) : undefined;
        d.claims = [
          {
            id: claimId,
            unitId: unit.id,
            customerId: unit.customerId,
            jobId: id,
            store: done.store,
            openedOn: today(),
            issue: done.issue ?? 'pilot',
            part: partItem?.name ?? issues[done.issue ?? '']?.label ?? 'Repair',
            manufacturer: d.vendors.find((v) => v.id === item.vendorId)?.name ?? item.brand,
            status: 'draft',
            credit: Math.round((partItem?.cost ?? 0) + 120),
            updatedOn: today(),
          },
          ...d.claims,
        ];
        edit(d.jobs, id, (j) => (j.claimId = claimId));
      }
    }
    if (done.leadId) {
      edit(d.leads, done.leadId, (l) => {
        if (l.kind === 'service' && l.stage !== 'closed') {
          l.stage = 'closed';
          l.closedAt = stamp();
          l.activity.push(activity('status', `Closed — ${id} completed`));
        }
      });
    }
    if (d.settings.notifications.jobCompleted) {
      const c = d.customers.find((x) => x.id === done.customerId);
      notify(d, 'job', `${d.staff.find((s) => s.id === actor())?.name.split(' ')[0] ?? 'A tech'} completed ${done.id} for ${c?.name ?? 'a customer'}`, `/office/jobs/?id=${id}`);
    }
  });
  markTried('complete');
}

export function addJobNote(id: string, text: string) {
  mutate((d) => edit(d.jobs, id, (j) => j.notes.push(activity('note', text))));
}

export function toggleChecklistItem(jobId: string, itemId: string) {
  mutate((d) => edit(d.jobs, jobId, (j) => (j.checklist = j.checklist.map((c) => (c.id === itemId ? { ...c, done: !c.done } : c)))));
}

/** Reserve a part from a store's stock for this job. */
export function addJobPart(jobId: string, itemId: string, qty: number, store: StoreId) {
  mutate((d) => {
    edit(d.jobs, jobId, (j) => {
      j.parts.push({ itemId, qty, store, status: 'reserved' });
      j.notes.push(activity('job', `Reserved ${qty} × ${d.items.find((i) => i.id === itemId)?.name ?? itemId} from ${store === 'nixa' ? 'Nixa' : 'Osage Beach'}`));
    });
    edit(d.items, itemId, (it) => (it.stock[store].reserved += qty));
  });
}

export function removeJobPart(jobId: string, index: number) {
  mutate((d) => {
    const job = d.jobs.find((j) => j.id === jobId);
    const part = job?.parts[index];
    if (!job || !part) return;
    if (part.status === 'reserved') edit(d.items, part.itemId, (it) => (it.stock[part.store].reserved = Math.max(0, it.stock[part.store].reserved - part.qty)));
    edit(d.jobs, jobId, (j) => j.parts.splice(index, 1));
  });
}

/* ======================================================================
   Invoices, estimates & payments
   ====================================================================== */

/** Suggested invoice lines for a finished job */
export function linesForJob(d: DB, job: Job): InvoiceLine[] {
  const s = d.settings;
  const unit = d.units.find((u) => u.id === job.unitId);
  const fc = fuelClass(unit?.fuel);
  const lines: InvoiceLine[] = [];
  const line = (description: string, qty: number, rate: number, category: InvoiceLine['category'], taxable: boolean, itemId?: string) =>
    lines.push({ id: uid('l'), description, qty, rate, category, taxable, itemId });
  const hours = job.startedAt && job.completedAt ? Math.max(0.5, Math.round(((Date.parse(job.completedAt) - Date.parse(job.startedAt)) / 3.6e6) * 4) / 4) : job.hours;

  if (job.type === 'install') {
    const it = d.items.find((i) => i.id === job.itemId);
    const std = installStandards[it?.category ?? 'Gas fireplaces'];
    if (it) line(`${it.brand} ${it.name}`, 1, it.price, 'Equipment', true, it.id);
    if (std) {
      line(std.materialsLabel, 1, std.materials, 'Parts', true);
      line('Installation labor', 1, std.labor, 'Installation', false);
    }
  } else if (job.type === 'maintenance') {
    const price = fc === 'wood' ? s.annualService.wood : fc === 'pellet' ? s.annualService.pellet : s.annualService.gas;
    line(`Annual service — ${fc === 'wood' ? 'wood appliance & chimney sweep' : fc === 'pellet' ? 'pellet appliance' : 'gas appliance'}`, 1, price, 'Service', false);
  } else if (job.type === 'repair') {
    if (!job.callbackOf) line('Service call', 1, s.tripCharge, 'Service', false);
    line('Labor', hours, s.laborRate, 'Service', false);
  } else if (job.type === 'warranty') {
    line('Warranty service — parts and labor covered by the manufacturer', 1, 0, 'Service', false);
  } else if (job.type === 'estimate') {
    line('Design consultation & site measure', 1, 0, 'Service', false);
  }
  for (const p of job.parts) {
    if (job.type === 'install' && p.itemId === job.itemId) continue;
    const it = d.items.find((i) => i.id === p.itemId);
    if (!it) continue;
    line(it.brand === 'HMI Supply' ? it.name : `${it.brand} ${it.name}`, p.qty, job.type === 'warranty' ? 0 : it.price, it.kind === 'accessory' ? 'Retail' : 'Parts', true, it.id);
  }
  return lines;
}

export function createInvoice(input: { kind: 'invoice' | 'estimate'; customerId: string; store: StoreId; lines: InvoiceLine[]; jobId?: string; leadId?: string; issuedOn?: string; dueOn?: string; memo?: string; status?: Invoice['status'] }): string {
  let id = '';
  mutate((d) => {
    id = input.kind === 'estimate' ? nextId(d, 'estimate', 'EST') : nextId(d, 'invoice', 'INV');
    const issuedOn = input.issuedOn ?? today();
    const customer = d.customers.find((c) => c.id === input.customerId);
    const termDays = input.kind === 'estimate' ? 30 : customer?.kind === 'builder' ? 30 : d.settings.terms === 'Net 30' ? 30 : d.settings.terms === 'Net 15' ? 15 : 0;
    const inv: Invoice = {
      id,
      kind: input.kind,
      customerId: input.customerId,
      jobId: input.jobId,
      leadId: input.leadId,
      store: input.store,
      issuedOn,
      dueOn: input.dueOn ?? addDays(issuedOn, termDays),
      status: input.status ?? 'draft',
      lines: input.lines,
      taxRate: d.settings.taxRates[input.store],
      payments: [],
      memo: input.memo,
      salesperson: actor(),
    };
    if (inv.status === 'sent') inv.sentAt = stamp();
    d.invoices = [inv, ...d.invoices];
    if (input.leadId && input.kind === 'estimate') {
      edit(d.leads, input.leadId, (l) => {
        l.estimateId = id;
        l.value = invoiceTotals(inv).subtotal;
        if (l.stage !== 'won' && l.stage !== 'lost') l.stage = inv.status === 'sent' ? 'quoted' : l.stage;
        l.activity.push(activity('estimate', `Estimate ${id} ${inv.status === 'sent' ? 'sent' : 'drafted'} — ${money(invoiceTotals(inv).total)}`));
      });
    }
  });
  return id;
}

/** Bill a finished job. Installs reuse their deposit invoice; everything else gets a new one. */
export function invoiceJob(jobId: string, opts: { send?: boolean } = {}): string {
  const job = db.value.jobs.find((j) => j.id === jobId)!;
  if (job.invoiceId && db.value.invoices.some((i) => i.id === job.invoiceId)) {
    mutate((d) =>
      edit(d.jobs, jobId, (j) => {
        j.status = 'closed';
        j.notes.push(activity('status', `Closed — billed on ${j.invoiceId}`));
      }),
    );
    return job.invoiceId;
  }
  const id = createInvoice({ kind: 'invoice', customerId: job.customerId, store: job.store, lines: linesForJob(db.value, job), jobId, status: opts.send ? 'sent' : 'draft' });
  mutate((d) => {
    edit(d.jobs, jobId, (j) => {
      j.invoiceId = id;
      j.status = 'closed';
      j.notes.push(activity('status', `Invoice ${id} created`));
    });
    const synced = syncIfConnected(d, `Invoice ${id} sent to QuickBooks`);
    if (synced) edit(d.invoices, id, (i) => (i.syncedAt = synced));
  });
  return id;
}

export function updateInvoice(id: string, patch: Partial<Invoice>) {
  mutate((d) => edit(d.invoices, id, (i) => Object.assign(i, patch)));
}

export function sendInvoice(id: string) {
  mutate((d) => {
    const inv = edit(d.invoices, id, (i) => {
      if (i.status === 'draft') i.status = 'sent';
      i.sentAt = stamp();
    });
    if (inv?.kind === 'estimate' && inv.leadId) {
      edit(d.leads, inv.leadId, (l) => {
        if (l.stage !== 'won' && l.stage !== 'lost') l.stage = 'quoted';
        l.activity.push(activity('estimate', `Estimate ${id} sent to the customer`));
      });
    }
    const synced = syncIfConnected(d, `${inv?.kind === 'estimate' ? 'Estimate' : 'Invoice'} ${id} sent to QuickBooks`);
    if (synced) edit(d.invoices, id, (i) => (i.syncedAt = synced));
  });
}

export function recordPayment(invoiceId: string, amount: number, method: PaymentMethod, date = today(), ref?: string) {
  mutate((d) => {
    const inv = edit(d.invoices, invoiceId, (i) => {
      i.payments.push({ id: uid('p'), date, amount: Math.round(amount * 100) / 100, method, ref });
      if (i.status === 'draft') i.status = 'sent';
    })!;
    const c = d.customers.find((x) => x.id === inv.customerId);
    if (d.settings.notifications.paymentReceived) notify(d, 'payment', `Payment received: ${money(amount)} from ${c?.name ?? 'a customer'} (${method})`, `/office/accounting/?tab=invoices&id=${invoiceId}`);
    const synced = syncIfConnected(d, `Payment of ${money(amount)} on ${invoiceId} sent to QuickBooks`);
    if (synced) edit(d.invoices, invoiceId, (i) => (i.syncedAt = synced));
  });
  markTried('payment');
}

export function voidInvoice(id: string) {
  mutate((d) => edit(d.invoices, id, (i) => (i.status = 'void')));
}

export function sendReminder(id: string) {
  mutate((d) => edit(d.invoices, id, (i) => (i.remindedAt = stamp())));
}

export function acceptEstimate(id: string) {
  mutate((d) => {
    const est = edit(d.invoices, id, (i) => {
      i.status = 'accepted';
      i.acceptedOn = today();
    })!;
    if (est.leadId) {
      edit(d.leads, est.leadId, (l) => {
        l.stage = 'won';
        l.closedAt = stamp();
        l.value = invoiceTotals(est).subtotal;
        l.activity.push(activity('status', `Estimate ${id} accepted`));
      });
    }
  });
}

export function declineEstimate(id: string, reason = 'Customer declined') {
  mutate((d) => {
    const est = edit(d.invoices, id, (i) => (i.status = 'declined'))!;
    if (est.leadId) {
      edit(d.leads, est.leadId, (l) => {
        l.stage = 'lost';
        l.lostReason = reason;
        l.closedAt = stamp();
        l.activity.push(activity('status', `Marked lost — ${reason.toLowerCase()}`));
      });
    }
  });
}

/** Turn an accepted estimate into an invoice (deposit billing), optionally scheduling the install. */
export function convertEstimate(id: string): string {
  const est = db.value.invoices.find((i) => i.id === id)!;
  if (est.status !== 'accepted') acceptEstimate(id);
  return createInvoice({ kind: 'invoice', customerId: est.customerId, store: est.store, lines: structuredClone(est.lines), leadId: est.leadId, status: 'sent', memo: `From estimate ${id}` });
}

/* ======================================================================
   Warranty & service reminders
   ====================================================================== */

export function registerUnit(unitId: string) {
  mutate((d) =>
    edit(d.units, unitId, (u) => {
      u.warranty.registered = true;
      u.warranty.registrationNo = `REG-${Math.floor(1_000_000 + Math.random() * 8_999_999)}`;
    }),
  );
}

export function createClaim(input: { unitId: string; jobId?: string; issue: string; part: string; credit?: number; notes?: string; submit?: boolean }): string {
  let id = '';
  mutate((d) => {
    const unit = d.units.find((u) => u.id === input.unitId)!;
    const item = unit.itemId ? d.items.find((i) => i.id === unit.itemId) : undefined;
    const customer = d.customers.find((c) => c.id === unit.customerId)!;
    id = nextId(d, 'claim', 'WC');
    const claim: WarrantyClaim = {
      id,
      unitId: unit.id,
      customerId: unit.customerId,
      jobId: input.jobId,
      store: customer.store,
      openedOn: today(),
      issue: input.issue,
      part: input.part,
      manufacturer: item ? d.vendors.find((v) => v.id === item.vendorId)?.name ?? item.brand : unit.brand,
      status: input.submit ? 'submitted' : 'draft',
      claimNo: input.submit ? `WC-${Math.floor(100000 + Math.random() * 899999)}` : undefined,
      credit: input.credit ?? 150,
      updatedOn: today(),
      notes: input.notes,
    };
    d.claims = [claim, ...d.claims];
    if (input.jobId) edit(d.jobs, input.jobId, (j) => (j.claimId = id));
  });
  return id;
}

export function setClaimStatus(id: string, status: WarrantyClaim['status'], patch: Partial<WarrantyClaim> = {}) {
  mutate((d) =>
    edit(d.claims, id, (c) => {
      c.status = status;
      c.updatedOn = today();
      if (status !== 'draft' && !c.claimNo) c.claimNo = `WC-${Math.floor(100000 + Math.random() * 899999)}`;
      Object.assign(c, patch);
    }),
  );
}

/** Email annual-service reminders (simulated). */
export function sendServiceReminders(unitIds: string[]) {
  if (!unitIds.length) return;
  mutate((d) => {
    const at = stamp();
    d.reminders = [...unitIds.map((unitId) => ({ unitId, at, by: actor() })), ...d.reminders];
    notify(d, 'system', `${unitIds.length} annual-service reminder${unitIds.length === 1 ? '' : 's'} sent`, '/office/analytics/?report=service-due');
  });
  markTried('reminders');
}

/* ======================================================================
   Inventory
   ====================================================================== */

export function adjustStock(itemId: string, store: StoreId, delta: number, note: string) {
  mutate((d) => {
    edit(d.items, itemId, (it) => (it.stock[store].onHand = Math.max(0, it.stock[store].onHand + delta)));
    d.moves = [{ id: uid('m'), at: stamp(), itemId, store, qty: delta, kind: 'adjustment', by: actor(), note }, ...d.moves];
  });
}

export function transferStock(itemId: string, from: StoreId, to: StoreId, qty: number, note?: string) {
  const label = `${from === 'nixa' ? 'Nixa' : 'Osage Beach'} → ${to === 'nixa' ? 'Nixa' : 'Osage Beach'}`;
  mutate((d) => {
    edit(d.items, itemId, (it) => {
      it.stock[from].onHand = Math.max(0, it.stock[from].onHand - qty);
      it.stock[to].onHand += qty;
    });
    const at = stamp();
    d.moves = [
      { id: uid('m'), at, itemId, store: to, qty, kind: 'transfer', ref: label, by: actor(), note },
      { id: uid('m'), at, itemId, store: from, qty: -qty, kind: 'transfer', ref: label, by: actor(), note },
      ...d.moves,
    ];
  });
  markTried('stock');
}

export function createPO(input: { vendorId: string; store: StoreId; lines: { itemId: string; qty: number }[]; notes?: string; order?: boolean }): string {
  let id = '';
  mutate((d) => {
    id = nextId(d, 'po', 'PO');
    const po: PurchaseOrder = {
      id,
      vendorId: input.vendorId,
      store: input.store,
      status: input.order ? 'ordered' : 'draft',
      createdAt: stamp(),
      orderedOn: input.order ? today() : undefined,
      expectedOn: input.order ? addDays(today(), 7) : undefined,
      lines: input.lines.map((l) => ({ ...l, received: 0, cost: d.items.find((i) => i.id === l.itemId)?.cost ?? 0 })),
      notes: input.notes,
      createdBy: actor(),
    };
    d.pos = [po, ...d.pos];
  });
  return id;
}

export function updatePO(id: string, patch: Partial<PurchaseOrder>) {
  mutate((d) => edit(d.pos, id, (p) => Object.assign(p, patch)));
}

export function orderPO(id: string) {
  mutate((d) =>
    edit(d.pos, id, (p) => {
      p.status = 'ordered';
      p.orderedOn = today();
      p.expectedOn = p.expectedOn ?? addDays(today(), 7);
    }),
  );
}

/** Receive some or all of a purchase order into stock; creates the vendor bill for what arrived. */
export function receivePO(id: string, quantities?: Record<string, number>) {
  mutate((d) => {
    const po = d.pos.find((p) => p.id === id)!;
    let amount = 0;
    const at = stamp();
    const lines = po.lines.map((l) => {
      const qty = Math.max(0, Math.min(l.qty - l.received, quantities?.[l.itemId] ?? l.qty - l.received));
      if (!qty) return l;
      amount += qty * l.cost;
      edit(d.items, l.itemId, (it) => (it.stock[po.store].onHand += qty));
      d.moves = [{ id: uid('m'), at, itemId: l.itemId, store: po.store, qty, kind: 'received', ref: id, by: actor() }, ...d.moves];
      return { ...l, received: l.received + qty };
    });
    const complete = lines.every((l) => l.received >= l.qty);
    edit(d.pos, id, (p) => {
      p.lines = lines;
      p.status = complete ? 'received' : 'partial';
      if (complete) p.receivedOn = today();
    });
    if (amount > 0) {
      const vendor = d.vendors.find((v) => v.id === po.vendorId)!;
      d.bills = [
        {
          id: nextId(d, 'bill', 'B'),
          vendorId: vendor.id,
          number: `${vendor.name.replace(/[^A-Z]/g, '').slice(0, 3) || 'INV'}-${Math.floor(10000 + Math.random() * 89999)}`,
          issuedOn: today(),
          dueOn: addDays(today(), vendor.terms === 'Net 30' ? 30 : vendor.terms === 'Net 15' ? 15 : 0),
          amount: Math.round(amount * 100) / 100,
          category: 'Inventory purchases',
          store: po.store,
          status: 'open',
          memo: `Received on ${id}`,
          poId: id,
        },
        ...d.bills,
      ];
    }
  });
  markTried('stock');
}

/* ======================================================================
   Bills & banking
   ====================================================================== */

export function payBill(id: string, date = today()) {
  mutate((d) => {
    const bill = edit(d.bills, id, (b) => {
      b.status = 'paid';
      b.paidOn = date;
    })!;
    const vendor = d.vendors.find((v) => v.id === bill.vendorId);
    d.txns = [{ id: uid('t'), accountId: 'acct-op', date, description: `ACH — ${vendor?.name ?? 'Vendor'}`, amount: -bill.amount, category: bill.category, match: { kind: 'bill', id }, reviewed: true }, ...d.txns];
    edit(d.accounts, 'acct-op', (a) => (a.balance = Math.round((a.balance - bill.amount) * 100) / 100));
    const synced = syncIfConnected(d, `Bill payment to ${vendor?.name ?? 'vendor'} sent to QuickBooks`);
    if (synced) edit(d.bills, id, (b) => (b.syncedAt = synced));
  });
}

export function scheduleBill(id: string, date: string) {
  mutate((d) =>
    edit(d.bills, id, (b) => {
      b.status = 'scheduled';
      b.scheduledOn = date;
    }),
  );
}

export function categorizeTxn(id: string, category: string) {
  mutate((d) =>
    edit(d.txns, id, (t) => {
      t.category = category;
      t.reviewed = true;
    }),
  );
}

/* ======================================================================
   Books: in-house or QuickBooks
   ====================================================================== */

export function setBooksMode(mode: 'in-house' | 'quickbooks') {
  mutate((d) => (d.books = { ...d.books, mode }));
}

export function updateBooks(patch: Partial<DB['books']>) {
  mutate((d) => (d.books = { ...d.books, ...patch }));
}

/** Simulated QuickBooks Online connection (no data leaves the browser). */
export function connectQuickBooks(company = 'HMI Fireplace Shop') {
  mutate((d) => {
    const at = stamp();
    const recent = d.invoices.filter((i) => i.status !== 'draft');
    const log = [
      { id: uid('q'), at, level: 'ok' as const, text: `Connected to QuickBooks Online company “${company}”` },
      { id: uid('q'), at, level: 'ok' as const, text: `Matched ${d.customers.length.toLocaleString()} customers and ${d.items.length} products & services` },
      { id: uid('q'), at, level: 'ok' as const, text: `Sent ${recent.length} invoices and ${recent.reduce((n, i) => n + i.payments.length, 0)} payments` },
      { id: uid('q'), at, level: 'warn' as const, text: '2 customers have no email address — invoices for them will sync without e-delivery' },
    ];
    d.books = { ...d.books, connected: true, mode: 'quickbooks', company, connectedAt: at, lastSyncAt: at, log: [...log.reverse(), ...d.books.log] };
    d.invoices = d.invoices.map((i) => (i.status === 'draft' || i.syncedAt ? i : { ...i, syncedAt: at }));
    notify(d, 'sync', 'QuickBooks Online connected — first sync finished', '/office/accounting/?tab=integrations');
  });
  markTried('quickbooks');
}

export function disconnectQuickBooks() {
  mutate((d) => {
    d.books = { ...d.books, connected: false, mode: 'in-house', log: [{ id: uid('q'), at: stamp(), level: 'warn' as const, text: 'Disconnected from QuickBooks Online' }, ...d.books.log] };
  });
}

export function syncQuickBooks() {
  mutate((d) => {
    const at = stamp();
    const pending = d.invoices.filter((i) => i.status !== 'draft' && !i.syncedAt);
    d.invoices = d.invoices.map((i) => (i.status === 'draft' || i.syncedAt ? i : { ...i, syncedAt: at }));
    d.books = {
      ...d.books,
      lastSyncAt: at,
      log: [{ id: uid('q'), at, level: 'ok' as const, text: pending.length ? `Sent ${pending.length} new invoice${pending.length === 1 ? '' : 's'} and updated payments` : 'Everything is up to date' }, ...d.books.log].slice(0, 60),
    };
  });
}

/* ======================================================================
   Settings
   ====================================================================== */

export function updateSettings(fn: (s: Settings) => void) {
  mutate((d) => {
    const next = structuredClone(d.settings);
    fn(next);
    d.settings = next;
  });
}

export function setPermission(role: Role, section: Section, allowed: boolean) {
  updateSettings((s) => {
    const list = new Set(s.permissions[role]);
    if (allowed) list.add(section);
    else list.delete(section);
    s.permissions[role] = [...list];
  });
}
