/**
 * Hand-off from the public website to HMI mode.
 *
 * There's no backend in this concept, so a submitted quote or service form is queued in
 * localStorage and a BroadcastChannel ping tells any open HMI mode tab to pick it up. The
 * public pages import only this small file.
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
