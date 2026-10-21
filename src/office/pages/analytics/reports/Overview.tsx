/** Analytics overview: the headline numbers for the selected range, plus a guide to every report. */
import { useMemo } from 'preact/hooks';
import { issues } from '../../../data/catalog';
import { compactMoney, decimal, money, percent, plural } from '../../../lib/format';
import { setParams } from '../../../router';
import { revenueEvents, storeName } from '../../../selectors';
import { BarChart, ChartFrame, HBarChart } from '../../../ui/charts';
import { Stat } from '../../../ui/core';
import { Icon } from '../../../ui/Icon';
import { reports, type ReportProps } from '../Analytics';
import { avg, bucketIndex, sum, timeBuckets, within } from '../facts';
import { bestSellers, inventoryHealth, leadStats, serviceDue, topCounts } from '../metrics';

export default function Overview({ d, h, facts, range, store, today }: ReportProps) {
  const events = useMemo(() => revenueEvents(d, h), [d, h]);
  const inRange = (from: string, to: string) => events.filter((e) => e.day >= from && e.day <= to && (store === 'all' || e.store === store));
  const cur = inRange(range.from, range.to);
  const revenue = sum(cur.map((e) => e.amount));
  const prevRevenue = range.prev ? sum(inRange(range.prev.from, range.prev.to).map((e) => e.amount)) : 0;

  const jobs = within(facts.jobs, range.from, range.to, store);
  const prevJobs = range.prev ? within(facts.jobs, range.prev.from, range.prev.to, store) : [];
  const done = jobs.filter((f) => f.type !== 'estimate');
  const installs = done.filter((f) => f.type === 'install');
  const fixes = done.filter((f) => (f.type === 'repair' || f.type === 'warranty') && !f.callback);
  const callbacks = done.filter((f) => f.callback).length;
  const paidService = done.filter((f) => (f.type === 'maintenance' || f.type === 'repair') && f.revenue > 0);
  const leads = leadStats(facts, range, store);

  // Revenue over time (+ the same dates last year)
  const buckets = timeBuckets(range.from, range.to);
  const byStore = { 'osage-beach': buckets.map(() => 0), nixa: buckets.map(() => 0) };
  for (const e of cur) {
    const i = bucketIndex(buckets, e.day);
    if (i >= 0) byStore[e.store][i] += e.amount;
  }
  const lastYear = range.prev
    ? buckets.map((b) => {
        const f = `${+b.from.slice(0, 4) - 1}${b.from.slice(4)}`;
        const t = `${+b.to.slice(0, 4) - 1}${b.to.slice(4)}`;
        return f >= h.from ? sum(inRange(f, t).map((e) => e.amount)) : null;
      })
    : undefined;

  const categories = ['Equipment', 'Installation', 'Service', 'Parts', 'Retail'].map((c) => ({ key: c, label: c, value: sum(cur.filter((e) => e.category === c).map((e) => e.amount)) }));

  // One headline per report for the library
  const top = bestSellers(d, facts, range, store, 'model').sort((a, b) => b.units - a.units)[0];
  const issue = topCounts(done.filter((f) => f.type === 'repair' || f.type === 'warranty'), 'issue')[0];
  const health = inventoryHealth(d, facts, range, store, today);
  const slow = health.filter((r) => r.health === 'slow');
  const due = serviceDue(d, today, store).filter((r) => r.days <= 30 && !r.scheduledFor);
  const headline: Record<string, string> = {
    technicians: `Installs average ${decimal(avg(installs.map((f) => f.hours)))} h · service visits ${decimal(avg(done.filter((f) => f.type !== 'install').map((f) => f.hours)))} h`,
    reliability: issue ? `Most common problem: ${issues[issue[0]]?.label.toLowerCase()} (${percent(issue[1] / Math.max(1, sum(topCounts(done, 'issue').map((x) => x[1]))))})` : 'No service calls in range',
    'best-sellers': top ? `Top seller: ${top.label} — ${plural(top.units, 'unit')}` : 'No appliance sales in range',
    leads: `${percent(leads.quoteWinRate)} of quote requests won · median first reply ${leads.medianResponse < 90 ? `${Math.round(leads.medianResponse)} min` : `${decimal(leads.medianResponse / 60)} h`}`,
    inventory: `${plural(slow.length, 'slow mover')} · ${money(sum(slow.map((r) => r.value)), false)} tied up`,
    'service-due': `${plural(due.length, 'appliance')} due for service in the next 30 days`,
  };

  return (
    <div class="report">
      <div class="stats">
        <Stat label="Revenue" icon="dollar" value={money(revenue, false)} delta={prevRevenue ? revenue / prevRevenue - 1 : undefined} deltaLabel="vs. last year" hint={range.prev ? undefined : 'No prior-year data for this range'} />
        <Stat label="Jobs completed" icon="clipboard" value={done.length.toLocaleString()} delta={prevJobs.length ? done.length / prevJobs.filter((f) => f.type !== 'estimate').length - 1 : undefined} deltaLabel="vs. last year" hint={`${plural(installs.length, 'install')}`} />
        <Stat label="Fixed on the first visit" icon="check-circle" value={fixes.length ? percent(1 - callbacks / fixes.length) : '—'} hint={`${plural(callbacks, 'return visit')}`} />
        <Stat label="Quote requests won" icon="inbox" value={percent(leads.quoteWinRate)} hint={`${leads.quotes} quote requests · ${leads.open} still open`} />
        <Stat label="Average service ticket" icon="receipt" value={paidService.length ? money(avg(paidService.map((f) => f.revenue)), false) : '—'} hint="Maintenance and repairs" />
      </div>

      <div class="grid-2 grid-2--wide">
        <ChartFrame
          title="Revenue over time"
          subtitle={`${range.days <= 120 ? 'Weekly' : 'Monthly'}${store === 'all' ? ', by showroom' : ` · ${storeName(store)}`}${lastYear ? ' — the line shows the same dates last year' : ''}`}
          legend={[...(store === 'all' ? [{ label: 'Osage Beach', color: 'var(--series-1)' }, { label: 'Nixa', color: 'var(--series-2)' }] : []), ...(lastYear ? [{ label: 'Last year', color: 'var(--series-muted)', kind: 'line' as const }] : [])]}
          table={{
            columns: ['Period', 'Osage Beach', 'Nixa', 'Total', ...(lastYear ? ['Last year'] : [])],
            rows: buckets.map((b, i) => [b.title, money(byStore['osage-beach'][i], false), money(byStore.nixa[i], false), money(byStore['osage-beach'][i] + byStore.nixa[i], false), ...(lastYear ? [lastYear[i] === null ? '—' : money(lastYear[i]!, false)] : [])]),
          }}
        >
          <BarChart
            ariaLabel="Revenue over time"
            categories={buckets.map((b) => b.label)}
            titles={buckets.map((b) => b.title)}
            series={
              store === 'all'
                ? [
                    { key: 'ob', label: 'Osage Beach', color: 'var(--series-1)', values: byStore['osage-beach'] },
                    { key: 'nx', label: 'Nixa', color: 'var(--series-2)', values: byStore.nixa },
                  ]
                : [{ key: store, label: storeName(store), color: 'var(--series-1)', values: byStore[store] }]
            }
            overlay={lastYear ? { label: 'Last year', color: 'var(--series-muted)', values: lastYear } : undefined}
            format={(n) => money(n, false)}
            axisFormat={compactMoney}
            height={270}
          />
        </ChartFrame>
        <ChartFrame title="Revenue by type" subtitle={range.label} table={{ columns: ['Type', 'Revenue', 'Share'], rows: categories.map((c) => [c.label, money(c.value, false), percent(c.value / Math.max(1, revenue))]) }}>
          <HBarChart ariaLabel="Revenue by type" rows={categories.filter((c) => c.value > 0).sort((a, b) => b.value - a.value).map((c) => ({ ...c, note: `· ${percent(c.value / Math.max(1, revenue))}` }))} format={(n) => money(n, false)} />
        </ChartFrame>
      </div>

      <h2 class="section-title">All reports</h2>
      <ul class="report-library" role="list">
        {reports
          .filter((r) => r.key !== 'overview')
          .map((r) => (
            <li key={r.key}>
              <button type="button" class="report-card" onClick={() => setParams({ report: r.key }, { scroll: true })}>
                <span class="report-card__icon">
                  <Icon name={r.icon} size={18} />
                </span>
                <span class="report-card__title">{r.label}</span>
                <span class="report-card__blurb">{r.blurb}</span>
                <span class="report-card__headline">{headline[r.key]}</span>
                <span class="report-card__go">
                  Open report <Icon name="arrow-right" size={14} />
                </span>
              </button>
            </li>
          ))}
      </ul>
    </div>
  );
}
