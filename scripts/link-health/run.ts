/**
 * Check links politely and turn the verdicts into the published report: one request per link (plus one retry),
 * with first-failed / last-ok dates carried over from the previous report.
 */
import { closeBrowser, fetchWithBrowser, findChrome } from './browser.ts';
import { classify, type Verdict } from './classify.ts';
import { fetchPage, sleep, type FetchResult } from './http.ts';
import { HostQueue } from './queue.ts';
import { FAILING, resolveTarget, type LinkReport, type LinkResult, type LinkStatus, type OutboundLink } from '../../src/data/links.ts';

export interface RunOptions {
  /** Retry bot checks and unreadable pages in headless Chrome (default: when Chrome is installed) */
  browser?: boolean;
  queue?: HostQueue;
  fetcher?: (url: string) => Promise<FetchResult>;
  browserFetcher?: (url: string) => Promise<FetchResult | null>;
  retryDelayMs?: number;
  log?: (line: string) => void;
}

export interface Checked {
  link: OutboundLink;
  verdict: Verdict & { status: LinkStatus };
  attempts: number;
}

/** Check one link: a browser-like GET, then — only if that didn't come back ok or moved — one retry. */
export async function checkLink(link: OutboundLink, opts: RunOptions = {}): Promise<Checked> {
  const queue = opts.queue ?? new HostQueue();
  const fetcher = opts.fetcher ?? ((u: string) => fetchPage(u));
  const browserFetcher = opts.browserFetcher ?? ((u: string) => fetchWithBrowser(u));
  const useBrowser = opts.browser ?? !!findChrome();

  const first = classify(link, await queue.run(link.url, () => fetcher(link.url)));
  if (first.status === 'ok' || first.status === 'moved') return { link, verdict: first as Checked['verdict'], attempts: 1 };

  let second: Verdict | undefined;
  if ((first.status === 'blocked' || first.needsBrowser) && useBrowser) {
    const res = await queue.run(link.url, () => browserFetcher(link.url));
    if (res) second = classify(link, res);
  }
  if (!second && first.status === 'blocked') {
    return { link, verdict: { ...first, status: 'unverified', reason: `${first.reason} — no browser available to retry` }, attempts: 1 };
  }
  if (!second) {
    await sleep(opts.retryDelayMs ?? 3000);
    second = classify(link, await queue.run(link.url, () => fetcher(link.url)));
  }
  if (second.status === 'blocked') {
    return { link, verdict: { ...second, status: 'unverified', reason: `still behind a bot check in a real browser (${second.reason.replace(/^HTTP \d+ — /, '')})` }, attempts: 2 };
  }
  // A plain-HTTP bot check followed by a browser page that only fails the fingerprint is still "can't tell"
  if (first.status === 'blocked' && second.status === 'wrong-page' && second.via === 'browser' && !second.page?.title && !second.page?.h1.length) {
    return { link, verdict: { ...second, status: 'unverified', reason: 'behind a bot check; the browser saw an empty page' }, attempts: 2 };
  }
  return { link, verdict: second as Checked['verdict'], attempts: 2 };
}

export async function checkAll(links: OutboundLink[], opts: RunOptions = {}): Promise<Checked[]> {
  const queue = opts.queue ?? new HostQueue({ perHost: 1, delayMs: 1200, globalLimit: 6 });
  const log = opts.log ?? (() => {});
  try {
    return await Promise.all(
      links.map(async (link) => {
        const c = await checkLink(link, { ...opts, queue });
        log(`${c.verdict.status.padEnd(10)} ${link.slug.padEnd(34)} ${c.verdict.reason}${c.verdict.via === 'browser' ? ' [browser]' : ''}`);
        return c;
      }),
    );
  } finally {
    await closeBrowser();
  }
}

const isWorking = (s: LinkStatus) => s === 'ok' || s === 'moved';

/** Build the report, carrying first-failed / last-ok dates over from the previous one (same slug and stored URL). */
export function buildReport(checked: Checked[], prev: LinkReport | null, meta: { trigger: LinkReport['trigger']; startedAt: number; browser: boolean; now?: Date }): LinkReport {
  const now = (meta.now ?? new Date()).toISOString();
  const before = new Map((prev?.results ?? []).map((r) => [r.slug, r]));
  const results: Omit<LinkResult, 'target'>[] = checked.map(({ link, verdict }) => {
    const old = before.get(link.slug);
    const history = old && old.url === link.url ? old : undefined;
    const status = verdict.status;
    const working = isWorking(status);
    return {
      slug: link.slug,
      kind: link.kind,
      label: link.label,
      brand: link.brand,
      productId: link.productId,
      url: link.url,
      status,
      reason: verdict.reason,
      finalUrl: verdict.finalUrl,
      httpStatus: verdict.httpStatus,
      via: verdict.via,
      checkedAt: now,
      lastOk: working ? now : (history?.lastOk ?? null),
      firstFailed: FAILING.includes(status) ? (history?.firstFailed ?? now) : status === 'unverified' ? (history?.firstFailed ?? null) : null,
      ...(status === 'moved' ? { suggestedUrl: verdict.finalUrl } : {}),
    };
  });
  const byslug = new Map(results.map((r) => [r.slug, r]));
  const withTargets: LinkResult[] = results.map((r) => ({ ...r, target: resolveTarget(checked.find((c) => c.link.slug === r.slug)!.link, byslug) }));
  const summary = { total: results.length, ok: 0, moved: 0, dead: 0, 'wrong-page': 0, 'soft-404': 0, unverified: 0 } as LinkReport['summary'];
  for (const r of results) summary[r.status]++;
  return { version: 1, generatedAt: now, trigger: meta.trigger, durationMs: Date.now() - meta.startedAt, browser: meta.browser, summary, results: withTargets };
}

/** Links that are new, or whose stored URL changed, compared with a baseline (the previously published report). */
export function changedSince(links: OutboundLink[], baseline: Map<string, string> | null): Set<string> {
  if (!baseline) return new Set(links.map((l) => l.slug));
  return new Set(links.filter((l) => baseline.get(l.slug) !== l.url).map((l) => l.slug));
}
