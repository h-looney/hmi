/** Warranty: coverage on every appliance HMI installs, manufacturer registration, and claims. */
import { useMemo, useState } from 'preact/hooks';
import { registerUnit, sendServiceReminders } from '../../actions';
import { issues } from '../../data/catalog';
import type { ClaimStatus, Unit, WarrantyClaim } from '../../data/types';
import { openDialog } from '../../dialogs';
import { addDays, today } from '../../lib/dates';
import { money, plural, shortDate } from '../../lib/format';
import { navigate, param, setParams } from '../../router';
import { customerOf, matchStore, storeName, unitLabel, unitOf, warrantyState, type WarrantyState } from '../../selectors';
import { can, db, markTried, ui } from '../../store';
import { toast } from '../../toast';
import { Button, Chips, EmptyState, Link, Menu, PageHeader, SearchInput, Sr, Stat, TabPanel, Tabs } from '../../ui/core';
import { Icon } from '../../ui/Icon';
import { DataTable, type Column } from '../../ui/Table';
import { claimStatusMeta, StatusBadge, warrantyMeta } from '../../ui/status';
import { ClaimDrawer } from './ClaimDrawer';

type Tab = 'registry' | 'claims';
type RegFilter = 'all' | 'active' | 'expiring' | 'unregistered' | 'expired' | 'others';
type ClaimFilter = 'open' | ClaimStatus | 'all';

const regFilters: RegFilter[] = ['all', 'active', 'expiring', 'unregistered', 'expired', 'others'];
const claimFilters: ClaimFilter[] = ['open', 'draft', 'submitted', 'approved', 'parts-shipped', 'credited', 'denied', 'all'];
const OPEN: ClaimStatus[] = ['draft', 'submitted', 'approved', 'parts-shipped'];
const stateOrder: Record<WarrantyState, number> = { expiring: 0, active: 1, 'labor-ended': 2, expired: 3, none: 4 };

const isCovered = (u: Unit, t: string) => !!u.warranty.partsUntil && u.warranty.partsUntil >= t;
const needsRegistration = (u: Unit) => u.installedBy === 'HMI' && !u.warranty.registered && warrantyState(u) !== 'expired';

export default function Warranty() {
  const d = db.value;
  const store = ui.value.store;
  const t = today();
  const claimId = param('id');
  const tab: Tab = claimId || param('tab') === 'claims' ? 'claims' : 'registry';

  const units = useMemo(() => d.units.filter((u) => matchStore(store, customerOf(d, u.customerId)?.store ?? 'osage-beach')), [d, store]);
  const claims = useMemo(() => d.claims.filter((c) => matchStore(store, c.store)), [d.claims, store]);
  const hmi = units.filter((u) => u.installedBy === 'HMI');
  const covered = hmi.filter((u) => isCovered(u, t)).length;
  const expiring = hmi.filter((u) => warrantyState(u) === 'expiring').length;
  const unregistered = hmi.filter(needsRegistration).length;
  const openClaims = claims.filter((c) => OPEN.includes(c.status));
  const since = addDays(t, -90);
  const credited90 = claims.filter((c) => c.status === 'credited' && c.updatedOn >= since).reduce((s, c) => s + c.credit, 0);

  return (
    <>
      <PageHeader
        eyebrow={store === 'all' ? 'Both showrooms' : storeName(store)}
        title="Warranty"
        description="Coverage on every appliance HMI installs, manufacturer registration, and claims from first report to credit."
        actions={
          <Button variant="primary" icon="plus" onClick={() => openDialog({ kind: 'claim' })}>
            New claim
          </Button>
        }
      />

      <div class="stats cust-stats">
        <Stat label="Under warranty" icon="shield" value={covered.toLocaleString()} hint={`of ${plural(hmi.length, 'HMI install')}`} to="/office/warranty/?filter=active" />
        <Stat label="Expiring in 90 days" icon="clock" value={expiring} hint="Offer an extended plan or a check-up" to="/office/warranty/?filter=expiring" />
        <Stat label="Not registered" icon="alert" value={unregistered} hint={unregistered ? <span class="is-bad">Register before coverage is at risk</span> : 'All registered'} to="/office/warranty/?filter=unregistered" />
        <Stat label="Open claims" icon="file" value={openClaims.length} hint={`${money(openClaims.reduce((s, c) => s + c.credit, 0), false)} expected back`} to="/office/warranty/?tab=claims" />
        <Stat label="Credits received" icon="dollar" value={money(credited90, false)} hint="Last 90 days" to="/office/warranty/?tab=claims&status=credited" />
      </div>

      <Tabs<Tab>
        label="Warranty views"
        idBase="warranty"
        value={tab}
        onChange={(k) => setParams({ tab: k === 'registry' ? undefined : k, id: undefined, filter: undefined, status: undefined }, { replace: true })}
        items={[
          { key: 'registry', label: 'Coverage registry', icon: 'shield', count: hmi.length },
          { key: 'claims', label: 'Claims', icon: 'file', count: openClaims.length },
        ]}
      />
      <TabPanel idBase="warranty" active={tab}>
        {tab === 'registry' ? <Registry units={units} /> : <Claims claims={claims} />}
      </TabPanel>

      {claimId && <ClaimDrawer key={claimId} id={claimId} onClose={() => setParams({ id: undefined })} />}
    </>
  );
}

