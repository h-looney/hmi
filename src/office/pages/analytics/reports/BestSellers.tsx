/** Which appliances sell best — by units, revenue or margin — with stock on hand alongside. */
import { useMemo, useState } from 'preact/hooks';
import { compact, compactMoney, decimal, money, percent, plural } from '../../../lib/format';
import { storeName } from '../../../selectors';
import { BarChart, ChartFrame, HBarChart } from '../../../ui/charts';
import { Badge, Button, Card, EmptyState, Segmented, Stat } from '../../../ui/core';
import { DataTable } from '../../../ui/Table';
import type { ReportProps } from '../Analytics';
import { bucketIndex, downloadCSV, sum, timeBuckets, within } from '../facts';
import { Icon } from '../../../ui/Icon';
import { bestSellers, type SellerRow } from '../metrics';
import { STAND_IN_NOTE } from '../standIns';

type Metric = 'units' | 'revenue' | 'margin';

export default function BestSellers({ d, facts, range, store }: ReportProps) {
  const [metric, setMetric] = useState<Metric>('units');
  const [by, setBy] = useState<'model' | 'brand' | 'category'>('model');
  const rows = useMemo(() => bestSellers(d, facts, range, store, by), [d, facts, range.from, range.to, store, by]);
  const prev = useMemo(() => (range.prev ? bestSellers(d, facts, { ...range, from: range.prev.from, to: range.prev.to }, store, 'model') : undefined), [d, facts, range.from, range.to, store]);
  const valueOf = (r: SellerRow) => (metric === 'units' ? r.units : metric === 'revenue' ? r.revenue : r.revenue - r.cost);
  const fmt = (n: number) => (metric === 'units' ? compact(n) : money(n, false));
  const ranked = [...rows].sort((a, b) => valueOf(b) - valueOf(a));

  const units = sum(rows.map((r) => r.units));
  const revenue = sum(rows.map((r) => r.revenue));
  const cost = sum(rows.map((r) => r.cost));
  const prevUnits = prev ? sum(prev.map((r) => r.units)) : 0;
  const prevRevenue = prev ? sum(prev.map((r) => r.revenue)) : 0;

  // Units sold over time, split by store
  const buckets = timeBuckets(range.from, range.to);
  const series = { 'osage-beach': buckets.map(() => 0), nixa: buckets.map(() => 0) };
  const unitIds = new Set(d.items.filter((i) => i.kind === 'unit').map((i) => i.id));
  for (const s of within(facts.sales, range.from, range.to, store)) {
    if (!unitIds.has(s.itemId)) continue;
    const i = bucketIndex(buckets, s.day);
    if (i >= 0) series[s.store][i] += s.qty;
  }

  const top = ranked.slice(0, 10);
  const split = store === 'all' && metric === 'units';

  return (
    <div class="report">
      <div class="toolbar">
        <Segmented
          label="Measure"
          value={metric}
          onChange={setMetric}
          items={[
            { key: 'units', label: 'Units' },
            { key: 'revenue', label: 'Revenue' },
            { key: 'margin', label: 'Gross margin' },
          ]}
        />
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
            downloadCSV(`best-sellers-${range.from}-to-${range.to}.csv`, [
              ['Rank', by === 'model' ? 'Model' : by === 'brand' ? 'Brand' : 'Category', 'Units', 'Osage Beach', 'Nixa', 'Revenue', 'Gross margin %', 'Average price', 'Available now', 'Days of supply'],
              ...ranked.map((r, i) => [i + 1, r.label, r.units, r.byStore['osage-beach'], r.byStore.nixa, Math.round(r.revenue), +(r.margin * 100).toFixed(1), Math.round(r.avgPrice), r.available ?? '', r.daysOfSupply !== undefined ? Math.round(r.daysOfSupply) : '']),
            ])
          }
        >
          Export CSV
        </Button>
      </div>

      <div class="stats">
        <Stat label="Appliances sold" icon="flame" value={units.toLocaleString()} delta={prevUnits ? units / prevUnits - 1 : undefined} deltaLabel="vs. last year" />
        <Stat label="Appliance revenue" icon="dollar" value={money(revenue, false)} delta={prevRevenue ? revenue / prevRevenue - 1 : undefined} deltaLabel="vs. last year" />
        <Stat label="Average selling price" icon="tag" value={units ? money(revenue / units, false) : '—'} />
        <Stat label="Gross margin" icon="trend" value={revenue ? percent((revenue - cost) / revenue) : '—'} hint={`${money(revenue - cost, false)} on equipment`} />
      </div>

      <div class="callout callout--amber">
        <Icon name="info" size={18} />
        <div>
          <p class="callout__title">Sample data</p>
          <p class="callout__text">{STAND_IN_NOTE}</p>
        </div>
      </div>

      <div class="grid-2">
        <ChartFrame
          title={`Top ${by === 'model' ? 'models' : by === 'brand' ? 'brands' : 'categories'} by ${metric === 'units' ? 'units sold' : metric === 'revenue' ? 'revenue' : 'gross margin'}`}
          subtitle={split ? 'Split by showroom' : store === 'all' ? 'Both showrooms' : storeName(store)}
          legend={split ? [{ label: 'Osage Beach', color: 'var(--series-1)' }, { label: 'Nixa', color: 'var(--series-2)' }] : undefined}
          table={{ columns: ['Rank', 'Name', 'Units', 'Revenue', 'Gross margin'], rows: top.map((r, i) => [i + 1, r.label, r.units, money(r.revenue, false), percent(r.margin)]) }}
        >
          {top.length ? (
            <HBarChart
              ariaLabel="Best sellers"
              rows={top.map((r, i) => ({ key: r.key, label: `${i + 1}. ${r.label}`, sub: by === 'model' ? r.category : undefined, value: split ? r.byStore['osage-beach'] : valueOf(r), value2: split ? r.byStore.nixa : undefined }))}
              format={fmt}
              labels={['Osage Beach', 'Nixa']}
            />
          ) : (
            <EmptyState icon="tag" title="No appliance sales in this range" />
          )}
        </ChartFrame>
        <ChartFrame
          title="Appliances sold over time"
          subtitle={range.days <= 120 ? 'Weekly' : 'Monthly'}
          legend={store === 'all' ? [{ label: 'Osage Beach', color: 'var(--series-1)' }, { label: 'Nixa', color: 'var(--series-2)' }] : undefined}
          table={{ columns: ['Period', 'Osage Beach', 'Nixa', 'Total'], rows: buckets.map((b, i) => [b.title, series['osage-beach'][i], series.nixa[i], series['osage-beach'][i] + series.nixa[i]]) }}
        >
          <BarChart
            ariaLabel="Appliances sold over time"
            categories={buckets.map((b) => b.label)}
            titles={buckets.map((b) => b.title)}
            series={
              store === 'all'
                ? [
                    { key: 'ob', label: 'Osage Beach', color: 'var(--series-1)', values: series['osage-beach'] },
                    { key: 'nx', label: 'Nixa', color: 'var(--series-2)', values: series.nixa },
                  ]
                : [{ key: store, label: storeName(store), color: 'var(--series-1)', values: series[store] }]
            }
            format={(n) => plural(n, 'unit')}
            axisFormat={(n) => compact(n)}
            height={260}
          />
        </ChartFrame>
      </div>

      <Card title="All appliances sold" subtitle="Stock on hand and days of supply help plan the next order" flush>
        <DataTable
          caption="Appliance sales"
          rows={ranked}
          rowKey={(r) => r.key}
          initialSort={{ key: 'value', dir: 'desc' }}
          empty={<EmptyState icon="tag" title="No appliance sales in this range" />}
          columns={[
            {
              key: 'label',
              label: by === 'model' ? 'Model' : by === 'brand' ? 'Brand' : 'Category',
              sortValue: (r) => r.label,
              // Stand-in names, without a link to the real item (standIns.ts)
              render: (r) =>
                r.itemId ? (
                  <span>
                    <span class="cell-main">{r.label}</span>
                    <span class="cell-sub">{r.category}</span>
                  </span>
                ) : (
                  <span class="cell-main">{r.label}</span>
                ),
            },
            { key: 'value', label: 'Units', align: 'right', sortValue: (r) => r.units, render: (r) => <strong>{r.units}</strong> },
            { key: 'split', label: 'Osage / Nixa', align: 'right', render: (r) => `${r.byStore['osage-beach']} / ${r.byStore.nixa}`, hide: 'sm' },
            { key: 'revenue', label: 'Revenue', align: 'right', sortValue: (r) => r.revenue, render: (r) => money(r.revenue, false) },
            { key: 'margin', label: 'Margin', align: 'right', sortValue: (r) => r.margin, render: (r) => percent(r.margin), hide: 'sm' },
            { key: 'price', label: 'Avg price', align: 'right', sortValue: (r) => r.avgPrice, render: (r) => compactMoney(r.avgPrice), hide: 'md' },
            ...(by === 'model'
              ? [
                  { key: 'avail', label: 'Available now', align: 'right' as const, sortValue: (r: SellerRow) => r.available ?? 0, render: (r: SellerRow) => r.available ?? '—', hide: 'md' as const },
                  {
                    key: 'supply',
                    label: 'Days of supply',
                    align: 'right' as const,
                    sortValue: (r: SellerRow) => r.daysOfSupply ?? 9999,
                    render: (r: SellerRow) =>
                      r.daysOfSupply === undefined ? (
                        '—'
                      ) : r.daysOfSupply < 21 ? (
                        <Badge tone="amber" icon="alert">
                          {decimal(r.daysOfSupply).replace(/\.0$/, '')} days
                        </Badge>
                      ) : (
                        `${Math.round(r.daysOfSupply)} days`
                      ),
                  },
                ]
              : []),
          ]}
        />
      </Card>
      <p class="report-note">Counts appliances delivered — installs on the day they were completed, counter sales on the sale date. Days of supply = sellable stock ÷ the average daily sales in this range.</p>
    </div>
  );
}
