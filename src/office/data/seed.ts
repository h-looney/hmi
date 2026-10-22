/**
 * Demo data generator for HMI mode.
 *
 * Builds a believable two-store hearth business around "today": ~15 months of analytics
 * history (compact facts), five weeks of detailed records (jobs, invoices, requests, stock
 * movements), and a three-week schedule ahead. A fixed random seed makes the data identical
 * for everyone; dates are relative, so the demo always looks current.
 */
import { createRng } from '../lib/rng';
import { addDays, addMinutes, diffDays, diffMinutes, monthKey, weekday } from '../lib/dates';
import {
  buildItems,
  checklists,
  fuelClass,
  installStandards,
  issueWeights,
  issues,
  legacyGroups,
  vendors,
} from './catalog';
import { builders, crews, defaultPermissions, firstNames, lastNames, rooms, staff, streets, techProfiles, towns } from './people';
import type {
  Activity,
  BankAccount,
  BankTxn,
  Bill,
  BooksState,
  Customer,
  DB,
  History,
  Invoice,
  InvoiceLine,
  Item,
  ItemCategory,
  Job,
  JobFact,
  JobStatus,
  JobType,
  Lead,
  LeadFact,
  LeadKind,
  LeadSource,
  LeadStage,
  MonthFact,
  Notice,
  PaymentMethod,
  PurchaseOrder,
  SaleFact,
  Settings,
  StockMove,
  StoreId,
  Unit,
  WarrantyClaim,
  WebsiteState,
} from './types';

export const DB_VERSION = 9;

/**
 * The Website section starts with nothing pending and no model photos (staff add their own); the weekly summary goes
 * to Gabe (the Nixa store manager).
 */