/* ---------- Coverage registry ---------- */

function Registry({ units }: { units: Unit[] }) {
  const d = db.value;
  const t = today();
  const fp = param('filter') as RegFilter | undefined;
  const filter: RegFilter = fp && regFilters.includes(fp) ? fp : 'all';
  const [q, setQ] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const counts = useMemo(() => {
    const hmi = units.filter((u) => u.installedBy === 'HMI');
    return {
      all: hmi.length,
      active: hmi.filter((u) => isCovered(u, t)).length,
      expiring: hmi.filter((u) => warrantyState(u) === 'expiring').length,
      unregistered: hmi.filter(needsRegistration).length,
      expired: hmi.filter((u) => warrantyState(u) === 'expired').length,
      others: units.length - hmi.length,
    };
  }, [units, t]);

  const term = q.trim().toLowerCase();
  const rows = useMemo(
    () =>
      units.filter((u) => {
        const state = warrantyState(u);
        if (filter === 'others') {
          if (u.installedBy === 'HMI') return false;
        } else {
          if (u.installedBy !== 'HMI') return false;
          if (filter === 'active' && !isCovered(u, t)) return false;
          if (filter === 'expiring' && state !== 'expiring') return false;
          if (filter === 'unregistered' && !needsRegistration(u)) return false;
          if (filter === 'expired' && state !== 'expired') return false;
        }
        if (term) {
          const c = customerOf(d, u.customerId);
          const hay = `${c?.name ?? ''} ${unitLabel(u)} ${u.serial} ${c?.address.city ?? ''}`.toLowerCase();
          if (!hay.includes(term)) return false;
        }
        return true;
      }),
    [units, filter, term, d, t],
  );

  const setFilter = (f: RegFilter) => {
    setParams({ filter: f === 'all' ? undefined : f }, { replace: true });
    setSelected(new Set());
  };

  const picked = rows.filter((u) => selected.has(u.id));
  const registerable = picked.filter(needsRegistration);
  const remindable = picked.filter((u) => u.fuel !== 'Electric');

  const registerMany = () => {
    registerable.forEach((u) => registerUnit(u.id));
    toast(`${plural(registerable.length, 'unit')} registered with the manufacturer (simulated)`);
    setSelected(new Set());
  };
  const remind = () => {
    sendServiceReminders(remindable.map((u) => u.id));
    const people = new Set(remindable.map((u) => u.customerId)).size;
    toast(`Annual-service reminders sent to ${plural(people, 'customer')} (simulated — nothing actually goes out)`);
    setSelected(new Set());
  };

  const columns: Column<Unit>[] = [
    {
      key: 'customer',
      label: 'Customer',
      sortValue: (u) => customerOf(d, u.customerId)?.name.toLowerCase() ?? '',
      render: (u) => {
        const c = customerOf(d, u.customerId);
        return (
          <>
            {c ? (
              <Link to={`/office/customers/?id=${c.id}&tab=equipment`} class="cell-main">
                {c.name}
              </Link>
            ) : (
              <span class="cell-main">Unknown</span>
            )}
            <span class="cell-sub">{c?.address.city}</span>
          </>
        );
      },
    },
    {
      key: 'unit',
      label: 'Appliance',
      sortValue: (u) => unitLabel(u),
      render: (u) => (
        <>
          <span class="cell-main">{unitLabel(u)}</span>
          <span class="cell-sub">
            {u.category}
            <span class="hide-md-inline"> · Serial {u.serial}</span>
          </span>
        </>
      ),
    },
    { key: 'installed', label: 'Installed', sortValue: (u) => u.installedOn, render: (u) => <span class="nowrap">{shortDate(u.installedOn, true)}</span>, hide: 'sm' },
    {
      key: 'parts',
      label: 'Parts until',
      sortValue: (u) => u.warranty.partsUntil ?? '',
      render: (u) => (u.warranty.partsUntil ? <span class="nowrap">{shortDate(u.warranty.partsUntil, true)}</span> : <span class="muted">—</span>),
      hide: 'md',
    },
    {
      key: 'labor',
      label: 'Labor until',
      sortValue: (u) => u.warranty.laborUntil ?? '',
      render: (u) => (u.warranty.laborUntil ? <span class="nowrap">{shortDate(u.warranty.laborUntil, true)}</span> : <span class="muted">—</span>),
      hide: 'md',
    },
    { key: 'state', label: 'Coverage', sortValue: (u) => stateOrder[warrantyState(u)], render: (u) => <StatusBadge meta={warrantyMeta[warrantyState(u)]} /> },
    {
      key: 'registered',
      label: 'Registered',
      sortValue: (u) => (u.installedBy !== 'HMI' ? 2 : u.warranty.registered ? 1 : 0),
      render: (u) =>
        u.installedBy !== 'HMI' ? (
          <span class="muted">—</span>
        ) : u.warranty.registered ? (
          <span class="reg-yes">
            <Icon name="check" size={14} stroke={2.4} /> Yes
          </span>
        ) : warrantyState(u) === 'expired' ? (
          <span class="muted">No</span>
        ) : (
          <Button
            size="sm"
            onClick={() => {
              registerUnit(u.id);
              toast(`${unitLabel(u)} registered (simulated)`);
            }}
          >
            Register
          </Button>
        ),
    },
    {
      key: 'actions',
      label: <Sr>Actions</Sr>,
      render: (u) => {
        const c = customerOf(d, u.customerId);
        return (
          <Menu
            label={`Actions for ${unitLabel(u)}`}
            size="sm"
            items={[
              { label: 'Start a warranty claim', icon: 'file', disabled: u.installedBy !== 'HMI', onSelect: () => openDialog({ kind: 'claim', unitId: u.id }) },
              ...(can('jobs') && c ? [{ label: 'Schedule service', icon: 'calendar-plus' as const, onSelect: () => openDialog({ kind: 'job', preset: { type: 'maintenance', customerId: c.id, unitId: u.id, store: c.store } }) }] : []),
              { label: 'View customer', icon: 'user', onSelect: () => navigate(`/office/customers/?id=${u.customerId}&tab=equipment`) },
            ]}
          />
        );
      },
    },
  ];

  return (
    <section class="card card--flush" aria-label="Coverage registry">
      <div class="cust-toolbar">
        <Chips<RegFilter>
          label="Coverage filter"
          value={filter}
          onChange={setFilter}
          items={[
            { key: 'all', label: 'All HMI installs', count: counts.all },
            { key: 'active', label: 'Under warranty', count: counts.active },
            { key: 'expiring', label: 'Expiring soon', count: counts.expiring },
            { key: 'unregistered', label: 'Not registered', count: counts.unregistered },
            { key: 'expired', label: 'Expired', count: counts.expired },
            { key: 'others', label: 'Installed by others', count: counts.others },
          ]}
        />
        <SearchInput value={q} onInput={setQ} label="Search the registry" placeholder="Customer, model or serial" class="cust-toolbar__search" />
      </div>

      {filter === 'unregistered' && counts.unregistered > 0 && (
        <p class="callout callout--amber warranty-note">
          <Icon name="alert" size={16} />
          <span>Manufacturers can refuse claims on units that were never registered. Select them all and register in one step.</span>
        </p>
      )}
      {filter === 'others' && (
        <p class="callout warranty-note">
          <Icon name="info" size={16} />
          <span>Appliances HMI services but didn’t install. There’s no HMI warranty on these — and older ones are good replacement leads.</span>
        </p>
      )}

      {selected.size > 0 && (
        <div class="bulk-bar" role="region" aria-label="Bulk actions">
          <span>
            <strong>{selected.size}</strong> selected
          </span>
          <Button size="sm" variant="primary" icon="shield" disabled={!registerable.length} onClick={registerMany}>
            Register {registerable.length ? registerable.length : ''}
          </Button>
          <Button size="sm" icon="mail" disabled={!remindable.length} onClick={remind}>
            Send service reminders
          </Button>
          {picked.length > remindable.length && <span class="muted small">Electric units don’t need annual service</span>}
          <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>
            Clear
          </Button>
        </div>
      )}

      <DataTable<Unit>
        rows={rows}
        columns={columns}
        rowKey={(u) => u.id}
        caption="Warranty coverage registry"
        initialSort={{ key: filter === 'expiring' ? 'parts' : 'installed', dir: filter === 'expiring' ? 'asc' : 'desc' }}
        selected={selected}
        onSelect={(keys) => {
          setSelected(keys);
          if (keys.size) markTried('reminders');
        }}
        empty={
          <EmptyState icon="shield" title={filter === 'unregistered' ? 'Every install is registered' : 'Nothing matches'}>
            {filter === 'unregistered' ? 'Nice — every unit under warranty is registered with its manufacturer.' : 'Try another filter or search.'}
          </EmptyState>
        }
      />
    </section>
  );
}

