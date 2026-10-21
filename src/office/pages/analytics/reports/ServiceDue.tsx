/** Maintenance due: appliances coming up on (or past) their annual service — remind or book in bulk. */
import { useMemo, useState } from 'preact/hooks';
import { sendServiceReminders } from '../../../actions';
import { openDialog } from '../../../dialogs';
import { fromToday, money, plural, shortDate } from '../../../lib/format';
import { unitLabel } from '../../../selectors';
import { toast } from '../../../toast';
import { Badge, Button, Card, Chips, EmptyState, Link, Stat } from '../../../ui/core';
import { DataTable } from '../../../ui/Table';
import type { ReportProps } from '../Analytics';
import { downloadCSV, sum } from '../facts';
import { serviceDue } from '../metrics';

type Filter = 'overdue' | '30' | '60' | 'plan' | 'all';

const overdue = (days: number) => (days < 60 ? `${days} days overdue` : days < 730 ? `${Math.round(days / 30.4)} months overdue` : `${Math.floor(days / 365)}+ years overdue`);

export default function ServiceDue({ d, store, today }: ReportProps) {
  const [filter, setFilter] = useState<Filter>('30');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const all = useMemo(() => serviceDue(d, today, store), [d, today, store]);
  const open = all.filter((r) => !r.scheduledFor);
  const groups: Record<Filter, typeof all> = {
    overdue: open.filter((r) => r.days < 0),
    '30': open.filter((r) => r.days <= 30),
    '60': open.filter((r) => r.days <= 60),
    plan: open.filter((r) => r.customer.servicePlan && r.days <= 60),
    all: open.filter((r) => r.days <= 120),
  };
  const shown = groups[filter];
  const scheduledSoon = all.filter((r) => r.scheduledFor).length;

  const remind = (ids: string[]) => {
    sendServiceReminders(ids);
    setSelected(new Set());
    toast(`${plural(ids.length, 'reminder')} sent — emails and texts are simulated in this demo`, { tone: 'success' });
  };

  return (
    <div class="report">
      <div class="stats">
        <Stat label="Due in the next 30 days" icon="calendar" value={groups['30'].length} hint={`${groups.overdue.length} already past due`} />
        <Stat label="Service plan members due" icon="star" value={groups.plan.length} hint="Next 60 days" />
        <Stat label="Already booked" icon="check-circle" value={scheduledSoon} hint="Maintenance on the schedule" />
        <Stat label="Potential revenue" icon="dollar" value={money(sum(groups['60'].map((r) => r.price)), false)} hint="Annual service, next 60 days" />
      </div>

      <div class="toolbar">
        <Chips
          label="Due"
          value={filter}
          onChange={(k) => {
            setFilter(k);
            setSelected(new Set());
          }}
          items={[
            { key: 'overdue', label: 'Past due', count: groups.overdue.length },
            { key: '30', label: 'Next 30 days', count: groups['30'].length },
            { key: '60', label: 'Next 60 days', count: groups['60'].length },
            { key: 'plan', label: 'Service plan', count: groups.plan.length },
          ]}
        />
        <span class="toolbar__spacer" />
        <Button size="sm" icon="download" onClick={() => downloadCSV(`maintenance-due-${today}.csv`, [['Customer', 'Phone', 'Email', 'Appliance', 'Last service', 'Due', 'Reminder sent'], ...shown.map((r) => [r.customer.name, r.customer.phone, r.customer.email, unitLabel(r.unit), r.unit.lastServiceOn ?? '', r.due, r.remindedAt?.slice(0, 10) ?? ''])])}>
          Export CSV
        </Button>
        <Button size="sm" variant="primary" icon="send" disabled={!selected.size} onClick={() => remind([...selected])}>
          {selected.size ? `Send ${plural(selected.size, 'reminder')}` : 'Send reminders'}
        </Button>
      </div>

      <Card title="Appliances due for annual service" subtitle="Twelve months after the last visit (or the install). Booked appliances are left out." flush>
        <DataTable
          caption="Appliances due for service"
          rows={shown}
          rowKey={(r) => r.unit.id}
          selected={selected}
          onSelect={setSelected}
          initialSort={{ key: 'due', dir: 'asc' }}
          empty={<EmptyState icon="check-circle" title="Nobody in this group">Every appliance here is either booked or not due yet.</EmptyState>}
          columns={[
            {
              key: 'customer',
              label: 'Customer',
              sortValue: (r) => r.customer.name,
              render: (r) => (
                <span>
                  <Link class="cell-main" to={`/office/customers/?id=${r.customer.id}&tab=equipment`}>
                    {r.customer.name}
                  </Link>
                  <span class="cell-sub">
                    {r.customer.address.city}
                    {r.customer.servicePlan ? ' · Service plan' : ''}
                  </span>
                </span>
              ),
            },
            { key: 'unit', label: 'Appliance', sortValue: (r) => unitLabel(r.unit), render: (r) => <span>{unitLabel(r.unit)}<span class="cell-sub">{r.unit.fuel}</span></span>, hide: 'sm' },
            { key: 'last', label: 'Last service', sortValue: (r) => r.unit.lastServiceOn ?? r.unit.installedOn, render: (r) => (r.unit.lastServiceOn ? shortDate(r.unit.lastServiceOn) : <span class="muted">Never</span>), hide: 'md' },
            {
              key: 'due',
              label: 'Due',
              sortValue: (r) => r.due,
              render: (r) =>
                r.days < 0 ? (
                  <Badge tone="red" icon="alert">
                    {overdue(-r.days)}
                  </Badge>
                ) : (
                  <span>
                    {shortDate(r.due)}
                    <span class="cell-sub">{fromToday(r.due)}</span>
                  </span>
                ),
            },
            { key: 'pref', label: 'Prefers', sortValue: (r) => r.customer.contactPref, render: (r) => ({ phone: 'Phone', email: 'Email', text: 'Text' })[r.customer.contactPref], hide: 'md' },
            { key: 'reminded', label: 'Reminder', sortValue: (r) => r.remindedAt ?? '', render: (r) => (r.remindedAt ? <Badge tone="green" icon="check">{`Sent ${shortDate(r.remindedAt)}`}</Badge> : <span class="muted">Not sent</span>) },
            {
              key: 'act',
              label: <span class="sr-only">Actions</span>,
              align: 'right',
              render: (r) => (
                <Button size="sm" variant="ghost" icon="calendar-plus" aria-label={`Book service for ${r.customer.name}`} onClick={() => openDialog({ kind: 'job', preset: { type: 'maintenance', customerId: r.customer.id, unitId: r.unit.id, store: r.customer.store } })}>
                  <span class="hide-sm">Book</span>
                </Button>
              ),
            },
          ]}
        />
      </Card>
      <p class="report-note">Reminders go out by each customer’s preferred channel. In this demo they’re logged but not sent.</p>
    </div>
  );
}
