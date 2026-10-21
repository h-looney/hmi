/** Dashboard: today at a glance for owners, managers and the office. */
import { useMemo } from 'preact/hooks';
import { addDays, addMonths, diffDays, now, startOfMonth, startOfWeek, today } from '../../lib/dates';
import { compactMoney, longDate, money, monthLong, monthShort, plural, relative, time } from '../../lib/format';
import { sectionPath } from '../../router';
import {
  arAging,
  customerOf,
  invoiceStatus,
  invoiceTotals,
  jobsOn,
  lowStock,
  matchStore,
  monthlyRevenue,
  revenueBetween,
  revenueEvents,
  staffOf,
  storeName,
  warrantyState,
} from '../../selectors';
import { can, db, history, me, setUI, ui } from '../../store';
import { actionableSuggestions, failingLinks, movedLinks } from '../website/data';
import { BarChart, ChartFrame, Sparkline } from '../../ui/charts';
import { AvatarStack, Badge, Card, EmptyState, Link, LinkButton, Meter, PageHeader, Stat } from '../../ui/core';
import { Icon, type IconName } from '../../ui/Icon';
import { jobStatusMeta, jobTypeMeta, leadKindMeta, StatusBadge } from '../../ui/status';

const PUBLIC_CONTACT = `${import.meta.env.BASE_URL.replace(/\/$/, '')}/contact/`;

const tryItems: { key: string; label: string; to?: string; href?: string }[] = [
  { key: 'web-request', label: 'Send a quote or service request from the public website — watch it land in the Inbox', href: PUBLIC_CONTACT },
  { key: 'schedule', label: 'Schedule a job on the dispatch board (drag it to a technician and day)', to: '/office/jobs/?view=schedule' },
  { key: 'complete', label: 'Sign in as Luis and finish a job from the phone-friendly day view', to: '/office/my-day/' },
  { key: 'payment', label: 'Record a payment on an open invoice', to: '/office/accounting/?tab=invoices' },
  { key: 'stock', label: 'Transfer stock between showrooms or receive a purchase order', to: '/office/inventory/' },
  { key: 'quickbooks', label: 'Connect QuickBooks (simulated) — or keep the books in-house', to: '/office/accounting/?tab=integrations' },
  { key: 'analytics', label: 'Filter the technician and best-seller reports by store and date', to: '/office/analytics/' },
];

function Welcome() {
  const done = tryItems.filter((t) => ui.value.tried.includes(t.key)).length;
  return (
    <section class="welcome card" aria-labelledby="welcome-title">
      <div class="welcome__intro">
        <p class="welcome__kicker">
          <Icon name="sparkle" size={16} /> Concept demo
        </p>
        <h2 id="welcome-title" class="welcome__title">
          Welcome to HMI mode
        </h2>
        <p class="welcome__text">
          This is the business side of the new HMI website — one place for requests, scheduling, customers, warranty, stock at both showrooms, and the books. The data is sample data, and anything you change is saved only in this browser.
        </p>
        <div class="welcome__progress">
          <Meter value={done} max={tryItems.length} label="Things tried" tone="green" />
          <span class="muted small">
            {done} of {tryItems.length} tried
          </span>
        </div>
      </div>
      <div class="welcome__list">
        <h3 class="section-label">Things to try</h3>
        <ul role="list">
          {tryItems.map((t) => {
            const isDone = ui.value.tried.includes(t.key);
            const content = (
              <>
                <span class={`welcome__check${isDone ? ' is-done' : ''}`} aria-hidden="true">
                  {isDone && <Icon name="check" size={12} stroke={3} />}
                </span>
                <span>{t.label}</span>
                <span class="sr-only">{isDone ? '(done)' : ''}</span>
              </>
            );
            return (
              <li key={t.key}>
                {t.href ? (
                  <a class="welcome__item" href={t.href}>
                    {content}
                  </a>
                ) : (
                  <Link class="welcome__item" to={t.to!}>
                    {content}
                  </Link>
                )}
              </li>
            );
          })}
        </ul>
      </div>
      <button type="button" class="btn btn--ghost btn--sm btn--icon welcome__close" aria-label="Hide the welcome guide" onClick={() => setUI({ welcomeDismissed: true })}>
        <Icon name="close" size={16} />
      </button>
    </section>
  );
}

interface Attention {
  icon: IconName;
  tone: 'red' | 'amber' | 'blue' | 'violet' | 'ember';
  label: string;
  detail?: string;
  to: string;
}

