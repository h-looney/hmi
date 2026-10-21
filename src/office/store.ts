/**
 * HMI mode's data store.
 *
 * One document (the DB) lives in a Preact signal and is saved to IndexedDB in this browser.
 * Open tabs stay in sync over a BroadcastChannel, and website form submissions queued by
 * the public pages (see bridge.ts) arrive as new inbox requests — live, if a tab is open.
 */
import { batch, computed, effect, signal } from '@preact/signals';
import { CHANNEL, QUEUE_KEY, clearQueue, readQueue, type QueuedSubmission } from './bridge';
import { profiles } from './data/people';
import { createDemo, DB_VERSION, demoClock } from './data/seed';
import type { DB, History, Lead, Section, StoreId, UIState } from './data/types';
import { diffDays, now, shiftDates, today } from './lib/dates';
import { toast } from './toast';

/* ---------- Signals ---------- */

export const db = signal<DB>(null as unknown as DB);
export const history = signal<History>(null as unknown as History);
export const ready = signal(false);

const UI_KEY = 'hmi-office-ui';
const defaultUI: UIState = {
  signedIn: false,
  userId: 'charlie',
  store: 'all',
  jobsView: 'board',
  range: '90d',
  welcomeDismissed: false,
  tried: [],
};

function loadUI(): UIState {
  try {
    const saved: UIState = { ...defaultUI, ...JSON.parse(localStorage.getItem(UI_KEY) ?? '{}') };
    // A profile the demo no longer offers (an earlier version's owner) becomes today's default
    if (!profiles.some((p) => p.id === saved.userId)) saved.userId = defaultUI.userId;
    return saved;
  } catch {
    return defaultUI;
  }
}

export const ui = signal<UIState>(loadUI());
effect(() => {
  try {
    localStorage.setItem(UI_KEY, JSON.stringify(ui.value));
  } catch {
    /* private mode */
  }
});

export const setUI = (patch: Partial<UIState>) => {
  ui.value = { ...ui.value, ...patch };
};

/** Tick off an item in the "Things to try" checklist */
export const markTried = (key: string) => {
  if (!ui.value.tried.includes(key)) setUI({ tried: [...ui.value.tried, key] });
};

export const me = computed(() => db.value?.staff.find((s) => s.id === ui.value.userId) ?? db.value?.staff[0]);

export const can = (section: Section) => {
  const user = me.value;
  return !!user && !!db.value && db.value.settings.permissions[user.role].includes(section);
};

/** Does a record belong to the location picked in the sidebar? */
export const inStore = (store: StoreId) => ui.value.store === 'all' || ui.value.store === store;

/* ---------- Editing ---------- */

/**
 * Change the data. Top-level collections are copied so every view re-renders; use `edit()`
 * to change a single record without touching the previous version.
 */
export function mutate(fn: (d: DB) => void) {
  const current = db.value;
  const next = { ...current } as DB;
  for (const key of Object.keys(next) as (keyof DB)[]) {
    const value = next[key];
    if (Array.isArray(value)) (next as unknown as Record<string, unknown>)[key] = [...value];
  }
  fn(next);
  db.value = next;
}

/** Replace one record (by id) with an edited copy. */
export function edit<T extends { id: string }>(list: T[], id: string, fn: (draft: T) => void): T | undefined {
  const i = list.findIndex((x) => x.id === id);
  if (i < 0) return undefined;
  const copy = structuredClone(list[i]);
  fn(copy);
  list[i] = copy;
  return copy;
}

/** Next sequential id, e.g. nextId(d, 'job', 'J') → 'J-41542' */
export function nextId(d: DB, key: string, prefix: string) {
  d.counters = { ...d.counters };
  const n = d.counters[key] ?? 1;
  d.counters[key] = n + 1;
  return `${prefix}-${n}`;
}