export const defaultWebsite = (): WebsiteState => ({ edits: {}, linkUrls: {}, listings: {}, listingsLive: {}, dismissed: [], digestTo: 'gabe', publishes: [], photos: {}, photosLive: {} });
/** Detailed records cover this many days before today */
export const WINDOW_DAYS = 35;
const HISTORY_DAYS = 455;
const FUTURE_DAYS = 21;
/** The generated schedule is built around the current time, kept within business hours. */
export function demoClock(d = new Date()): string {
  // Capped mid-afternoon so there is always work left on today's schedule to try; before opening
  // the day simply hasn't started yet
  const mins = Math.min(13 * 60 + 30, d.getHours() * 60 + d.getMinutes());
  return `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;
}

const STORES: StoreId[] = ['osage-beach', 'nixa'];
/** Year-over-year growth built into the sample business */
const GROWTH = 1.08;
const STORE_FACTOR: Record<StoreId, number> = { 'osage-beach': 1.1, nixa: 0.9 };
const STORE_NAME: Record<StoreId, string> = { 'osage-beach': 'Osage Beach', nixa: 'Nixa' };

// Per store, per business day — hearth work peaks September through December.
const INSTALLS = [0.42, 0.38, 0.42, 0.46, 0.46, 0.42, 0.42, 0.52, 0.7, 0.88, 0.85, 0.63];
const SERVICE = [2.0, 1.8, 1.6, 1.5, 1.4, 1.3, 1.4, 2.4, 3.6, 4.4, 4.0, 2.8];
const MAINT_SHARE = [0.35, 0.3, 0.3, 0.35, 0.4, 0.45, 0.5, 0.68, 0.72, 0.7, 0.6, 0.42];
const COUNTER = [1.6, 1.4, 1.1, 1.0, 1.0, 0.9, 0.9, 1.3, 2.2, 2.8, 2.9, 2.6];
const QUOTE_LEADS = [0.9, 0.8, 0.9, 1.0, 1.0, 0.9, 0.9, 1.1, 1.4, 1.6, 1.5, 1.1];

const TOP_SELLERS: Record<string, number> = {
  'LOPI-DVL': 1.7, 'DIM-XLF60': 1.9, 'HRG-OAK24': 2.0, 'HG-ESC-I35': 1.5,
  'QF-3100M': 1.4, 'LOPI-ANSWER': 1.5, 'HPC-FP30': 1.3, 'VC-DEFIANT': 1.2,
};

const INTERESTS: { label: string; category: ItemCategory; noun: string; fuel?: string }[] = [
  { label: 'Gas Fireplaces', category: 'Gas fireplaces', noun: 'gas fireplace' },
  { label: 'Fireplace Inserts', category: 'Inserts', noun: 'fireplace insert' },
  { label: 'Wood Stoves', category: 'Stoves', noun: 'wood stove', fuel: 'Wood' },
  { label: 'Electric Fireplaces', category: 'Electric fireplaces', noun: 'electric fireplace' },
  { label: 'Gas Log Sets', category: 'Gas logs', noun: 'gas log set' },
  { label: 'Outdoor Fireplaces', category: 'Outdoor', noun: 'outdoor fireplace' },
  { label: 'Gas Stoves', category: 'Stoves', noun: 'gas stove', fuel: 'Gas' },
  { label: 'Pellet Stoves & Inserts', category: 'Stoves', noun: 'pellet stove', fuel: 'Pellet' },
  { label: 'Wood-Burning Fireplaces', category: 'Wood fireplaces', noun: 'wood-burning fireplace' },
];

const PROJECTS: [value: string, label: string][] = [
  ['remodel', 'Remodel or addition'],
  ['replace', 'Replace or upgrade an existing fireplace'],
  ['new-construction', 'New construction'],
  ['exploring', 'Just exploring'],
];

const TIMELINES = ['As soon as possible', 'In the next 1–3 months', 'In 3–6 months', '6 months or more', 'Just researching'];

const SERVICE_ISSUES: { key: string; label: string; issue?: string; text: string[] }[] = [
  { key: 'annual', label: 'Annual service & cleaning', text: ['Due for our yearly cleaning and inspection before it gets cold.', 'Would like to get on the schedule for annual service. Last done about a year ago.', 'Please schedule the annual check-up — we use it every evening in winter.'] },
  { key: 'wont-light', label: 'Won’t light or won’t stay lit', issue: 'pilot', text: ['Pilot lights but goes out after a minute or so.', 'It clicks and clicks but the burner never lights.', 'Pilot keeps going out overnight. Started this week.'] },
  { key: 'ignition', label: 'Pilot or ignition problem', issue: 'ignition', text: ['Igniter glows but the pellets never catch.', 'No spark at the pilot anymore.'] },
  { key: 'controls', label: 'Remote, fan or controls', issue: 'controls', text: ['Remote stopped working — already tried new batteries.', 'Fan makes a loud rattle on high.', 'Wall switch does nothing; remote works sometimes.'] },
  { key: 'glass', label: 'Glass, doors or gaskets', issue: 'glass', text: ['Glass has a white haze that won’t come off.', 'Door gasket is frayed and smoke leaks out.'] },
  { key: 'other', label: 'Something else', issue: 'soot', text: ['There’s a smell the first few minutes after it starts.', 'Flames look tall and orange and there’s soot on the glass.'] },
];

const NOTE_TEMPLATES: Record<string, string[]> = {
  pilot: ['Replaced thermocouple; pilot holding steady after 20 min test.', 'Cleaned pilot hood and replaced thermopile. Millivolts back in spec.'],
  ignition: ['Replaced igniter, ran full start-up cycle twice.', 'Cleaned spark electrode and adjusted gap; lights every time now.'],
  controls: ['Re-paired remote to receiver and replaced receiver batteries.', 'Replaced receiver module; tested all functions.'],
  blower: ['Blower bearings worn — replaced blower kit.', 'Cleaned blower wheel and secured loose housing.'],
  glass: ['Cleaned glass and replaced door gasket.', 'Glass etched; ordered replacement panel.'],
  soot: ['Repositioned logs per manual, adjusted air shutter. Burning clean.', 'Cleaned soot, corrected log placement.'],
  venting: ['Resealed vent joint and cleared termination screen.', 'Swept flue and adjusted damper; draft is good.'],
  valve: ['Gas valve failed regulation test — replaced valve.', 'Replaced valve; leak tested all connections.'],
  auger: ['Auger motor seized — replaced and cleared hopper.', 'Cleared pellet jam and replaced auger motor.'],
  power: ['Battery backup pack replaced and tested on outage mode.', 'Installed new battery backup; reviewed outage operation.'],
  heater: ['Reset heater thermal cutoff; cleaned intake.', 'Replaced flame-effect motor.'],
  maintenance: ['Annual service complete. All readings in spec.', 'Cleaned and inspected; recommended new batteries next visit.', 'Service complete — glass cleaned, gasket good, venting clear.'],
  install: ['Install complete. Customer walked through operation and warranty registration.', 'Finished install; trim and media set. Customer very happy.'],
  estimate: ['Measured the opening and checked the venting route. Sending options tonight.', 'Customer is leaning toward a linear unit; needs about 30 ft of new gas line.', 'Chimney is in good shape for an insert. Took photos for the estimate.'],
};

export function createDemo(T: string, clock = '10:30'): { db: DB; history: History } {
  const rng = createRng(1975);
  const NOW = `${T}T${clock}`;
  const windowStart = addDays(T, -WINDOW_DAYS);
  const historyStart = addDays(windowStart, -HISTORY_DAYS);

  const items = buildItems();
  const itemById = new Map(items.map((i) => [i.id, i]));
  const unitModels = items.filter((i) => i.kind === 'unit');
  /** Models still made — discontinued ones appear only in older customers' homes, never in recent sales */
  const currentModels = unitModels.filter((i) => i.productStatus !== 'discontinued');

  const counters: Record<string, number> = { customer: 1001, unit: 2001, lead: 3001, job: 41001, invoice: 10001, estimate: 1201, claim: 501, po: 3101, bill: 7001, x: 1, hist: 1 };
  const nextId = (key: string, prefix: string) => `${prefix}-${counters[key]++}`;
  const uid = (prefix: string) => `${prefix}${counters.x++}`;

  const customers: Customer[] = [];
  const customerById = new Map<string, Customer>();
  const units: Unit[] = [];
  const claims: WarrantyClaim[] = [];
  const jobs: Job[] = [];
  const leads: Lead[] = [];
  const invoices: Invoice[] = [];
  const moves: StockMove[] = [];
  const jobFacts: JobFact[] = [];
  const saleFacts: SaleFact[] = [];
  const leadFacts: LeadFact[] = [];

  const settings: Settings = {
    taxRates: { 'osage-beach': 0.0835, nixa: 0.081 },
    terms: 'Net 15',
    invoiceFooter: 'Thank you for choosing HMI Fireplace Shops — family-owned since 1975.',
    laborRate: 115,
    tripCharge: 129,
    annualService: { gas: 189, wood: 229, pellet: 209 },
    forms: {
      routing: {
        quote: { 'osage-beach': 'matt', nixa: 'mark' },
        service: { 'osage-beach': 'amanda', nixa: 'amanda' },
      },
      autoReply: true,
      autoReplyText:
        'Thanks for contacting HMI Fireplace Shops! We received your request and someone from our team will reach out within one business day. If it’s urgent, call the showroom nearest you.',
    },
    notifications: { newLead: true, jobCompleted: true, paymentReceived: true, lowStock: true, dailyDigest: false },
    permissions: structuredClone(defaultPermissions),
  };

  const month = (day: string) => +day.slice(5, 7) - 1;
  const dayFactor = (day: string) => {
    const wd = weekday(day);
    return wd === 0 ? 0 : wd === 6 ? 0.3 : 1;
  };
  const q = (h: number) => Math.max(0.25, Math.round(h * 4) / 4);
  /** A whole count averaging `mean` with little day-to-day noise (keeps monthly totals steady) */
  const count = (mean: number) => Math.floor(mean) + (rng.next() < mean - Math.floor(mean) ? 1 : 0);
  /** Smooth growth across the timeline: 1.0 today, 1/GROWTH a year ago */
  const trend = (day: string) => GROWTH ** (diffDays(day, T) / 365);
  const streamKey = (str: string) => {
    let h = 2166136261;
    for (const ch of str) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
    return h >>> 0;
  };
  /**
   * Daily volume that carries the fraction left over from the day before, with a little jitter.
   * Monthly totals follow the season closely, so year-over-year comparisons show the built-in
   * growth rather than luck.
   */
  const volumes = new Map<string, number>();
  const smooth = (key: string, mean: number) => {
    const acc = (volumes.get(key) ?? rng.next()) + mean + rng.float(-0.25, 0.25) * Math.min(1, mean);
    const n = Math.max(0, Math.floor(acc));
    volumes.set(key, Math.min(1.5, Math.max(-0.5, acc - n)));
    return n;
  };
  const ln = (sigma: number) => Math.exp(rng.normal(0, sigma));
  const round5 = (n: number) => Math.round(n / 5) * 5;
  const cents = (n: number) => Math.round(n * 100) / 100;

  /* ---------- Model popularity & (sample) reliability ---------- */

  const popularity = new Map<string, number>();
  const reliability = new Map<string, number>();
  for (const m of unitModels) {
    popularity.set(m.id, rng.float(0.6, 1.4) * (TOP_SELLERS[m.id] ?? 1));
    reliability.set(m.id, rng.float(0.8, 1.15));
  }
  for (const [key, g] of Object.entries(legacyGroups)) reliability.set(key, g.factor);

  // Units in service that aren't in the customer registry (denominator for service rates)
  const base: Record<string, number> = {};
  for (const m of unitModels) base[m.id] = Math.round(40 + 70 * (popularity.get(m.id)! / 1.4) * rng.float(0.7, 1.3));
  Object.assign(base, { 'legacy-builder-gas': 340, 'legacy-vent-free': 150, 'legacy-pellet': 70, 'legacy-wood': 190 });

  function categoryWeights(store: StoreId, m: number): [ItemCategory, number][] {
    const fall = m >= 8 && m <= 11;
    const spring = m >= 2 && m <= 6;
    return [
      ['Gas fireplaces', store === 'osage-beach' ? 34 : 26],
      ['Inserts', (store === 'nixa' ? 24 : 18) * (fall ? 1.3 : 1)],
      ['Stoves', 13 * (fall ? 1.6 : 0.8)],
      ['Electric fireplaces', store === 'nixa' ? 12 : 9],
      ['Gas logs', 9 * (fall ? 1.3 : 0.9)],
      ['Outdoor', (store === 'osage-beach' ? 9 : 6) * (spring ? 2.6 : fall ? 0.6 : 1)],
      ['Wood fireplaces', 5],
    ];
  }

  function pickModel(store: StoreId, day: string, category?: ItemCategory, fuel?: string): Item {
    const cat = category ?? rng.weighted(categoryWeights(store, month(day)));
    const models = day >= historyStart ? currentModels : unitModels;
    let pool = models.filter((i) => i.category === cat && (!fuel || i.fuel === fuel || (fuel === 'Gas' && i.fuel === 'Gas')));
    if (!pool.length) pool = models.filter((i) => i.category === cat);
    return rng.weighted(pool.map((i) => [i, popularity.get(i.id)!] as const));
  }

  /**
   * Install mix per store and month: systematic sampling over the expected mix (a shuffled "deck"),
   * seeded by month of year. Each model sells in proportion to its popularity, monthly revenue
   * follows the season instead of a lucky run, and last October looks like this October.
   */
  const decks = new Map<string, { cards: string[]; round: number }>();
  function drawModel(store: StoreId, day: string): Item {
    const key = `${store}|${day.slice(0, 7)}`;
    let deck = decks.get(key);
    if (!deck || !deck.cards.length) {
      const round = (deck?.round ?? 0) + 1;
      const r = createRng(streamKey(`${store}|${day.slice(5, 7)}|deck|${round}`));
      const m = month(day);
      const first = `${day.slice(0, 7)}-01`;
      let expected = 0;
      for (let d = first; d.slice(0, 7) === day.slice(0, 7); d = addDays(d, 1)) expected += INSTALLS[m] * STORE_FACTOR[store] * dayFactor(d);
      const n = Math.max(6, Math.round(expected));
      const cats = categoryWeights(store, m);
      const catTotal = cats.reduce((sum, [, w]) => sum + w, 0);
      const weights: [string, number][] = [];
      for (const [cat, cw] of cats) {
        const models = currentModels.filter((i) => i.category === cat);
        const popTotal = models.reduce((sum, i) => sum + popularity.get(i.id)!, 0);
        for (const i of models) weights.push([i.id, (cw / catTotal) * (popularity.get(i.id)! / popTotal)]);
      }
      const step = 1 / n;
      let point = r.next() * step;
      let acc = 0;
      const cards: string[] = [];
      for (const [id, w] of weights) {
        acc += w;
        while (point < acc && cards.length < n) {
          cards.push(id);
          point += step;
        }
      }
      deck = { cards: r.shuffle(cards), round };
      decks.set(key, deck);
    }
    return itemById.get(deck.cards.pop()!)!;
  }

  /* ---------- People ---------- */

  const usedPhones = new Set<string>();
  const areaCodes: Record<StoreId, [string, number][]> = {
    'osage-beach': [['573', 50], ['816', 20], ['314', 14], ['636', 10], ['913', 6]],
    nixa: [['417', 84], ['573', 6], ['816', 5], ['479', 5]],
  };
  function newPhone(store: StoreId) {
    for (let i = 0; i < 60; i++) {
      const p = `${rng.weighted(areaCodes[store])}-555-01${String(rng.int(0, 99)).padStart(2, '0')}`;
      if (!usedPhones.has(p)) {
        usedPhones.add(p);
        return p;
      }
    }
    return `${store === 'osage-beach' ? '573' : '417'}-555-01${String(rng.int(0, 99)).padStart(2, '0')}`;
  }

  const usedEmails = new Set<string>();
  function newEmail(first: string, last: string) {
    const stem = `${first}.${last}`.toLowerCase().replace(/[^a-z.]/g, '');
    const domains = ['example.com', 'example.net', 'example.org'];
    for (let n = 0; n < 30; n++) {
      const e = `${stem}${n ? n + 1 : ''}@${rng.pick(domains)}`;
      if (!usedEmails.has(e)) {
        usedEmails.add(e);
        return e;
      }
    }
    return `${stem}${rng.int(100, 999)}@example.com`;
  }

  function newCustomer(store: StoreId, since: string, o: Partial<Customer> & { first?: string; last?: string } = {}): Customer {
    const first = o.first ?? rng.pick(firstNames);
    const last = o.last ?? rng.pick(lastNames);
    const town = rng.weighted(towns[store].map((t) => [t, t.weight] as const));
    const c: Customer = {
      id: o.id ?? nextId('customer', 'C'),
      name: o.name ?? (rng.chance(0.12) ? `${first} & ${rng.pick(firstNames)} ${last}` : `${first} ${last}`),
      contact: o.contact,
      kind: o.kind ?? 'homeowner',
      phone: o.phone ?? newPhone(store),
      email: o.email ?? newEmail(first, last),
      address: o.address ?? { street: `${rng.int(100, 9899)} ${rng.pick(streets[store])}`, city: town.city, state: 'MO', zip: town.zip },
      store,
      since,
      tags: o.tags ?? [],
      notes: o.notes,
      contactPref: o.contactPref ?? rng.weighted([['phone', 5], ['email', 3], ['text', 2]] as const),
      servicePlan: o.servicePlan ?? rng.chance(0.22),
    };
    if (c.servicePlan && !c.tags.includes('Service plan')) c.tags.push('Service plan');
    if (store === 'osage-beach' && c.kind === 'homeowner' && rng.chance(0.3)) c.tags.push('Lake home');
    customers.push(c);
    customerById.set(c.id, c);
    return c;
  }

  /* ---------- Units ---------- */

  const unitById = new Map<string, Unit>();
  const unitsByStore: Record<StoreId, Unit[]> = { 'osage-beach': [], nixa: [] };

  function serialFor(brand: string, day: string) {
    const letters = brand === 'Other' ? 'XX' : brand.split(/[\s&-]+/).filter(Boolean).map((w) => w[0]).join('').toUpperCase().slice(0, 3);
    return `${letters}${day.slice(2, 4)}-${rng.int(100000, 999999)}`;
  }

  function newUnit(c: Customer, installedOn: string, src: { itemId?: string; legacy?: string }): Unit {
    let u: Unit;
    if (src.itemId) {
      const it = itemById.get(src.itemId)!;
      const w = it.warranty ?? { partsYears: 1, laborYears: 1, fireboxLifetime: false };
      const fuel = it.fuel === 'Gas' ? (c.store === 'osage-beach' ? (rng.chance(0.55) ? 'Propane' : 'Natural gas') : rng.chance(0.82) ? 'Natural gas' : 'Propane') : it.fuel!;
      const age = diffDays(T, installedOn);
      u = {
        id: nextId('unit', 'U'),
        customerId: c.id,
        itemId: it.id,
        model: it.name,
        brand: it.brand,
        category: it.category,
        fuel,
        serial: serialFor(it.brand, installedOn),
        room: rng.pick(it.category === 'Outdoor' ? ['Covered patio', 'Outdoor kitchen', 'Lake deck'] : rooms),
        installedOn,
        installedBy: 'HMI',
        warranty: {
          terms: `${w.fireboxLifetime ? 'Limited lifetime firebox · ' : ''}${w.partsYears} yr parts · ${w.laborYears} yr HMI labor`,
          partsUntil: addDays(installedOn, Math.round(w.partsYears * 365.25)),
          laborUntil: addDays(installedOn, Math.round(w.laborYears * 365.25)),
          fireboxLifetime: w.fireboxLifetime,
          registered: age > 21 ? rng.chance(0.992) : rng.chance(0.5),
        },
      };
      if (u.warranty.registered) u.warranty.registrationNo = regNo(u.id);
    } else {
      const g = legacyGroups[src.legacy!];
      u = {
        id: nextId('unit', 'U'),
        customerId: c.id,
        legacyGroup: src.legacy,
        model: g.label.replace(/ \(.+\)$/, ''),
        brand: 'Other',
        category: g.category,
        fuel: g.fuel,
        serial: serialFor('Other', installedOn),
        room: rng.pick(rooms),
        installedOn,
        installedBy: 'Other',
        warranty: { terms: 'No HMI warranty — installed by others', fireboxLifetime: false, registered: false },
      };
    }
    units.push(u);
    unitById.set(u.id, u);
    unitsByStore[c.store].push(u);
    return u;
  }

  const groupOf = (u: Unit) => u.itemId ?? u.legacyGroup!;
  /** Stable registration number from the unit id (keeps the random sequence independent of it) */
  function regNo(id: string) {
    let h = 2166136261;
    for (const ch of id) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
    return `REG-${1_000_000 + (Math.abs(h) % 9_000_000)}`;
  }
  const shortModel = (u: Unit) => (u.brand === 'Other' ? u.model : `${u.brand} ${(u.itemId && itemById.get(u.itemId)?.model) || u.model.replace(/ (Gas|Wood|Pellet) (Fireplace|Insert|Stove)$/, '')}`);

  /* ---------- Installed base: customers from before the history window ---------- */

  const pickLegacy = () => rng.weighted([['legacy-builder-gas', 45], ['legacy-vent-free', 18], ['legacy-pellet', 10], ['legacy-wood', 27]] as const);
  for (const store of STORES) {
    const n = store === 'osage-beach' ? 150 : 120;
    for (let i = 0; i < n; i++) {
      const legacy = rng.chance(0.36);
      const installed = legacy ? addDays(historyStart, -rng.int(500, 5200)) : addDays(historyStart, -rng.int(20, 1700));
      const c = newCustomer(store, legacy ? addDays(historyStart, -rng.int(20, 1400)) : installed);
      newUnit(c, installed, legacy ? { legacy: pickLegacy() } : { itemId: pickModel(store, installed).id });
      if (rng.chance(0.12)) newUnit(c, addDays(installed, rng.int(30, 900)), { itemId: pickModel(store, installed, rng.pick(['Outdoor', 'Gas logs', 'Electric fireplaces'] as const)).id });
    }
  }

  // Builders and counter-sale accounts
  const builderCustomers = builders.map((b, i) => {
    const store: StoreId = i % 2 === 0 ? 'nixa' : 'osage-beach';
    const [first, last] = b.contact.split(' ');
    return newCustomer(store, addDays(historyStart, -rng.int(200, 2400)), {
      name: b.name,
      contact: b.contact,
      kind: 'builder',
      first,
      last,
      tags: ['Builder', 'Net 30'],
      servicePlan: false,
      contactPref: 'email',
    });
  });
  const walkIn: Record<StoreId, Customer> = {
    'osage-beach': newCustomer('osage-beach', addDays(historyStart, -3000), { id: 'C-0001', name: 'Counter sale — Osage Beach', kind: 'business', first: 'counter', last: 'osage', tags: ['Counter sales'], servicePlan: false, contactPref: 'email', email: 'counter-osage@example.com' }),
    nixa: newCustomer('nixa', addDays(historyStart, -3000), { id: 'C-0002', name: 'Counter sale — Nixa', kind: 'business', first: 'counter', last: 'nixa', tags: ['Counter sales'], servicePlan: false, contactPref: 'email', email: 'counter-nixa@example.com' }),
  };

  /* ---------- Technician helpers ---------- */

  const prof = (id: string) => techProfiles[id] ?? { speed: 1, onTime: 0.92, callback: 0.05 };

  function installCrew(store: StoreId, cat: ItemCategory): string[] {
    const [lead, helper] = crews[store].installers;
    const small = cat === 'Electric fireplaces' || cat === 'Gas logs';
    if (small) return [rng.chance(0.55) ? helper : lead];
    if (cat === 'Inserts' && rng.chance(0.35)) return [lead];
    return [lead, helper];
  }

  function installHours(cat: ItemCategory, crew: string[]) {
    const est = installStandards[cat]?.hours ?? 4;
    const lead = prof(crew[0]);
    const crewFactor = crew.length > 1 ? 0.94 : 1.12;
    const actual = Math.min(est * 1.8, Math.max(est * 0.55, est * lead.speed * crewFactor * ln(0.12)));
    return { est, actual: q(actual) };
  }

  function serviceHours(type: JobType, tech: string, fuel: string) {
    const fc = fuelClass(fuel);
    const est = type === 'maintenance' ? (fc === 'wood' ? 2 : fc === 'pellet' ? 1.75 : 1.5) : 1.5;
    const sigma = type === 'repair' ? 0.3 : type === 'warranty' ? 0.25 : 0.15;
    const bias = type === 'warranty' ? 1.12 : 1;
    const actual = Math.min(est * 2.6, Math.max(0.5, est * prof(tech).speed * bias * ln(sigma)));
    return { est, actual: q(actual) };
  }

  function pickIssue(group: string, fuel: string): string {
    const weights = issueWeights[fuelClass(fuel)].map(([k, w]) => [k, w * (legacyGroups[group]?.boost.includes(k) ? 2.2 : 1)] as [string, number]);
    return rng.weighted(weights);
  }

  function partFor(issue: string): string | undefined {
    const parts = issues[issue]?.parts ?? [];
    if (!parts.length || rng.chance(0.18)) return undefined;
    return rng.pick(parts);
  }

  const underWarranty = (u: Unit, day: string) => !!u.warranty.partsUntil && u.warranty.partsUntil >= day;

  /* ---------- Pricing ---------- */

  // Add-ons follow a steady rhythm rather than a coin flip, so they don't swing monthly revenue
  const addOnTicks = { haul: 0, mantel: 0, stone: 0, permit: 0 };
  const every = (key: keyof typeof addOnTicks, n: number) => ++addOnTicks[key] % n === 0;

  function installLines(it: Item, store: StoreId): InvoiceLine[] {
    const std = installStandards[it.category] ?? { hours: 4, labor: 600, materials: 150, materialsLabel: 'Installation materials' };
    const discount = rng.chance(0.4) ? rng.float(0.02, 0.05) : 0;
    const lines: InvoiceLine[] = [
      { id: uid('l'), description: `${it.brand} ${it.name}`, qty: 1, rate: round5(it.price * (1 - discount)), itemId: it.id, category: 'Equipment', taxable: true },
      { id: uid('l'), description: std.materialsLabel, qty: 1, rate: round5(std.materials * rng.float(0.92, 1.1)), category: 'Parts', taxable: true },
      { id: uid('l'), description: 'Installation labor', qty: 1, rate: round5(std.labor * rng.float(0.94, 1.08)), category: 'Installation', taxable: false },
    ];
    if ((it.category === 'Gas fireplaces' || it.category === 'Inserts') && every('haul', 4)) {
      lines.push({ id: uid('l'), description: 'Remove and haul away existing unit', qty: 1, rate: 150, category: 'Installation', taxable: false });
    }
    if ((it.category === 'Gas fireplaces' || it.category === 'Wood fireplaces') && every('mantel', 5)) {
      const mantel = itemById.get('MAG-MANTEL60')!;
      lines.push({ id: uid('l'), description: `${mantel.brand} ${mantel.name}`, qty: 1, rate: mantel.price, itemId: mantel.id, category: 'Equipment', taxable: true });
    }
    if ((it.category === 'Gas fireplaces' || it.category === 'Outdoor') && every('stone', 6)) {
      const stone = itemById.get('CS-SLEDGE')!;
      lines.push({ id: uid('l'), description: `${stone.brand} ${stone.name}`, qty: 10, rate: stone.price, itemId: stone.id, category: 'Equipment', taxable: true });
    }
    if (it.fuel === 'Gas' && store === 'osage-beach' && every('permit', 2)) {
      lines.push({ id: uid('l'), description: 'Permit & inspection', qty: 1, rate: 75, category: 'Installation', taxable: false });
    }
    return lines;
  }

  function serviceLines(type: JobType, fuel: string, hours: number, part: string | undefined, callback: boolean): InvoiceLine[] {
    const fc = fuelClass(fuel);
    const lines: InvoiceLine[] = [];
    if (type === 'maintenance') {
      const price = fc === 'wood' ? settings.annualService.wood : fc === 'pellet' ? settings.annualService.pellet : settings.annualService.gas;
      lines.push({ id: uid('l'), description: `Annual service — ${fc === 'wood' ? 'wood appliance & chimney sweep' : fc === 'pellet' ? 'pellet appliance' : 'gas appliance'}`, qty: 1, rate: price, category: 'Service', taxable: false });
      if (fc === 'gas' && rng.chance(0.18)) {
        const b = itemById.get('P-BATT-BACKUP')!;
        lines.push({ id: uid('l'), description: b.name, qty: 1, rate: b.price, itemId: b.id, category: 'Parts', taxable: true });
      }
    } else if (type === 'repair') {
      if (!callback) lines.push({ id: uid('l'), description: 'Service call', qty: 1, rate: settings.tripCharge, category: 'Service', taxable: false });
      lines.push({ id: uid('l'), description: 'Labor', qty: q(hours), rate: settings.laborRate, category: 'Service', taxable: false });
      if (part) {
        const p = itemById.get(part)!;
        lines.push({ id: uid('l'), description: p.name, qty: p.uom === 'ft' ? 8 : 1, rate: p.price, itemId: p.id, category: 'Parts', taxable: true });
      }
    }
    return lines;
  }

  const subtotalOf = (lines: InvoiceLine[]) => lines.reduce((s, l) => s + l.qty * l.rate, 0);
  const totalOf = (lines: InvoiceLine[], rate: number) => cents(subtotalOf(lines) + lines.filter((l) => l.taxable).reduce((s, l) => s + l.qty * l.rate, 0) * rate);
  const revenueOf = (lines: InvoiceLine[]) => cents(subtotalOf(lines));

  function saleFactsFor(lines: InvoiceLine[], day: string, store: StoreId, channel: SaleFact['channel'], ref: string) {
    for (const l of lines) {
      if (!l.itemId) continue;
      const it = itemById.get(l.itemId)!;
      saleFacts.push({ id: `${ref}-${l.id}`, day, store, itemId: it.id, qty: l.qty, revenue: cents(l.qty * l.rate), cost: cents(l.qty * it.cost), channel });
    }
  }

  /* ---------- History: compact facts ---------- */

  interface Pending {
    day: string;
    store: StoreId;
    unit?: Unit;
    group: string;
    fuel: string;
    issue: string;
    crew: string[];
    prevId: string;
  }
  let pending: Pending[] = [];

  const lastService = new Map<string, string>();

  function pickRegistryUnit(store: StoreId, day: string, type: JobType): Unit | undefined {
    const pool = unitsByStore[store].filter((u) => u.installedOn < day && (type !== 'maintenance' || fuelClass(u.fuel) !== 'electric'));
    if (!pool.length) return undefined;
    for (let tries = 0; tries < 6; tries++) {
      const u = rng.pick(pool);
      if (type === 'maintenance') {
        const last = lastService.get(u.id);
        if (last && diffDays(day, last) < 300) continue;
        const c = customerById.get(u.customerId);
        if (!c?.servicePlan && rng.chance(0.4)) continue;
        return u;
      }
      if (type === 'warranty' && !underWarranty(u, day)) continue;
      if (rng.chance(Math.min(1, reliability.get(groupOf(u))! / 4.6))) return u;
    }
    return type === 'warranty' ? undefined : rng.pick(pool);
  }

  function pickAnonymousGroup(type: JobType): { group: string; fuel: string } {
    const entries = Object.entries(base)
      .filter(([g]) => type !== 'warranty' || !legacyGroups[g])
      .filter(([g]) => type !== 'maintenance' || (itemById.get(g)?.fuel ?? legacyGroups[g]?.fuel) !== 'Electric')
      .map(([g, n]) => [g, n * (type === 'maintenance' ? 1 : reliability.get(g)!)] as [string, number]);
    const group = rng.weighted(entries);
    const it = itemById.get(group);
    const fuel = it ? (it.fuel === 'Gas' ? 'Natural gas' : it.fuel!) : legacyGroups[group]!.fuel;
    return { group, fuel };
  }

  function serviceType(m: number): JobType {
    if (rng.chance(MAINT_SHARE[m])) return 'maintenance';
    return rng.chance(0.22) ? 'warranty' : 'repair';
  }

  function claimFor(u: Unit, store: StoreId, day: string, issue: string, part: string | undefined, jobId: string | undefined, age: number) {
    if (!u.itemId) return undefined;
    const it = itemById.get(u.itemId)!;
    const vendor = vendors.find((v) => v.id === it.vendorId)!;
    const partName = part ? itemById.get(part)!.name : issues[issue]?.label ?? 'Repair';
    const status: WarrantyClaim['status'] =
      age > 45 ? (rng.chance(0.88) ? 'credited' : 'denied') : age > 20 ? rng.weighted([['credited', 4], ['approved', 3], ['parts-shipped', 2], ['denied', 1]] as const) : age > 6 ? rng.weighted([['submitted', 4], ['approved', 3], ['parts-shipped', 2]] as const) : rng.weighted([['draft', 2], ['submitted', 5]] as const);
    const claim: WarrantyClaim = {
      id: nextId('claim', 'WC'),
      unitId: u.id,
      customerId: u.customerId,
      jobId,
      store,
      openedOn: day,
      issue,
      part: partName,
      manufacturer: vendor.name,
      claimNo: status === 'draft' ? undefined : `${vendor.name.split(' ').map((w) => w[0]).join('')}-${rng.int(100000, 999999)}`,
      status,
      credit: round5((part ? itemById.get(part)!.cost : 0) + rng.float(95, 185)),
      updatedOn: addDays(day, Math.min(age, rng.int(2, 30))),
      notes: status === 'denied' ? 'Denied — damage not covered (installation or use).' : undefined,
    };
    claims.push(claim);
    return claim;
  }

  function historyDay(day: string) {
    const df = dayFactor(day);
    const m = month(day);
    const g = trend(day);
    for (const store of STORES) leadFactsFor(day, store, m, (df || 0.25) * g);
    if (!df) return;
    for (const store of STORES) {
      // Installs
      const nInstall = smooth(`${store}|install`, INSTALLS[m] * STORE_FACTOR[store] * df * g);
      for (let i = 0; i < nInstall; i++) {
        const it = drawModel(store, day);
        const crew = installCrew(store, it.category);
        const { est, actual } = installHours(it.category, crew);
        const existing = rng.chance(0.15) ? rng.pick(customers.filter((c) => c.store === store && c.kind === 'homeowner')) : undefined;
        const c = existing ?? newCustomer(store, day);
        customerById.set(c.id, c);
        const u = newUnit(c, day, { itemId: it.id });
        const lines = installLines(it, store);
        const id = `H-${counters.hist++}`;
        saleFactsFor(lines, day, store, 'install', id);
        jobFacts.push({ id, day, store, type: 'install', crew, hours: actual, estHours: est, onTime: rng.chance(prof(crew[0]).onTime), unitId: u.id, customerId: c.id, group: it.id, callback: false, revenue: revenueOf(lines) });
        lastService.set(u.id, day);
      }

      // Service
      const due = pending.filter((p) => p.day === day && p.store === store);
      pending = pending.filter((p) => !(p.day === day && p.store === store));
      for (const p of due) serviceFact(day, store, 'repair', p);
      const nService = smooth(`${store}|service`, SERVICE[m] * STORE_FACTOR[store] * df * g);
      for (let i = 0; i < nService; i++) serviceFact(day, store, serviceType(m));

      // Counter sales
      const nCounter = smooth(`${store}|counter`, COUNTER[m] * STORE_FACTOR[store] * df * g);
      for (let i = 0; i < nCounter; i++) counterSaleFact(day, store, m);
    }
  }

  function serviceFact(day: string, store: StoreId, type: JobType, callback?: Pending) {
    const tech = callback ? (rng.chance(0.7) ? callback.crew[0] : rng.pick(crews[store].service)) : rng.pick(crews[store].service);
    let unit = callback?.unit;
    let group: string;
    let fuel: string;
    if (callback) {
      group = callback.group;
      fuel = callback.fuel;
    } else {
      unit = rng.chance(0.42) ? pickRegistryUnit(store, day, type) : undefined;
      if (unit) {
        group = groupOf(unit);
        fuel = unit.fuel;
      } else {
        ({ group, fuel } = pickAnonymousGroup(type));
      }
    }
    if (type === 'warranty' && (legacyGroups[group] || (unit && !underWarranty(unit, day)))) type = 'repair';
    if (type === 'maintenance' && fuelClass(fuel) === 'electric') type = 'repair';
    const issue = type === 'maintenance' ? undefined : callback?.issue ?? pickIssue(group, fuel);
    const part = issue ? partFor(issue) : undefined;
    const { est, actual } = serviceHours(type, tech, fuel);
    const lines = serviceLines(type, fuel, actual, part, !!callback);
    const id = `H-${counters.hist++}`;
    if (part && type === 'repair') saleFactsFor(lines.filter((l) => l.itemId), day, store, 'counter', id);
    jobFacts.push({ id, day, store, type, crew: [tech], hours: actual, estHours: est, onTime: rng.chance(prof(tech).onTime), unitId: unit?.id, customerId: unit?.customerId, group, issue, part, callback: !!callback, callbackOf: callback?.prevId, revenue: revenueOf(lines) });
    if (unit) lastService.set(unit.id, day);
    if (unit && type === 'warranty' && diffDays(T, day) <= 400) claimFor(unit, store, day, issue!, part, undefined, diffDays(T, day));
    if (type !== 'maintenance' && !callback) {
      const chance = prof(tech).callback * Math.sqrt(reliability.get(group) ?? 1);
      if (rng.chance(chance)) pending.push({ day: addDays(day, rng.int(3, 25)), store, unit, group, fuel, issue: issue!, crew: [tech], prevId: id });
    }
  }

  const COUNTER_ITEMS: [string, number][] = [
    ['ACC-RUTLAND', 30], ['ACC-PELLETS', 18], ['ACC-TOOLSET', 6], ['ACC-LOGRACK', 6], ['UNI-SCREEN3', 7], ['P-BATT-BACKUP', 8],
    ['HRG-OAK24', 6], ['ACC-HEARTHPAD', 3], ['P-GASKET34', 5], ['DIM-XLF60', 2], ['HPC-FP30', 1],
    ['STOLL-BF36', 1], ['DS-CAROLINA', 1], ['P-PROFLAME2', 3], ['HYC-CAP13', 2],
  ];

  function counterLines(m: number): InvoiceLine[] {
    const n = rng.chance(0.25) ? 2 : 1;
    const lines: InvoiceLine[] = [];
    for (let i = 0; i < n; i++) {
      const id = rng.weighted(COUNTER_ITEMS.map(([k, w]) => [k, k === 'ACC-PELLETS' ? w * (m >= 8 || m <= 2 ? 2 : 0.3) : w] as [string, number]));
      const it = itemById.get(id)!;
      const qty = it.id === 'ACC-PELLETS' ? rng.pick([5, 10, 20, 50]) : it.id === 'ACC-RUTLAND' ? rng.int(1, 3) : it.uom === 'ft' ? 10 : 1;
      lines.push({ id: uid('l'), description: `${it.brand === 'HMI Supply' ? '' : `${it.brand} `}${it.name}`, qty, rate: it.price, itemId: it.id, category: 'Retail', taxable: true });
    }
    return lines;
  }

  function counterSaleFact(day: string, store: StoreId, m: number) {
    const lines = counterLines(m);
    saleFactsFor(lines, day, store, 'counter', `H-${counters.hist++}`);
  }

  /* ---------- Requests (leads) ---------- */

  function receivedTime(day: string): string {
    const slot = rng.weighted([['business', 70], ['evening', 25], ['night', 5]] as const);
    const hour = slot === 'business' ? rng.int(8, 16) : slot === 'evening' ? rng.int(17, 22) : rng.int(5, 7);
    return `${day}T${String(hour).padStart(2, '0')}:${String(rng.int(0, 59)).padStart(2, '0')}`;
  }

  const two = (n: number) => String(n).padStart(2, '0');
  const openHour = (day: string) => (weekday(day) === 6 ? 9 : 8);
  const closeHour = (day: string) => (weekday(day) === 6 ? 13 : 17);
  const inBusinessHours = (dt: string) => {
    const h = +dt.slice(11, 13);
    return weekday(dt) !== 0 && h >= openHour(dt) && h < closeHour(dt);
  };
  const nextOpening = (dt: string) => {
    const day = dt.slice(0, 10);
    if (weekday(day) !== 0 && +dt.slice(11, 13) < openHour(day)) return `${day}T${two(openHour(day))}:00`;
    let d = addDays(day, 1);
    while (weekday(d) === 0) d = addDays(d, 1);
    return `${d}T${two(openHour(d))}:00`;
  };

  /** Minutes until someone reaches out — undefined for live calls and walk-ins */
  function responseMinutes(receivedAt: string, source: LeadSource): number | undefined {
    if (source === 'walk-in' || source === 'phone') return undefined;
    let t = receivedAt;
    for (let i = 0; i < 4 && !inBusinessHours(t); i++) t = nextOpening(t);
    const work = Math.min(600, Math.max(4, (source === 'facebook' ? 120 : 45) * ln(0.75)));
    return Math.round(diffMinutes(t, receivedAt) + work);
  }

  function leadFactsFor(day: string, store: StoreId, m: number, df: number) {
    const nQuote = smooth(`${store}|quote`, QUOTE_LEADS[m] * STORE_FACTOR[store] * df);
    for (let i = 0; i < nQuote; i++) {
      const source = rng.weighted([['web-quote', 42], ['phone', 22], ['walk-in', 18], ['facebook', 6], ['referral', 7], ['builder', 5]] as const);
      const at = receivedTime(day);
      const responseMins = responseMinutes(at, source);
      // Speed matters: requests answered quickly are won more often (live calls & walk-ins count as instant)
      const winRate = responseMins === undefined ? (source === 'walk-in' ? 0.5 : 0.42) : responseMins <= 60 ? 0.46 : responseMins <= 240 ? 0.37 : responseMins <= 1440 ? 0.29 : 0.2;
      const outcome = rng.chance(winRate) ? 'won' : rng.weighted([['lost', 64], ['closed', 36]] as const);
      leadFacts.push({ id: `HL-${counters.hist++}`, day, store, source, kind: 'quote', outcome, responseMins, value: round5(rng.float(1400, 11000)) });
    }
    const nService = smooth(`${store}|service-lead`, 0.55 * (SERVICE[m] / 2.4) * STORE_FACTOR[store] * df);
    for (let i = 0; i < nService; i++) {
      const source = rng.weighted([['web-service', 70], ['facebook', 8], ['phone', 22]] as const);
      const at = receivedTime(day);
      leadFacts.push({ id: `HL-${counters.hist++}`, day, store, source, kind: 'service', outcome: rng.chance(0.86) ? 'won' : 'closed', responseMins: responseMinutes(at, source), value: round5(rng.float(150, 480)) });
    }
    if (rng.chance(0.12 * df)) {
      const at = receivedTime(day);
      leadFacts.push({ id: `HL-${counters.hist++}`, day, store, source: 'facebook', kind: 'question', outcome: 'closed', responseMins: responseMinutes(at, 'facebook'), value: 0 });
    }
  }

  for (let day = historyStart; day < windowStart; day = addDays(day, 1)) historyDay(day);

  // Units' last service before the detailed window
  for (const u of units) {
    const last = lastService.get(u.id);
    if (last && last !== u.installedOn) u.lastServiceOn = last;
  }
  // Fill in service dates the history didn't cover: plan members stay current, others drift
  for (const u of units) {
    if (u.lastServiceOn || fuelClass(u.fuel) === 'electric' || diffDays(windowStart, u.installedOn) < 240) continue;
    const plan = customerById.get(u.customerId)?.servicePlan;
    const monthsAgo = plan ? rng.int(9, 12) : rng.chance(0.6) ? rng.int(9, 18) : rng.int(18, 36);
    const d = addDays(windowStart, -monthsAgo * 30 + rng.int(-10, 10));
    if (d > u.installedOn) u.lastServiceOn = d;
  }

  /* ======================================================================
     Detailed records: the last five weeks, today and the schedule ahead
     ====================================================================== */

  // Booked minutes per person per day, so jobs fill the gaps in a schedule.
  const busy = new Map<string, [number, number][]>();
  const toMin = (hhmm: string) => +hhmm.slice(0, 2) * 60 + +hhmm.slice(3, 5);
  const fromMin = (m: number) => `${two(Math.floor(m / 60))}:${two(m % 60)}`;
  const span = (hours: number) => Math.round(((hours + 0.5) * 60) / 15) * 15; // + travel

  function slot(staffId: string, day: string, hours: number, earliest = '08:00'): string {
    const key = `${staffId}|${day}`;
    const list = (busy.get(key) ?? []).sort((a, b) => a[0] - b[0]);
    const dur = span(hours);
    let t = toMin(earliest);
    for (const [s0, e0] of list) {
      if (t + dur <= s0) break;
      t = Math.max(t, e0);
    }
    list.push([t, t + dur]);
    busy.set(key, list);
    return `${day}T${fromMin(t)}`;
  }
  const reserve = (staffId: string, start: string, hours: number) => {
    const key = `${staffId}|${start.slice(0, 10)}`;
    const s0 = toMin(start.slice(11, 16));
    busy.set(key, [...(busy.get(key) ?? []), [s0, s0 + span(hours)]]);
  };
  const isFree = (staffId: string, start: string, hours: number) => {
    const s0 = toMin(start.slice(11, 16));
    const e0 = s0 + span(hours);
    return (busy.get(`${staffId}|${start.slice(0, 10)}`) ?? []).every(([a, b]) => e0 <= a || s0 >= b);
  };
  /** Minutes already booked */
  const load = (staffId: string, day: string) => (busy.get(`${staffId}|${day}`) ?? []).reduce((sum, [a, b]) => sum + b - a, 0);
  const leastBusy = (ids: string[], day: string) => ids.reduce((a, b) => (load(a, day) <= load(b, day) ? a : b));
  const nextBusinessDay = (day: string) => {
    let d = addDays(day, 1);
    while (weekday(d) === 0) d = addDays(d, 1);
    return d;
  };
  const clampDay = (d: string) => (d > T ? T : d);

  function act(at: string, by: string, kind: Activity['kind'], text: string): Activity {
    return { id: uid('a'), at: at > NOW ? addMinutes(NOW, -rng.int(5, 60)) : at, by, kind, text };
  }

  function checklistFor(type: JobType, fuel: string | undefined, done: boolean) {
    const fc = fuelClass(fuel);
    const key = type === 'maintenance' ? (fc === 'wood' ? 'maintenance-wood' : fc === 'pellet' ? 'maintenance-pellet' : 'maintenance') : type;
    return checklists[key].map((label, i) => ({ id: `c${i + 1}`, label, done }));
  }

  interface JobInput {
    type: JobType;
    store: StoreId;
    customer: Customer;
    unit?: Unit;
    itemId?: string;
    crew: string[];
    start?: string;
    hours: number;
    status: JobStatus;
    title: string;
    description: string;
    createdAt: string;
    leadId?: string;
    issue?: string;
    callbackOf?: string;
    value?: number;
    priority?: 'normal' | 'high';
  }

  function makeJob(p: JobInput): Job {
    const done = p.status === 'completed' || p.status === 'closed';
    const job: Job = {
      id: nextId('job', 'J'),
      type: p.type,
      title: p.title,
      customerId: p.customer.id,
      unitId: p.unit?.id,
      itemId: p.itemId,
      leadId: p.leadId,
      store: p.store,
      status: p.status,
      priority: p.priority ?? 'normal',
      start: p.start,
      hours: p.hours,
      crew: p.crew,
      description: p.description,
      checklist: checklistFor(p.type, p.unit?.fuel ?? (p.itemId ? itemById.get(p.itemId)?.fuel : undefined), done),
      parts: [],
      notes: [],
      createdAt: p.createdAt,
      issue: p.issue,
      callbackOf: p.callbackOf,
      value: p.value,
    };
    jobs.push(job);
    return job;
  }

  /** Mark a job finished with realistic arrival/finish times. */
  function finish(job: Job, actualHours: number, closed = true) {
    const lead = job.crew[0] ?? 'luis';
    const late = rng.chance(prof(lead).onTime) ? rng.int(-5, 12) : rng.int(20, 55);
    job.startedAt = addMinutes(job.start!, late);
    job.completedAt = addMinutes(job.startedAt, Math.round(actualHours * 60));
    job.status = closed ? 'closed' : 'completed';
    job.checklist = job.checklist.map((c) => ({ ...c, done: true }));
    const noteKey = job.type === 'install' || job.type === 'estimate' ? job.type : job.type === 'maintenance' ? 'maintenance' : job.issue ?? 'maintenance';
    job.notes.push(act(job.completedAt, lead, 'note', rng.pick(NOTE_TEMPLATES[noteKey] ?? NOTE_TEMPLATES.maintenance)));
    if (job.type !== 'estimate') {
      const c = customerById.get(job.customerId);
      job.signature = { name: c?.contact ?? c?.name.split(' & ')[0] ?? 'Customer', at: job.completedAt };
    }
  }

  function pay(inv: Invoice, date: string, amount: number, method?: PaymentMethod) {
    const m = method ?? rng.weighted([['card', 62], ['check', 26], ['ach', 6], ['cash', 6]] as const);
    inv.payments.push({ id: uid('p'), date, amount: cents(amount), method: m, ref: m === 'check' ? `#${rng.int(1001, 9899)}` : m === 'card' ? `•••• ${rng.int(1000, 9999)}` : undefined });
  }

  function makeInvoice(p: { customer: Customer; store: StoreId; lines: InvoiceLine[]; issuedOn: string; jobId?: string; leadId?: string; terms?: number; salesperson?: string; status?: Invoice['status']; kind?: Invoice['kind'] }): Invoice {
    const kind = p.kind ?? 'invoice';
    const inv: Invoice = {
      id: kind === 'estimate' ? nextId('estimate', 'EST') : nextId('invoice', 'INV'),
      kind,
      customerId: p.customer.id,
      jobId: p.jobId,
      leadId: p.leadId,
      store: p.store,
      issuedOn: p.issuedOn,
      dueOn: addDays(p.issuedOn, p.terms ?? (kind === 'estimate' ? 30 : p.customer.kind === 'builder' ? 30 : 15)),
      status: p.status ?? 'sent',
      lines: p.lines,
      taxRate: settings.taxRates[p.store],
      payments: [],
      sentAt: p.status === 'draft' ? undefined : `${p.issuedOn}T${String(rng.int(9, 17)).padStart(2, '0')}:${String(rng.int(0, 59)).padStart(2, '0')}`,
      salesperson: p.salesperson,
    };
    invoices.push(inv);
    return inv;
  }

  function moveOut(itemId: string, store: StoreId, qty: number, at: string, kind: StockMove['kind'], ref: string, by: string) {
    moves.push({ id: uid('m'), at, itemId, store, qty: -qty, kind, ref, by });
  }

  /* ---------- Window jobs (past days) ---------- */

  function recordInstall(day: string, store: StoreId, o: { customer?: Customer; itemId?: string; leadId?: string; createdAt?: string; status?: JobStatus; start?: string; depositOn?: string; salesperson?: string } = {}) {
    const it = o.itemId ? itemById.get(o.itemId)! : drawModel(store, day);
    let crew = installCrew(store, it.category);
    const status = o.status ?? 'closed';
    if (!o.start && load(crew[0], day) > 0) {
      if (status === 'closed') {
        const helper = crews[store].installers[1];
        if (load(helper, day) === 0) crew = [helper];
        else {
          // Both installers are booked: move to the next open day in the past, if there is one
          let next = nextBusinessDay(day);
          while (next < T && load(crew[0], next) > 0) next = nextBusinessDay(next);
          if (next < T) day = next;
        }
      } else {
        for (let tries = 0; tries < 8 && load(crew[0], day) > 0; tries++) day = nextBusinessDay(day);
      }
    }
    const { est, actual } = installHours(it.category, crew);
    const c = o.customer ?? newCustomer(store, addDays(day, -rng.int(14, 45)));
    customerById.set(c.id, c);
    const start = o.start ?? slot(crew[0], day, est);
    // Helpers who are already booked stay on their own job
    crew = crew.filter((t, i) => i === 0 || isFree(t, start, est));
    if (o.start) reserve(crew[0], start, est);
    crew.slice(1).forEach((t) => reserve(t, start, est));
    const lines = installLines(it, store);
    const room = rng.pick(rooms);
    const job = makeJob({
      type: 'install',
      store,
      customer: c,
      itemId: it.id,
      crew,
      start,
      hours: est,
      status: status === 'closed' ? 'scheduled' : status,
      title: `Install ${it.brand} ${it.name.replace(/ (Gas|Wood|Pellet|Electric) /, ' ')}`,
      description: `Install ${it.brand} ${it.name} in the ${room.toLowerCase()}. ${installStandards[it.category]?.materialsLabel ?? ''}.`,
      createdAt: o.createdAt ?? `${addDays(day, -rng.int(10, 30))}T${String(rng.int(9, 16)).padStart(2, '0')}:15`,
      leadId: o.leadId,
      value: revenueOf(lines),
    });
    job.parts.push({ itemId: it.id, qty: 1, store, status: status === 'closed' || status === 'completed' ? 'used' : 'reserved' });
    const salesperson = o.salesperson ?? crews[store].estimators[0];
    const inv = makeInvoice({ customer: c, store, lines, issuedOn: clampDay(o.depositOn ?? addDays(day, -rng.int(7, 25))), jobId: job.id, leadId: o.leadId, terms: 0, salesperson });
    inv.dueOn = day;
    job.invoiceId = inv.id;
    const total = totalOf(lines, inv.taxRate);
    pay(inv, inv.issuedOn, round5(total * 0.5), rng.chance(0.18) ? 'financing' : undefined);
    if (status === 'closed') {
      finish(job, actual);
      const u = newUnit(c, day, { itemId: it.id });
      job.unitId = u.id;
      moveOut(it.id, store, 1, job.completedAt!, 'job', job.id, crew[0]);
      if (rng.chance(c.kind === 'builder' ? 0.2 : 0.86)) pay(inv, clampDay(addDays(day, rng.int(0, 3))), total - inv.payments[0].amount);
    }
    return job;
  }

  /** A customer's appliance from a model/legacy group, adding a service customer when the store has none yet */
  function unitForGroup(store: StoreId, day: string, group: string, needWarranty: boolean): Unit {
    const pool = unitsByStore[store].filter((u) => groupOf(u) === group && u.installedOn < day && (!needWarranty || underWarranty(u, day)));
    if (pool.length && rng.chance(0.8)) return rng.pick(pool);
    const legacy = !!legacyGroups[group];
    const installed = addDays(day, -(legacy ? rng.int(900, 6000) : needWarranty ? rng.int(60, 700) : rng.int(200, 2400)));
    const c = newCustomer(store, addDays(installed, legacy ? rng.int(30, 800) : 0));
    return newUnit(c, installed, legacy ? { legacy: group } : { itemId: group });
  }

  function pickServiceUnit(store: StoreId, day: string, type: JobType): Unit {
    if (type === 'maintenance') return pickRegistryUnit(store, day, type) ?? rng.pick(unitsByStore[store]);
    const { group } = pickAnonymousGroup(type);
    return unitForGroup(store, day, group, type === 'warranty');
  }

  function recordService(day: string, store: StoreId, type: JobType, o: { unit?: Unit; issue?: string; callbackOf?: Job; leadId?: string; status?: JobStatus; tech?: string; start?: string; createdAt?: string; unscheduled?: boolean } = {}) {
    const unit = o.unit ?? pickServiceUnit(store, day, type);
    if (type === 'warranty' && !underWarranty(unit, day)) type = 'repair';
    if (type === 'maintenance' && fuelClass(unit.fuel) === 'electric') type = 'repair';
    const group = groupOf(unit);
    const c = customerById.get(unit.customerId)!;
    const issue = type === 'maintenance' ? undefined : o.issue ?? pickIssue(group, unit.fuel);
    const part = issue ? partFor(issue) : undefined;
    const tech = o.tech ?? (o.callbackOf && rng.chance(0.7) ? o.callbackOf.crew[0] : leastBusy(crews[store].service, day));
    const { est, actual } = serviceHours(type, tech, unit.fuel);
    const start = o.unscheduled ? undefined : o.start ?? slot(tech, day, est);
    if (o.start && !o.unscheduled) reserve(tech, o.start, est);
    const status = o.status ?? 'closed';
    const title =
      type === 'maintenance'
        ? `Annual service — ${shortModel(unit)}`
        : type === 'warranty'
          ? `Warranty: ${issues[issue!]?.label.toLowerCase()} — ${shortModel(unit)}`
          : `${o.callbackOf ? 'Return visit: ' : ''}${issues[issue!]?.label} — ${shortModel(unit)}`;
    const job = makeJob({
      type,
      store,
      customer: c,
      unit,
      crew: [tech],
      start,
      hours: est,
      status: status === 'closed' ? 'scheduled' : status,
      title,
      description: type === 'maintenance' ? 'Annual cleaning and safety inspection.' : `Customer reports: ${rng.pick(SERVICE_ISSUES.find((s) => s.issue === issue)?.text ?? ['Appliance not working properly.'])}`,
      createdAt: o.createdAt ?? `${addDays(day, -rng.int(1, 12))}T${String(rng.int(8, 16)).padStart(2, '0')}:${String(rng.int(0, 59)).padStart(2, '0')}`,
      leadId: o.leadId,
      issue,
      callbackOf: o.callbackOf?.id,
      value: type === 'warranty' ? 0 : revenueOf(serviceLines(type, unit.fuel, est, part, !!o.callbackOf)),
    });
    if (part) job.parts.push({ itemId: part, qty: itemById.get(part)!.uom === 'ft' ? 8 : 1, store, status: status === 'closed' || status === 'completed' ? 'used' : 'reserved' });
    if (status === 'closed' || status === 'completed') {
      finish(job, actual, status === 'closed');
      unit.lastServiceOn = day;
      if (part) moveOut(part, store, job.parts[0].qty, job.completedAt!, 'job', job.id, tech);
      if (type === 'warranty') {
        const claim = claimFor(unit, store, day, issue!, part, job.id, diffDays(T, day));
        if (claim) job.claimId = claim.id;
      } else if (status === 'closed') {
        const lines = serviceLines(type, unit.fuel, actual, part, !!o.callbackOf);
        const inv = makeInvoice({ customer: c, store, lines, issuedOn: day, jobId: job.id, leadId: o.leadId });
        job.invoiceId = inv.id;
        const total = totalOf(lines, inv.taxRate);
        const age = diffDays(T, day);
        if (rng.chance(0.8)) pay(inv, day, total, rng.weighted([['card', 75], ['check', 25]] as const));
        else if (age > 10 && rng.chance(0.82)) pay(inv, addDays(day, rng.int(5, Math.min(age, 20))), total, rng.weighted([['check', 60], ['card', 25], ['ach', 15]] as const));
      }
    }
    return job;
  }

  function recordCounterSale(day: string, store: StoreId) {
    const lines = counterLines(month(day));
    const c = rng.chance(0.55) ? walkIn[store] : rng.pick(customers.filter((x) => x.store === store && x.kind === 'homeowner'));
    const inv = makeInvoice({ customer: c, store, lines, issuedOn: day, terms: 0, salesperson: crews[store].estimators[0] });
    pay(inv, day, totalOf(lines, inv.taxRate), rng.weighted([['card', 72], ['cash', 18], ['check', 10]] as const));
    for (const l of lines) if (l.itemId) moves.push({ id: uid('m'), at: `${day}T${String(rng.int(9, 16)).padStart(2, '0')}:20`, itemId: l.itemId, store, qty: -l.qty, kind: 'sold', ref: inv.id, by: crews[store].estimators[0] });
  }

  const futureLinks: (() => void)[] = [];
  const routing = settings.forms.routing;
  // Requests come first: jobs they create count toward each day's normal volume (see below)
  for (let day = windowStart; day <= T; day = addDays(day, 1)) {
    const df = dayFactor(day) || 0.25; // web forms arrive on Sundays too
    const m = month(day);
    for (const store of STORES) {
      const g = trend(day);
      const nQuote = smooth(`${store}|quote`, QUOTE_LEADS[m] * STORE_FACTOR[store] * df * g);
      for (let i = 0; i < nQuote; i++) windowLead(day, store, 'quote');
      const nService = smooth(`${store}|service-lead`, 0.55 * (SERVICE[m] / 2.4) * STORE_FACTOR[store] * df * g);
      for (let i = 0; i < nService; i++) windowLead(day, store, 'service');
      if (rng.chance(0.1)) windowLead(day, store, 'question');
    }
  }

  const callbackQueue: { day: string; job: Job }[] = [];
  const carry: Record<StoreId, { install: number; service: number }> = { 'osage-beach': { install: 0, service: 0 }, nixa: { install: 0, service: 0 } };

  for (let day = windowStart; day < T; day = addDays(day, 1)) {
    const df = dayFactor(day);
    if (!df) continue;
    const m = month(day);
    for (const store of STORES) {
      for (const cb of callbackQueue.filter((x) => x.day === day && x.job.store === store)) {
        recordService(day, store, 'repair', { unit: unitById.get(cb.job.unitId!), issue: cb.job.issue, callbackOf: cb.job });
      }
      const g = trend(day);
      const fromRequests = jobs.filter((j) => j.leadId && j.store === store && j.start?.slice(0, 10) === day);
      const leadInstalls = fromRequests.filter((j) => j.type === 'install').length;
      const leadService = fromRequests.filter((j) => j.type !== 'install' && j.type !== 'estimate').length;
      // Requests that booked more than the day's normal volume borrow from the following days
      const installRoom = smooth(`${store}|install`, INSTALLS[m] * STORE_FACTOR[store] * df * g) - leadInstalls - carry[store].install;
      const nInstall = Math.max(0, installRoom);
      carry[store].install = Math.max(0, -installRoom);
      for (let i = 0; i < nInstall; i++) recordInstall(day, store, { itemId: drawModel(store, day).id });
      const serviceRoom = smooth(`${store}|service`, SERVICE[m] * STORE_FACTOR[store] * df * g) - leadService - carry[store].service;
      const nService = Math.max(0, serviceRoom);
      carry[store].service = Math.max(0, -serviceRoom);
      for (let i = 0; i < nService; i++) {
        const job = recordService(day, store, serviceType(m));
        if ((job.type === 'repair' || job.type === 'warranty') && !job.callbackOf) {
          const chance = prof(job.crew[0]).callback * Math.sqrt(reliability.get(groupOf(unitById.get(job.unitId!)!)) ?? 1);
          if (rng.chance(chance)) {
            const back = addDays(day, rng.int(3, 18));
            if (back < T) callbackQueue.push({ day: back, job });
          }
        }
      }
      const nCounter = smooth(`${store}|counter`, COUNTER[m] * STORE_FACTOR[store] * df * g);
      for (let i = 0; i < nCounter; i++) recordCounterSale(day, store);
    }
  }

  /* ---------- Requests in the window (full inbox records) ---------- */


  function interestFields(interest: (typeof INTERESTS)[number], extra: string[], project: string, timeline: string, store: StoreId, zip: string, pref: string): [string, string][] {
    return [
      ['Interested in', [interest.label, ...extra].join(', ')],
      ['Project', project],
      ['Timeline', timeline],
      ['Preferred showroom', rng.chance(0.3) ? 'Either is fine' : STORE_NAME[store]],
      ['Best way to reach you', pref],
      ['ZIP code', zip],
    ];
  }

  function quoteMessage(interest: (typeof INTERESTS)[number], projectKey: string, c: { city: string }): string {
    const room = rng.pick(['great room', 'living room', 'basement', 'family room', 'den']);
    switch (projectKey) {
      case 'remodel':
        return rng.pick([
          `We're remodeling the ${room} and would like to add a ${interest.noun}. Could someone help us choose the right size?`,
          `Finishing our ${room} this winter and want a ${interest.noun} as the focal point. What are our options?`,
        ]);
      case 'replace':
        return rng.pick([
          `Our old fireplace is drafty and we hardly use it. Interested in a ${interest.noun} — what would it take to switch?`,
          `Looking to replace a 20-year-old unit with a ${interest.noun}. Can you give us a ballpark?`,
        ]);
      case 'new-construction':
        return `Building in ${c.city}; framing starts in about ${rng.int(3, 8)} weeks. Need a ${interest.noun} for the ${room}.`;
      default:
        return rng.pick([`Just starting to look. Saw the ${interest.noun}s on your site and wanted rough pricing.`, `Curious what a ${interest.noun} would cost installed.`]);
    }
  }

  function windowLead(day: string, store: StoreId, kind: LeadKind) {
    const receivedAt = receivedTime(day);
    if (receivedAt > NOW) return;
    const age = diffDays(T, day);
    const town = rng.weighted(towns[store].map((t) => [t, t.weight] as const));
    const first = rng.pick(firstNames);
    const last = rng.pick(lastNames);
    let source: LeadSource;
    let lead: Lead;
    const pref = rng.weighted([['Phone call', 5], ['Email', 3], ['Text message', 2]] as const);
    const id = nextId('lead', 'R');
    if (kind === 'quote') {
      source = rng.weighted([['web-quote', 52], ['phone', 18], ['walk-in', 14], ['facebook', 6], ['referral', 7], ['builder', 3]] as const);
      const interest = rng.weighted(INTERESTS.map((x, i) => [x, [30, 22, 12, 12, 9, 6, 4, 3, 2][i]] as const));
      const extra = rng.chance(0.3) ? [rng.pick(['Mantels & Surrounds', 'Cultured Stone & Veneer', 'Fireplace Doors', 'Accessories & Care'])] : [];
      const [projectKey, project] = rng.weighted(PROJECTS.map((p, i) => [p, [36, 32, 14, 18][i]] as const));
      const timeline = rng.pick(TIMELINES);
      const message = quoteMessage(interest, projectKey, town);
      lead = {
        id,
        kind,
        source,
        receivedAt,
        name: `${first} ${last}`,
        email: newEmail(first, last),
        phone: newPhone(store),
        city: town.city,
        zip: town.zip,
        store,
        summary: `${interest.label} · ${project}`,
        message,
        fields: source === 'web-quote' ? interestFields(interest, extra, project, timeline, store, town.zip, pref) : [['Interested in', interest.label], ['Project', project], ['Timeline', timeline]],
        stage: 'new',
        assignee: routing.quote[store],
        unread: false,
        activity: [],
        value: round5(rng.float(1800, 9500)),
      };
      planQuote(lead, interest, age);
    } else if (kind === 'service') {
      source = rng.weighted([['web-service', 78], ['facebook', 6], ['phone', 16]] as const);
      const svc = rng.weighted(SERVICE_ISSUES.map((s, i) => [s, [34, 22, 8, 16, 10, 10][i]] as const));
      let unit = svc.key === 'annual' ? rng.pick(unitsByStore[store].filter((u) => u.installedOn < day && fuelClass(u.fuel) !== 'electric')) : pickServiceUnit(store, day, 'repair');
      if (svc.key !== 'annual' && fuelClass(unit.fuel) === 'electric') unit = pickServiceUnit(store, day, 'repair');
      const c = customerById.get(unit.customerId)!;
      lead = {
        id,
        kind,
        source,
        receivedAt,
        name: c.contact ?? c.name,
        email: c.email,
        phone: c.phone,
        city: c.address.city,
        zip: c.address.zip,
        address: `${c.address.street}, ${c.address.city}`,
        store,
        summary: `${svc.label} · ${unit.brand === 'Other' ? unit.category : unit.brand}`,
        message: rng.pick(svc.text),
        fields: [
          ['Type of appliance', unit.category.replace(/s$/, '').replace('Inserts', 'Insert')],
          ['Brand', unit.brand === 'Other' ? 'Not sure' : unit.brand],
          ['Purchased from HMI?', unit.installedBy === 'HMI' ? 'Yes' : 'No'],
          ['What do you need?', svc.label],
          ['Best days for a visit', rng.shuffle(['Mon', 'Tue', 'Wed', 'Thu', 'Fri']).slice(0, rng.int(1, 3)).join(', ')],
          ['Time of day', rng.pick(['Morning', 'Afternoon', 'Either'])],
          ['Service address', `${c.address.street}, ${c.address.city}`],
        ],
        photos: rng.chance(0.3) ? rng.int(1, 3) : undefined,
        stage: 'new',
        assignee: routing.service[store],
        customerId: c.id,
        unread: false,
        activity: [],
        value: round5(rng.float(150, 450)),
      };
      planService(lead, unit, svc.key === 'annual' ? 'maintenance' : svc.issue === 'pilot' && underWarranty(unit, day) && rng.chance(0.4) ? 'warranty' : 'repair', svc.issue, age);
    } else {
      source = 'facebook';
      const questions = [
        'Do you sell pellets by the pallet? Do you deliver?',
        'Are you open Saturday? Want to look at stoves with my husband.',
        'Do you service units you didn’t sell? Ours came with the house.',
        'How long does a gas insert install usually take?',
        'Can I get replacement glass for an older Heatilator?',
      ];
      lead = {
        id,
        kind,
        source,
        receivedAt,
        name: `${first} ${last}`,
        city: town.city,
        store,
        summary: 'Facebook message',
        message: rng.pick(questions),
        fields: [['Channel', 'Facebook Messenger']],
        stage: age > 1 ? 'closed' : rng.pick(['new', 'contacted'] as const),
        assignee: routing.service[store],
        unread: false,
        activity: [],
      };
    }
    // Activity trail
    lead.activity.push(act(receivedAt, 'customer', 'received', source.startsWith('web') ? 'Submitted on hmifireplaceshop.com' : source === 'facebook' ? 'Message received on Facebook' : source === 'walk-in' ? 'Logged from a showroom visit' : source === 'phone' ? 'Logged from a phone call' : 'Referral logged by staff'));
    if (source.startsWith('web') && settings.forms.autoReply) lead.activity.push(act(addMinutes(receivedAt, 1), 'system', 'email', 'Auto-reply sent: “Thanks for contacting HMI Fireplace Shops…”'));
    const mins = responseMinutes(receivedAt, source);
    if (lead.stage !== 'new') {
      const firstAt = mins === undefined ? receivedAt : addMinutes(receivedAt, mins);
      if (firstAt <= NOW) {
        lead.firstResponseAt = firstAt;
        if (mins !== undefined) lead.activity.push(act(firstAt, lead.assignee!, rng.chance(0.65) ? 'call' : 'email', rng.pick(['Called and talked through options.', 'Left a voicemail and sent an email with next steps.', 'Replied with availability and pricing ranges.'])));
      } else lead.stage = 'new';
    }
    if (lead.stage === 'new' && age === 0) lead.unread = rng.chance(0.7);
    leads.push(lead);
  }

  function planQuote(lead: Lead, interest: (typeof INTERESTS)[number], age: number) {
    const day = lead.receivedAt.slice(0, 10);
    const store = lead.store;
    const estimator = crews[store].estimators[rng.chance(0.75) ? 0 : 1];
    const stage: LeadStage =
      age >= 18 ? rng.weighted([['won', 36], ['lost', 30], ['closed', 14], ['quoted', 20]] as const)
        : age >= 5 ? rng.weighted([['contacted', 18], ['scheduled', 20], ['quoted', 32], ['won', 16], ['lost', 9], ['closed', 5]] as const)
          : age >= 1 ? rng.weighted([['contacted', 50], ['scheduled', 30], ['new', 20]] as const)
            : rng.weighted([['new', 70], ['contacted', 30]] as const);
    lead.stage = stage;
    if (stage === 'new' || stage === 'contacted' || stage === 'closed') {
      if (stage === 'closed') {
        lead.closedAt = `${addDays(day, rng.int(3, 10))}T11:00`;
        lead.activity.push(act(lead.closedAt, lead.assignee!, 'status', rng.pick(['Closed — no response after three attempts.', 'Closed — outside our service area.', 'Closed — just gathering information for now.'])));
      }
      return;
    }
    const customer = newCustomer(store, day, { name: lead.name, email: lead.email, phone: lead.phone, first: lead.name.split(' ')[0], last: lead.name.split(' ').slice(-1)[0], servicePlan: false });
    customerById.set(customer.id, customer);
    lead.customerId = customer.id;
    const visitDay = addDays(day, rng.int(1, 4));
    const it = pickModel(store, day, interest.category, interest.fuel);

    if (stage === 'scheduled') {
      const target = visitDay > T ? visitDay : addDays(T, rng.int(1, 6));
      futureLinks.push(() => {
        const d = weekday(target) === 0 ? addDays(target, 1) : target;
        const start = slot(estimator, d, 1, rng.pick(['09:00', '11:00', '14:00']));
        const job = makeJob({ type: 'estimate', store, customer, crew: [estimator], start, hours: 1, status: 'scheduled', title: `Site visit — ${interest.noun}`, description: `Measure and discuss ${interest.noun} options. ${lead.message ?? ''}`, createdAt: lead.firstResponseAt ?? lead.receivedAt, leadId: lead.id, value: lead.value });
        lead.jobId = job.id;
        lead.activity.push(act(job.createdAt, lead.assignee!, 'job', `Site visit scheduled for ${d} with ${staff.find((s) => s.id === estimator)!.name.split(' ')[0]}`));
      });
      return;
    }

    // Past site visit (quoted / won / lost)
    const vd = weekday(visitDay) === 0 ? addDays(visitDay, 1) : visitDay;
    if (vd < T) {
      const start = slot(estimator, vd, 1, '09:00');
      const visit = makeJob({ type: 'estimate', store, customer, crew: [estimator], start, hours: 1, status: 'scheduled', title: `Site visit — ${interest.noun}`, description: `Measure and discuss ${interest.noun} options.`, createdAt: lead.firstResponseAt ?? lead.receivedAt, leadId: lead.id, value: lead.value });
      finish(visit, q(rng.float(0.75, 1.5)));
      lead.jobId = visit.id;
    }
    const estDay = vd < T ? addDays(vd, rng.int(0, 2)) : day;
    const lines = installLines(it, store);
    const est = makeInvoice({ kind: 'estimate', customer, store, lines, issuedOn: estDay > T ? T : estDay, leadId: lead.id, salesperson: estimator });
    lead.estimateId = est.id;
    lead.value = revenueOf(lines);
    lead.activity.push(act(`${est.issuedOn}T15:30`, estimator, 'estimate', `Estimate ${est.id} sent — ${it.brand} ${it.name}`));
    if (stage === 'quoted') return;
    if (stage === 'lost') {
      est.status = 'declined';
      lead.lostReason = rng.pick(['Went with another dealer', 'Postponed to next year', 'Over budget', 'Chose a different product']);
      lead.closedAt = `${addDays(est.issuedOn, rng.int(4, 12))}T10:00`;
      lead.activity.push(act(lead.closedAt, lead.assignee!, 'status', `Marked lost — ${lead.lostReason.toLowerCase()}`));
      return;
    }
    // Won → install
    est.status = 'accepted';
    const acceptedOn = addDays(est.issuedOn, rng.int(1, 6));
    lead.closedAt = acceptedOn >= T ? `${T}T09:40` : `${acceptedOn}T13:10`;
    lead.activity.push(act(lead.closedAt, lead.assignee!, 'status', 'Estimate accepted — deposit collected'));
    const installDay = addDays(acceptedOn, rng.int(7, 21));
    if (installDay < T && weekday(installDay) !== 0) {
      const job = recordInstall(installDay, store, { customer, itemId: it.id, leadId: lead.id, depositOn: acceptedOn, salesperson: estimator });
      lead.activity.push(act(job.createdAt, 'amanda', 'job', `Installation ${job.id} scheduled`));
    } else {
      futureLinks.push(() => {
        let d = installDay > T ? installDay : addDays(T, rng.int(2, 12));
        if (weekday(d) === 0) d = addDays(d, 1);
        const job = recordInstall(d, store, { customer, itemId: it.id, leadId: lead.id, status: 'scheduled', depositOn: acceptedOn > T ? T : acceptedOn, createdAt: `${acceptedOn > T ? T : acceptedOn}T14:00`, salesperson: estimator });
        lead.activity.push(act(job.createdAt, 'amanda', 'job', `Installation ${job.id} scheduled`));
      });
    }
  }

  function planService(lead: Lead, unit: Unit, type: JobType, issue: string | undefined, age: number) {
    const day = lead.receivedAt.slice(0, 10);
    const stage: LeadStage = age >= 3 ? rng.weighted([['closed', 70], ['scheduled', 25], ['contacted', 5]] as const) : age >= 1 ? rng.weighted([['scheduled', 60], ['contacted', 40]] as const) : rng.weighted([['new', 75], ['contacted', 25]] as const);
    lead.stage = stage;
    const store = lead.store;
    if (stage === 'closed') {
      let d = addDays(day, rng.int(1, 5));
      if (weekday(d) === 0) d = addDays(d, 1);
      if (d >= T) {
        lead.stage = 'scheduled';
      } else {
        const job = recordService(d, store, type, { unit, issue, leadId: lead.id, createdAt: addMinutes(lead.receivedAt, 90) });
        lead.jobId = job.id;
        lead.closedAt = job.completedAt;
        lead.activity.push(act(job.createdAt, lead.assignee!, 'job', `${job.id} scheduled for ${d}`));
        lead.activity.push(act(job.completedAt!, 'system', 'status', `Closed — ${job.id} completed`));
        return;
      }
    }
    if (lead.stage === 'scheduled') {
      futureLinks.push(() => {
        let d = addDays(T, rng.int(0, 7));
        if (weekday(d) === 0) d = addDays(d, 1);
        const job = recordService(d, store, type, { unit, issue, leadId: lead.id, status: 'scheduled', createdAt: addMinutes(lead.receivedAt, 120) });
        lead.jobId = job.id;
        lead.activity.push(act(job.createdAt, lead.assignee!, 'job', `${job.id} scheduled for ${d}`));
      });
    }
  }

  /* ---------- Story records: the requests and jobs people will click first ---------- */

  const story = buildStory();

  function buildStory() {
    // Dale Hutchins — existing customer whose insert won't stay lit (shows customer matching)
    const dale = newCustomer('nixa', addDays(T, -1105), { first: 'Dale', last: 'Hutchins', name: 'Dale & Marcy Hutchins', address: { street: '418 Hickory Ridge Dr', city: 'Nixa', state: 'MO', zip: '65714' }, contactPref: 'phone', servicePlan: false, tags: [] });
    customerById.set(dale.id, dale);
    const daleUnit = newUnit(dale, addDays(T, -1102), { itemId: 'HG-ESC-I35' });
    daleUnit.fuel = 'Natural gas';
    daleUnit.room = 'Family room';
    daleUnit.lastServiceOn = addDays(T, -372);

    const karen: Lead = {
      id: nextId('lead', 'R'),
      kind: 'quote',
      source: 'web-quote',
      receivedAt: addMinutes(NOW, -25),
      name: 'Karen Whitfield',
      email: 'karen.whitfield@example.com',
      phone: '816-555-0147',
      city: 'Lake Ozark',
      zip: '65049',
      store: 'osage-beach',
      summary: 'Gas Fireplaces, Mantels & Surrounds · Remodel or addition',
      message:
        'We’re redoing the great room at our lake house and want to replace the old wood-burning fireplace with gas. It’s a two-story stone wall, so we’d love for someone to come take a look before we pick anything.',
      fields: [
        ['Interested in', 'Gas Fireplaces, Mantels & Surrounds'],
        ['Project', 'Remodel or addition'],
        ['Timeline', 'In the next 1–3 months'],
        ['Preferred showroom', 'Osage Beach'],
        ['Best way to reach you', 'Phone call'],
        ['ZIP code', '65049'],
      ],
      stage: 'new',
      assignee: 'matt',
      unread: true,
      value: 7800,
      activity: [],
    };
    karen.activity.push(act(karen.receivedAt, 'customer', 'received', 'Submitted on hmifireplaceshop.com'));
    karen.activity.push(act(addMinutes(karen.receivedAt, 1), 'system', 'email', 'Auto-reply sent: “Thanks for contacting HMI Fireplace Shops…”'));

    const daleLead: Lead = {
      id: nextId('lead', 'R'),
      kind: 'service',
      source: 'web-service',
      receivedAt: addMinutes(NOW, -78),
      name: 'Dale Hutchins',
      email: dale.email,
      phone: dale.phone,
      city: 'Nixa',
      zip: '65714',
      address: '418 Hickory Ridge Dr, Nixa',
      store: 'nixa',
      summary: 'Won’t light or won’t stay lit · Heat & Glo',
      message: 'Pilot lights but goes out after about a minute. Started when we turned it on for the season last weekend.',
      fields: [
        ['Type of appliance', 'Gas insert'],
        ['Brand', 'Heat & Glo'],
        ['Model or serial number', 'Escape I35 I think'],
        ['Purchased from HMI?', 'Yes'],
        ['What do you need?', 'Won’t light or won’t stay lit'],
        ['Best days for a visit', 'Wed, Thu'],
        ['Time of day', 'Morning'],
        ['Service address', '418 Hickory Ridge Dr, Nixa'],
        ['Nearest showroom', 'Nixa'],
      ],
      photos: 2,
      stage: 'new',
      assignee: 'amanda',
      customerId: dale.id,
      unread: true,
      value: 280,
      activity: [],
    };
    daleLead.activity.push(act(daleLead.receivedAt, 'customer', 'received', 'Submitted on hmifireplaceshop.com'));
    daleLead.activity.push(act(addMinutes(daleLead.receivedAt, 1), 'system', 'email', 'Auto-reply sent: “Thanks for contacting HMI Fireplace Shops…”'));

    const priya: Lead = {
      id: nextId('lead', 'R'),
      kind: 'service',
      source: 'web-service',
      receivedAt: addMinutes(NOW, -162),
      name: 'Priya Raman',
      email: 'priya.raman@example.org',
      phone: '417-555-0163',
      city: 'Springfield',
      zip: '65810',
      address: '2210 Aldersgate Dr, Springfield',
      store: 'nixa',
      summary: 'Annual service & cleaning · Lopi',
      message: 'Would like to get on the schedule for a sweep and inspection before it turns cold. We burn about two cords a winter.',
      fields: [
        ['Type of appliance', 'Wood stove or insert'],
        ['Brand', 'Lopi'],
        ['Purchased from HMI?', 'No'],
        ['What do you need?', 'Annual service & cleaning'],
        ['Best days for a visit', 'Mon, Fri'],
        ['Time of day', 'Afternoon'],
        ['Service address', '2210 Aldersgate Dr, Springfield'],
        ['Nearest showroom', 'Nixa'],
      ],
      stage: 'new',
      assignee: 'amanda',
      unread: true,
      value: 229,
      activity: [],
    };
    priya.activity.push(act(priya.receivedAt, 'customer', 'received', 'Submitted on hmifireplaceshop.com'));

    const brandt: Lead = {
      id: nextId('lead', 'R'),
      kind: 'quote',
      source: 'web-quote',
      receivedAt: `${addDays(T, -1)}T16:12`,
      name: 'Tom & Lisa Brandt',
      email: 'tbrandt@example.net',
      phone: '573-555-0118',
      city: 'Camdenton',
      zip: '65020',
      store: 'osage-beach',
      summary: 'Wood Stoves · Just exploring',
      message: 'Building a small cabin near Ha Ha Tonka. We lose power a lot, so wood heat makes sense. What would you recommend for about 1,200 sq ft?',
      fields: [
        ['Interested in', 'Wood Stoves'],
        ['Project', 'New construction'],
        ['Timeline', 'In 3–6 months'],
        ['Preferred showroom', 'Osage Beach'],
        ['Best way to reach you', 'Email'],
        ['ZIP code', '65020'],
      ],
      stage: 'new',
      assignee: 'matt',
      unread: false,
      value: 4200,
      activity: [],
    };
    brandt.activity.push(act(brandt.receivedAt, 'customer', 'received', 'Submitted on hmifireplaceshop.com'));
    brandt.activity.push(act(addMinutes(brandt.receivedAt, 1), 'system', 'email', 'Auto-reply sent: “Thanks for contacting HMI Fireplace Shops…”'));

    const ridgeline = builderCustomers[0];
    const jake: Lead = {
      id: nextId('lead', 'R'),
      kind: 'quote',
      source: 'builder',
      receivedAt: `${addDays(T, -1)}T11:40`,
      name: 'Jake Morrow — Ridgeline Custom Homes',
      email: ridgeline.email,
      phone: ridgeline.phone,
      city: 'Ozark',
      zip: '65721',
      store: 'nixa',
      summary: '3 gas units · New construction',
      message:
        'Spec home on Riverbluff in Ozark. Need pricing on three gas units: a linear for the great room (60" or so), one in the primary bedroom, and an outdoor fireplace on the covered patio. Framing starts in 3 weeks.',
      fields: [
        ['Interested in', 'Gas Fireplaces, Outdoor Fireplaces'],
        ['Project', 'New construction'],
        ['Timeline', 'As soon as possible'],
        ['Preferred showroom', 'Nixa'],
      ],
      stage: 'contacted',
      assignee: 'gabe',
      customerId: ridgeline.id,
      unread: false,
      value: 14800,
      firstResponseAt: `${addDays(T, -1)}T12:05`,
      activity: [],
    };
    jake.activity.push(act(jake.receivedAt, 'customer', 'received', 'Email from builder logged by Amanda'));
    jake.activity.push(act(`${addDays(T, -1)}T12:05`, 'gabe', 'call', 'Left a voicemail — will email spec sheets for the Callaway 50 and Carol Rose 42.'));
    jake.activity.push(act(`${addDays(T, -1)}T12:20`, 'gabe', 'email', 'Sent spec sheets and builder pricing sheet.'));
    jake.activity.push(act(`${addDays(T, -1)}T15:45`, 'amanda', 'note', 'Jake replied — wants a walk-through Thursday. Framing plans attached in email.'));

    const glendaCustomer = newCustomer('osage-beach', addDays(T, -2200), { first: 'Glenda', last: 'Ortiz', name: 'Glenda Ortiz', address: { street: '1187 Harbor Point Dr', city: 'Osage Beach', state: 'MO', zip: '65065' }, servicePlan: true, contactPref: 'phone' });
    customerById.set(glendaCustomer.id, glendaCustomer);
    const glendaUnit = newUnit(glendaCustomer, addDays(T, -1500), { itemId: 'FPX-PB42' });
    glendaUnit.lastServiceOn = addDays(T, -330);
    const glenda: Lead = {
      id: nextId('lead', 'R'),
      kind: 'service',
      source: 'phone',
      receivedAt: `${addDays(T, -1)}T09:30`,
      name: 'Glenda Ortiz',
      email: glendaCustomer.email,
      phone: glendaCustomer.phone,
      city: 'Osage Beach',
      zip: '65065',
      address: '1187 Harbor Point Dr, Osage Beach',
      store: 'osage-beach',
      summary: 'Remote, fan or controls · Fireplace Xtrordinair',
      message: 'Remote stopped working — tried new batteries. Fireplace still lights from the wall switch.',
      fields: [
        ['Type of appliance', 'Gas fireplace'],
        ['Brand', 'Fireplace Xtrordinair'],
        ['Purchased from HMI?', 'Yes'],
        ['What do you need?', 'Remote, fan or controls'],
      ],
      stage: 'scheduled',
      assignee: 'amanda',
      customerId: glendaCustomer.id,
      unread: false,
      value: 320,
      firstResponseAt: `${addDays(T, -1)}T09:30`,
      activity: [],
    };
    glenda.activity.push(act(glenda.receivedAt, 'amanda', 'received', 'Logged from a phone call'));

    const chenCustomer = newCustomer('osage-beach', addDays(T, -3), { first: 'Michael', last: 'Chen', name: 'Michael Chen', address: { street: '55 Shoreline Ct, Unit 3B', city: 'Osage Beach', state: 'MO', zip: '65065' }, contactPref: 'email', servicePlan: false, tags: ['Condo'] });
    customerById.set(chenCustomer.id, chenCustomer);
    const chen: Lead = {
      id: nextId('lead', 'R'),
      kind: 'quote',
      source: 'web-quote',
      receivedAt: `${addDays(T, -3)}T14:22`,
      name: 'Michael Chen',
      email: chenCustomer.email,
      phone: chenCustomer.phone,
      city: 'Osage Beach',
      zip: '65065',
      store: 'osage-beach',
      summary: 'Electric Fireplaces · Remodel or addition',
      message: 'Condo association won’t allow gas. Looking for a realistic built-in electric unit for the living room wall, around 42".',
      fields: [
        ['Interested in', 'Electric Fireplaces'],
        ['Project', 'Remodel or addition'],
        ['Timeline', 'In the next 1–3 months'],
        ['Preferred showroom', 'Osage Beach'],
        ['Best way to reach you', 'Email'],
        ['ZIP code', '65065'],
      ],
      stage: 'quoted',
      assignee: 'matt',
      customerId: chenCustomer.id,
      unread: false,
      firstResponseAt: `${addDays(T, -3)}T15:02`,
      activity: [],
    };
    const chenLines: InvoiceLine[] = [
      { id: uid('l'), description: 'Dimplex Revillusion 42 Built-in Firebox', qty: 1, rate: 1690, itemId: 'DIM-RBF42', category: 'Equipment', taxable: true },
      { id: uid('l'), description: 'Electrical rough-in & mounting hardware', qty: 1, rate: 145, category: 'Parts', taxable: true },
      { id: uid('l'), description: 'Installation labor', qty: 1, rate: 650, category: 'Installation', taxable: false },
    ];
    const chenEst = makeInvoice({ kind: 'estimate', customer: chenCustomer, store: 'osage-beach', lines: chenLines, issuedOn: addDays(T, -2), leadId: chen.id, salesperson: 'matt' });
    chen.estimateId = chenEst.id;
    chen.value = revenueOf(chenLines);
    chen.activity.push(act(chen.receivedAt, 'customer', 'received', 'Submitted on hmifireplaceshop.com'));
    chen.activity.push(act(`${addDays(T, -3)}T15:02`, 'matt', 'email', 'Replied with two electric options and asked for wall photos.'));
    chen.activity.push(act(`${addDays(T, -2)}T10:40`, 'matt', 'estimate', `Estimate ${chenEst.id} sent — Dimplex Revillusion 42`));

    const rosaCustomer = newCustomer('nixa', addDays(T, -6), { first: 'Rosa', last: 'Delgado', name: 'Rosa Delgado', address: { street: '904 Kingsway Dr', city: 'Nixa', state: 'MO', zip: '65714' }, contactPref: 'text', servicePlan: false });
    customerById.set(rosaCustomer.id, rosaCustomer);
    const rosa: Lead = {
      id: nextId('lead', 'R'),
      kind: 'quote',
      source: 'walk-in',
      receivedAt: `${addDays(T, -6)}T13:15`,
      name: 'Rosa Delgado',
      email: rosaCustomer.email,
      phone: rosaCustomer.phone,
      city: 'Nixa',
      zip: '65714',
      store: 'nixa',
      summary: 'Fireplace Inserts · Replace or upgrade an existing fireplace',
      message: 'Visited the showroom. Wants a gas insert for the existing brick fireplace — liked the Lopi DVL on display.',
      fields: [
        ['Interested in', 'Fireplace Inserts'],
        ['Project', 'Replace or upgrade an existing fireplace'],
      ],
      stage: 'won',
      assignee: 'mark',
      customerId: rosaCustomer.id,
      unread: false,
      firstResponseAt: `${addDays(T, -6)}T13:15`,
      closedAt: `${addDays(T, -4)}T11:30`,
      activity: [],
    };
    rosa.activity.push(act(rosa.receivedAt, 'mark', 'received', 'Logged from a showroom visit'));

    const darlaCustomer = newCustomer('osage-beach', addDays(T, -5), { first: 'Darla', last: 'McCoy', name: 'Darla McCoy', address: { street: '3320 Eagle Bluff Ln', city: 'Lake Ozark', state: 'MO', zip: '65049' }, contactPref: 'phone', servicePlan: false, tags: ['Lake home'] });
    customerById.set(darlaCustomer.id, darlaCustomer);
    const darla: Lead = {
      id: nextId('lead', 'R'),
      kind: 'quote',
      source: 'referral',
      receivedAt: `${addDays(T, -5)}T10:05`,
      name: 'Darla McCoy',
      email: darlaCustomer.email,
      phone: darlaCustomer.phone,
      city: 'Lake Ozark',
      zip: '65049',
      store: 'osage-beach',
      summary: 'Wood Stoves · Replace or upgrade an existing fireplace',
      message: 'Referred by the Hendricks family. Interested in a soapstone stove for the lake room — wants to see the Castleton.',
      fields: [['Interested in', 'Wood Stoves'], ['Project', 'Replace or upgrade an existing fireplace'], ['Referred by', 'Hendricks family']],
      stage: 'scheduled',
      assignee: 'matt',
      customerId: darlaCustomer.id,
      unread: false,
      value: 4900,
      firstResponseAt: `${addDays(T, -5)}T10:05`,
      activity: [],
    };
    darla.activity.push(act(darla.receivedAt, 'matt', 'received', 'Referral logged by staff'));

    const brent: Lead = {
      id: nextId('lead', 'R'),
      kind: 'question',
      source: 'facebook',
      receivedAt: `${addDays(T, -2)}T19:40`,
      name: 'Brent Kessler',
      city: 'Sunrise Beach',
      store: 'osage-beach',
      summary: 'Facebook message',
      message: 'Do you guys sell pellets by the pallet? And do you deliver to Sunrise Beach?',
      fields: [['Channel', 'Facebook Messenger']],
      stage: 'contacted',
      assignee: 'amanda',
      unread: false,
      firstResponseAt: `${addDays(T, -1)}T08:20`,
      activity: [],
    };
    brent.activity.push(act(brent.receivedAt, 'customer', 'received', 'Message received on Facebook'));
    brent.activity.push(act(`${addDays(T, -1)}T08:20`, 'amanda', 'text', 'Yes — pallets of 50 bags. Free delivery within 15 miles of the store; Sunrise Beach is a $45 delivery.'));

    for (const l of [karen, daleLead, priya, brandt, jake, glenda, chen, rosa, darla, brent]) leads.push(l);
    return { dale, daleUnit, glendaCustomer, glendaUnit, glenda, rosa, rosaCustomer, darla, darlaCustomer, jake, ridgeline };
  }

  /* ---------- Today and the schedule ahead ---------- */

  // Story jobs first, so their times are fixed.
  const todayInstallOB = recordInstall(T, 'osage-beach', {
    customer: newCustomer('osage-beach', addDays(T, -30), { first: 'Greg', last: 'Whitaker', name: 'Greg & Ann Whitaker', address: { street: '2741 Woodland Bay Dr', city: 'Lake Ozark', state: 'MO', zip: '65049' }, servicePlan: false, tags: ['Lake home'] }),
    itemId: 'FPX-PB42',
    status: 'in-progress',
    start: `${T}T08:00`,
    depositOn: addDays(T, -19),
    salesperson: 'matt',
  });
  const workdayStarted = clock >= '08:15';
  if (workdayStarted) {
    todayInstallOB.startedAt = `${T}T08:04`;
    todayInstallOB.checklist = todayInstallOB.checklist.map((c, i) => ({ ...c, done: i < (clock >= '10:00' ? 4 : 2) }));
    if (clock >= '10:00') todayInstallOB.notes.push(act(`${T}T09:52`, 'cody', 'note', 'Unit set and framed. Running vent through the chase now — termination on the lake side.'));
  } else todayInstallOB.status = 'scheduled';

  const glendaJob = recordService(T, 'osage-beach', 'repair', { unit: story.glendaUnit, issue: 'controls', leadId: story.glenda.id, status: 'scheduled', tech: 'luis', start: `${T}T13:00`, createdAt: `${addDays(T, -1)}T09:34` });
  glendaJob.description = 'Remote stopped working — customer already tried new batteries. Wall switch still works. Bring Proflame 2 receiver.';
  story.glenda.jobId = glendaJob.id;
  story.glenda.activity.push(act(glendaJob.createdAt, 'amanda', 'job', `${glendaJob.id} scheduled for today at 1 PM with Luis`));

  const rosaJob = recordInstall(addDays(T, weekday(addDays(T, 3)) === 0 ? 4 : 3), 'nixa', { customer: story.rosaCustomer, itemId: 'LOPI-DVL', leadId: story.rosa.id, status: 'scheduled', depositOn: addDays(T, -4), createdAt: `${addDays(T, -4)}T11:40`, salesperson: 'mark' });
  story.rosa.jobId = rosaJob.id;
  story.rosa.value = rosaJob.value;
  story.rosa.activity.push(act(`${addDays(T, -4)}T11:30`, 'mark', 'estimate', 'Estimate accepted in the showroom — 50% deposit collected'));
  story.rosa.activity.push(act(rosaJob.createdAt, 'amanda', 'job', `Installation ${rosaJob.id} scheduled`));

  const darlaDay = weekday(addDays(T, 1)) === 0 ? addDays(T, 2) : addDays(T, 1);
  const darlaJob = makeJob({ type: 'estimate', store: 'osage-beach', customer: story.darlaCustomer, crew: ['matt'], start: `${darlaDay}T09:00`, hours: 1, status: 'scheduled', title: 'Site visit — soapstone wood stove', description: 'Measure the lake room hearth and clearances for a Hearthstone Castleton 8030. Check chimney condition.', createdAt: `${addDays(T, -5)}T10:20`, leadId: story.darla.id, value: 4900 });
  reserve('matt', `${darlaDay}T09:00`, 1);
  story.darla.jobId = darlaJob.id;
  story.darla.activity.push(act(darlaJob.createdAt, 'matt', 'job', `Site visit booked for ${darlaDay} at 9 AM`));

  // Today's Nixa install
  const nixaToday = recordInstall(T, 'nixa', { status: workdayStarted ? 'in-progress' : 'scheduled', start: `${T}T08:00`, depositOn: addDays(T, -16) });
  if (workdayStarted) nixaToday.startedAt = `${T}T08:11`;

  // Lead-driven jobs, then the regular schedule.
  futureLinks.forEach((fn) => fn());

  for (let offset = 0; offset <= FUTURE_DAYS; offset++) {
    const day = addDays(T, offset);
    const df = dayFactor(day);
    if (!df) continue;
    const density = offset <= 3 ? 1 : offset <= 10 ? 0.72 : 0.3;
    const m = month(day);
    // Booked minutes we aim for per service tech: full near-term days, tapering off
    const target = (offset <= 2 ? rng.int(430, 480) : offset <= 6 ? rng.int(260, 360) : offset <= 12 ? rng.int(120, 220) : rng.int(0, 120)) * (df < 1 ? 0.45 : 1);
    for (const store of STORES) {
      for (let guard = 0; guard < 8; guard++) {
        const tech = leastBusy(crews[store].service, day);
        if (load(tech, day) >= target) break;
        const type = rng.chance(0.72) ? 'maintenance' : rng.chance(0.2) ? 'warranty' : 'repair';
        recordService(day, store, type, { status: 'scheduled', tech });
      }
      if (offset > 0) {
        const nInstall = count(INSTALLS[m] * STORE_FACTOR[store] * df * (offset <= 10 ? 0.7 : 0.25));
        for (let i = 0; i < nInstall; i++) {
          if (load(crews[store].installers[0], day) > 0) break;
          recordInstall(day, store, { status: 'scheduled', createdAt: `${addDays(T, -rng.int(3, 20))}T10:00` });
        }
        if (rng.chance(0.5 * df * density)) {
          const estimator = crews[store].estimators[0];
          const c = newCustomer(store, addDays(T, -rng.int(1, 6)));
          const interest = rng.pick(INTERESTS.slice(0, 5));
          makeJob({ type: 'estimate', store, customer: c, crew: [estimator], start: slot(estimator, day, 1, rng.pick(['10:00', '14:00', '15:30'])), hours: 1, status: 'scheduled', title: `Site visit — ${interest.noun}`, description: `Measure and discuss ${interest.noun} options.`, createdAt: `${addDays(T, -rng.int(1, 5))}T11:00`, value: round5(rng.float(2500, 8000)) });
        }
      }
    }
  }

  // Requested (not yet scheduled) and on-hold work
  for (let i = 0; i < 6; i++) {
    const store = STORES[i % 2];
    const job = recordService(T, store, i < 2 ? 'maintenance' : 'repair', { status: 'requested', unscheduled: true, createdAt: `${addDays(T, -rng.int(0, 3))}T${two(rng.int(8, 10))}:${two(rng.int(0, 59))}` });
    job.crew = [];
    if (i === 2) job.priority = 'high';
  }
  const holdUnit = rng.pick(unitsByStore.nixa.filter((u) => u.itemId && underWarranty(u, T) && fuelClass(u.fuel) === 'gas')) ?? unitsByStore.nixa[0];
  const glassJob = recordService(addDays(T, -6), 'nixa', 'warranty', { unit: holdUnit, issue: 'glass', status: 'completed', tech: 'jared', start: `${addDays(T, -6)}T13:00` });
  glassJob.status = 'on-hold';
  glassJob.title = `Warranty: replacement glass — ${shortModel(holdUnit)}`;
  glassJob.holdReason = 'Waiting on replacement glass from the manufacturer (claim approved).';
  glassJob.completedAt = undefined;
  glassJob.checklist = glassJob.checklist.map((c, i) => ({ ...c, done: i < 3 }));
  glassJob.parts = [{ itemId: 'P-GLASS36', qty: 1, store: 'nixa', status: 'reserved' }];
  glassJob.start = undefined;
  if (glassJob.claimId) {
    const cl = claims.find((x) => x.id === glassJob.claimId)!;
    cl.status = 'parts-shipped';
    cl.claimNo ??= `${cl.manufacturer.split(' ').map((w) => w[0]).join('')}-${rng.int(100000, 999999)}`;
    cl.part = 'Ceramic Glass Panel, 36 in.';
    cl.notes = 'Glass shipped from the manufacturer — tracking 1Z 999 AA1 0123 4567 84.';
  }

  const valveUnit = rng.pick(unitsByStore['osage-beach'].filter((u) => u.legacyGroup === 'legacy-builder-gas')) ?? unitsByStore['osage-beach'][0];
  const valveJob = recordService(addDays(T, -2), 'osage-beach', 'repair', { unit: valveUnit, issue: 'valve', status: 'completed', tech: 'wes', start: `${addDays(T, -2)}T10:00` });
  valveJob.status = 'on-hold';
  valveJob.holdReason = 'Quoted gas valve replacement ($612) — waiting on customer approval. Suggested a replacement insert instead.';
  valveJob.completedAt = undefined;
  valveJob.start = undefined;
  valveJob.parts = [{ itemId: 'P-VALVE', qty: 1, store: 'osage-beach', status: 'reserved' }];

  const mezzoCustomer = newCustomer('osage-beach', addDays(T, -12), { first: 'Hector', last: 'Romero', name: 'Hector Romero', address: { street: '640 Lighthouse Ln', city: 'Sunrise Beach', state: 'MO', zip: '65079' }, servicePlan: false, tags: ['Lake home'] });
  const mezzoJob = recordInstall(addDays(T, 9), 'osage-beach', { customer: mezzoCustomer, itemId: 'HG-MEZZO48', status: 'on-hold', depositOn: addDays(T, -11), createdAt: `${addDays(T, -11)}T15:00`, salesperson: 'mike' });
  mezzoJob.holdReason = 'Waiting on unit — Heat & Glo Mezzo 48 on PO-3105 (due in 5 days).';
  mezzoJob.start = undefined;

  // Statuses for today, as of mid-morning
  for (const j of jobs) {
    if (!j.start || j.start.slice(0, 10) !== T || j.status !== 'scheduled') continue;
    const end = addMinutes(j.start, Math.round(j.hours * 60));
    if (end <= NOW) {
      finish(j, j.hours * rng.float(0.85, 1.1), false);
      j.status = 'completed';
    } else if (j.start <= NOW) {
      j.status = 'in-progress';
      j.startedAt = addMinutes(j.start, rng.int(-5, 15));
      j.checklist = j.checklist.map((c, i) => ({ ...c, done: i < 2 }));
    }
  }

  // A few recent jobs finished but not invoiced yet
  for (const j of jobs.filter((x) => x.status === 'closed' && x.type !== 'install' && x.completedAt && x.completedAt.slice(0, 10) === addDays(T, -1)).slice(0, 4)) {
    j.status = 'completed';
    if (j.invoiceId) {
      const idx = invoices.findIndex((x) => x.id === j.invoiceId);
      if (idx >= 0) invoices.splice(idx, 1);
      j.invoiceId = undefined;
    }
  }

  /* ---------- Problem units: repeat visits worth a replacement conversation ---------- */

  const repeatCandidates = rng.shuffle(units.filter((u) => u.legacyGroup && u.installedOn < addDays(T, -800))).slice(0, 5);
  const hmiRepeat = units.find((u) => u.itemId === 'KH-CHASKA34' && u.installedOn < addDays(T, -200));
  if (hmiRepeat) repeatCandidates.push(hmiRepeat);
  repeatCandidates.forEach((u, idx) => {
    const store = customerById.get(u.customerId)!.store;
    const visits = idx === 0 ? 4 : 3;
    const issue = u.legacyGroup ? pickIssue(u.legacyGroup, u.fuel) : 'venting';
    for (let v = 0; v < visits; v++) {
      let day = addDays(T, -rng.int(40, 330));
      if (weekday(day) === 0) day = addDays(day, 1);
      const tech = rng.pick(crews[store].service);
      const { est, actual } = serviceHours('repair', tech, u.fuel);
      const part = partFor(issue);
      jobFacts.push({ id: `H-${counters.hist++}`, day, store, type: 'repair', crew: [tech], hours: actual, estHours: est, onTime: true, unitId: u.id, customerId: u.customerId, group: groupOf(u), issue: v === 0 ? issue : rng.chance(0.6) ? issue : pickIssue(groupOf(u), u.fuel), part, callback: v > 0 && rng.chance(0.5), revenue: revenueOf(serviceLines('repair', u.fuel, actual, part, false)) });
    }
    if (!u.legacyGroup) customerById.get(u.customerId)!.notes = 'Recurring draft issue — termination may need relocating. Discussed with Mike.';
  });

  /* ---------- Inventory: reservations, purchase orders, receipts, transfers ---------- */

  for (const j of jobs) {
    if (j.status === 'closed' || j.status === 'completed' || j.status === 'cancelled' || j.id === mezzoJob.id) continue;
    for (const p of j.parts) {
      if (p.status !== 'reserved') continue;
      const it = itemById.get(p.itemId)!;
      const s = it.stock[p.store];
      s.reserved += p.qty;
      if (s.onHand - s.display < s.reserved && !it.specialOrder) s.onHand = s.display + s.reserved + (it.kind === 'unit' ? rng.int(0, 1) : rng.int(1, 4));
    }
  }
  const designedLow: [string, StoreId, number][] = [
    ['P-THERMOCPL', 'nixa', 3],
    ['P-PROFLAME2', 'nixa', 1],
    ['P-THERMOPILE', 'nixa', 2],
    ['P-BLOWER-GFK', 'nixa', 0],
    ['DV-DB648', 'nixa', 2],
    ['KH-CALLAWAY50', 'osage-beach', 0],
    ['P-IGNITER', 'nixa', 1],
  ];
  for (const it of items) {
    for (const store of STORES) {
      const s0 = it.stock[store];
      const low = designedLow.find(([id, st]) => id === it.id && st === store);
      if (low) {
        s0.onHand = s0.display + s0.reserved + low[2];
        continue;
      }
      if (it.specialOrder) continue;
      const available = s0.onHand - s0.display - s0.reserved;
      if (available < it.reorderPoint) s0.onHand += it.reorderPoint - available + rng.int(0, it.kind === 'unit' ? 1 : Math.max(2, Math.round(it.reorderQty / 2)));
    }
  }

  const po = (vendorId: string, store: StoreId, status: PurchaseOrder['status'], created: number, lines: [string, number, number][], extra: Partial<PurchaseOrder> = {}): PurchaseOrder => ({
    id: nextId('po', 'PO'),
    vendorId,
    store,
    status,
    createdAt: `${addDays(T, -created)}T09:30`,
    orderedOn: status === 'draft' ? undefined : addDays(T, -created),
    lines: lines.map(([itemId, qty, received]) => ({ itemId, qty, received, cost: itemById.get(itemId)!.cost })),
    createdBy: store === 'nixa' ? 'amanda' : 'mike',
    ...extra,
  });

  const pos: PurchaseOrder[] = [
    po('v-hht', 'osage-beach', 'received', 27, [['HG-ESC-I35', 2, 2], ['HG-TWILIGHT', 1, 1], ['P-BATT-BACKUP', 8, 8]], { receivedOn: addDays(T, -22), expectedOn: addDays(T, -22) }),
    po('v-travis', 'nixa', 'received', 21, [['LOPI-DVL', 2, 2], ['LOPI-ANSWER', 2, 2], ['FPX-PB42', 1, 1]], { receivedOn: addDays(T, -15), expectedOn: addDays(T, -16) }),
    po('v-ozark', 'osage-beach', 'received', 12, [['P-THERMOCPL', 12, 12], ['ACC-RUTLAND', 24, 24], ['HRG-OAK24', 4, 4]], { receivedOn: addDays(T, -9), expectedOn: addDays(T, -9) }),
    po('v-ff', 'nixa', 'partial', 12, [['HAR-P43', 2, 1], ['VC-DEFIANT', 2, 2], ['P-IGNITER', 4, 0]], { expectedOn: addDays(T, 2), notes: 'Backordered: 1× P43 and igniters ship next week.' }),
    po('v-hht', 'osage-beach', 'ordered', 4, [['HG-MEZZO48', 1, 0], ['HG-ESC-I35', 2, 0], ['P-BLOWER-GFK', 2, 0]], { expectedOn: addDays(T, 5), notes: 'Mezzo 48 is for the Romero install.' }),
    po('v-venting', 'nixa', 'ordered', 2, [['DV-DB648', 8, 0], ['DV-DVP36', 10, 0]], { expectedOn: addDays(T, 6) }),
    po('v-ozark', 'nixa', 'draft', 0, [['P-THERMOCPL', 12, 0], ['P-THERMOPILE', 6, 0], ['P-PROFLAME2', 4, 0]], { notes: 'Suggested from low-stock alerts.' }),
  ];
  for (const p of pos) {
    for (const l of p.lines) {
      if (!l.received) continue;
      moves.push({ id: uid('m'), at: `${p.receivedOn ?? addDays(T, -3)}T10:15`, itemId: l.itemId, store: p.store, qty: l.received, kind: 'received', ref: p.id, by: p.createdBy });
    }
  }
  moves.push(
    { id: uid('m'), at: `${addDays(T, -13)}T15:40`, itemId: 'DIM-XLF60', store: 'osage-beach', qty: 1, kind: 'transfer', ref: 'Nixa → Osage Beach', by: 'amanda', note: 'Customer pick-up at Osage Beach' },
    { id: uid('m'), at: `${addDays(T, -13)}T15:40`, itemId: 'DIM-XLF60', store: 'nixa', qty: -1, kind: 'transfer', ref: 'Nixa → Osage Beach', by: 'amanda', note: 'Customer pick-up at Osage Beach' },
    { id: uid('m'), at: `${addDays(T, -8)}T08:30`, itemId: 'P-GASKET34', store: 'nixa', qty: -6, kind: 'adjustment', by: 'gabe', note: 'Cycle count' },
    { id: uid('m'), at: `${addDays(T, -5)}T11:10`, itemId: 'P-THERMOCPL', store: 'nixa', qty: -2, kind: 'adjustment', by: 'amanda', note: 'Damaged in van' },
  );

  /* ---------- Warranty registrations on recent installs ---------- */

  for (const u of units) {
    if (u.installedBy === 'HMI' && diffDays(T, u.installedOn) <= 21) {
      u.warranty.registered = rng.chance(0.5);
      u.warranty.registrationNo = u.warranty.registered ? regNo(u.id) : undefined;
    }
  }

  /* ---------- Older unpaid invoices (AR aging) ---------- */

  const agedInvoice = (customer: Customer, store: StoreId, daysAgo: number, desc: string, amount: number, terms: number, paid = 0) => {
    const inv = makeInvoice({ customer, store, lines: [{ id: uid('l'), description: desc, qty: 1, rate: amount, category: 'Installation', taxable: false }], issuedOn: addDays(T, -daysAgo), terms });
    if (paid) pay(inv, addDays(T, -daysAgo + 5), paid, 'check');
    return inv;
  };
  agedInvoice(story.ridgeline, 'nixa', 52, 'Gas fireplace package — Lot 14, Riverbluff (2 units installed)', 9840, 30);
  agedInvoice(builderCustomers[2], 'nixa', 74, 'Builder package — 3 direct-vent fireplaces, Copper Creek spec homes', 12650, 30, 6000);
  agedInvoice(builderCustomers[1], 'osage-beach', 41, 'Outdoor fireplace & gas line — Harbor Point model home', 6120, 30);
  agedInvoice(rng.pick(customers.filter((c) => c.kind === 'homeowner' && c.store === 'osage-beach')), 'osage-beach', 96, 'Chimney liner replacement & cap', 1385, 15);

  /* ---------- Bills, bank activity and balances ---------- */

  const bills: Bill[] = [];
  const bill = (vendorId: string, issued: string, amount: number, o: Partial<Bill> = {}) => {
    const v = vendors.find((x) => x.id === vendorId)!;
    const terms = v.terms === 'Net 30' ? 30 : v.terms === 'Net 15' ? 15 : 0;
    const b: Bill = {
      id: nextId('bill', 'B'),
      vendorId,
      number: `${v.name.replace(/[^A-Z]/g, '').slice(0, 3) || 'INV'}-${rng.int(10000, 99999)}`,
      issuedOn: issued,
      dueOn: addDays(issued, terms),
      amount: cents(amount),
      category: v.category,
      status: 'open',
      ...o,
    };
    if (b.dueOn < T && !o.status) {
      b.status = 'paid';
      b.paidOn = addDays(b.dueOn, -rng.int(0, 3));
    }
    bills.push(b);
    return b;
  };
  for (const offset of [-1, 0]) {
    const first = `${monthKey(addDays(T, offset * 30)).slice(0, 7)}-01`;
    if (first > T) continue;
    bill('v-lease-ob', first, 7800, { store: 'osage-beach', memo: 'Showroom & warehouse lease' });
    bill('v-lease-nixa', first, 6400, { store: 'nixa', memo: 'Showroom lease' });
    if (addDays(first, 9) <= T) {
      bill('v-util-ob', addDays(first, 9), rng.float(820, 1150), { store: 'osage-beach' });
      bill('v-util-nixa', addDays(first, 9), rng.float(640, 900), { store: 'nixa' });
    }
    if (addDays(first, 14) <= T) bill('v-insurance', addDays(first, 14), 3240, { memo: 'General liability & auto — monthly' });
    bill('v-software', first, 912, { memo: 'Phones, internet, HMI Office subscription' });
    if (addDays(first, 4) <= T) bill('v-media', addDays(first, 4), rng.float(2800, 4200), { memo: 'Radio + digital — fall campaign' });
  }
  for (let w = 4; w >= 0; w--) {
    const d = addDays(T, -w * 7 - 2);
    bill('v-fuel', d, rng.float(980, 1420), { memo: 'Weekly fleet fuel' });
  }
  bill('v-cpa', addDays(T, -26), 1850, { memo: 'Q3 bookkeeping review & sales tax filing' });
  bill('v-tools', addDays(T, -11), 642.18, { memo: 'Manometer, vent tools' });
  // Inventory bills from purchase orders
  for (const p of pos.filter((x) => x.status === 'received' || x.status === 'partial')) {
    const amount = p.lines.reduce((s, l) => s + l.received * l.cost, 0);
    bill(p.vendorId, p.receivedOn ?? addDays(T, -8), amount, { poId: p.id, store: p.store, memo: `Received on ${p.id}` });
  }
  bill('v-hht', addDays(T, -38), 18640, { memo: 'September stock order', store: 'osage-beach', status: 'open' });
  bill('v-kozy', addDays(T, -20), 6240, { memo: 'Display models', store: 'nixa' });
  const scheduled = bills.find((b) => b.status === 'open' && b.dueOn >= T && b.dueOn <= addDays(T, 7));
  if (scheduled) {
    scheduled.status = 'scheduled';
    scheduled.scheduledOn = scheduled.dueOn;
  }

  const accounts: BankAccount[] = [
    { id: 'acct-op', name: 'Operating checking', kind: 'checking', mask: '4821', balance: 186420.55 },
    { id: 'acct-payroll', name: 'Payroll checking', kind: 'checking', mask: '9033', balance: 42150.0 },
    { id: 'acct-savings', name: 'Reserve savings', kind: 'savings', mask: '7710', balance: 250000.0 },
    { id: 'acct-card', name: 'Business credit card', kind: 'credit', mask: '1170', balance: -8940.32 },
  ];

  const txns: BankTxn[] = [];
  const txn = (accountId: string, date: string, description: string, amount: number, o: Partial<BankTxn> = {}) =>
    txns.push({ id: uid('t'), accountId, date, description, amount: cents(amount), reviewed: diffDays(T, date) > 4 || rng.chance(0.3), ...o });

  for (let day = addDays(T, -30); day <= T; day = addDays(day, 1)) {
    if (weekday(day) === 0) continue;
    for (const store of STORES) {
      const card = invoices.flatMap((inv) => (inv.store === store ? inv.payments : [])).filter((p) => p.date === addDays(day, -1) && p.method === 'card').reduce((s, p) => s + p.amount, 0);
      if (card > 0) txn('acct-op', day, `Card settlement — ${STORE_NAME[store]}`, card * 0.974, { category: 'Customer payments', match: { kind: 'deposit' } });
      const checks = invoices.flatMap((inv) => (inv.store === store ? inv.payments : [])).filter((p) => p.date === day && (p.method === 'check' || p.method === 'cash')).reduce((s, p) => s + p.amount, 0);
      if (checks > 0 && weekday(day) !== 6) txn('acct-op', day, `Deposit — checks & cash, ${STORE_NAME[store]}`, checks, { category: 'Customer payments', match: { kind: 'deposit' } });
    }
  }
  for (const b of bills.filter((x) => x.status === 'paid' && x.paidOn && x.paidOn >= addDays(T, -30))) {
    const v = vendors.find((x) => x.id === b.vendorId)!;
    txn(v.id === 'v-fuel' ? 'acct-card' : 'acct-op', b.paidOn!, `${v.id === 'v-fuel' ? 'FLEET FUEL' : 'ACH'} — ${v.name}`, -b.amount, { category: b.category, match: { kind: 'bill', id: b.id } });
  }
  for (const d of [addDays(T, -26), addDays(T, -12)]) {
    txn('acct-payroll', d, 'Payroll — direct deposits', -28640.12, { category: 'Payroll', match: { kind: 'payroll' } });
    txn('acct-op', addDays(d, -1), 'Transfer to payroll ••9033', -30000, { category: 'Transfer', match: { kind: 'transfer' } });
    txn('acct-payroll', addDays(d, -1), 'Transfer from operating ••4821', 30000, { category: 'Transfer', match: { kind: 'transfer' } });
  }
  txn('acct-card', addDays(T, -3), 'LOWES #1342 OSAGE BEACH', -184.62, { reviewed: false });
  txn('acct-card', addDays(T, -2), 'AMAZON MKTPLACE', -96.4, { reviewed: false });
  txn('acct-op', addDays(T, -1), 'MOBILE DEPOSIT', 1250, { reviewed: false });
  txn('acct-op', addDays(T, -1), 'Mo. Dept of Revenue — sales tax', -14322.18, { category: 'Sales tax', reviewed: false });
  txns.sort((a, b) => (a.date < b.date ? 1 : -1));

  /* ---------- Monthly operating expenses (for P&L and analytics) ---------- */

  const months: MonthFact[] = [];
  for (let d = `${historyStart.slice(0, 7)}-01`; d <= T; d = `${monthKey(addDays(d, 32))}-01`) {
    const key = monthKey(d);
    const m = month(d);
    const isCurrent = key === monthKey(T);
    const share = isCurrent ? +T.slice(8, 10) / 30.4 : 1;
    const busyness = SERVICE[m] / 2.4;
    for (const store of STORES) {
      const f = STORE_FACTOR[store];
      const opex: MonthFact['opex'] = {
        Payroll: round5(f * (29000 + 6500 * busyness) * rng.float(0.97, 1.03) * share),
        'Rent & utilities': round5((store === 'osage-beach' ? 7800 + 980 : 6400 + 760) * share),
        'Vehicles & fuel': round5(f * (1900 + 900 * busyness) * rng.float(0.9, 1.1) * share),
        Insurance: round5(1620 * share),
        Marketing: round5(f * (1100 + 900 * (m >= 7 && m <= 10 ? 1.6 : 0.6)) * share),
        'Supplies & tools': round5(f * rng.float(500, 900) * share),
        'Professional services': round5((m % 3 === 0 ? 925 : 300) * share),
        'Software & fees': round5(f * (450 + 2200 * busyness * 0.4) * share),
      };
      months.push({ month: key, store, opex });
    }
  }

  /* ---------- Notifications ---------- */

  const notices: Notice[] = [
    { id: uid('n'), at: addMinutes(NOW, -25), kind: 'lead', text: 'New quote request from Karen Whitfield (Lake Ozark)', href: `/office/inbox/?id=${leads.find((l) => l.name === 'Karen Whitfield')!.id}`, read: false },
    { id: uid('n'), at: addMinutes(NOW, -78), kind: 'lead', text: 'Service request from Dale Hutchins — matches an existing customer', href: `/office/inbox/?id=${leads.find((l) => l.name === 'Dale Hutchins')!.id}`, read: false },
    ...(workdayStarted ? [{ id: uid('n'), at: `${T}T08:04`, kind: 'job' as const, text: `${todayInstallOB.crew.map((id) => staff.find((s) => s.id === id)!.name.split(' ')[0]).join(' & ')} started the Whitaker install in Lake Ozark`, href: `/office/jobs/?id=${todayInstallOB.id}`, read: false }] : []),
    { id: uid('n'), at: addMinutes(NOW, -150), kind: 'stock', text: 'Low stock at Nixa: thermocouples (3 left), Proflame 2 remotes (1 left)', href: '/office/inventory/?filter=low', read: false },
    { id: uid('n'), at: `${addDays(T, -1)}T16:05`, kind: 'warranty', text: 'Warranty claim approved — replacement glass shipped for the Nixa on-hold job', href: `/office/warranty/?tab=claims`, read: true },
    { id: uid('n'), at: `${addDays(T, -1)}T14:30`, kind: 'payment', text: 'Payment received: $4,212.50 from an install balance (card)', href: '/office/accounting/?tab=invoices', read: true },
    { id: uid('n'), at: `${addDays(T, -2)}T09:10`, kind: 'stock', text: 'PO-3104 partially received at Nixa — 2 lines backordered', href: '/office/inventory/?tab=orders', read: true },
  ];

  /* ---------- Books ---------- */

  const books: BooksState = {
    mode: 'in-house',
    connected: false,
    autoSync: true,
    sync: { customers: true, items: true, invoices: true, payments: true, bills: false },
    mapping: [
      { key: 'Equipment', label: 'Equipment sales', account: '4000 Sales: Hearth equipment' },
      { key: 'Installation', label: 'Installation labor', account: '4100 Sales: Installation' },
      { key: 'Service', label: 'Service & repair', account: '4200 Sales: Service' },
      { key: 'Parts', label: 'Parts & materials', account: '4300 Sales: Parts & materials' },
      { key: 'Retail', label: 'Retail & accessories', account: '4400 Sales: Retail' },
      { key: 'tax', label: 'Sales tax collected', account: '2200 Sales tax payable' },
      { key: 'deposits', label: 'Customer deposits', account: '2300 Customer deposits' },
      { key: 'cogs', label: 'Cost of goods sold', account: '5000 Cost of goods sold' },
      { key: 'inventory', label: 'Inventory', account: '1200 Inventory asset' },
    ],
    log: [],
  };

  /* ---------- Assemble ---------- */

  leads.sort((a, b) => (a.receivedAt < b.receivedAt ? 1 : -1));
  jobs.sort((a, b) => ((a.start ?? a.createdAt) < (b.start ?? b.createdAt) ? -1 : 1));
  invoices.sort((a, b) => (a.issuedOn < b.issuedOn ? 1 : a.issuedOn > b.issuedOn ? -1 : a.id < b.id ? 1 : -1));
  moves.sort((a, b) => (a.at < b.at ? 1 : -1));
  claims.sort((a, b) => (a.openedOn < b.openedOn ? 1 : -1));

  const db: DB = {
    version: DB_VERSION,
    seededOn: T,
    windowStart,
    counters,
    staff: structuredClone(staff),
    customers,
    units,
    claims,
    leads,
    jobs,
    items,
    moves: moves.filter((m) => m.at >= windowStart),
    pos,
    vendors: structuredClone(vendors),
    invoices,
    bills: bills.sort((a, b) => (a.dueOn < b.dueOn ? 1 : -1)),
    accounts,
    txns,
    books,
    notices,
    settings,
    reminders: [],
    website: defaultWebsite(),
  };

  const history: History = { from: historyStart, to: addDays(windowStart, -1), jobs: jobFacts, sales: saleFacts, leads: leadFacts, months, base };
  return { db, history };
}

/** Exposed for tests and the "what's in the demo" note. */
export const demoStats = (db: DB, history: History) => ({
  customers: db.customers.length,
  units: db.units.length,
  jobs: db.jobs.length,
  leads: db.leads.length,
  invoices: db.invoices.length,
  historyJobs: history.jobs.length,
  historySales: history.sales.length,
  historyLeads: history.leads.length,
});

