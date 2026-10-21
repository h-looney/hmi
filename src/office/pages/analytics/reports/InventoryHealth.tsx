/** Inventory health: what's moving, what's sitting, and what's about to run out. */
import { useMemo, useState } from 'preact/hooks';
import { money, plural, shortDate } from '../../../lib/format';
import { storeName, STORES } from '../../../selectors';
import { ChartFrame, HBarChart } from '../../../ui/charts';
import { Badge, Button, Card, Chips, EmptyState, Link, Stat, type Tone } from '../../../ui/core';
import type { IconName } from '../../../ui/Icon';
import { DataTable } from '../../../ui/Table';
import type { ReportProps } from '../Analytics';
import { downloadCSV, sum } from '../facts';
import { inventoryHealth } from '../metrics';

type Health = ReturnType<typeof inventoryHealth>[number]['health'];

const healthMeta: Record<Health, { label: string; tone: Tone; icon: IconName }> = {
  out: { label: 'Out of stock', tone: 'red', icon: 'x-circle' },
  low: { label: 'Low', tone: 'amber', icon: 'alert' },
  slow: { label: 'Slow mover', tone: 'violet', icon: 'clock' },
  overstock: { label: 'Overstocked', tone: 'blue', icon: 'layers' },
  healthy: { label: 'Healthy', tone: 'green', icon: 'check' },
  special: { label: 'Special order', tone: 'neutral', icon: 'truck' },
};