/* ---------- Claims ---------- */

function Claims({ claims }: { claims: WarrantyClaim[] }) {
  const d = db.value;
  const sp = param('status') as ClaimFilter | undefined;
  const filter: ClaimFilter = sp && claimFilters.includes(sp) ? sp : 'open';
  const [q, setQ] = useState('');

  const byStatus = useMemo(() => {
    const m = new Map<ClaimStatus, { count: number; amount: number }>();
    for (const c of claims) {
      const e = m.get(c.status) ?? { count: 0, amount: 0 };
      e.count++;
      e.amount += c.credit;
      m.set(c.status, e);
    }
    return m;
  }, [claims]);

  const term = q.trim().toLowerCase();
  const rows = claims.filter((c) => {
    if (filter === 'open' && !OPEN.includes(c.status)) return false;
    if (filter !== 'open' && filter !== 'all' && c.status !== filter) return false;
    if (term) {
      const u = unitOf(d, c.unitId);
      const hay = `${c.id} ${c.claimNo ?? ''} ${customerOf(d, c.customerId)?.name ?? ''} ${u ? unitLabel(u) : ''} ${c.part} ${c.manufacturer}`.toLowerCase();
      if (!hay.includes(term)) return false;
    }
    return true;
  });

  const count = (s: ClaimStatus) => byStatus.get(s)?.count ?? 0;
  const pending = OPEN.reduce((s, st) => s + (byStatus.get(st)?.amount ?? 0), 0);

  const columns: Column<WarrantyClaim>[] = [
    {
      key: 'id',
      label: 'Claim',
      sortValue: (c) => c.id,
      render: (c) => (
        <>
          <button type="button" class="cell-main link-plain" onClick={() => setParams({ id: c.id })}>
            {c.id}
          </button>
          <span class="cell-sub">{c.claimNo ?? (c.status === 'draft' ? 'Not submitted' : 'Claim # pending')}</span>
        </>
      ),
    },
    {
      key: 'customer',
      label: 'Customer',
      sortValue: (c) => customerOf(d, c.customerId)?.name ?? '',
      render: (c) => {
        const u = unitOf(d, c.unitId);
        return (
          <>
            <span class="cell-main">{customerOf(d, c.customerId)?.name ?? '—'}</span>
            <span class="cell-sub">{u ? unitLabel(u) : '—'}</span>
          </>
        );
      },
    },
    {
      key: 'part',
      label: 'Part / issue',
      render: (c) => (
        <>
          <span>{c.part}</span>
          <span class="cell-sub">{issues[c.issue]?.label ?? c.issue}</span>
        </>
      ),
      hide: 'sm',
    },
    { key: 'maker', label: 'Manufacturer', sortValue: (c) => c.manufacturer, render: (c) => c.manufacturer, hide: 'md' },
    { key: 'opened', label: 'Opened', sortValue: (c) => c.openedOn, render: (c) => <span class="nowrap">{shortDate(c.openedOn, true)}</span>, hide: 'md' },
    { key: 'status', label: 'Status', sortValue: (c) => claimFilters.indexOf(c.status), render: (c) => <StatusBadge meta={claimStatusMeta[c.status]} /> },
    {
      key: 'credit',
      label: 'Credit',
      align: 'right',
      sortValue: (c) => c.credit,
      render: (c) =>
        c.status === 'credited' ? (
          <span class="tabular">{money(c.credit)}</span>
        ) : c.status === 'denied' ? (
          <span class="muted">—</span>
        ) : (
          <>
            <span class="tabular">{money(c.credit)}</span>
            <span class="cell-sub">expected</span>
          </>
        ),
    },
  ];

  return (
    <div class="stack">
      <ul class="claim-summary" role="list" aria-label="Claims by status">
        {(['draft', 'submitted', 'approved', 'parts-shipped', 'credited', 'denied'] as ClaimStatus[]).map((s) => (
          <li key={s}>
            <button type="button" class={`claim-summary__item${filter === s ? ' is-active' : ''}`} aria-pressed={filter === s} onClick={() => setParams({ status: s }, { replace: true })}>
              <StatusBadge meta={claimStatusMeta[s]} />
              <span class="claim-summary__count">{count(s)}</span>
              <span class="claim-summary__amount">{money(byStatus.get(s)?.amount ?? 0, false)}</span>
            </button>
          </li>
        ))}
      </ul>

      <section class="card card--flush" aria-label="Warranty claims">
        <div class="cust-toolbar">
          <Chips<ClaimFilter>
            label="Claim status"
            value={filter}
            onChange={(f) => setParams({ status: f === 'open' ? undefined : f }, { replace: true })}
            items={[
              { key: 'open', label: 'Open', count: OPEN.reduce((n, s) => n + count(s), 0) },
              { key: 'credited', label: 'Credited', count: count('credited') },
              { key: 'denied', label: 'Denied', count: count('denied') },
              { key: 'all', label: 'All', count: claims.length },
            ]}
          />
          <SearchInput value={q} onInput={setQ} label="Search claims" placeholder="Claim, customer, part or maker" class="cust-toolbar__search" />
        </div>
        <p class="cust-count">
          {plural(rows.length, 'claim')} · {money(pending, false)} in credits still expected from manufacturers
        </p>
        <DataTable<WarrantyClaim>
          rows={rows}
          columns={columns}
          rowKey={(c) => c.id}
          caption="Warranty claims"
          initialSort={{ key: 'opened', dir: 'desc' }}
          onRowClick={(c) => setParams({ id: c.id })}
          empty={
            <EmptyState icon="file" title="No claims here" action={<Button size="sm" icon="plus" onClick={() => openDialog({ kind: 'claim' })}>New claim</Button>}>
              Claims open automatically when a warranty job is completed, or start one by hand.
            </EmptyState>
          }
        />
      </section>
    </div>
  );
}
