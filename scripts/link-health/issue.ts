/**
 * Keep one GitHub issue (label: link-health) in step with the latest link check — `npm run links:issue`.
 *
 *   failing links → open the issue, or update it (and comment when new links start failing)
 *   all passing   → comment and close it
 *
 * Runs in GitHub Actions with GITHUB_TOKEN (permissions: issues: write) and GITHUB_REPOSITORY, after a build that's
 * about to be deployed — so the fallbacks it describes are the ones going live. `--dry-run` prints what it would do.
 * Moved and unverified links are listed when the issue is open, but don't open it on their own.
 */
import { readFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { FAILING, type LinkReport, type LinkResult } from '../../src/data/links.ts';

const { values: args } = parseArgs({ options: { report: { type: 'string', default: '.link-health/report.json' }, 'dry-run': { type: 'boolean', default: false } } });

const LABEL = 'link-health';
const repo = process.env.GITHUB_REPOSITORY;
const token = process.env.GITHUB_TOKEN;
const dry = args['dry-run'] || !repo || !token;
const site = (process.env.PAGES_URL ?? '').replace(/\/$/, '');
const runUrl = process.env.GITHUB_RUN_ID ? `${process.env.GITHUB_SERVER_URL ?? 'https://github.com'}/${repo}/actions/runs/${process.env.GITHUB_RUN_ID}` : '';

const report = JSON.parse(readFileSync(args.report!, 'utf8')) as LinkReport;
const failing = report.results.filter((r) => FAILING.includes(r.status));
const moved = report.results.filter((r) => r.status === 'moved');
const unverified = report.results.filter((r) => r.status === 'unverified');

async function gh(method: string, path: string, body?: unknown) {
  const res = await fetch(`https://api.github.com/repos/${repo}${path}`, {
    method,
    headers: { authorization: `Bearer ${token}`, accept: 'application/vnd.github+json', 'x-github-api-version': '2022-11-28', 'content-type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok && res.status !== 404 && res.status !== 422) throw new Error(`GitHub ${method} ${path}: ${res.status} ${await res.text()}`);
  return { status: res.status, json: res.status === 204 ? null : await res.json().catch(() => null) };
}

const fallbackText = (r: LinkResult) =>
  r.target.href.startsWith('/') ? `HMI page \`${r.target.href}\`` : `${r.target.href}${r.target.via ? ` (via ${r.target.via})` : ''}`;
const day = (iso: string | null) => (iso ? iso.slice(0, 10) : '—');
const cell = (s: string) => s.replace(/\|/g, '/').replace(/\n/g, ' ');

const CHECK_NAME: Record<LinkReport['trigger'], string> = {
  nightly: 'Last night’s link check',
  push: 'The link check for the latest deploy',
  manual: 'A link check started by hand',
  local: 'A link check',
};

function body(): string {
  const lines = [
    `${CHECK_NAME[report.trigger] ?? 'A link check'} found **${failing.length} manufacturer link${failing.length === 1 ? '' : 's'} not working**. Customers aren’t affected: each one’s /go/ page now sends people to a safe fallback until the link is fixed.`,
    '',
    '| Link | Status | What’s wrong | Failing since | Fallback in effect |',
    '|---|---|---|---|---|',
    ...failing.map((r) => `| ${cell(r.label)} — ${r.url} | ${r.status} | ${cell(r.reason)} | ${day(r.firstFailed)} | ${cell(fallbackText(r))} |`),
    '',
    'To fix one: find the model’s new page on the manufacturer’s site and update its `url` in `src/data/products.ts` (or mark the model discontinued), or accept the suggestion in HMI mode → Website.',
  ];
  if (moved.length) lines.push('', `**Moved (working through a redirect — update the stored URL):**`, ...moved.map((r) => `- ${r.label}: ${r.url} → ${r.suggestedUrl ?? r.finalUrl}`));
  if (unverified.length) lines.push('', `**Unverified (behind a bot check, still linked normally):**`, ...unverified.map((r) => `- ${r.label}: ${cell(r.reason)}`));
  lines.push('', `Checked ${report.generatedAt} · ${report.summary.total} links${runUrl ? ` · [workflow run](${runUrl})` : ''}${site ? ` · [HMI mode → Website](${site}/office/website/?tab=health)` : ''}`);
  lines.push('', `<!-- failing: ${failing.map((r) => r.slug).join(',')} -->`);
  return lines.join('\n');
}

const title = `Link health: ${failing.length} manufacturer link${failing.length === 1 ? '' : 's'} failing (fallbacks in effect)`;

if (dry) {
  console.log(failing.length ? `Would open/update “${title}”:\n\n${body()}` : 'All links pass — would close any open link-health issue.');
  process.exit(0);
}

await gh('POST', '/labels', { name: LABEL, color: 'ad4118', description: 'Nightly manufacturer link check' }); // 422 if it exists
const list = await gh('GET', `/issues?labels=${LABEL}&state=open&per_page=10`);
const open = ((list.json as { number: number; body?: string; pull_request?: unknown }[] | null) ?? []).find((i) => !i.pull_request);

if (failing.length) {
  if (open) {
    const before = new Set((open.body?.match(/<!-- failing: ([^>]*) -->/)?.[1] ?? '').split(',').filter(Boolean));
    const fresh = failing.filter((r) => !before.has(r.slug));
    await gh('PATCH', `/issues/${open.number}`, { title, body: body() });
    if (fresh.length) await gh('POST', `/issues/${open.number}/comments`, { body: `Newly failing: ${fresh.map((r) => `**${r.label}** (${r.status} — ${r.reason})`).join('; ')}.` });
    console.log(`Updated issue #${open.number}${fresh.length ? ` (+${fresh.length} newly failing)` : ''}`);
  } else {
    const created = await gh('POST', '/issues', { title, body: body(), labels: [LABEL] });
    console.log(`Opened issue #${(created.json as { number: number }).number}`);
  }
} else if (open) {
  await gh('POST', `/issues/${open.number}/comments`, { body: `All ${report.summary.total} links pass as of ${report.generatedAt} — closing.${runUrl ? ` ([run](${runUrl}))` : ''}` });
  await gh('PATCH', `/issues/${open.number}`, { state: 'closed', state_reason: 'completed' });
  console.log(`Closed issue #${open.number}`);
} else {
  console.log('All links pass — no issue to close.');
}
