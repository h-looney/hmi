/** One customer's record: contact, account, equipment & warranty, history, invoices, activity. */
import { useMemo, useState } from 'preact/hooks';
import { updateCustomer } from '../../actions';
import type { Customer, Invoice } from '../../data/types';
import { openDialog } from '../../dialogs';
import { today } from '../../lib/dates';
import { dayTime, mapsUrl, money, monthLabel, phone, plural, relative, shortDate, telHref } from '../../lib/format';
import { param, setParams } from '../../router';
import { customerOf, invoiceStatus, invoiceTotals, isOpenJob, storeName, unitLabel, warrantyState } from '../../selectors';
import { can, db, history } from '../../store';
import { toast } from '../../toast';
import { Badge, Button, Card, Details, EmptyState, Link, LinkButton, Menu, PageHeader, Switch, TabPanel, Tabs } from '../../ui/core';
import { Dialog } from '../../ui/Dialog';
import { Icon } from '../../ui/Icon';
import { DataTable } from '../../ui/Table';
import { invoiceStatusMeta, jobStatusMeta, jobTypeMeta, leadKindMeta, leadStageMeta, StatusBadge, warrantyMeta } from '../../ui/status';
import { AddUnitDialog } from './AddUnitDialog';
import { customerSummaries, customerTimeline, kindLabels, lifetimeSpend, serviceHistory } from './helpers';
import { Composer, HistoryTable, TagList, Timeline } from './parts';
import { UnitCard } from './UnitCard';

type TabKey = 'overview' | 'equipment' | 'history' | 'invoices' | 'activity';
const tabKeys: TabKey[] = ['overview', 'equipment', 'history', 'invoices', 'activity'];

const prefers: Record<Customer['contactPref'], string> = { phone: 'Prefers phone calls', email: 'Prefers email', text: 'Prefers text messages' };