export const uid = (prefix = 'x') => `${prefix}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

/* ---------- IndexedDB (falls back to memory) ---------- */

let idb: Promise<IDBDatabase | null> | null = null;

function openIdb(): Promise<IDBDatabase | null> {
  idb ??= new Promise((resolve) => {
    try {
      const req = indexedDB.open('hmi-office', 1);
      req.onupgradeneeded = () => req.result.createObjectStore('state');
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
      req.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
  return idb;
}

async function idbGet<T>(key: string): Promise<T | undefined> {
  const conn = await openIdb();
  if (!conn) return undefined;
  return new Promise((resolve) => {
    try {
      const req = conn.transaction('state').objectStore('state').get(key);
      req.onsuccess = () => resolve(req.result as T | undefined);
      req.onerror = () => resolve(undefined);
    } catch {
      resolve(undefined);
    }
  });
}

async function idbSet(key: string, value: unknown): Promise<void> {
  const conn = await openIdb();
  if (!conn) return;
  return new Promise((resolve) => {
    try {
      const tx = conn.transaction('state', 'readwrite');
      tx.objectStore('state').put(value, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
      tx.onabort = () => resolve();
    } catch {
      resolve();
    }
  });
}

/* ---------- Load, save, sync ---------- */

const TAB = Math.random().toString(36).slice(2);
let channel: BroadcastChannel | null = null;
let saveTimer: ReturnType<typeof setTimeout> | undefined;
let skipNextSave = false;

async function save(value: DB) {
  await idbSet('db', value);
  channel?.postMessage({ type: 'db', from: TAB });
}

effect(() => {
  const value = db.value;
  if (!ready.value || !value) return;
  if (skipNextSave) {
    skipNextSave = false;
    return;
  }
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    saveTimer = undefined;
    void save(value);
  }, 60);
});

export async function initStore() {
  let stored = await idbGet<DB>('db');
  let hist = await idbGet<History>('history');
  const t = today();

  if (!stored || stored.version !== DB_VERSION || !hist) {
    const demo = createDemo(t, demoClock());
    stored = demo.db;
    hist = demo.history;
    void idbSet('history', hist);
    void idbSet('db', stored);
  } else {
    // Keep the demo current: move every date forward by the days since it was generated.
    const delta = diffDays(t, stored.seededOn);
    if (delta > 0) {
      stored = shiftDates(stored, delta);
      hist = shiftDates(hist, delta);
      void idbSet('history', hist);
      void idbSet('db', stored);
    }
  }

  skipNextSave = true;
  batch(() => {
    db.value = stored!;
    history.value = hist!;
    ready.value = true;
  });

  try {
    channel = new BroadcastChannel(CHANNEL);
    channel.onmessage = async (e: MessageEvent) => {
      const msg = e.data as { type?: string; from?: string };
      if (msg.from === TAB) return;
      if (msg.type === 'db' || msg.type === 'reset') {
        const fresh = await idbGet<DB>('db');
        if (fresh) {
          skipNextSave = true;
          db.value = fresh;
        }
        if (msg.type === 'reset') {
          const h = await idbGet<History>('history');
          if (h) history.value = h;
        }
      } else if (msg.type === 'queue') ingestQueue(true);
    };
  } catch {
    /* no cross-tab sync */
  }
  window.addEventListener('storage', (e) => {
    if (e.key === QUEUE_KEY && e.newValue) ingestQueue(true);
  });
  const flush = () => {
    if (saveTimer) {
      clearTimeout(saveTimer);
      saveTimer = undefined;
      void save(db.value);
    }
  };
  window.addEventListener('pagehide', flush);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flush();
  });

  ingestQueue(false);
}

/** Start over with fresh demo data (and an empty "Things to try" list). */
export async function resetDemo() {
  const demo = createDemo(today(), demoClock());
  skipNextSave = true;
  batch(() => {
    db.value = demo.db;
    history.value = demo.history;
  });
  await Promise.all([idbSet('db', demo.db), idbSet('history', demo.history)]);
  channel?.postMessage({ type: 'reset', from: TAB });
  setUI({ tried: [], welcomeDismissed: false });
}

/* ---------- Website submissions → inbox ---------- */

const storeFor = (s: QueuedSubmission): StoreId => {
  if (s.store === 'nixa' || s.store === 'osage-beach') return s.store;
  // "Either is fine": route Springfield-area ZIPs to Nixa, everything else to Osage Beach
  return s.zip?.startsWith('657') || s.zip?.startsWith('656') ? 'nixa' : 'osage-beach';
};

const field = (s: QueuedSubmission, label: string) => s.fields.find(([k]) => k === label)?.[1];

function leadFrom(d: DB, s: QueuedSubmission): Lead {
  const store = storeFor(s);
  const digits = (p?: string) => (p ?? '').replace(/\D/g, '').slice(-10);
  const match = d.customers.find(
    (c) => (s.email && c.email.toLowerCase() === s.email.toLowerCase()) || (digits(s.phone).length === 10 && digits(c.phone) === digits(s.phone)),
  );
  const id = nextId(d, 'lead', 'R');
  const summary =
    s.kind === 'quote'
      ? [field(s, 'Interested in'), field(s, 'Project')].filter(Boolean).join(' · ')
      : [field(s, 'What do you need?'), field(s, 'Brand')].filter(Boolean).join(' · ');
  const lead: Lead = {
    id,
    kind: s.kind,
    source: s.kind === 'quote' ? 'web-quote' : 'web-service',
    receivedAt: s.at,
    name: s.name || 'Website visitor',
    email: s.email,
    phone: s.phone,
    zip: s.zip,
    address: s.address,
    city: s.address?.split(',').slice(-1)[0]?.trim() || undefined,
    store,
    summary: summary || (s.kind === 'quote' ? 'Quote request' : 'Service request'),
    message: s.message,
    fields: s.fields,
    photos: s.photos,
    stage: 'new',
    assignee: d.settings.forms.routing[s.kind][store],
    customerId: match?.id,
    unread: true,
    demo: true,
    ref: s.ref,
    activity: [{ id: uid('a'), at: s.at, by: 'customer', kind: 'received', text: 'Submitted on the website (this demo)' }],
  };
  if (d.settings.forms.autoReply && s.email) {
    lead.activity.push({ id: uid('a'), at: s.at, by: 'system', kind: 'email', text: `Auto-reply sent to ${s.email}` });
  }
  return lead;
}

function ingestQueue(live: boolean) {
  const queue = readQueue();
  if (!queue.length || !db.value) return;
  const fresh = queue.filter((s) => !db.value.leads.some((l) => l.ref === s.ref));
  clearQueue(queue.map((s) => s.ref));
  if (!fresh.length) return;
  const added: Lead[] = [];
  mutate((d) => {
    for (const s of fresh) {
      const lead = leadFrom(d, s);
      added.push(lead);
      d.leads.unshift(lead);
      d.notices.unshift({
        id: uid('n'),
        at: now(),
        kind: 'lead',
        text: `New ${lead.kind === 'quote' ? 'quote' : 'service'} request from ${lead.name}${lead.customerId ? ' — matches an existing customer' : ''}`,
        href: `/office/inbox/?id=${lead.id}`,
        read: false,
      });
    }
  });
  markTried('web-request');
  if (live) {
    const lead = added[added.length - 1];
    toast(`New ${lead.kind === 'quote' ? 'quote' : 'service'} request from ${lead.name}`, {
      tone: 'success',
      action: { label: 'Open', run: () => openRecord(`/office/inbox/?id=${lead.id}`) },
    });
  }
}

/** Set by the router so the store can link to records without importing it. */
let openRecord: (href: string) => void = (href) => location.assign(href);
export const setOpenRecord = (fn: (href: string) => void) => {
  openRecord = fn;
};
