/** Link health: the latest nightly check — what failed, where customers are sent instead, and URLs to update. */
import { useState } from 'preact/hooks';
import type { LinkResult, LinkStatus } from '../../../data/links';
import { plural } from '../../lib/format';
import { toast } from '../../toast';
import { Badge, Button, Card, Chips, EmptyState, Stat } from '../../ui/core';
import { DataTable, type Column } from '../../ui/Table';
import { dismiss, setLinkUrl } from './actions';
import { failingLinks, movedLinks, report, unverifiedLinks } from './data';
import { ago, LinkBadge, linkMeta, shortUrl, targetText, when } from './helpers';
import { db } from '../../store';

type Filter = 'all' | 'failing' | 'moved' | 'unverified' | 'ok';

const kindLabel: Record<LinkResult['kind'], string> = { model: 'Model page', brand: 'Brand site', support: 'Owner support', tool: 'Tool' };

export function NoReport({ what = 'link report' }: { what?: string }) {
  const reason = report.value.state === 'none' ? report.value.reason : '';
  return (
    <Card title={what === 'link report' ? 'Link health' : 'New & discontinued'}>
      <EmptyState icon="link" title={`No ${what} yet`}>
        The nightly job checks every manufacturer link and publishes the results with the site, so HMI mode shows them here. This copy was built without one
        — that’s normal in local development. Run <code>npm run links:check</code>
        {what === 'link report' ? '' : ' and npm run links:sitemaps'} before building to see real results.
        {reason && <span class="sr-only"> ({reason})</span>}
      </EmptyState>
    </Card>
  );
}

