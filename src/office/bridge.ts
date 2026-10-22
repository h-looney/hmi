/**
 * Hand-off between the public website and HMI mode.
 *
 * There's no backend in this concept, so a submitted quote or service form is queued in
 * localStorage and a BroadcastChannel ping tells any open HMI mode tab to pick it up. The other
 * way round, listings and model photos published from HMI mode (simulated) are read from this
 * browser's IndexedDB. The public pages import only this small file.
 */

export const QUEUE_KEY = 'hmi-office-queue';
export const CHANNEL = 'hmi-office';

export interface QueuedSubmission {
  /** Unique reference, also used to link from the confirmation message */
  ref: string;
  kind: 'quote' | 'service';
  /** Local datetime, YYYY-MM-DDTHH:mm */
  at: string;
  name: string;
  email?: string;
  phone?: string;
  zip?: string;
  address?: string;
  /** Location slug or 'either' */
  store?: string;
  message?: string;
  fields: [string, string][];
  photos?: number;
}

const pad = (n: number) => String(n).padStart(2, '0');
const localNow = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

export function readQueue(): QueuedSubmission[] {
  try {
    const list = JSON.parse(localStorage.getItem(QUEUE_KEY) ?? '[]');
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

export function clearQueue(refs: string[]) {
  try {
    const rest = readQueue().filter((s) => !refs.includes(s.ref));
    if (rest.length) localStorage.setItem(QUEUE_KEY, JSON.stringify(rest));
    else localStorage.removeItem(QUEUE_KEY);
  } catch {
    /* storage unavailable */
  }
}

/** Queue a submission for HMI mode. Returns its reference, or undefined if storage is unavailable. */
export function queueSubmission(submission: Omit<QueuedSubmission, 'ref' | 'at'>): string | undefined {
  const ref = `W${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  try {
    const queue = readQueue();
    queue.push({ ...submission, ref, at: localNow() });
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  } catch {
    return undefined;
  }
  try {
    const channel = new BroadcastChannel(CHANNEL);
    channel.postMessage({ type: 'queue' });
    channel.close();
  } catch {
    /* other tabs will see it on their next load */
  }
  return ref;
}

/* ---------- Outbound clicks from /go/ pages ---------- */

/**
 * Every /go/<slug>/ visit in this browser, so HMI mode can show clicks per product. A real deployment would count
 * these server-side (analytics or the redirect service); this concept keeps them in localStorage.
 */
export const CLICKS_KEY = 'hmi-go-clicks';
const MAX_CLICKS = 500;

export interface GoClick {
  slug: string;
  kind: 'model' | 'brand' | 'support' | 'tool';
  brand: string;
  productId?: string;
  label: string;
  /** Where the visitor was sent: the stored URL, its new address, or a fallback */
  mode: 'direct' | 'moved' | 'fallback' | 'unchecked';
  to: string;
  /** Path of the page the link was on */
  from?: string;
  /** Local datetime, YYYY-MM-DDTHH:mm */
  at: string;
}

export function readClicks(): GoClick[] {
  try {
    const list = JSON.parse(localStorage.getItem(CLICKS_KEY) ?? '[]');
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

export function clearClicks() {
  try {
    localStorage.removeItem(CLICKS_KEY);
  } catch {
    /* storage unavailable */
  }
}

/** Record a click on an outbound link. Never throws — the redirect must happen regardless. */
export function recordClick(click: Omit<GoClick, 'at'>) {
  try {
    const list = readClicks();
    list.push({ ...click, at: localNow() });
    localStorage.setItem(CLICKS_KEY, JSON.stringify(list.slice(-MAX_CLICKS)));
  } catch {
    return;
  }
  try {
    const channel = new BroadcastChannel(CHANNEL);
    channel.postMessage({ type: 'clicks' });
    channel.close();
  } catch {
    /* other tabs will see it on their next load */
  }
}

/* ---------- Model photos published from HMI mode ---------- */

/**
 * Photos added in HMI mode stay in this browser, in the IndexedDB database HMI mode saves to: each image under
 * `photo:<id>`, and the set last published (simulated) under `site-photos`. Model pages and cards read that set to
 * preview a publish in this browser. In production a publish would put the photos in the site itself.
 */
export const OFFICE_DB = 'hmi-office';
export const OFFICE_STORE = 'state';
export const SITE_PHOTOS_KEY = 'site-photos';
export const SITE_LISTINGS_KEY = 'site-listings';
export const photoKey = (id: string) => `photo:${id}`;

/** A listing as published from HMI mode (simulated): a new one, or HMI's changes to a model on the product list */
export interface SiteListing {
  id: string;
  isNew: boolean;
  brand: string;
  brandName: string;
  model: string;
  type: string;
  category: string;
  summary: string;
  specs: { label: string; value: string }[];
  /** The manufacturer's or distributor's page, when HMI set one in HMI mode */
  url?: string;
  /** What the link says, when HMI changed it */
  linkText?: string;
  display: { 'osage-beach': number; nixa: number };
}

export interface SitePhoto {
  id: string;
  alt: string;
  caption?: string;
  width: number;
  height: number;
}

/** Open HMI mode's database to read it — without creating it when nothing has been saved in this browser. */
function openOfficeDb(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open(OFFICE_DB, 1);
      req.onupgradeneeded = () => req.transaction?.abort();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
      req.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

function read<T>(conn: IDBDatabase, key: string): Promise<T | undefined> {
  return new Promise((resolve) => {
    try {
      const req = conn.transaction(OFFICE_STORE).objectStore(OFFICE_STORE).get(key);
      req.onsuccess = () => resolve(req.result as T | undefined);
      req.onerror = () => resolve(undefined);
    } catch {
      resolve(undefined);
    }
  });
}

/** Listings published from HMI mode in this browser (new ones on the public site, and changes to models on the list). */
export async function readPublishedListings(): Promise<Record<string, SiteListing>> {
  if (typeof indexedDB === 'undefined') return {};
  const conn = await openOfficeDb();
  if (!conn) return {};
  try {
    return (await read<Record<string, SiteListing>>(conn, SITE_LISTINGS_KEY)) ?? {};
  } finally {
    conn.close();
  }
}

/** Photos published from HMI mode in this browser, for the given product ids — each with an object URL. */
export async function readPublishedPhotos(productIds: string[]): Promise<Map<string, (SitePhoto & { url: string })[]>> {
  const out = new Map<string, (SitePhoto & { url: string })[]>();
  if (!productIds.length || typeof indexedDB === 'undefined') return out;
  const conn = await openOfficeDb();
  if (!conn) return out;
  try {
    const site = await read<Record<string, SitePhoto[]>>(conn, SITE_PHOTOS_KEY);
    for (const id of productIds) {
      const list: (SitePhoto & { url: string })[] = [];
      for (const photo of site?.[id] ?? []) {
        const blob = await read<Blob>(conn, photoKey(photo.id));
        if (blob instanceof Blob) list.push({ ...photo, url: URL.createObjectURL(blob) });
      }
      if (list.length) out.set(id, list);
    }
  } finally {
    conn.close();
  }
  return out;
}