export function CustomerDetail({ id }: { id: string }) {
  const d = db.value;
  const h = history.value;
  const c = customerOf(d, id);
  const [dialog, setDialog] = useState<'log' | 'unit' | null>(null);
  const [editingNotes, setEditingNotes] = useState(false);
  const [notesDraft, setNotesDraft] = useState('');

  const units = useMemo(() => d.units.filter((u) => u.customerId === id).sort((a, b) => (a.installedOn < b.installedOn ? 1 : -1)), [d.units, id]);
  const jobs = useMemo(() => d.jobs.filter((j) => j.customerId === id), [d.jobs, id]);
  const docs = useMemo(() => d.invoices.filter((i) => i.customerId === id).sort((a, b) => (a.issuedOn < b.issuedOn ? 1 : -1)), [d.invoices, id]);
  const leads = useMemo(() => d.leads.filter((l) => l.customerId === id), [d.leads, id]);
  const historyRows = useMemo(() => serviceHistory(d, h, { customerId: id }), [d, h, id]);
  const timeline = useMemo(() => (c ? customerTimeline(d, c, h) : []), [d, c, h]);
  const lifetime = useMemo(() => lifetimeSpend(d, h, id), [d, h, id]);

  if (!c) {
    return (
      <>
        <Link to="/office/customers/" class="back-link">
          <Icon name="arrow-left" size={16} /> All customers
        </Link>
        <PageHeader title="Customer not found" />
        <EmptyState icon="users" title="We couldn’t find that customer" action={<LinkButton to="/office/customers/">Back to customers</LinkButton>}>
          The record may have been removed when the demo data was reset.
        </EmptyState>
      </>
    );
  }

  const tabParam = param('tab') as TabKey | undefined;
  const tab: TabKey = tabParam && tabKeys.includes(tabParam) ? tabParam : 'overview';
  const setTab = (k: TabKey) => setParams({ tab: k === 'overview' ? undefined : k }, { replace: true });

  const summary = customerSummaries(d).get(id);
  const open = summary?.open ?? 0;
  const overdue = summary?.overdue ?? 0;
  const upcoming = jobs.filter(isOpenJob).sort((a, b) => ((a.start ?? '9999') < (b.start ?? '9999') ? -1 : 1));
  const openLeads = leads.filter((l) => l.stage === 'new' || l.stage === 'contacted' || l.stage === 'scheduled' || l.stage === 'quoted');
  const invoiceCount = docs.filter((i) => i.kind === 'invoice').length;

  const newJob = () => openDialog({ kind: 'job', preset: { customerId: id, store: c.store } });

  return (
    <div class="cust-detail">
      <Link to="/office/customers/" class="back-link">
        <Icon name="arrow-left" size={16} /> All customers
      </Link>
      <PageHeader
        eyebrow={`${kindLabels[c.kind]} · ${storeName(c.store)} · Customer since ${c.since.slice(0, 4)}`}
        title={c.name}
        description={c.contact ? `Contact: ${c.contact}` : undefined}
        actions={
          <>
            <Button icon="phone" onClick={() => setDialog('log')}>
              Log a call
            </Button>
            <Button icon="edit" onClick={() => openDialog({ kind: 'customer', customerId: id })}>
              Edit
            </Button>
            {can('accounting') && (
              <Menu
                label="New estimate or invoice"
                icon="file"
                buttonLabel="Estimate / invoice"
                variant="secondary"
                items={[
                  { label: 'New estimate', icon: 'file', onSelect: () => openDialog({ kind: 'invoice', preset: { kind: 'estimate', customerId: id } }) },
                  { label: 'New invoice', icon: 'receipt', onSelect: () => openDialog({ kind: 'invoice', preset: { kind: 'invoice', customerId: id } }) },
                ]}
              />
            )}
            {can('jobs') && (
              <Button variant="primary" icon="clipboard" onClick={newJob}>
                New job
              </Button>
            )}
          </>
        }
      />
      {c.tags.length > 0 && (
        <div class="cust-tags">
          <TagList tags={c.tags} />
        </div>
      )}

      <div class="cust-layout">
        <aside class="cust-side" aria-label="Customer details">
          <div class="cust-side__contact">
            <ContactCard c={c} />
          </div>

          <Card title="Account">
            <Details
              items={[
                [
                  'Open balance',
                  open > 0.004 ? (
                    <span>
                      <span class="tabular">{money(open)}</span>
                      {overdue > 0.004 && <span class="is-bad"> · {money(overdue)} overdue</span>}
                    </span>
                  ) : (
                    'Nothing due'
                  ),
                ],
                [
                  'Spend on record',
                  <span>
                    <span class="tabular">{money(lifetime, false)}</span>
                    <span class="muted small"> · records start {monthLabel(h.from.slice(0, 7))}</span>
                  </span>,
                ],
                ['Invoices on file', plural(invoiceCount, 'invoice')],
              ]}
            />
            {docs.length > 0 && (
              <button type="button" class="card-link cust-side__link" onClick={() => setTab('invoices')}>
                View invoices &amp; estimates <Icon name="arrow-right" size={14} />
              </button>
            )}
          </Card>

          <Card title="Service">
            <Switch
              checked={!!c.servicePlan}
              label="Annual maintenance plan"
              description="Reminder each fall and priority booking."
              onChange={(v) => {
                updateCustomer(id, { servicePlan: v, tags: v ? [...new Set(['Service plan', ...c.tags])] : c.tags.filter((t) => t !== 'Service plan') });
                toast(v ? `${c.name} enrolled in the maintenance plan` : `${c.name} removed from the maintenance plan`);
              }}
            />
            {summary?.nextServiceDue && (
              <p class="muted small cust-side__due">
                <Icon name="calendar" size={14} /> Next annual service {summary.nextServiceDue < today() ? 'overdue since' : 'due'} {shortDate(summary.nextServiceDue, true)}
              </p>
            )}
          </Card>

          <Card
            title="Notes"
            actions={
              !editingNotes && (
                <Button
                  size="sm"
                  variant="ghost"
                  icon="edit"
                  onClick={() => {
                    setNotesDraft(c.notes ?? '');
                    setEditingNotes(true);
                  }}
                >
                  Edit
                </Button>
              )
            }
          >
            {editingNotes ? (
              <div class="stack-sm">
                <label class="sr-only" for="cust-notes">
                  Notes
                </label>
                <textarea id="cust-notes" class="textarea" rows={4} value={notesDraft} onInput={(e) => setNotesDraft((e.target as HTMLTextAreaElement).value)} />
                <div class="row">
                  <Button
                    size="sm"
                    variant="primary"
                    onClick={() => {
                      updateCustomer(id, { notes: notesDraft.trim() || undefined });
                      setEditingNotes(false);
                      toast('Notes saved');
                    }}
                  >
                    Save
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setEditingNotes(false)}>
                    Cancel
                  </Button>
                </div>
              </div>
            ) : c.notes ? (
              <p class="cust-notes">{c.notes}</p>
            ) : (
              <p class="muted">No notes yet — gate codes, pets and preferences go here.</p>
            )}
          </Card>
        </aside>

        <div class="cust-main">
          <div class="cust-mobile-contact">
            <ContactCard c={c} />
          </div>
          <Tabs<TabKey>
            label="Customer record"
            idBase="cust"
            value={tab}
            onChange={setTab}
            items={[
              { key: 'overview', label: 'Overview' },
              { key: 'equipment', label: 'Equipment & warranty', count: units.length },
              { key: 'history', label: 'Service history', count: historyRows.length },
              { key: 'invoices', label: 'Invoices', count: docs.length },
              { key: 'activity', label: 'Activity' },
            ]}
          />
          <TabPanel idBase="cust" active={tab}>
            {tab === 'overview' && (
              <div class="stack">
                <Card
                  title="Coming up"
                  subtitle={upcoming.length ? plural(upcoming.length, 'open job') : undefined}
                  flush
                  actions={
                    can('jobs') && (
                      <Button size="sm" variant="ghost" icon="plus" onClick={newJob}>
                        Schedule
                      </Button>
                    )
                  }
                >
                  {upcoming.length === 0 ? (
                    <EmptyState icon="calendar" title="Nothing scheduled">
                      {summary?.dueForService ? 'Annual service is due soon — a good reason to call.' : 'No open jobs for this customer.'}
                    </EmptyState>
                  ) : (
                    <ul class="mini-list" role="list">
                      {upcoming.map((j) => {
                        const meta = jobTypeMeta[j.type];
                        const body = (
                          <>
                            <span class={`mini-list__icon mini-list__icon--${meta.tone}`}>
                              <Icon name={meta.icon} size={15} />
                            </span>
                            <span class="mini-list__main">
                              <span class="mini-list__title">{j.title}</span>
                              <span class="mini-list__sub">
                                {j.start ? dayTime(j.start) : 'Not scheduled yet'} · {j.id}
                              </span>
                            </span>
                            <StatusBadge meta={jobStatusMeta[j.status]} />
                          </>
                        );
                        return (
                          <li key={j.id}>
                            {can('jobs') ? (
                              <Link to={`/office/jobs/?id=${j.id}`} class="mini-list__row">
                                {body}
                              </Link>
                            ) : (
                              <div class="mini-list__row">{body}</div>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </Card>

                {openLeads.length > 0 && (
                  <Card title="Open requests" flush>
                    <ul class="mini-list" role="list">
                      {openLeads.map((l) => {
                        const meta = leadKindMeta[l.kind];
                        const body = (
                          <>
                            <span class={`mini-list__icon mini-list__icon--${meta.tone}`}>
                              <Icon name={meta.icon} size={15} />
                            </span>
                            <span class="mini-list__main">
                              <span class="mini-list__title">{l.summary}</span>
                              <span class="mini-list__sub">
                                {l.id} · received {relative(l.receivedAt)}
                              </span>
                            </span>
                            <StatusBadge meta={leadStageMeta[l.stage]} />
                          </>
                        );
                        return (
                          <li key={l.id}>
                            {can('inbox') ? (
                              <Link to={`/office/inbox/?id=${l.id}`} class="mini-list__row">
                                {body}
                              </Link>
                            ) : (
                              <div class="mini-list__row">{body}</div>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  </Card>
                )}

                <Card
                  title="Equipment"
                  subtitle={units.length ? plural(units.length, 'appliance') : undefined}
                  flush
                  actions={
                    units.length > 0 && (
                      <button type="button" class="card-link" onClick={() => setTab('equipment')}>
                        Warranty details <Icon name="arrow-right" size={14} />
                      </button>
                    )
                  }
                >
                  {units.length === 0 ? (
                    <EmptyState
                      icon="flame"
                      title="No equipment on file"
                      action={
                        <Button size="sm" icon="plus" onClick={() => setDialog('unit')}>
                          Add equipment
                        </Button>
                      }
                    >
                      Add the appliances in this home to track warranty and service.
                    </EmptyState>
                  ) : (
                    <ul class="mini-list" role="list">
                      {units.map((u) => (
                        <li key={u.id}>
                          <button type="button" class="mini-list__row mini-list__row--btn" onClick={() => setTab('equipment')}>
                            <span class="mini-list__icon">
                              <Icon name="flame" size={15} />
                            </span>
                            <span class="mini-list__main">
                              <span class="mini-list__title">{unitLabel(u)}</span>
                              <span class="mini-list__sub">
                                Installed {shortDate(u.installedOn, true)}
                                {u.room ? ` · ${u.room}` : ''}
                                {u.installedBy === 'HMI' && !u.warranty.registered && warrantyState(u) !== 'expired' ? ' · not registered' : ''}
                              </span>
                            </span>
                            <StatusBadge meta={warrantyMeta[warrantyState(u)]} />
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </Card>

                <Card
                  title="Recent activity"
                  actions={
                    timeline.length > 5 && (
                      <button type="button" class="card-link" onClick={() => setTab('activity')}>
                        See all <Icon name="arrow-right" size={14} />
                      </button>
                    )
                  }
                >
                  <Timeline entries={timeline.slice(0, 5)} />
                </Card>
              </div>
            )}

            {tab === 'equipment' && (
              <div class="stack">
                <div class="row row--between">
                  <p class="muted">
                    {plural(units.length, 'appliance')} on file. Many manufacturer warranties require annual service — keep it current here.
                  </p>
                  <Button size="sm" icon="plus" onClick={() => setDialog('unit')}>
                    Add equipment
                  </Button>
                </div>
                {units.length === 0 ? (
                  <Card>
                    <EmptyState icon="flame" title="No equipment on file">
                      Add the appliances in this home to track warranty and service.
                    </EmptyState>
                  </Card>
                ) : (
                  units.map((u) => <UnitCard key={u.id} unit={u} />)
                )}
              </div>
            )}

            {tab === 'history' && (
              <Card title="Service history" subtitle="Jobs on the schedule plus the last 15 months of visits" flush>
                {historyRows.length === 0 ? <EmptyState icon="clipboard" title="No visits on file" /> : <HistoryTable rows={historyRows} caption={`Service history for ${c.name}`} />}
              </Card>
            )}

            {tab === 'invoices' && (
              <Card
                title="Invoices & estimates"
                subtitle={`${open > 0.004 ? `${money(open)} open` : 'Nothing due'}${overdue > 0.004 ? ` · ${money(overdue)} overdue` : ''} · ${money(lifetime, false)} on record`}
                flush
                actions={
                  can('accounting') && (
                    <Button size="sm" variant="ghost" icon="plus" onClick={() => openDialog({ kind: 'invoice', preset: { kind: 'invoice', customerId: id } })}>
                      New invoice
                    </Button>
                  )
                }
              >
                <DataTable<Invoice>
                  rows={docs}
                  rowKey={(i) => i.id}
                  caption={`Invoices and estimates for ${c.name}`}
                  pageSize={15}
                  initialSort={{ key: 'issued', dir: 'desc' }}
                  empty={<EmptyState icon="receipt" title="No invoices yet" />}
                  columns={[
                    {
                      key: 'number',
                      label: 'Number',
                      sortValue: (i) => i.id,
                      render: (i) =>
                        can('accounting') ? (
                          <Link to={`/office/accounting/?tab=${i.kind === 'estimate' ? 'estimates' : 'invoices'}&id=${i.id}`} class="cell-main">
                            {i.id}
                          </Link>
                        ) : (
                          <span class="cell-main">{i.id}</span>
                        ),
                    },
                    { key: 'kind', label: 'Type', render: (i) => <Badge tone={i.kind === 'estimate' ? 'violet' : 'neutral'}>{i.kind === 'estimate' ? 'Estimate' : 'Invoice'}</Badge>, hide: 'sm' },
                    { key: 'issued', label: 'Issued', sortValue: (i) => i.issuedOn, render: (i) => <span class="nowrap">{shortDate(i.issuedOn, true)}</span> },
                    { key: 'due', label: 'Due / valid until', sortValue: (i) => i.dueOn, render: (i) => <span class="nowrap">{shortDate(i.dueOn, true)}</span>, hide: 'md' },
                    { key: 'total', label: 'Total', align: 'right', sortValue: (i) => invoiceTotals(i).total, render: (i) => money(invoiceTotals(i).total) },
                    {
                      key: 'balance',
                      label: 'Balance',
                      align: 'right',
                      sortValue: (i) => (i.kind === 'invoice' ? invoiceTotals(i).balance : -1),
                      render: (i) => (i.kind === 'invoice' && i.status !== 'void' ? money(invoiceTotals(i).balance) : <span class="muted">—</span>),
                      hide: 'sm',
                    },
                    { key: 'status', label: 'Status', render: (i) => <StatusBadge meta={invoiceStatusMeta[invoiceStatus(i)]} /> },
                  ]}
                />
              </Card>
            )}

            {tab === 'activity' && (
              <div class="stack">
                <Card title="Log a call or note">
                  <Composer customerId={id} />
                </Card>
                <Card title="Activity" subtitle="Calls, notes, requests, job updates, invoices and payments">
                  <Timeline entries={timeline} limit={25} />
                </Card>
              </div>
            )}
          </TabPanel>
        </div>
      </div>

      {dialog === 'log' && (
        <Dialog title="Log a call or note" description={c.name} onClose={() => setDialog(null)} size="md" class="cust-dialog">
          <Composer customerId={id} autoFocus onSaved={() => setDialog(null)} />
        </Dialog>
      )}
      {dialog === 'unit' && <AddUnitDialog customerId={id} onClose={() => setDialog(null)} />}
    </div>
  );
}

function ContactCard({ c }: { c: Customer }) {
  return (
    <Card title="Contact">
      <ul class="contact-list" role="list">
        {c.phone && (
          <li>
            <Icon name="phone" size={16} />
            <a href={telHref(c.phone)}>{phone(c.phone)}</a>
          </li>
        )}
        {c.email && (
          <li>
            <Icon name="mail" size={16} />
            <a href={`mailto:${c.email}`} class="contact-list__email">
              {c.email}
            </a>
          </li>
        )}
        {(c.address.street || c.address.city) && (
          <li>
            <Icon name="pin" size={16} />
            <span>
              {c.address.street}
              {c.address.street && <br />}
              {c.address.city}
              {c.address.city && ', '}
              {c.address.state} {c.address.zip}
              <br />
              <a href={mapsUrl(c.address)} target="_blank" rel="noopener">
                Directions <Icon name="external" size={12} />
                <span class="sr-only"> (opens Google Maps)</span>
              </a>
            </span>
          </li>
        )}
        <li>
          <Icon name="chat" size={16} />
          <span>{prefers[c.contactPref]}</span>
        </li>
        <li>
          <Icon name="store" size={16} />
          <span>
            {storeName(c.store)} showroom · {c.id}
          </span>
        </li>
      </ul>
    </Card>
  );
}