export function HealthTab() {
  const [filter, setFilter] = useState<Filter>('all');
  const r = report.value;
  if (r.state === 'loading') return <Card title="Link health"><p class="muted">Loading the latest check…</p></Card>;
  if (r.state === 'none') return <NoReport />;

  const rep = r.data;
  const s = rep.summary;
  const failing = failingLinks.value;
  const moved = movedLinks.value;
  const unverified = unverifiedLinks.value;
  const accepted = db.value.website.linkUrls;

  const rows = rep.results.filter((x) => {
    if (filter === 'failing') return ['dead', 'wrong-page', 'soft-404'].includes(x.status);
    if (filter === 'all') return true;
    return x.status === (filter as LinkStatus);
  });

  const columns: Column<LinkResult>[] = [
    {
      key: 'link',
      label: 'Link',
      sortValue: (x) => x.label,
      render: (x) => (
        <span>
          <span class="cell-main">{x.label}</span>
          <span class="cell-sub">
            {kindLabel[x.kind]} · <span title={x.url}>{shortUrl(x.url)}</span>
          </span>
        </span>
      ),
    },
    { key: 'status', label: 'Status', sortValue: (x) => x.status, render: (x) => <LinkBadge result={x} /> },
    { key: 'reason', label: 'Why', hide: 'md', render: (x) => <span class="web-reason">{x.reason}</span> },
    { key: 'target', label: '/go/ sends people to', hide: 'sm', render: (x) => <span class="cell-sub web-target">{targetText(x.target)}</span> },
    { key: 'lastOk', label: 'Last OK', hide: 'md', sortValue: (x) => x.lastOk ?? '', render: (x) => <span class="cell-sub">{ago(x.lastOk)}</span> },
  ];

  return (
    <div class="stack">
      <div class="stats">
        <Stat label="Links checked" icon="link" value={s.total} hint={`${when(rep.generatedAt)} · ${rep.trigger === 'nightly' ? 'nightly run' : rep.trigger === 'push' ? 'before a publish' : rep.trigger === 'manual' ? 'manual run' : 'local run'}`} />
        <Stat label="Working" icon="check-circle" value={s.ok + s.moved} hint={s.moved ? `${plural(s.moved, 'moved', 'moved')} to a new address` : 'At their stored addresses'} />
        <Stat label="Fallbacks in effect" icon="shield" value={failing.length} hint={failing.length ? 'Customers get a safe page instead' : 'Nothing broken'} />
        <Stat label="Unverified" icon="lock" value={s.unverified} hint="Bot checks — still sent to the stored URL" />
      </div>

      <Card title="Fallbacks in effect" subtitle={failing.length ? 'These links failed the check, so /go/ sends customers to a safe page until someone fixes them.' : 'Every manufacturer link passed — no fallbacks needed.'} flush>
        {failing.length === 0 ? (
          <EmptyState icon="check-circle" title="Nothing to fix" />
        ) : (
          <ul class="web-list" role="list">
            {failing.map((x) => (
              <li key={x.slug} class="web-item">
                <div class="web-item__main">
                  <p class="web-item__title">
                    {x.label} <LinkBadge result={x} />
                  </p>
                  <p class="web-item__text">{x.reason}</p>
                  <p class="web-item__meta">
                    Failing since {when(x.firstFailed)} · customers now go to <strong>{targetText(x.target)}</strong> · stored URL{' '}
                    <a href={x.url} target="_blank" rel="noopener noreferrer" class="link-btn">
                      {shortUrl(x.url)}
                    </a>
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title="Update stored URL" subtitle={moved.length ? 'The right page, at a new address. Accept to store the new one — it goes live on the next publish (simulated).' : 'No moved links waiting.'} flush>
        {moved.length === 0 ? (
          <EmptyState icon="link" title="No URLs to update" />
        ) : (
          <ul class="web-list" role="list">
            {moved.map((x) => (
              <li key={x.slug} class="web-item">
                <div class="web-item__main">
                  <p class="web-item__title">{x.label}</p>
                  <p class="web-item__text">
                    <span class="web-from">{shortUrl(x.url)}</span> → <span class="web-to">{shortUrl(x.suggestedUrl ?? x.finalUrl)}</span>
                  </p>
                  <p class="web-item__meta">{x.reason}</p>
                </div>
                <div class="web-item__actions">
                  <Button
                    variant="primary"
                    size="sm"
                    icon="check"
                    onClick={() => {
                      setLinkUrl(x.slug, x.suggestedUrl ?? x.finalUrl);
                      toast(`New address stored for ${x.label} — goes live on the next publish (simulated)`, { tone: 'success' });
                    }}
                  >
                    Accept<span class="sr-only"> new address for {x.label}</span>
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => (dismiss(`url:${x.slug}`), toast(`Kept the stored URL for ${x.label}`))}>
                    Keep old<span class="sr-only"> address for {x.label}</span>
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
        {Object.values(accepted).some((a) => !a.publishedAt) && (
          <p class="web-note">
            <Badge tone="violet" icon="clock">
              {plural(Object.values(accepted).filter((a) => !a.publishedAt).length, 'new address', 'new addresses')} waiting for the next publish (simulated)
            </Badge>
          </p>
        )}
      </Card>

      {unverified.length > 0 && (
        <Card title="Couldn’t verify" subtitle="These sites showed a bot check even to a real browser. They’re never counted as dead — customers still go to the stored URL." flush>
          <ul class="web-list" role="list">
            {unverified.map((x) => (
              <li key={x.slug} class="web-item">
                <div class="web-item__main">
                  <p class="web-item__title">{x.label}</p>
                  <p class="web-item__text">{x.reason}</p>
                  <p class="web-item__meta">Last verified OK: {x.lastOk ? when(x.lastOk) : 'never (since this check began)'}</p>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card title="Every link" subtitle={`${plural(rep.results.length, 'outbound link')} — models, brand sites, owner-support pages and tools`} flush>
        <div class="toolbar web-toolbar">
          <Chips<Filter>
            label="Show"
            value={filter}
            onChange={setFilter}
            items={[
              { key: 'all', label: 'All', count: rep.results.length },
              { key: 'failing', label: 'Failing', count: failing.length },
              { key: 'moved', label: linkMeta.moved.label, count: s.moved },
              { key: 'unverified', label: linkMeta.unverified.label, count: s.unverified },
              { key: 'ok', label: linkMeta.ok.label, count: s.ok },
            ]}
          />
        </div>
        <DataTable rows={rows} columns={columns} rowKey={(x) => x.slug} caption="Outbound links and their latest check" initialSort={{ key: 'status', dir: 'asc' }} pageSize={40} dense />
      </Card>
    </div>
  );
}