export default function Dashboard() {
  const d = db.value;
  const h = history.value;
  const store = ui.value.store;
  const t = today();
  const user = me.value!;

  const events = useMemo(() => revenueEvents(d, h), [d, h]);
  const monthStart = startOfMonth(t);
  // A rolling 30 days compares fairly on any date (month-to-date swings early in a month)
  const from30 = addDays(t, -29);
  const rev30 = revenueBetween(events, from30, t, store);
  const rev30LastYear = revenueBetween(events, addMonths(from30, -12), addMonths(t, -12), store);
  const months = useMemo(() => monthlyRevenue(events, t, 12), [events, t]);
  const monthTotals = months.map((m) => (store === 'all' ? m['osage-beach'] + m.nixa : m[store]));

  const todays = jobsOn(d, t, store);
  const inProgress = todays.filter((j) => j.status === 'in-progress').length;
  const finished = todays.filter((j) => j.status === 'completed' || j.status === 'closed').length;

  const leads = d.leads.filter((l) => matchStore(store, l.store));
  const newLeads = leads.filter((l) => l.stage === 'new');
  const weekLeads = leads.filter((l) => l.receivedAt.slice(0, 10) >= startOfWeek(t)).length;
  const recentLeads = leads.filter((l) => l.stage === 'new' || l.stage === 'contacted').slice(0, 5);

  const aging = arAging(d, store);
  const receivable = aging.reduce((s, b) => s + b.amount, 0);
  const overdue = aging.slice(1).reduce((s, b) => s + b.amount, 0);

  const attention: Attention[] = [];
  const overdueInv = d.invoices.filter((i) => i.kind === 'invoice' && matchStore(store, i.store) && invoiceStatus(i) === 'overdue');
  if (overdueInv.length) attention.push({ icon: 'alert', tone: 'red', label: `${plural(overdueInv.length, 'invoice')} overdue`, detail: money(overdueInv.reduce((s, i) => s + invoiceTotals(i).balance, 0), false), to: '/office/accounting/?tab=invoices&filter=overdue' });
  const needsScheduling = d.jobs.filter((j) => j.status === 'requested' && matchStore(store, j.store)).length;
  if (needsScheduling) attention.push({ icon: 'calendar-plus', tone: 'amber', label: `${plural(needsScheduling, 'job')} waiting to be scheduled`, to: '/office/jobs/?view=schedule' });
  const onHold = d.jobs.filter((j) => j.status === 'on-hold' && matchStore(store, j.store));
  if (onHold.length) attention.push({ icon: 'clock', tone: 'amber', label: `${plural(onHold.length, 'job')} on hold`, detail: onHold[0].holdReason?.split(' — ')[0].replace(/\.$/, ''), to: '/office/jobs/?view=list&status=on-hold' });
  const toInvoice = d.jobs.filter((j) => j.status === 'completed' && matchStore(store, j.store)).length;
  if (toInvoice) attention.push({ icon: 'receipt', tone: 'blue', label: `${plural(toInvoice, 'finished job')} ready to invoice`, to: '/office/jobs/?view=list&status=completed' });
  const low = lowStock(d, store);
  if (low.length) attention.push({ icon: 'box', tone: 'amber', label: `${plural(low.length, 'item')} low on stock`, detail: low.slice(0, 2).map((i) => i.name.split(',')[0]).join(', '), to: '/office/inventory/?filter=low' });
  const unregistered = d.units.filter((u) => u.installedBy === 'HMI' && !u.warranty.registered && warrantyState(u) !== 'expired' && matchStore(store, customerOf(d, u.customerId)?.store ?? 'osage-beach')).length;
  if (unregistered) attention.push({ icon: 'shield', tone: 'violet', label: `${plural(unregistered, 'install')} not registered for warranty`, to: '/office/warranty/?filter=unregistered' });
  const staleEstimates = d.invoices.filter((i) => i.kind === 'estimate' && invoiceStatus(i) === 'sent' && diffDays(t, i.issuedOn) >= 3 && matchStore(store, i.store)).length;
  if (staleEstimates) attention.push({ icon: 'file', tone: 'ember', label: `${plural(staleEstimates, 'estimate')} waiting on a reply for 3+ days`, to: '/office/accounting/?tab=estimates' });
  if (can('website')) {
    const failing = failingLinks.value;
    if (failing.length) attention.push({ icon: 'link', tone: 'red', label: `${plural(failing.length, 'manufacturer link')} failing — fallback in effect`, detail: failing.slice(0, 2).map((l) => l.label).join(', '), to: '/office/website/?tab=health' });
    const moved = movedLinks.value.length;
    if (moved) attention.push({ icon: 'link', tone: 'blue', label: `${plural(moved, 'stored URL')} to update`, detail: 'The right page, at a new address', to: '/office/website/?tab=health' });
    const suggestions = actionableSuggestions.value.length;
    if (suggestions) attention.push({ icon: 'sparkle', tone: 'violet', label: `${plural(suggestions, 'sitemap suggestion')} to review`, detail: 'New and possibly discontinued models', to: '/office/website/?tab=suggestions' });
  }

  const hour = +now().slice(11, 13);
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const currentKey = months[months.length - 1].key;

  return (
    <div class="dashboard">
      <PageHeader
        eyebrow={`${longDate(t)} · ${store === 'all' ? 'Both showrooms' : storeName(store)}`}
        title={`${greeting}, ${user.name.split(' ')[0]}`}
        description={`${plural(newLeads.length, 'new request')} · ${plural(todays.length, 'job')} on today’s schedule · ${money(overdue, false)} overdue`}
      />

      {!ui.value.welcomeDismissed && <Welcome />}

      <div class="stats">
        <Stat
          label="Revenue, last 30 days"
          icon="dollar"
          value={money(rev30, false)}
          delta={rev30LastYear ? rev30 / rev30LastYear - 1 : undefined}
          deltaLabel="vs. same days last year"
          to="/office/analytics/"
          spark={<Sparkline values={monthTotals} label={`Monthly revenue, last 12 months, ending ${compactMoney(monthTotals[monthTotals.length - 1])} this month`} />}
        />
        <Stat label="Jobs today" icon="clipboard" value={todays.length} hint={`${inProgress} in progress · ${finished} done`} to="/office/jobs/?view=schedule" />
        <Stat label="New requests" icon="inbox" value={newLeads.length} hint={`${weekLeads} received this week`} to="/office/inbox/" />
        <Stat label="Receivables" icon="receipt" value={money(receivable, false)} hint={<span class={overdue ? 'is-bad' : undefined}>{money(overdue, false)} overdue</span>} to="/office/accounting/?tab=invoices" />
      </div>

      <div class="dash-grid">
        <div class="dash-main">
          <Card
            title="Today’s schedule"
            subtitle={todays.length ? `${todays.length} jobs · ${new Set(todays.flatMap((j) => j.crew)).size} people in the field` : undefined}
            actions={
              <Link class="card-link" to="/office/jobs/?view=schedule">
                Open schedule <Icon name="arrow-right" size={14} />
              </Link>
            }
            flush
          >
            {todays.length === 0 ? (
              <EmptyState icon="calendar" title="Nothing on the schedule today" />
            ) : (
              <ul class="agenda" role="list">
                {todays.map((j) => {
                  const c = customerOf(d, j.customerId);
                  const type = jobTypeMeta[j.type];
                  return (
                    <li key={j.id}>
                      <Link to={`/office/jobs/?id=${j.id}`} class="agenda__row">
                        <span class="agenda__time">
                          {time(j.start!)}
                          <span class="agenda__dur">{j.hours} h</span>
                        </span>
                        <span class={`agenda__bar agenda__bar--${type.tone}`} aria-hidden="true" />
                        <span class="agenda__main">
                          <span class="agenda__title">{j.title}</span>
                          <span class="agenda__meta">
                            <Icon name={type.icon} size={13} /> {type.label}
                            <span class="dot-sep" />
                            {c?.name}, {c?.address.city}
                          </span>
                        </span>
                        <AvatarStack people={j.crew.map((id) => staffOf(d, id)!).filter(Boolean)} size={26} />
                        <span class="agenda__status">
                          <StatusBadge meta={jobStatusMeta[j.status]} />
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>

          <ChartFrame
            title="Revenue by month"
            subtitle={`Last 12 months${store === 'all' ? ', by showroom' : ` · ${storeName(store)}`} — work is counted when it’s completed`}
            legend={
              store === 'all'
                ? [
                    { label: 'Osage Beach', color: 'var(--series-1)' },
                    { label: 'Nixa', color: 'var(--series-2)' },
                  ]
                : undefined
            }
            table={{
              columns: ['Month', ...(store === 'all' ? ['Osage Beach', 'Nixa', 'Total'] : [storeName(store)])],
              rows: months.map((m) => [monthLong(m.key), ...(store === 'all' ? [money(m['osage-beach'], false), money(m.nixa, false), money(m['osage-beach'] + m.nixa, false)] : [money(m[store], false)])]),
            }}
          >
            <BarChart
              ariaLabel="Revenue by month for the last 12 months"
              categories={months.map((m) => monthShort(m.key))}
              titles={months.map((m) => (m.key === currentKey ? `${monthLong(m.key)} (to date)` : monthLong(m.key)))}
              series={
                store === 'all'
                  ? [
                      { key: 'ob', label: 'Osage Beach', color: 'var(--series-1)', values: months.map((m) => m['osage-beach']) },
                      { key: 'nx', label: 'Nixa', color: 'var(--series-2)', values: months.map((m) => m.nixa) },
                    ]
                  : [{ key: store, label: storeName(store), color: 'var(--series-1)', values: months.map((m) => m[store]) }]
              }
              format={(n) => money(n, false)}
              axisFormat={compactMoney}
              labelIndex={months.length - 1}
              height={250}
            />
          </ChartFrame>
        </div>

        <div class="dash-side">
          <Card
            title="New requests"
            subtitle={newLeads.length ? `${newLeads.length} waiting for a first reply` : 'All caught up'}
            actions={
              <Link class="card-link" to="/office/inbox/">
                Inbox <Icon name="arrow-right" size={14} />
              </Link>
            }
            flush
          >
            {recentLeads.length === 0 ? (
              <EmptyState icon="inbox" title="No open requests" />
            ) : (
              <ul class="mini-list" role="list">
                {recentLeads.map((l) => (
                  <li key={l.id}>
                    <Link to={`/office/inbox/?id=${l.id}`} class="mini-list__row">
                      <span class={`mini-list__icon mini-list__icon--${leadKindMeta[l.kind].tone}`}>
                        <Icon name={leadKindMeta[l.kind].icon} size={15} />
                      </span>
                      <span class="mini-list__main">
                        <span class="mini-list__title">
                          {l.unread && <span class="unread-dot" aria-label="Unread" />}
                          {l.name}
                        </span>
                        <span class="mini-list__sub">{l.summary}</span>
                      </span>
                      <span class="mini-list__time">{relative(l.receivedAt)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card title="Needs attention" subtitle={attention.length ? undefined : 'Nothing urgent'} flush>
            {attention.length === 0 ? (
              <EmptyState icon="check-circle" title="You’re all caught up" />
            ) : (
              <ul class="mini-list" role="list">
                {attention.map((a) => (
                  <li key={a.label}>
                    <Link to={a.to} class="mini-list__row">
                      <span class={`mini-list__icon mini-list__icon--${a.tone}`}>
                        <Icon name={a.icon} size={15} />
                      </span>
                      <span class="mini-list__main">
                        <span class="mini-list__title">{a.label}</span>
                        {a.detail && <span class="mini-list__sub">{a.detail}</span>}
                      </span>
                      <Icon name="chevron-right" size={16} class="mini-list__chev" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card title="Showrooms this month" subtitle={monthLong(currentKey)}>
            <ul class="store-split" role="list">
              {(['osage-beach', 'nixa'] as const).map((s) => {
                const rev = revenueBetween(events, monthStart, t, s);
                const total = revenueBetween(events, monthStart, t, 'all') || 1;
                const jobsDone = d.jobs.filter((j) => j.store === s && j.completedAt && j.completedAt.slice(0, 10) >= monthStart).length;
                return (
                  <li key={s}>
                    <div class="row row--between">
                      <span class="store-split__name">{storeName(s)}</span>
                      <span class="store-split__value">{money(rev, false)}</span>
                    </div>
                    <Meter value={rev} max={total} label={`${storeName(s)} share of revenue`} tone={s === 'osage-beach' ? 'ember' : 'blue'} />
                    <p class="muted small">
                      {Math.round((rev / total) * 100)}% of revenue · {plural(jobsDone, 'job')} completed
                    </p>
                  </li>
                );
              })}
            </ul>
            <LinkButton variant="ghost" size="sm" icon="chart" to={sectionPath('analytics')}>
              See all reports
            </LinkButton>
          </Card>
        </div>
      </div>

      <p class="demo-footnote">
        <Badge tone="neutral" icon="info">
          Sample data
        </Badge>{' '}
        Customers, jobs and figures are invented for this concept. Technician names are placeholders.
      </p>
    </div>
  );
}
