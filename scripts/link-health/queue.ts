/**
 * Polite request scheduling: at most `perHost` requests in flight per host, a pause between
 * requests to the same host, and an overall cap so a run never floods the network.
 */
import { sleep } from './http.ts';

interface HostState {
  active: number;
  lastStart: number;
  waiting: (() => void)[];
}

export class HostQueue {
  private hosts = new Map<string, HostState>();
  private active = 0;
  private waitingGlobal: (() => void)[] = [];
  readonly perHost: number;
  readonly delayMs: number;
  readonly globalLimit: number;

  constructor(opts: { perHost?: number; delayMs?: number; globalLimit?: number } = {}) {
    this.perHost = opts.perHost ?? 1;
    this.delayMs = opts.delayMs ?? 1200;
    this.globalLimit = opts.globalLimit ?? 6;
  }

  private state(host: string): HostState {
    let s = this.hosts.get(host);
    if (!s) {
      s = { active: 0, lastStart: 0, waiting: [] };
      this.hosts.set(host, s);
    }
    return s;
  }

  /** Run `task` against `hostOrUrl` once a slot is free. */
  async run<T>(hostOrUrl: string, task: () => Promise<T>): Promise<T> {
    const host = hostKey(hostOrUrl);
    const s = this.state(host);
    while (s.active >= this.perHost) await new Promise<void>((r) => s.waiting.push(r));
    s.active++;
    while (this.active >= this.globalLimit) await new Promise<void>((r) => this.waitingGlobal.push(r));
    this.active++;
    try {
      const wait = s.lastStart + this.delayMs - Date.now();
      if (wait > 0) await sleep(wait);
      s.lastStart = Date.now();
      return await task();
    } finally {
      this.active--;
      this.waitingGlobal.shift()?.();
      s.active--;
      s.waiting.shift()?.();
    }
  }
}

/** Requests to www.example.com and example.com share one politeness budget. */
export function hostKey(hostOrUrl: string): string {
  let host = hostOrUrl;
  try {
    host = new URL(hostOrUrl).hostname;
  } catch {
    /* already a host */
  }
  return host.toLowerCase().replace(/^www\./, '');
}
