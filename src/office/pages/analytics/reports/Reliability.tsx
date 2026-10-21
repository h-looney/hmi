/** Problem units: service calls and warranty work per installed unit, top issues, repeat visits. */
import { useMemo, useState } from 'preact/hooks';
import { issues } from '../../../data/catalog';
import { openDialog } from '../../../dialogs';
import { decimal, money, percent, plural, shortDate } from '../../../lib/format';
import { navigate } from '../../../router';
import { itemOf, unitLabel } from '../../../selectors';
import { ChartFrame, HBarChart } from '../../../ui/charts';
import { Badge, Button, Card, EmptyState, Link, Menu, Segmented, Stat } from '../../../ui/core';
import { Icon } from '../../../ui/Icon';
import { DataTable } from '../../../ui/Table';
import type { ReportProps } from '../Analytics';
import { downloadCSV, sum } from '../facts';
import { reliability, repeatUnits, topCounts } from '../metrics';

export default function Reliability({ d, h, facts, range, store, today }: ReportProps) {
  const [by, setBy] = useState<'model' | 'brand' | 'category'>('model');
  const { rows, fleet, calls } = useMemo(() => reliability(d, h, facts, range, store, by), [d, h, facts, range.from, range.to, store, by]);
  const repeats = useMemo(() => repeatUnits(d, facts, today, store), [d, facts, today, store]);
  // Small samples swing wildly once annualized, so rank only groups with enough calls to mean something
  const minBase = by === 'model' ? 40 : 60;
  const minCalls = Math.max(6, Math.round(range.days / 30));
  const ranked = rows.filter((r) => r.base >= minBase && r.calls >= minCalls).sort((a, b) => b.per100 - a.per100);
  const watch = (r: (typeof rows)[number]) => r.per100 > fleet * 1.8 && r.calls >= minCalls * 2;
  const issueCounts = topCounts(calls, 'issue');
  const partCounts = topCounts(calls, 'part');
  const claimsInRange = d.claims.filter((c) => c.openedOn >= range.from && c.openedOn <= range.to && (store === 'all' || c.store === store));
  const credited = claimsInRange.filter((c) => c.status === 'credited');

  return (
    <div class="report">
      <div class="toolbar">
        <Segmented
          label="Group by"
          value={by}
          onChange={setBy}
          items={[
            { key: 'model', label: 'Model' },
            { key: 'brand', label: 'Brand' },
            { key: 'category', label: 'Category' },
          ]}
        />
        <span class="toolbar__spacer" />
        <Button
          size="sm"
          icon="download"
          onClick={() =>
            downloadCSV(`problem-units-${range.from}-to-${range.to}.csv`, [
              ['Group', 'Brand', 'Category', 'Installed base', 'Service calls', 'Warranty jobs', 'Return visits', 'Calls per 100 units per year', 'Top issue'],
              ...rows.sort((a, b) => b.per100 - a.per100).map((r) => [r.label, r.brand, r.category, r.base, r.calls, r.warranty, r.callbacks, +r.per100.toFixed(1), r.topIssue ?? '']),
            ])
          }
        >
          Export CSV
        </Button>
      </div>

      <div class="stats">
        <Stat label="Service calls" icon="wrench" value={calls.length} hint={`Repairs and warranty visits · ${decimal(fleet)} per 100 units a year`} />
        <Stat label="Warranty claims filed" icon="shield" value={claimsInRange.length} hint={`${claimsInRange.filter((c) => c.status === 'denied').length} denied`} to="/office/warranty/?tab=claims" />
        <Stat label="Credits received" icon="dollar" value={money(sum(credited.map((c) => c.credit)), false)} hint={`${plural(credited.length, 'claim')} credited`} />
        <Stat label="Repeat-visit appliances" icon="undo" value={repeats.length} hint="3+ service calls in 12 months" />
      </div>

      <div class="callout callout--amber">
        <Icon name="info" size={18} />
        <div>
          <p class="callout__title">Sample data</p>
          <p class="callout__text">These figures are randomly generated for the demo and say nothing about how any real product performs. In the live system they would come from HMI’s own service history.</p>
        </div>
      </div>

      <div class="grid-2">
        <ChartFrame
          title={`Service calls per 100 units — by ${by}`}
          subtitle={`Annualized; groups with ${minBase}+ units in service and ${minCalls}+ calls in this range. The line marks the overall rate.`}
          table={{ columns: [by === 'model' ? 'Model' : by === 'brand' ? 'Brand' : 'Category', 'Units in service', 'Service calls', 'Per 100 units / yr'], rows: ranked.map((r) => [r.label, r.base, r.calls, decimal(r.per100)]) }}
        >
          {ranked.length ? (
            <HBarChart
              ariaLabel="Service calls per 100 units"
              rows={ranked.slice(0, 10).map((r) => ({
                key: r.key,
                label: r.label,
                sub: `${plural(r.calls, 'call')} · ${r.base.toLocaleString()} in service`,
                value: r.per100,
                flag: watch(r) ? (
                  <Badge tone="red" icon="alert" class="ml-6">
                    Watch
                  </Badge>
                ) : undefined,
              }))}
              format={(n) => decimal(n)}
              reference={{ value: fleet, label: `Overall ${decimal(fleet)}` }}
            />
          ) : (
            <EmptyState icon="check-circle" title="Not enough service calls in this range" />
          )}
        </ChartFrame>

        <ChartFrame title="Most common problems" subtitle="Share of repair and warranty calls" table={{ columns: ['Problem', 'Calls', 'Share'], rows: issueCounts.map(([k, n]) => [issues[k]?.label ?? k, n, percent(n / Math.max(1, calls.length))]) }}>
          {issueCounts.length ? (
            <HBarChart ariaLabel="Most common problems" rows={issueCounts.slice(0, 8).map(([k, n]) => ({ key: k, label: issues[k]?.label ?? k, value: n, note: `· ${percent(n / calls.length)}` }))} format={(n) => String(n)} color="var(--series-2)" />
          ) : (
            <EmptyState icon="check-circle" title="No service calls in this range" />
          )}
        </ChartFrame>
      </div>

      <Card title="Appliances that keep needing service" subtitle="Three or more repair or warranty visits in the last 12 months — good candidates for a replacement conversation" flush>
        <DataTable
          caption="Appliances with repeat service visits"
          rows={repeats}
          rowKey={(r) => r.unit.id}
          pageSize={10}
          initialSort={{ key: 'visits', dir: 'desc' }}
          empty={<EmptyState icon="check-circle" title="No repeat-visit appliances">Nothing has needed three or more service calls in the last year.</EmptyState>}
          columns={[
            {
              key: 'customer',
              label: 'Customer',
              sortValue: (r) => r.customer?.name ?? '',
              render: (r) => (
                <span>
                  <Link class="cell-main" to={`/office/customers/?id=${r.customer?.id}&tab=equipment`}>
                    {r.customer?.name}
                  </Link>
                  <span class="cell-sub">{r.customer?.address.city}</span>
                </span>
              ),
            },
            {
              key: 'unit',
              label: 'Appliance',
              sortValue: (r) => unitLabel(r.unit),
              render: (r) => (
                <span>
                  {unitLabel(r.unit)}
                  <span class="cell-sub">
                    {r.unit.installedBy === 'HMI' ? `Installed by HMI ${r.unit.installedOn.slice(0, 4)}` : 'Installed by others'} · {r.unit.serial}
                  </span>
                </span>
              ),
            },
            { key: 'visits', label: 'Visits', align: 'right', sortValue: (r) => r.visits, render: (r) => <strong>{r.visits}</strong> },
            { key: 'last', label: 'Last problem', sortValue: (r) => r.last.day, render: (r) => <span>{issues[r.last.issue ?? '']?.label ?? 'Service'}<span class="cell-sub">{shortDate(r.last.day)}</span></span>, hide: 'sm' },
            {
              key: 'act',
              label: <span class="sr-only">Actions</span>,
              align: 'right',
              render: (r) => (
                <Menu
                  label={`Actions for ${r.customer?.name}`}
                  size="sm"
                  items={[
                    { label: 'Start a replacement estimate', icon: 'file', onSelect: () => openDialog({ kind: 'invoice', preset: { kind: 'estimate', customerId: r.customer?.id } }) },
                    { label: 'Schedule a service visit', icon: 'calendar-plus', onSelect: () => openDialog({ kind: 'job', preset: { type: 'repair', customerId: r.customer?.id, unitId: r.unit.id, store: r.customer?.store } }) },
                    { label: 'Open customer', icon: 'user', onSelect: () => navigate(`/office/customers/?id=${r.customer?.id}`) },
                  ]}
                />
              ),
            },
          ]}
        />
      </Card>

      <div class="grid-2">
        <ChartFrame title="Parts replaced most" subtitle="From repair and warranty visits in this range" table={{ columns: ['Part', 'Times replaced'], rows: partCounts.map(([k, n]) => [itemOf(d, k)?.name ?? k, n]) }}>
          {partCounts.length ? <HBarChart ariaLabel="Parts replaced most" rows={partCounts.slice(0, 8).map(([k, n]) => ({ key: k, label: itemOf(d, k)?.name ?? k, value: n }))} format={(n) => String(n)} color="var(--series-3)" /> : <EmptyState icon="box" title="No parts replaced in this range" />}
        </ChartFrame>
        <Card title="All groups" subtitle="Sorted by service rate" flush>
          <DataTable
            caption="Service rate by group"
            dense
            rows={rows.filter((r) => r.calls > 0)}
            rowKey={(r) => r.key}
            pageSize={8}
            initialSort={{ key: 'rate', dir: 'desc' }}
            columns={[
              { key: 'label', label: by === 'model' ? 'Model' : by === 'brand' ? 'Brand' : 'Category', sortValue: (r) => r.label, render: (r) => <span class="cell-main">{r.label}</span> },
              { key: 'base', label: 'In service', align: 'right', sortValue: (r) => r.base, render: (r) => r.base.toLocaleString(), hide: 'sm' },
              { key: 'calls', label: 'Calls', align: 'right', sortValue: (r) => r.calls, render: (r) => r.calls },
              { key: 'rate', label: 'Per 100 / yr', align: 'right', sortValue: (r) => r.per100, render: (r) => decimal(r.per100) },
              { key: 'issue', label: 'Top problem', sortValue: (r) => r.topIssue ?? '', render: (r) => r.topIssue ?? '—', hide: 'md' },
            ]}
          />
        </Card>
      </div>
    </div>
  );
}
