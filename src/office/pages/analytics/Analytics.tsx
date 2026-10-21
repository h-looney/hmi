/** Analytics: reports across both showrooms, filtered by date range and store. */
import type { FunctionComponent } from 'preact';
import { useMemo } from 'preact/hooks';
import type { DB, History, RangeKey, StoreFilter } from '../../data/types';
import { today as todayFn } from '../../lib/dates';
import { param, setParams } from '../../router';
import { db, history, markTried, setUI, ui } from '../../store';
import { Button, PageHeader, TabPanel, Tabs } from '../../ui/core';
import { Icon, type IconName } from '../../ui/Icon';
import { allFacts, rangeOptions, resolveRange, type Facts, type Range } from './facts';
import BestSellers from './reports/BestSellers';
import InventoryHealth from './reports/InventoryHealth';
import Leads from './reports/Leads';
import Overview from './reports/Overview';
import Reliability from './reports/Reliability';
import ServiceDue from './reports/ServiceDue';
import Technicians from './reports/Technicians';

export interface ReportProps {
  d: DB;
  h: History;
  facts: Facts;
  range: Range;
  store: StoreFilter;
  today: string;
}

export type ReportKey = 'overview' | 'technicians' | 'reliability' | 'best-sellers' | 'leads' | 'inventory' | 'service-due';

export const reports: { key: ReportKey; label: string; icon: IconName; blurb: string; usesRange: boolean }[] = [
  { key: 'overview', label: 'Overview', icon: 'dashboard', blurb: 'Revenue, jobs and conversion at a glance', usesRange: true },
  { key: 'technicians', label: 'Technicians', icon: 'hardhat', blurb: 'Install and service times, on-time arrival and return visits', usesRange: true },
  { key: 'reliability', label: 'Problem units', icon: 'alert', blurb: 'Service calls and warranty work by model, with repeat-visit appliances', usesRange: true },
  { key: 'best-sellers', label: 'Best sellers', icon: 'trend', blurb: 'Which appliances sell, by units, revenue and margin', usesRange: true },
  { key: 'leads', label: 'Leads & conversion', icon: 'inbox', blurb: 'Where requests come from, how fast we reply, and what we win', usesRange: true },
  { key: 'inventory', label: 'Inventory health', icon: 'box', blurb: 'Slow movers, low stock and days of supply', usesRange: true },
  { key: 'service-due', label: 'Maintenance due', icon: 'calendar', blurb: 'Customers due for annual service — send reminders in bulk', usesRange: false },
];

const components: Record<ReportKey, FunctionComponent<ReportProps>> = {
  overview: Overview,
  technicians: Technicians,
  reliability: Reliability,
  'best-sellers': BestSellers,
  leads: Leads,
  inventory: InventoryHealth,
  'service-due': ServiceDue,
};

export default function Analytics() {
  const d = db.value;
  const h = history.value;
  const today = todayFn();
  const key = (reports.some((r) => r.key === param('report')) ? param('report') : 'overview') as ReportKey;
  const meta = reports.find((r) => r.key === key)!;
  const { range: rangeKey, rangeFrom, rangeTo, store } = ui.value;
  const range = resolveRange(rangeKey, today, h.from, rangeFrom, rangeTo);
  const facts = useMemo(() => allFacts(d, h), [d, h]);
  const Report = components[key];

  const change = (patch: Parameters<typeof setUI>[0]) => {
    setUI(patch);
    markTried('analytics');
  };

  return (
    <div class="analytics">
      <PageHeader
        eyebrow="Reports"
        title="Analytics"
        description="Every report reads from the same jobs, sales and requests you work with each day — filter by date range and showroom."
        actions={
          <Button icon="printer" onClick={() => window.print()}>
            Print
          </Button>
        }
      />

      <div class="filters no-print" role="group" aria-label="Report filters">
        <label class="filters__field">
          <span class="filters__label">
            <Icon name="calendar" size={15} /> Date range
          </span>
          <select class="select" value={rangeKey} disabled={!meta.usesRange} onChange={(e) => change({ range: (e.target as HTMLSelectElement).value as RangeKey })}>
            {rangeOptions.map((o) => (
              <option key={o.key} value={o.key}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        {rangeKey === 'custom' && meta.usesRange && (
          <>
            <label class="filters__field">
              <span class="filters__label">From</span>
              <input class="input" type="date" min={h.from} max={today} value={range.from} onChange={(e) => change({ rangeFrom: (e.target as HTMLInputElement).value, rangeTo: range.to })} />
            </label>
            <label class="filters__field">
              <span class="filters__label">To</span>
              <input class="input" type="date" min={range.from} max={today} value={range.to} onChange={(e) => change({ rangeTo: (e.target as HTMLInputElement).value, rangeFrom: range.from })} />
            </label>
          </>
        )}
        <label class="filters__field">
          <span class="filters__label">
            <Icon name="store" size={15} /> Showroom
          </span>
          <select class="select" value={store} onChange={(e) => change({ store: (e.target as HTMLSelectElement).value as StoreFilter })}>
            <option value="all">Both showrooms</option>
            <option value="osage-beach">Osage Beach</option>
            <option value="nixa">Nixa</option>
          </select>
        </label>
        <p class="filters__note">
          {meta.usesRange ? (
            <>
              <strong>{range.label}</strong> · {range.days} days{range.prev ? ' · compared with the same dates last year' : ''}
            </>
          ) : (
            'This report looks ahead, so the date range doesn’t apply.'
          )}
        </p>
      </div>

      <Tabs items={reports.map((r) => ({ key: r.key, label: r.label, icon: r.icon }))} value={key} onChange={(k) => setParams({ report: k === 'overview' ? undefined : k })} label="Reports" idBase="report" />
      <TabPanel idBase="report" active={key}>
        <p class="report-blurb">{meta.blurb}</p>
        <Report d={d} h={h} facts={facts} range={range} store={store} today={today} />
      </TabPanel>
    </div>
  );
}
