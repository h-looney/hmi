/** Clicks: outbound clicks per product, from the /go/ pages visited in this browser. */
import { clearClicks } from '../../bridge';
import { toDateTime } from '../../lib/dates';
import { plural, relative } from '../../lib/format';
import { toast } from '../../toast';
import { Button, Card, EmptyState, LinkButton, Stat } from '../../ui/core';
import { ChartFrame, HBarChart } from '../../ui/charts';
import { Icon } from '../../ui/Icon';
import { DataTable, type Column } from '../../ui/Table';
import { clickRows, clicks, refreshClicks, siteHref, type ClickRow } from './data';
import { productPath, productById } from '../../../data/products';

const kindLabel: Record<ClickRow['kind'], string> = { model: 'Full specs', brand: 'Brand site', support: 'Owner support', tool: 'Tool' };

export function ClicksTab() {
  const rows = clickRows.value;
  const total = clicks.value.length;
  const week = clicks.value.filter((c) => c.at >= toDateTime(new Date(Date.now() - 7 * 86_400_000))).length;
  const fallback = clicks.value.filter((c) => c.mode === 'fallback').length;
  const sample = productById('HG-MEZZO48');

  const columns: Column<ClickRow>[] = [
    {
      key: 'label',
      label: 'Link',
      sortValue: (r) => r.label,
      render: (r) => (
        <span>
          <span class="cell-main">{r.label}</span>
          <span class="cell-sub">{kindLabel[r.kind]}</span>
        </span>
      ),
    },
    { key: 'count', label: 'Clicks', align: 'right', sortValue: (r) => r.count, render: (r) => r.count },
    { key: 'fallback', label: 'Sent to a fallback', align: 'right', hide: 'sm', sortValue: (r) => r.fallback, render: (r) => r.fallback || '—' },
    { key: 'last', label: 'Last click', hide: 'sm', sortValue: (r) => r.last, render: (r) => <span class="cell-sub">{relative(r.last)}</span> },
  ];

  return (
    <div class="stack">
      <div class="callout callout--amber">
        <Icon name="info" size={18} />
        <div>
          <p class="callout__title">Counted in this browser only</p>
          <p class="callout__text">
            Each /go/ page records the click here before sending the visitor on. In production these would be counted server-side — web analytics or the redirect
            service — across every visitor, not just this browser.
          </p>
        </div>
      </div>

      <div class="stats">
        <Stat label="Outbound clicks" icon="external" value={total} hint={`${week} in the last 7 days`} />
        <Stat label="Links clicked" icon="link" value={rows.length} hint={rows.length ? `Most: ${rows[0].label}` : 'None yet'} />
        <Stat label="Saved by a fallback" icon="shield" value={fallback} hint="Clicks on a failing link that went somewhere safe" />
      </div>

      {rows.length === 0 ? (
        <Card title="Clicks per product">
          <EmptyState
            icon="external"
            title="No clicks in this browser yet"
            action={
              sample ? (
                <a class="btn btn--secondary btn--md" href={siteHref(productPath(sample))} target="_blank" rel="noopener">
                  Open a model page<span class="sr-only"> (opens in a new tab)</span>
                </a>
              ) : undefined
            }
          >
            Open a model page on the public site and use “Full specs at …” — the click shows up here.
          </EmptyState>
        </Card>
      ) : (
        <>
          <ChartFrame title="Clicks per product" subtitle="Top links by clicks in this browser" table={{ columns: ['Link', 'Clicks'], rows: rows.slice(0, 10).map((r) => [r.label, r.count]) }}>
            <HBarChart ariaLabel="Outbound clicks per link" rows={rows.slice(0, 10).map((r) => ({ key: r.key, label: r.label, value: r.count }))} format={(n) => plural(n, 'click')} />
          </ChartFrame>
          <Card
            title="Every click"
            actions={
              <>
                <Button size="sm" variant="ghost" icon="refresh" onClick={refreshClicks}>
                  Refresh
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  icon="trash"
                  onClick={() => {
                    clearClicks();
                    refreshClicks();
                    toast('Click history cleared in this browser');
                  }}
                >
                  Clear
                </Button>
              </>
            }
            flush
          >
            <DataTable rows={rows} columns={columns} rowKey={(r) => r.key} caption="Outbound clicks per link" initialSort={{ key: 'count', dir: 'desc' }} />
          </Card>
        </>
      )}
      <LinkButton to="/office/website/?tab=health" variant="ghost" size="sm" icon="link">
        Link health
      </LinkButton>
    </div>
  );
}
