/** Install and service times by technician, on-time arrival and return visits. */
import { useMemo, useState } from 'preact/hooks';
import { jobTypeLabels } from '../../../data/catalog';
import { decimal, money, percent, plural, shortDate } from '../../../lib/format';
import { storeName } from '../../../selectors';
import { ChartFrame, HBarChart, LineChart } from '../../../ui/charts';
import { Avatar, Badge, Button, Card, EmptyState, Segmented, Stat } from '../../../ui/core';
import { Dialog } from '../../../ui/Dialog';
import { Icon } from '../../../ui/Icon';
import { DataTable } from '../../../ui/Table';
import type { ReportProps } from '../Analytics';
import { avg, bucketIndex, downloadCSV, sum, timeBuckets, within } from '../facts';
import { techStats, type TechRow } from '../metrics';

const h1 = (n: number) => `${decimal(n)} h`;

export default function Technicians({ d, facts, range, store }: ReportProps) {
  const [type, setType] = useState<'all' | 'install' | 'service'>('all');
  const [open, setOpen] = useState<string | null>(null);
  const rows = useMemo(() => techStats(d, facts, range, store, type), [d, facts, range.from, range.to, store, type]);
  const jobs = within(facts.jobs, range.from, range.to, store);
  const installs = jobs.filter((f) => f.type === 'install');
  const service = jobs.filter((f) => f.type === 'maintenance' || f.type === 'repair' || f.type === 'warranty');
  const fixes = service.filter((f) => f.type !== 'maintenance' && !f.callback);
  const callbacks = service.filter((f) => f.callback).length;
  const visits = type === 'install' ? installs : type === 'service' ? service : [...installs, ...service];
  const prev = range.prev ? within(facts.jobs, range.prev.from, range.prev.to, store) : undefined;
  const prevInstallAvg = prev ? avg(prev.filter((f) => f.type === 'install').map((f) => f.hours)) : 0;
  const prevServiceAvg = prev ? avg(prev.filter((f) => f.type !== 'install' && f.type !== 'estimate' && f.type !== 'delivery').map((f) => f.hours)) : 0;
  const installAvg = avg(installs.map((f) => f.hours));
  const serviceAvg = avg(service.map((f) => f.hours));

  const installers = rows.filter((r) => r.installs > 0).sort((a, b) => a.installHours - b.installHours);
  const servicers = rows.filter((r) => r.service > 0).sort((a, b) => a.serviceHours - b.serviceHours);
  const installEst = avg(installs.map((f) => f.estHours));
  const serviceEst = avg(service.map((f) => f.estHours));

  const ratio = (r: TechRow) => {
    const actual = r.installs * r.installHours + r.service * r.serviceHours;
    const est = r.installs * r.installEst + r.service * r.serviceEst;
    return est ? actual / est - 1 : 0;
  };
  const cbRate = (r: TechRow) => (r.fixes ? r.callbacks / r.fixes : 0);

  // Plain-language observations, computed from the numbers above
  const insights: string[] = [];
  if (servicers.length > 1) {
    const fastest = servicers[0];
    insights.push(`${fastest.name.split(' ')[0]} has the quickest service visits at ${h1(fastest.serviceHours)} on average (${plural(fastest.service, 'visit')}).`);
    const mostCb = [...servicers].filter((r) => r.fixes >= 12).sort((a, b) => cbRate(b) - cbRate(a))[0];
    if (mostCb && cbRate(mostCb) > 0.04) insights.push(`${mostCb.name.split(' ')[0]} has the most return visits — ${percent(cbRate(mostCb))} of repairs needed a second trip.${mostCb.id === fastest.id ? ' Speed may be costing a few callbacks.' : ''}`);
  }
  const onTimeBest = [...rows].filter((r) => r.visits >= 30).sort((a, b) => b.onTime / b.visits - a.onTime / a.visits)[0];
  if (onTimeBest) insights.push(`${onTimeBest.name.split(' ')[0]} arrives on time most often (${percent(onTimeBest.onTime / onTimeBest.visits)}).`);
  if (installs.length && installEst) {
    const diff = installAvg / installEst - 1;
    insights.push(`Installs averaged ${h1(installAvg)} against a ${h1(installEst)} estimate — ${Math.abs(diff) < 0.02 ? 'right on target' : `${percent(Math.abs(diff))} ${diff < 0 ? 'faster' : 'slower'} than planned`}.`);
  }

  const detail = open ? rows.find((r) => r.id === open) : undefined;

  return (
    <div class="report">
      <div class="toolbar">
        <Segmented
          label="Job type"
          value={type}
          onChange={setType}
          items={[
            { key: 'all', label: 'All work' },
            { key: 'install', label: 'Installs' },
            { key: 'service', label: 'Service' },
          ]}
        />
        <span class="toolbar__spacer" />
        <Button
          size="sm"
          icon="download"
          onClick={() =>
            downloadCSV(`technicians-${range.from}-to-${range.to}.csv`, [
              ['Technician', 'Store', 'Jobs', 'Installs', 'Avg install hours', 'Service visits', 'Avg service hours', 'Vs estimate', 'On-time %', 'Return visits %', 'Revenue (lead)'],
              ...rows.map((r) => [r.name, storeName(r.store), r.visits, r.installs, +r.installHours.toFixed(2), r.service, +r.serviceHours.toFixed(2), +(ratio(r) * 100).toFixed(1), +((r.onTime / r.visits) * 100).toFixed(1), +(cbRate(r) * 100).toFixed(1), Math.round(r.revenue)]),
            ])
          }
        >
          Export CSV
        </Button>
      </div>

      <div class="stats">
        <Stat label="Average install" icon="hardhat" value={installs.length ? h1(installAvg) : '—'} delta={prevInstallAvg && installs.length ? installAvg / prevInstallAvg - 1 : undefined} deltaGood="down" deltaLabel="vs. last year" hint={`${plural(installs.length, 'install')} · estimate ${h1(installEst)}`} />
        <Stat label="Average service visit" icon="wrench" value={service.length ? h1(serviceAvg) : '—'} delta={prevServiceAvg && service.length ? serviceAvg / prevServiceAvg - 1 : undefined} deltaGood="down" deltaLabel="vs. last year" hint={`${plural(service.length, 'visit')} · estimate ${h1(serviceEst)}`} />
        <Stat label="On-time arrival" icon="clock" value={visits.length ? percent(visits.filter((f) => f.onTime).length / visits.length) : '—'} hint="Within 15 minutes of the window" />
        <Stat label="Fixed on the first visit" icon="check-circle" value={fixes.length ? percent(1 - callbacks / fixes.length) : '—'} hint={`${plural(callbacks, 'return visit')} for ${plural(fixes.length, 'repair')}`} />
      </div>

      {insights.length > 0 && (
        <div class="callout callout--blue insights">
          <Icon name="sparkle" size={18} />
          <div>
            <p class="callout__title">What stands out</p>
            <ul role="list">
              {insights.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      <div class="grid-2">
        {type !== 'service' && (
          <ChartFrame
            title="Average install time by installer"
            subtitle="Hours on site per install (crews share the time). The line marks the average estimate."
            table={{ columns: ['Installer', 'Installs', 'Average hours', 'Average estimate'], rows: installers.map((r) => [r.name, r.installs, decimal(r.installHours), decimal(r.installEst)]) }}
          >
            {installers.length ? (
              <HBarChart ariaLabel="Average install hours by installer" rows={installers.map((r) => ({ key: r.id, label: r.name, sub: `${r.title} · ${storeName(r.store)}`, value: r.installHours, note: `· ${plural(r.installs, 'job')}` }))} format={h1} reference={installEst ? { value: installEst, label: `Estimate ${h1(installEst)}` } : undefined} onSelect={setOpen} />
            ) : (
              <EmptyState icon="hardhat" title="No installs in this range" />
            )}
          </ChartFrame>
        )}
        {type !== 'install' && (
          <ChartFrame
            title="Average service visit by technician"
            subtitle="Maintenance, repair and warranty visits. The line marks the average estimate."
            table={{ columns: ['Technician', 'Visits', 'Average hours', 'Average estimate'], rows: servicers.map((r) => [r.name, r.service, decimal(r.serviceHours), decimal(r.serviceEst)]) }}
          >
            {servicers.length ? (
              <HBarChart ariaLabel="Average service visit hours by technician" rows={servicers.map((r) => ({ key: r.id, label: r.name, sub: `${r.title} · ${storeName(r.store)}`, value: r.serviceHours, note: `· ${plural(r.service, 'visit')}` }))} format={h1} color="var(--series-2)" reference={serviceEst ? { value: serviceEst, label: `Estimate ${h1(serviceEst)}` } : undefined} onSelect={setOpen} />
            ) : (
              <EmptyState icon="wrench" title="No service visits in this range" />
            )}
          </ChartFrame>
        )}
      </div>

      <Card title="Technician scorecard" subtitle="Select a technician for their trend and recent jobs" flush>
        <DataTable
          caption="Technician scorecard"
          rows={rows}
          rowKey={(r) => r.id}
          onRowClick={(r) => setOpen(r.id)}
          initialSort={{ key: 'visits', dir: 'desc' }}
          empty={<EmptyState icon="users" title="No technician work in this range" />}
          columns={[
            {
              key: 'name',
              label: 'Technician',
              sortValue: (r) => r.name,
              render: (r) => (
                <button type="button" class="tech-cell" onClick={() => setOpen(r.id)}>
                  <Avatar person={d.staff.find((s) => s.id === r.id)} size={30} />
                  <span>
                    <span class="cell-main">{r.name}</span>
                    <span class="cell-sub">
                      {r.title} · {storeName(r.store)}
                    </span>
                  </span>
                </button>
              ),
            },
            { key: 'visits', label: 'Jobs', align: 'right', sortValue: (r) => r.visits, render: (r) => r.visits },
            { key: 'install', label: 'Install avg', align: 'right', sortValue: (r) => r.installHours, render: (r) => (r.installs ? `${h1(r.installHours)} · ${r.installs}` : '—'), hide: 'sm' },
            { key: 'service', label: 'Service avg', align: 'right', sortValue: (r) => r.serviceHours, render: (r) => (r.service ? `${h1(r.serviceHours)} · ${r.service}` : '—') },
            {
              key: 'ratio',
              label: 'Vs. estimate',
              align: 'right',
              sortValue: ratio,
              render: (r) => {
                const v = ratio(r);
                return <span class={v > 0.08 ? 'is-bad' : v < -0.03 ? 'is-good' : undefined}>{`${v > 0 ? '+' : v < 0 ? '−' : '±'}${Math.abs(v * 100).toFixed(0)}%`}</span>;
              },
              hide: 'md',
            },
            { key: 'onTime', label: 'On time', align: 'right', sortValue: (r) => r.onTime / r.visits, render: (r) => percent(r.onTime / r.visits) },
            {
              key: 'cb',
              label: 'Return visits',
              align: 'right',
              sortValue: cbRate,
              render: (r) =>
                r.fixes ? (
                  <span class="nowrap">
                    {percent(cbRate(r))}
                    {cbRate(r) >= 0.08 && (
                      <Badge tone="amber" icon="alert" class="ml-6">
                        High
                      </Badge>
                    )}
                  </span>
                ) : (
                  '—'
                ),
            },
            { key: 'revenue', label: 'Revenue (lead)', align: 'right', sortValue: (r) => r.revenue, render: (r) => money(r.revenue, false), hide: 'md' },
          ]}
        />
      </Card>
      <p class="report-note">
        <Icon name="info" size={14} /> Times come from arrival and finish stamps on each job (technicians confirm them when they close out on their phone). Return visits count repairs that needed a second trip within 30 days. Technician names are placeholders.
      </p>

      {detail && <TechDetail row={detail} props={{ d, facts, range, store }} onClose={() => setOpen(null)} />}
    </div>
  );
}

function TechDetail({ row, props, onClose }: { row: TechRow; props: Pick<ReportProps, 'd' | 'facts' | 'range' | 'store'>; onClose: () => void }) {
  const { d, facts, range } = props;
  const person = d.staff.find((s) => s.id === row.id);
  const mine = within(facts.jobs, range.from, range.to, 'all').filter((f) => f.crew.includes(row.id) && f.type !== 'estimate');
  const buckets = timeBuckets(range.from, range.to);
  const svc = buckets.map(() => [] as number[]);
  const ins = buckets.map(() => [] as number[]);
  for (const f of mine) {
    const i = bucketIndex(buckets, f.day);
    if (i < 0) continue;
    (f.type === 'install' ? ins : svc)[i].push(f.hours);
  }
  const types = (['install', 'maintenance', 'repair', 'warranty'] as const)
    .map((t) => {
      const l = mine.filter((f) => f.type === t);
      return { type: t, count: l.length, hours: avg(l.map((f) => f.hours)), est: avg(l.map((f) => f.estHours)) };
    })
    .filter((x) => x.count);
  const recent = [...mine].sort((a, b) => (a.day < b.day ? 1 : -1)).slice(0, 12);
  return (
    <Dialog title={row.name} description={`${row.title} · ${storeName(row.store)} · ${range.label}`} onClose={onClose} drawer size="lg" headerExtra={<Avatar person={person} size={40} />}>
      <div class="stats stats--compact">
        <Stat label="Jobs" value={row.visits} />
        <Stat label="On time" value={percent(row.onTime / row.visits)} />
        <Stat label="Return visits" value={row.fixes ? percent(row.callbacks / row.fixes) : '—'} hint={`${row.callbacks} of ${row.fixes} repairs`} />
        <Stat label="Revenue as lead" value={money(row.revenue, false)} />
      </div>
      {row.service > 0 && (
        <ChartFrame title="Average service visit over time" level={3} table={{ columns: ['Period', 'Visits', 'Average hours'], rows: buckets.map((b, i) => [b.title, svc[i].length, svc[i].length ? decimal(avg(svc[i])) : '—']) }}>
          <LineChart ariaLabel={`${row.name} average service visit hours over time`} categories={buckets.map((b) => b.label)} titles={buckets.map((b) => b.title)} series={[{ key: 'svc', label: 'Average service visit', color: 'var(--series-2)', values: svc.map((v) => (v.length ? avg(v) : null)), area: true }]} format={h1} height={180} />
        </ChartFrame>
      )}
      {row.installs > 0 && (
        <ChartFrame title="Average install over time" level={3} table={{ columns: ['Period', 'Installs', 'Average hours'], rows: buckets.map((b, i) => [b.title, ins[i].length, ins[i].length ? decimal(avg(ins[i])) : '—']) }}>
          <LineChart ariaLabel={`${row.name} average install hours over time`} categories={buckets.map((b) => b.label)} titles={buckets.map((b) => b.title)} series={[{ key: 'ins', label: 'Average install', color: 'var(--series-1)', values: ins.map((v) => (v.length ? avg(v) : null)), area: true }]} format={h1} height={180} />
        </ChartFrame>
      )}
      <h3 class="section-label">By job type</h3>
      <div class="table-wrap">
        <table class="table table--dense">
          <caption class="sr-only">Jobs by type</caption>
          <thead>
            <tr>
              <th scope="col">Type</th>
              <th scope="col" class="is-right">
                Jobs
              </th>
              <th scope="col" class="is-right">
                Average
              </th>
              <th scope="col" class="is-right">
                Estimate
              </th>
            </tr>
          </thead>
          <tbody>
            {types.map((t) => (
              <tr key={t.type}>
                <th scope="row">{jobTypeLabels[t.type]}</th>
                <td class="is-right">{t.count}</td>
                <td class="is-right">{h1(t.hours)}</td>
                <td class="is-right">{h1(t.est)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <h3 class="section-label">Recent jobs</h3>
      <ul class="recent-jobs" role="list">
        {recent.map((f) => {
          const c = f.customerId ? d.customers.find((x) => x.id === f.customerId) : undefined;
          return (
            <li key={f.id}>
              <span class="recent-jobs__date">{shortDate(f.day)}</span>
              <span class="recent-jobs__main">
                {jobTypeLabels[f.type]}
                {c ? ` · ${c.name}` : ''}
                {f.callback && (
                  <Badge tone="amber" icon="undo" class="ml-6">
                    Return visit
                  </Badge>
                )}
              </span>
              <span class={`recent-jobs__hours ${f.hours > f.estHours * 1.15 ? 'is-bad' : ''}`}>
                {h1(f.hours)} <span class="muted">/ {h1(f.estHours)}</span>
              </span>
            </li>
          );
        })}
      </ul>
      <p class="muted small" style={{ marginTop: '12px' }}>
        Showing the latest {recent.length} of {mine.length} jobs · total {decimal(sum(mine.map((f) => f.hours)))} hours on site
      </p>
    </Dialog>
  );
}
