/** Leads & conversion: where requests come from, how fast we reply, and what we win. */
import { useMemo } from 'preact/hooks';
import type { LeadSource } from '../../../data/types';
import { decimal, duration, money, percent, plural } from '../../../lib/format';
import { BarChart, ChartFrame, HBarChart } from '../../../ui/charts';
import { Button, Card, EmptyState, Stat } from '../../../ui/core';
import { Icon } from '../../../ui/Icon';
import { sourceLabels } from '../../../ui/status';
import { DataTable } from '../../../ui/Table';
import type { ReportProps } from '../Analytics';
import { bucketIndex, downloadCSV, timeBuckets } from '../facts';
import { leadStats } from '../metrics';

const mins = (m: number | undefined) => (m === undefined ? '—' : duration(m));

export default function Leads({ facts, range, store }: ReportProps) {
  const s = useMemo(() => leadStats(facts, range, store), [facts, range.from, range.to, store]);
  const prev = useMemo(() => (range.prev ? leadStats(facts, { ...range, from: range.prev.from, to: range.prev.to }, store) : undefined), [facts, range.from, range.to, store]);
  const sources = [...s.bySource].sort((a, b) => b.total - a.total);
  const fast = s.buckets[0];
  const slow = s.buckets[s.buckets.length - 1];

  const buckets = timeBuckets(range.from, range.to);
  const quotes = buckets.map(() => 0);
  const service = buckets.map(() => 0);
  for (const l of s.list) {
    const i = bucketIndex(buckets, l.day);
    if (i < 0) continue;
    if (l.kind === 'quote') quotes[i]++;
    else service[i]++;
  }

  return (
    <div class="report">
      <div class="toolbar">
        <span class="toolbar__spacer" />
        <Button
          size="sm"
          icon="download"
          onClick={() =>
            downloadCSV(`leads-${range.from}-to-${range.to}.csv`, [
              ['Source', 'Requests', 'Won', 'Lost', 'Closed without a sale', 'Open', 'Win rate %', 'Median first reply (min)', 'Won value'],
              ...sources.map((r) => [sourceLabels[r.source as LeadSource] ?? r.source, r.total, r.won, r.lost, r.closed, r.open, +(r.winRate * 100).toFixed(1), r.medianResponse !== undefined ? Math.round(r.medianResponse) : '', Math.round(r.wonValue)]),
            ])
          }
        >
          Export CSV
        </Button>
      </div>

      <div class="stats">
        <Stat label="Requests received" icon="inbox" value={s.total.toLocaleString()} delta={prev?.total ? s.total / prev.total - 1 : undefined} deltaLabel="vs. last year" hint={`${s.quotes} quotes · ${s.service} service`} />
        <Stat label="Quote requests won" icon="check-circle" value={percent(s.quoteWinRate)} hint={prev ? `${percent(prev.quoteWinRate)} last year` : `${s.open} still open`} />
        <Stat label="Median first reply" icon="clock" value={mins(s.medianResponse)} deltaGood="down" delta={prev?.medianResponse ? s.medianResponse / prev.medianResponse - 1 : undefined} deltaLabel="vs. last year" hint="Website & Facebook requests" />
        <Stat label="Won from quotes" icon="dollar" value={money(s.wonValue, false)} hint="Estimated value of won requests" />
      </div>

      {fast.decided >= 5 && slow.decided >= 5 && fast.winRate > slow.winRate && (
        <div class="callout callout--green insights">
          <Icon name="zap" size={18} />
          <div>
            <p class="callout__title">Speed wins jobs</p>
            <p class="callout__text">
              Quote requests answered within an hour were won {percent(fast.winRate)} of the time, versus {percent(slow.winRate)} when the first reply took more than a day. Website requests that arrive after hours are the ones that wait — an evening auto-text or next-morning call list would help.
            </p>
          </div>
        </div>
      )}

      <div class="grid-2">
        <ChartFrame title="Requests by source" subtitle="Win rate counts requests that ended (won, lost or closed)" table={{ columns: ['Source', 'Requests', 'Win rate'], rows: sources.map((r) => [sourceLabels[r.source as LeadSource] ?? r.source, r.total, percent(r.winRate)]) }}>
          {sources.length ? <HBarChart ariaLabel="Requests by source" rows={sources.map((r) => ({ key: r.source, label: sourceLabels[r.source as LeadSource] ?? r.source, value: r.total, note: `· ${percent(r.winRate)} won` }))} format={(n) => String(n)} /> : <EmptyState icon="inbox" title="No requests in this range" />}
        </ChartFrame>
        <ChartFrame title="Win rate by first-reply time" subtitle="Quote requests from the website and Facebook" table={{ columns: ['First reply', 'Requests', 'Win rate'], rows: s.buckets.map((b) => [b.label, b.count, b.decided ? percent(b.winRate) : '—']) }}>
          <HBarChart ariaLabel="Win rate by how fast we replied" rows={s.buckets.map((b) => ({ key: b.key, label: b.label, value: b.winRate * 100, note: `· ${plural(b.count, 'request')}` }))} format={(n) => `${decimal(n).replace(/\.0$/, '')}%`} color="var(--series-3)" />
        </ChartFrame>
      </div>

      <ChartFrame
        title="Requests over time"
        subtitle={range.days <= 120 ? 'Weekly' : 'Monthly'}
        legend={[
          { label: 'Quote requests', color: 'var(--series-1)' },
          { label: 'Service & questions', color: 'var(--series-2)' },
        ]}
        table={{ columns: ['Period', 'Quote requests', 'Service & questions'], rows: buckets.map((b, i) => [b.title, quotes[i], service[i]]) }}
      >
        <BarChart
          ariaLabel="Requests over time"
          categories={buckets.map((b) => b.label)}
          titles={buckets.map((b) => b.title)}
          series={[
            { key: 'q', label: 'Quote requests', color: 'var(--series-1)', values: quotes },
            { key: 's', label: 'Service & questions', color: 'var(--series-2)', values: service },
          ]}
          format={(n) => plural(n, 'request')}
          axisFormat={(n) => String(n)}
          height={230}
        />
      </ChartFrame>

      <Card title="By source" flush>
        <DataTable
          caption="Requests by source"
          rows={sources}
          rowKey={(r) => r.source}
          initialSort={{ key: 'total', dir: 'desc' }}
          columns={[
            { key: 'source', label: 'Source', sortValue: (r) => sourceLabels[r.source as LeadSource] ?? r.source, render: (r) => <span class="cell-main">{sourceLabels[r.source as LeadSource] ?? r.source}</span> },
            { key: 'total', label: 'Requests', align: 'right', sortValue: (r) => r.total, render: (r) => r.total },
            { key: 'won', label: 'Won', align: 'right', sortValue: (r) => r.won, render: (r) => r.won },
            { key: 'lost', label: 'Lost', align: 'right', sortValue: (r) => r.lost, render: (r) => r.lost, hide: 'sm' },
            { key: 'open', label: 'Open', align: 'right', sortValue: (r) => r.open, render: (r) => r.open, hide: 'sm' },
            { key: 'rate', label: 'Win rate', align: 'right', sortValue: (r) => r.winRate, render: (r) => percent(r.winRate) },
            { key: 'reply', label: 'Median reply', align: 'right', sortValue: (r) => r.medianResponse ?? -1, render: (r) => (r.medianResponse === undefined ? <span class="muted">Live</span> : mins(r.medianResponse)), hide: 'md' },
            { key: 'value', label: 'Won value', align: 'right', sortValue: (r) => r.wonValue, render: (r) => money(r.wonValue, false), hide: 'md' },
          ]}
        />
      </Card>
      <p class="report-note">Phone calls and showroom visits are answered live, so they don’t have a reply time. A request counts as won when the customer accepts an estimate or books the work.</p>
    </div>
  );
}
