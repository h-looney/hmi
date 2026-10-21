/**
 * Link checker CLI — `npm run links:check`.
 *
 *   node scripts/link-health/check.ts [--trigger push|nightly|manual|local] [--baseline <file|url>]
 *        [--git-base <sha>] [--out .link-health/report.json] [--only slug,slug] [--no-browser]
 *
 * 1. Validates the product list (internal problems always fail).
 * 2. Checks every outbound link (src/data/links.ts) like a browser would, politely, with one retry.
 * 3. Writes the report that the build turns into /go/ targets and publishes at /data/link-health.json.
 * 4. On a push, fails if a link that is new or changed in that push doesn't work. Links that break on the
 *    manufacturer's side never fail the run — /go/ falls back instead.
 */
import { execFileSync } from 'node:child_process';
import { appendFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { parseArgs } from 'node:util';
import { findChrome } from './browser.ts';
import { buildReport, changedSince, checkAll } from './run.ts';
import { validateProductList } from './validate.ts';
import { FAILING, outboundLinks, type LinkReport, type OutboundLink } from '../../src/data/links.ts';

const { values: args } = parseArgs({
  options: {
    trigger: { type: 'string', default: process.env.GITHUB_ACTIONS ? 'manual' : 'local' },
    baseline: { type: 'string' },
    'git-base': { type: 'string' },
    out: { type: 'string', default: '.link-health/report.json' },
    only: { type: 'string' },
    'no-browser': { type: 'boolean', default: false },
    'validate-only': { type: 'boolean', default: false },
  },
});

const trigger = args.trigger as LinkReport['trigger'];
const started = Date.now();
const log = (s = '') => console.log(s);

// 1. Internal problems
const problems = validateProductList();
if (problems.length) {
  log(`✗ ${problems.length} problem${problems.length === 1 ? '' : 's'} in the product list:`);
  for (const p of problems) log(`  - ${p}`);
  summary(`### ✗ Product list problems\n\n${problems.map((p) => `- ${p}`).join('\n')}\n`);
  process.exit(1);
}
log(`✓ Product list OK`);
if (args['validate-only']) process.exit(0);

// 2. Previous report: first-failed / last-ok dates, and what counts as "changed in this push"
async function loadReport(src?: string): Promise<LinkReport | null> {
  if (!src) return null;
  try {
    const text = /^https?:/.test(src) ? await (await fetch(src, { signal: AbortSignal.timeout(20_000) })).text() : existsSync(src) ? readFileSync(src, 'utf8') : '';
    const json = JSON.parse(text) as LinkReport;
    return json?.version === 1 && Array.isArray(json.results) ? json : null;
  } catch {
    return null;
  }
}

/** The link list as it was at an earlier commit (when there's no published report to compare with). */
async function linksAt(sha: string): Promise<Map<string, string> | null> {
  const dir = mkdtempSync(join(tmpdir(), 'hmi-links-'));
  try {
    const tar = execFileSync('git', ['archive', sha, 'src/data', 'src/office/data'], { maxBuffer: 50_000_000 });
    execFileSync('tar', ['-x', '-C', dir], { input: tar });
    if (!existsSync(join(dir, 'src/data/links.ts'))) return new Map();
    const mod = (await import(join(dir, 'src/data/links.ts'))) as { outboundLinks: () => OutboundLink[] };
    return new Map(mod.outboundLinks().map((l) => [l.slug, l.url]));
  } catch {
    return null;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

const previous = await loadReport(args.baseline);
let baseline: Map<string, string> | null = previous ? new Map(previous.results.map((r) => [r.slug, r.url])) : null;
if (!baseline && args['git-base'] && !/^0+$/.test(args['git-base'])) baseline = await linksAt(args['git-base']);
log(previous ? `Previous report: ${previous.generatedAt} (${previous.results.length} links)` : 'No previous report — every link counts as new');

// 3. Check
let links = outboundLinks();
if (args.only) {
  const only = new Set(args.only.split(','));
  links = links.filter((l) => only.has(l.slug));
}
const browser = !args['no-browser'] && !!findChrome();
log(`Checking ${links.length} links${browser ? ' (headless Chrome available for retries)' : ' (no browser retries)'}…\n`);
const checked = await checkAll(links, { browser, log });
const report = buildReport(checked, previous, { trigger, startedAt: started, browser });

mkdirSync(dirname(args.out!), { recursive: true });
writeFileSync(args.out!, JSON.stringify(report, null, 1));

const s = report.summary;
log(`\n${s.total} links · ${s.ok} ok · ${s.moved} moved · ${s.dead} dead · ${s['wrong-page']} wrong page · ${s['soft-404']} soft 404 · ${s.unverified} unverified`);
log(`Report: ${args.out}  (${Math.round(report.durationMs / 1000)} s)`);

const failing = report.results.filter((r) => FAILING.includes(r.status));
const moved = report.results.filter((r) => r.status === 'moved');
const rows = (list: typeof report.results) => list.map((r) => `| ${r.label} | ${r.status} | ${r.reason.replace(/\|/g, '/')} | ${r.target.mode === 'fallback' ? `→ ${r.target.href}` : r.target.href} |`).join('\n');
summary(
  `### Link health — ${s.total} links\n\n${s.ok} ok · ${s.moved} moved · ${s.dead} dead · ${s['wrong-page']} wrong page · ${s['soft-404']} soft 404 · ${s.unverified} unverified\n\n` +
    (failing.length ? `#### Failing (customers get the fallback)\n\n| Link | Status | Why | /go/ now sends to |\n|---|---|---|---|\n${rows(failing)}\n\n` : '') +
    (moved.length ? `#### Moved (update the stored URL)\n\n| Link | Status | Why | /go/ now sends to |\n|---|---|---|---|\n${rows(moved)}\n` : ''),
);

// 4. On a push, a new or changed link must work
if (trigger === 'push') {
  const changed = changedSince(links, baseline);
  const bad = failing.filter((r) => changed.has(r.slug));
  if (bad.length) {
    log(`\n✗ ${bad.length} link${bad.length === 1 ? '' : 's'} added or changed in this push don't work:`);
    for (const r of bad) log(`  - ${r.label} (${r.url}): ${r.status} — ${r.reason}`);
    summary(`#### ✗ New or changed links that fail\n\n${bad.map((r) => `- **${r.label}** ${r.url}: ${r.status} — ${r.reason}`).join('\n')}\n`);
    process.exit(1);
  }
  log(`✓ ${changed.size} new or changed link${changed.size === 1 ? '' : 's'} in this push — none failing`);
}

function summary(md: string) {
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${md}\n`);
}
