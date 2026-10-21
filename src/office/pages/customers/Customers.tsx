/** Customers: the list, and each customer's record (?id=C-…). */
import { useMemo, useState } from 'preact/hooks';
import type { Customer } from '../../data/types';
import { openDialog } from '../../dialogs';
import { money, phone, plural, shortDate } from '../../lib/format';
import { navigate, param, setParams } from '../../router';
import { matchStore, storeName } from '../../selectors';
import { db, ui } from '../../store';
import { Button, Checkbox, Chips, EmptyState, Link, PageHeader, SearchInput, Stat } from '../../ui/core';
import { DataTable, type Column } from '../../ui/Table';
import { CustomerDetail } from './CustomerDetail';
import { customerSummaries, kindLabels } from './helpers';
import { TagList } from './parts';

export default function Customers() {
  const id = param('id');
  if (id) return <CustomerDetail key={id} id={id} />;
  return <CustomerList key={param('filter') ?? 'all'} />;
}

type KindFilter = 'all' | Customer['kind'];

function CustomerList() {
  const d = db.value;
  const store = ui.value.store;
  const initial = param('filter');
  const [q, setQ] = useState(param('q') ?? '');
  const [kind, setKind] = useState<KindFilter>('all');
  const [tag, setTag] = useState('');
  const [balanceOnly, setBalanceOnly] = useState(initial === 'balance');
  const [dueOnly, setDueOnly] = useState(initial === 'due');
  const [planOnly, setPlanOnly] = useState(initial === 'plan');
  const [showCounter, setShowCounter] = useState(false);

  const summaries = useMemo(() => customerSummaries(d), [d]);
  const inStore = useMemo(() => d.customers.filter((c) => matchStore(store, c.store) && !c.tags.includes('Counter sales')), [d.customers, store]);
  const allTags = useMemo(() => [...new Set(d.customers.flatMap((c) => c.tags))].filter((t) => t !== 'Counter sales').sort(), [d.customers]);

  const term = q.trim().toLowerCase();
  const digits = term.replace(/\D/g, '');
  const rows = useMemo(
    () =>
      d.customers.filter((c) => {
        if (!matchStore(store, c.store)) return false;
        if (!showCounter && c.tags.includes('Counter sales')) return false;
        if (kind !== 'all' && c.kind !== kind) return false;
        if (tag && !c.tags.includes(tag)) return false;
        const s = summaries.get(c.id);
        if (balanceOnly && !(s && s.open > 0.004)) return false;
        if (dueOnly && !s?.dueForService) return false;
        if (planOnly && !c.servicePlan) return false;
        if (term) {
          const hay = `${c.name} ${c.contact ?? ''} ${c.email} ${c.address.street} ${c.address.city} ${c.address.zip} ${c.id}`.toLowerCase();
          if (!hay.includes(term) && !(digits.length >= 3 && c.phone.replace(/\D/g, '').includes(digits))) return false;
        }
        return true;
      }),
    [d.customers, store, showCounter, kind, tag, balanceOnly, dueOnly, planOnly, term, digits, summaries],
  );

  const stats = useMemo(() => {
    let plan = 0;
    let due = 0;
    let open = 0;
    let overdue = 0;
    for (const c of inStore) {
      if (c.servicePlan) plan++;
      const s = summaries.get(c.id);
      if (s?.dueForService) due++;
      open += s?.open ?? 0;
      overdue += s?.overdue ?? 0;
    }
    return { plan, due, open, overdue };
  }, [inStore, summaries]);

  const filtered = !!(term || kind !== 'all' || tag || balanceOnly || dueOnly || planOnly);
  const clear = () => {
    setQ('');
    setKind('all');
    setTag('');
    setBalanceOnly(false);
    setDueOnly(false);
    setPlanOnly(false);
    if (initial) setParams({ filter: undefined }, { replace: true });
  };

  const columns: Column<Customer>[] = [
    {
      key: 'name',
      label: 'Customer',
      sortValue: (c) => c.name.toLowerCase(),
      render: (c) => (
        <>
          <Link to={`/office/customers/?id=${c.id}`} class="cell-main">
            {c.name}
          </Link>
          <span class="cell-sub">
            {c.kind !== 'homeowner' && c.contact ? `${c.contact} · ` : ''}
            {c.address.city || '—'}
          </span>
        </>
      ),
    },
    { key: 'phone', label: 'Phone', render: (c) => <span class="tabular nowrap">{c.phone ? phone(c.phone) : '—'}</span>, hide: 'sm' },
    { key: 'store', label: 'Store', sortValue: (c) => c.store, render: (c) => storeName(c.store), hide: 'md' },
    { key: 'units', label: 'Appliances', align: 'right', sortValue: (c) => summaries.get(c.id)?.units.length ?? 0, render: (c) => summaries.get(c.id)?.units.length ?? 0, hide: 'sm' },
    {
      key: 'service',
      label: 'Last service',
      sortValue: (c) => summaries.get(c.id)?.lastService ?? '',
      render: (c) => {
        const s = summaries.get(c.id)?.lastService;
        return s ? <span class="nowrap">{shortDate(s, true)}</span> : <span class="muted">—</span>;
      },
      hide: 'md',
    },
    {
      key: 'balance',
      label: 'Open balance',
      align: 'right',
      sortValue: (c) => summaries.get(c.id)?.open ?? 0,
      render: (c) => {
        const s = summaries.get(c.id);
        if (!s || s.open <= 0.004) return <span class="muted">—</span>;
        return (
          <>
            <span class="tabular">{money(s.open)}</span>
            {s.overdue > 0.004 && <span class="cell-sub is-bad">{money(s.overdue, false)} overdue</span>}
          </>
        );
      },
    },
    { key: 'tags', label: 'Tags', render: (c) => <TagList tags={c.tags} max={2} />, hide: 'md' },
  ];

  return (
    <>
      <PageHeader
        eyebrow={store === 'all' ? 'Both showrooms' : storeName(store)}
        title="Customers"
        description="Homeowners, builders and businesses — with every appliance, visit, invoice and conversation in one record."
        actions={
          <Button variant="primary" icon="plus" onClick={() => openDialog({ kind: 'customer' })}>
            New customer
          </Button>
        }
      />

      <div class="stats cust-stats">
        <Stat label="Customers" icon="users" value={inStore.length.toLocaleString()} hint={`${plural(inStore.filter((c) => c.kind === 'builder').length, 'builder')} on file`} />
        <Stat label="On the maintenance plan" icon="shield" value={stats.plan.toLocaleString()} hint={`${Math.round((stats.plan / Math.max(1, inStore.length)) * 100)}% of customers`} to="/office/customers/?filter=plan" />
        <Stat label="Due for annual service" icon="calendar" value={stats.due.toLocaleString()} hint="Within 60 days or overdue" to="/office/customers/?filter=due" />
        <Stat label="Open balances" icon="receipt" value={money(stats.open, false)} hint={<span class={stats.overdue > 0 ? 'is-bad' : undefined}>{money(stats.overdue, false)} overdue</span>} to="/office/customers/?filter=balance" />
      </div>

      <section class="card card--flush" aria-label="Customer list">
        <div class="cust-toolbar">
          <SearchInput value={q} onInput={setQ} label="Search customers" placeholder="Name, phone, email or address" class="cust-toolbar__search" />
          <Chips<KindFilter>
            label="Customer type"
            value={kind}
            onChange={setKind}
            items={[
              { key: 'all', label: 'All' },
              { key: 'homeowner', label: 'Homeowners' },
              { key: 'builder', label: 'Builders' },
              { key: 'business', label: 'Businesses' },
            ]}
          />
          <label class="cust-toolbar__tag">
            <span class="sr-only">Tag</span>
            <select class="select select--sm" value={tag} onChange={(e) => setTag((e.target as HTMLSelectElement).value)}>
              <option value="">Any tag</option>
              {allTags.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </label>
          <div class="cust-toolbar__checks">
            <Checkbox checked={balanceOnly} onChange={setBalanceOnly}>
              Open balance
            </Checkbox>
            <Checkbox checked={dueOnly} onChange={setDueOnly}>
              Due for service
            </Checkbox>
            <Checkbox checked={planOnly} onChange={setPlanOnly}>
              Maintenance plan
            </Checkbox>
            <Checkbox checked={showCounter} onChange={setShowCounter}>
              Counter-sale accounts
            </Checkbox>
          </div>
        </div>
        <p class="cust-count" aria-live="polite">
          {plural(rows.length, 'customer')}
          {filtered && (
            <>
              {' '}
              ·{' '}
              <button type="button" class="link-btn" onClick={clear}>
                Clear filters
              </button>
            </>
          )}
        </p>
        <DataTable<Customer>
          rows={rows}
          columns={columns}
          rowKey={(c) => c.id}
          caption="Customers"
          initialSort={{ key: 'name', dir: 'asc' }}
          onRowClick={(c) => navigate(`/office/customers/?id=${c.id}`)}
          empty={
            <EmptyState
              icon="users"
              title="No customers match"
              action={
                <Button size="sm" onClick={clear}>
                  Clear filters
                </Button>
              }
            >
              Try a different name, phone number or filter.
            </EmptyState>
          }
        />
      </section>
      <p class="demo-footnote">
        Customer names, addresses and phone numbers are fictional (555-01xx numbers, example.com emails). {kindLabels.builder} accounts carry Net 30 terms.
      </p>
    </>
  );
}