export default function InventoryHealth({ d, facts, range, store, today }: ReportProps) {
  const [filter, setFilter] = useState<'all' | Health>('all');
  const rows = useMemo(() => inventoryHealth(d, facts, range, store, today), [d, facts, range.from, range.to, store, today]);
  const counts = (h: Health) => rows.filter((r) => r.health === h).length;
  const shown = filter === 'all' ? rows : rows.filter((r) => r.health === filter);
  const slow = rows.filter((r) => r.health === 'slow');
  const unitsSupply = rows.filter((r) => r.item.kind === 'unit' && r.daysOfSupply !== undefined).map((r) => r.daysOfSupply!);

  const categories = [...new Set(d.items.map((i) => i.category))];
  const valueByCat = categories
    .map((c) => {
      const items = rows.filter((r) => r.item.category === c);
      const per = Object.fromEntries(STORES.map((s) => [s, sum(items.map((r) => r.item.stock[s].onHand * r.item.cost))])) as Record<string, number>;
      return { key: c, label: c, ob: per['osage-beach'], nx: per.nixa, total: per['osage-beach'] + per.nixa };
    })
    .filter((c) => c.total > 0)
    .sort((a, b) => b.total - a.total);

  return (
    <div class="report">
      <div class="toolbar">
        <Chips
          label="Stock health"
          value={filter}
          onChange={setFilter}
          items={[
            { key: 'all', label: 'All items', count: rows.length },
            { key: 'slow', label: 'Slow movers', count: counts('slow') },
            { key: 'low', label: 'Low', count: counts('low') },
            { key: 'out', label: 'Out', count: counts('out') },
            { key: 'overstock', label: 'Overstocked', count: counts('overstock') },
          ]}
        />
        <span class="toolbar__spacer" />
        <Button
          size="sm"
          icon="download"
          onClick={() =>
            downloadCSV(`inventory-health-${today}.csv`, [
              ['SKU', 'Item', 'Category', 'On hand', 'Available', `Sold (${range.label})`, 'Last sold', 'Days of supply', 'Value at cost', 'Status'],
              ...rows.map((r) => [r.item.id, `${r.item.brand} ${r.item.name}`, r.item.category, r.onHand, r.available, r.sold, r.lastSale ?? '', r.daysOfSupply !== undefined ? Math.round(r.daysOfSupply) : '', Math.round(r.value), healthMeta[r.health].label]),
            ])
          }
        >
          Export CSV
        </Button>
      </div>

      <div class="stats">
        <Stat label="Stock value at cost" icon="box" value={money(sum(rows.map((r) => r.value)), false)} hint={store === 'all' ? 'Both showrooms' : storeName(store)} />
        <Stat label="Slow movers" icon="clock" value={slow.length} hint={`${money(sum(slow.map((r) => r.value)), false)} tied up · no sale in 120+ days`} />
        <Stat label="Low or out of stock" icon="alert" value={counts('low') + counts('out')} hint="Below reorder point" to="/office/inventory/?filter=low" />
        <Stat label="Appliance days of supply" icon="calendar" value={unitsSupply.length ? `${Math.round(unitsSupply.sort((a, b) => a - b)[Math.floor(unitsSupply.length / 2)])} days` : '—'} hint="Median across models that sold" />
      </div>

      <ChartFrame
        title="Stock value by category"
        subtitle="At cost, split by showroom"
        legend={[
          { label: 'Osage Beach', color: 'var(--series-1)' },
          { label: 'Nixa', color: 'var(--series-2)' },
        ]}
        table={{ columns: ['Category', 'Osage Beach', 'Nixa', 'Total'], rows: valueByCat.map((c) => [c.label, money(c.ob, false), money(c.nx, false), money(c.total, false)]) }}
      >
        <HBarChart ariaLabel="Stock value by category" rows={valueByCat.map((c) => ({ key: c.key, label: c.label, value: store === 'nixa' ? c.nx : c.ob, value2: store === 'all' ? c.nx : undefined }))} format={(n) => money(n, false)} labels={['Osage Beach', 'Nixa']} />
      </ChartFrame>

      <Card title="Items" subtitle={`${plural(shown.length, 'item')} · sales measured over ${range.label.toLowerCase()}`} flush>
        <DataTable
          caption="Inventory health by item"
          rows={shown}
          rowKey={(r) => r.item.id}
          initialSort={{ key: 'value', dir: 'desc' }}
          empty={<EmptyState icon="check-circle" title="Nothing in this group" />}
          columns={[
            {
              key: 'item',
              label: 'Item',
              sortValue: (r) => r.item.name,
              render: (r) => (
                <span>
                  <Link class="cell-main" to={`/office/inventory/?id=${r.item.id}`}>
                    {r.item.brand === 'HMI Supply' ? r.item.name : `${r.item.brand} ${r.item.name}`}
                  </Link>
                  <span class="cell-sub">
                    {r.item.id} · {r.item.category}
                  </span>
                </span>
              ),
            },
            { key: 'onHand', label: 'On hand', align: 'right', sortValue: (r) => r.onHand, render: (r) => r.onHand },
            { key: 'sold', label: 'Sold', align: 'right', sortValue: (r) => r.sold, render: (r) => r.sold },
            { key: 'last', label: 'Last sold', sortValue: (r) => r.lastSale ?? '', render: (r) => (r.lastSale ? shortDate(r.lastSale) : <span class="muted">No sales</span>), hide: 'sm' },
            { key: 'supply', label: 'Days of supply', align: 'right', sortValue: (r) => r.daysOfSupply ?? 99999, render: (r) => (r.daysOfSupply === undefined ? '—' : Math.round(r.daysOfSupply).toLocaleString()), hide: 'md' },
            { key: 'value', label: 'Value', align: 'right', sortValue: (r) => r.value, render: (r) => money(r.value, false) },
            {
              key: 'status',
              label: 'Status',
              sortValue: (r) => r.health,
              render: (r) => (
                <Badge tone={healthMeta[r.health].tone} icon={healthMeta[r.health].icon}>
                  {healthMeta[r.health].label}
                </Badge>
              ),
            },
          ]}
        />
      </Card>
      <p class="report-note">Slow movers have stock on hand but no sale in the last 120 days — candidates for a showroom promotion or a transfer to the other store.</p>
    </div>
  );
}
