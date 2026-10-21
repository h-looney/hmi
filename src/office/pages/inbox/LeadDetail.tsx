/** One request: who it's from, what they asked for, what happens next, and the conversation so far. */
import type { ComponentChildren } from 'preact';
import { useState } from 'preact/hooks';
import { assignLead, createCustomerFromLead, linkLeadToCustomer, markLeadRead, setLeadStage, toggleLeadStar } from '../../actions';
import type { Activity, Lead, LeadStage } from '../../data/types';
import { openDialog } from '../../dialogs';
import { dayTime, longDate, money, phone, plural, relative, shortDate, telHref, time } from '../../lib/format';
import { customerOf, firstName, invoiceOf, invoiceStatus, invoiceTotals, jobOf, staffOf, storeName, unitLabel, warrantyState } from '../../selectors';
import { db, history } from '../../store';
import { toast } from '../../toast';
import { Badge, Button, Card, cx, Details, Field, Link, Menu } from '../../ui/core';
import { Dialog } from '../../ui/Dialog';
import { Icon, type IconName } from '../../ui/Icon';
import { invoiceStatusMeta, jobStatusMeta, leadKindMeta, leadStageMeta, sourceLabels, StatusBadge, warrantyMeta } from '../../ui/status';
import { Composer } from './Composer';
import { CLOSED_STAGES, field, firstNameOf, likelyUnit, markLost, personName, possibleMatches, suggestedJobType } from './helpers';

const stages = Object.keys(leadStageMeta) as LeadStage[];

const activityIcons: Record<Activity['kind'], IconName> = {
  received: 'inbox',
  note: 'note',
  email: 'mail',
  call: 'phone',
  text: 'message',
  status: 'refresh',
  assign: 'user',
  job: 'clipboard',
  estimate: 'file',
  system: 'info',
};

const activityLabels: Record<Activity['kind'], string> = {
  received: 'Request received',
  note: 'Note',
  email: 'Email',
  call: 'Call',
  text: 'Text message',
  status: 'Status update',
  assign: 'Assignment',
  job: 'Scheduling',
  estimate: 'Estimate',
  system: 'Update',
};

const lostReasons = ['Went with another dealer', 'Over budget', 'Postponed to later', 'Chose a different product', 'No response after follow-ups', 'Outside our service area', 'Other'];

function LostDialog({ lead, onClose }: { lead: Lead; onClose: () => void }) {
  const [reason, setReason] = useState(lostReasons[0]);
  const [note, setNote] = useState('');
  return (
    <Dialog
      title="Mark as lost"
      description="Knowing why helps spot patterns in the lead reports."
      size="sm"
      class="inbox-dialog"
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            onClick={() => {
              markLost(lead.id, note.trim() ? `${reason} (${note.trim()})` : reason);
              toast(`${personName(lead)} marked lost — ${reason.toLowerCase()}`);
              onClose();
            }}
          >
            Mark lost
          </Button>
        </>
      }
    >
      <div class="stack">
        <Field label="Reason">
          <select class="select" value={reason} onChange={(e) => setReason((e.target as HTMLSelectElement).value)}>
            {lostReasons.map((r) => (
              <option key={r}>{r}</option>
            ))}
          </select>
        </Field>
        <Field label="Note" optional>
          <textarea class="textarea" rows={3} value={note} placeholder="Anything worth remembering for next time" onInput={(e) => setNote((e.target as HTMLTextAreaElement).value)} />
        </Field>
      </div>
    </Dialog>
  );
}

function Timeline({ lead }: { lead: Lead }) {
  const d = db.value;
  const items = [...lead.activity].sort((a, b) => (a.at < b.at ? 1 : -1));
  const who = (a: Activity) => (a.by === 'customer' ? personName(lead) : a.by === 'system' ? 'HMI Office' : staffOf(d, a.by)?.name ?? firstName(d, a.by));
  return (
    <ol class="timeline lead-timeline">
      {items.map((a) => (
        <li key={a.id}>
          <span class={`timeline__icon lead-timeline__icon--${a.kind}`}>
            <Icon name={activityIcons[a.kind]} size={14} />
          </span>
          <div class="timeline__text">
            <p class="lead-timeline__head">
              <strong>{who(a)}</strong>
              <span class="muted"> · {activityLabels[a.kind]}</span>
            </p>
            <p class={cx('lead-timeline__body', (a.kind === 'email' || a.kind === 'text') && a.by !== 'system' && 'is-message')}>{a.text}</p>
            <p class="timeline__meta">
              <time dateTime={a.at}>
                {relative(a.at)} · {dayTime(a.at)}
              </time>
            </p>
          </div>
        </li>
      ))}
    </ol>
  );
}

function CustomerCard({ lead }: { lead: Lead }) {
  const d = db.value;
  const customer = customerOf(d, lead.customerId);

  if (!customer) {
    const matches = possibleMatches(d, lead);
    return (
      <Card title="Customer record" level={3} class="lead-card">
        <p class="muted">No customer record is linked to this request yet.</p>
        {matches.length > 0 && (
          <ul class="lead-matches" role="list">
            {matches.map((c) => (
              <li key={c.id} class="lead-match">
                <span class="lead-match__text">
                  <span class="lead-match__label">Possible match</span>
                  <strong>{c.name}</strong>
                  <span class="muted small">
                    {c.address.city} · {phone(c.phone)}
                  </span>
                </span>
                <Button
                  size="sm"
                  icon="link"
                  onClick={() => {
                    linkLeadToCustomer(lead.id, c.id);
                    toast(`Linked to ${c.name}`);
                  }}
                >
                  Link
                </Button>
              </li>
            ))}
          </ul>
        )}
        <Button
          icon="plus"
          onClick={() => {
            const id = createCustomerFromLead(lead.id);
            toast(`Customer record ${id} created`, { tone: 'success' });
          }}
        >
          Create customer record
        </Button>
      </Card>
    );
  }

  const units = d.units.filter((u) => u.customerId === customer.id);
  const pastVisits =
    d.jobs.filter((j) => j.customerId === customer.id && (j.status === 'closed' || j.status === 'completed')).length +
    (history.value?.jobs.filter((f) => f.customerId === customer.id).length ?? 0);

  return (
    <Card
      title="Existing customer"
      level={3}
      class="lead-card"
      actions={
        <Link class="card-link" to={`/office/customers/?id=${customer.id}`}>
          Open <Icon name="arrow-right" size={14} />
        </Link>
      }
    >
      <p class="lead-customer">
        <Link to={`/office/customers/?id=${customer.id}`} class="lead-customer__name">
          {customer.name}
        </Link>
        <span class="muted small">
          Customer since {customer.since.slice(0, 4)}
          {pastVisits > 0 ? ` · ${plural(pastVisits, 'past visit')}` : ''}
          {customer.servicePlan ? ' · Service plan' : ''}
        </span>
      </p>
      {units.length === 0 ? (
        <p class="muted small">No appliances on file yet.</p>
      ) : (
        <ul class="lead-units" role="list">
          {units.slice(0, 3).map((u) => {
            const state = warrantyState(u);
            return (
              <li key={u.id} class="lead-unit">
                <span class="lead-unit__icon">
                  <Icon name="flame" size={15} />
                </span>
                <span class="lead-unit__text">
                  <strong>{unitLabel(u)}</strong>
                  <span class="muted small">
                    Installed {u.installedBy === 'HMI' ? 'by HMI' : 'by others'} in {u.installedOn.slice(0, 4)} · Serial {u.serial}
                    {u.lastServiceOn ? ` · Last service ${shortDate(u.lastServiceOn, true)}` : ''}
                  </span>
                  {(state === 'active' || state === 'expiring' || state === 'labor-ended') && u.warranty.partsUntil && <span class="small">Parts covered until {shortDate(u.warranty.partsUntil, true)}</span>}
                </span>
                <StatusBadge meta={warrantyMeta[state]} />
              </li>
            );
          })}
        </ul>
      )}
      {units.length > 3 && <p class="muted small">+ {plural(units.length - 3, 'more appliance')}</p>}
    </Card>
  );
}

export function LeadDetail({ lead, onBack }: { lead: Lead; onBack: () => void }) {
  const d = db.value;
  const [losing, setLosing] = useState(false);
  const kind = leadKindMeta[lead.kind];
  const job = jobOf(d, lead.jobId);
  const estimate = invoiceOf(d, lead.estimateId);
  const isClosed = CLOSED_STAGES.includes(lead.stage);
  const first = firstNameOf(lead);

  const ensureCustomer = () => lead.customerId ?? createCustomerFromLead(lead.id);

  const schedule = () => {
    const customerId = ensureCustomer();
    openDialog({
      kind: 'job',
      preset: {
        type: suggestedJobType(lead),
        customerId,
        unitId: likelyUnit(db.value, lead, customerId),
        leadId: lead.id,
        store: lead.store,
        description: lead.message,
      },
    });
  };

  const createEstimate = () => {
    const customerId = ensureCustomer();
    openDialog({ kind: 'invoice', preset: { kind: 'estimate', customerId, leadId: lead.id } });
  };

  const changeStage = (stage: LeadStage) => {
    if (stage === lead.stage) return;
    if (stage === 'lost') return setLosing(true);
    setLeadStage(lead.id, stage);
    toast(`Moved to ${leadStageMeta[stage].label}`);
  };

  const preferred = field(lead, 'Best way to reach you') ?? customerOf(d, lead.customerId)?.contactPref.replace(/^./, (c) => c.toUpperCase());
  const showroomChoice = field(lead, 'Preferred showroom') ?? field(lead, 'Nearest showroom');
  const staffGroups = [
    { label: 'Office & showroom', people: d.staff.filter((s) => !s.tech && (s.active || s.id === lead.assignee)) },
    { label: 'Field team', people: d.staff.filter((s) => s.tech && (s.active || s.id === lead.assignee)) },
  ];

  const contact: [string, ComponentChildren][] = [
    ['Email', lead.email ? <a href={`mailto:${lead.email}`}>{lead.email}</a> : undefined],
    ['Phone', lead.phone ? <a href={telHref(lead.phone)}>{phone(lead.phone)}</a> : undefined],
    ['Address', lead.address ?? [lead.city, lead.zip].filter(Boolean).join(' ')],
    ['Prefers', preferred],
    ['Came in through', sourceLabels[lead.source]],
    ['Showroom', showroomChoice && showroomChoice !== storeName(lead.store) ? `${storeName(lead.store)} (they chose “${showroomChoice}”)` : storeName(lead.store)],
    ['Received', `${longDate(lead.receivedAt)} at ${time(lead.receivedAt)}`],
  ];

  const fields = lead.fields.filter(([k]) => !['Service address', 'ZIP code', 'Best way to reach you'].includes(k));

  return (
    <article class="lead" aria-labelledby={`lead-${lead.id}-name`}>
      <header class="lead-head card">
        <button type="button" class="btn btn--ghost btn--sm lead-head__back" onClick={onBack}>
          <Icon name="arrow-left" size={16} />
          <span>All requests</span>
        </button>
        <div class="lead-head__top">
          <div class="lead-head__title">
            <div class="lead-head__badges">
              <Badge tone={kind.tone} icon={kind.icon}>
                {kind.label}
              </Badge>
              <StatusBadge meta={leadStageMeta[lead.stage]} />
              {lead.demo && (
                <Badge tone="green" icon="globe">
                  From the website
                </Badge>
              )}
            </div>
            <h2 id={`lead-${lead.id}-name`} class="lead-head__name">
              {lead.name}
            </h2>
            <p class="lead-head__meta">
              {lead.id} · {sourceLabels[lead.source]} · {storeName(lead.store)} · received {relative(lead.receivedAt)}
            </p>
          </div>
          <div class="lead-head__tools">
            <button
              type="button"
              class={cx('btn btn--ghost btn--md btn--icon', lead.starred && 'is-starred')}
              aria-pressed={!!lead.starred}
              aria-label={lead.starred ? 'Remove star' : 'Star this request'}
              onClick={() => toggleLeadStar(lead.id)}
            >
              <Icon name="star" size={18} />
            </button>
            <Menu
              label="More actions"
              items={[
                {
                  label: 'Mark as unread',
                  icon: 'eye',
                  onSelect: () => {
                    markLeadRead(lead.id, false);
                    onBack();
                  },
                },
                isClosed
                  ? { label: 'Reopen request', icon: 'undo', onSelect: () => (setLeadStage(lead.id, lead.estimateId ? 'quoted' : 'contacted', 'Reopened'), toast('Request reopened')) }
                  : { label: 'Close request', icon: 'archive', onSelect: () => (setLeadStage(lead.id, 'closed', 'Closed'), toast('Request closed')) },
              ]}
            />
          </div>
        </div>
        <div class="lead-head__controls">
          <label class="lead-head__control">
            <span>Stage</span>
            <select class="select select--sm" value={lead.stage} onChange={(e) => changeStage((e.target as HTMLSelectElement).value as LeadStage)}>
              {stages.map((s) => (
                <option key={s} value={s}>
                  {leadStageMeta[s].label}
                </option>
              ))}
            </select>
          </label>
          <label class="lead-head__control">
            <span>Assigned to</span>
            <select
              class="select select--sm"
              value={lead.assignee ?? ''}
              onChange={(e) => {
                const v = (e.target as HTMLSelectElement).value || undefined;
                assignLead(lead.id, v);
                toast(v ? `Assigned to ${staffOf(d, v)?.name}` : 'Unassigned');
              }}
            >
              <option value="">Unassigned</option>
              {staffGroups.map((g) => (
                <optgroup key={g.label} label={g.label}>
                  {g.people.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </label>
        </div>
      </header>

      {lead.demo && (
        <div class="callout callout--green lead-demo" role="note">
          <Icon name="sparkle" size={18} />
          <div>
            <p class="callout__title">This one just arrived from the public website</p>
            <p class="callout__text">
              You sent it from the website’s {lead.kind === 'quote' ? 'quote' : 'service request'} form in this browser, and HMI mode picked it up instantly
              {lead.customerId ? ' — and matched it to an existing customer' : ''}. In the live version, every visitor’s request arrives here the same way.
            </p>
          </div>
        </div>
      )}

      <Card title="Next steps" level={3} class="lead-card">
        {(job || estimate) && (
          <ul class="lead-links" role="list">
            {job && (
              <li>
                <Link to={`/office/jobs/?id=${job.id}`} class="lead-link">
                  <span class="lead-link__icon">
                    <Icon name="clipboard" size={16} />
                  </span>
                  <span class="lead-link__text">
                    <strong>
                      {job.id} · {job.title}
                    </strong>
                    <span class="muted small">
                      {job.start ? dayTime(job.start) : 'Not on the schedule yet'}
                      {job.crew.length ? ` · ${job.crew.map((c) => staffOf(d, c)?.name.split(' ')[0]).join(' & ')}` : ''}
                    </span>
                  </span>
                  <StatusBadge meta={jobStatusMeta[job.status]} />
                </Link>
              </li>
            )}
            {estimate && (
              <li>
                <Link to={`/office/accounting/?tab=estimates&id=${estimate.id}`} class="lead-link">
                  <span class="lead-link__icon">
                    <Icon name="file" size={16} />
                  </span>
                  <span class="lead-link__text">
                    <strong>Estimate {estimate.id}</strong>
                    <span class="muted small">
                      {money(invoiceTotals(estimate).total)} · sent {shortDate(estimate.issuedOn)}
                    </span>
                  </span>
                  <StatusBadge meta={invoiceStatusMeta[invoiceStatus(estimate)]} />
                </Link>
              </li>
            )}
          </ul>
        )}
        <div class="lead-actions">
          {isClosed ? (
            <>
              <p class="muted lead-actions__note">
                {lead.stage === 'won' ? 'Won' : lead.stage === 'lost' ? `Lost${lead.lostReason ? ` — ${lead.lostReason.toLowerCase()}` : ''}` : 'Closed'}
                {lead.closedAt ? ` on ${shortDate(lead.closedAt)}` : ''}.
              </p>
              <Button icon="undo" onClick={() => (setLeadStage(lead.id, lead.estimateId ? 'quoted' : 'contacted', 'Reopened'), toast('Request reopened'))}>
                Reopen
              </Button>
            </>
          ) : (
            <>
              {lead.kind !== 'question' && !job && (
                <Button variant="primary" icon="calendar-plus" onClick={schedule}>
                  {lead.kind === 'quote' ? 'Schedule a site visit' : suggestedJobType(lead) === 'maintenance' ? 'Schedule annual service' : 'Schedule a service call'}
                </Button>
              )}
              {lead.kind === 'quote' && !estimate && (
                <Button icon="file" onClick={createEstimate}>
                  Create estimate
                </Button>
              )}
              {lead.kind === 'quote' && (
                <Button icon="check-circle" onClick={() => (setLeadStage(lead.id, 'won', 'Marked won'), toast(`${personName(lead)} marked won`, { tone: 'success' }))}>
                  Mark won
                </Button>
              )}
              {lead.kind === 'quote' && (
                <Button variant="ghost" icon="x-circle" onClick={() => setLosing(true)}>
                  Mark lost
                </Button>
              )}
              <Button variant="ghost" icon="archive" onClick={() => (setLeadStage(lead.id, 'closed', lead.kind === 'question' ? 'Answered and closed' : 'Closed'), toast('Request closed'))}>
                {lead.kind === 'question' ? 'Mark answered' : 'Close'}
              </Button>
            </>
          )}
        </div>
        {!isClosed && lead.kind !== 'question' && !job && (
          <p class="lead-actions__hint">
            {lead.customerId ? '' : 'Scheduling or estimating creates a customer record from this request. '}A scheduled visit goes on the dispatch board and moves this request to Scheduled.
          </p>
        )}
      </Card>

      <div class="lead-grid">
        <Card title="Contact" level={3} class="lead-card">
          <Details items={contact} />
        </Card>
        <CustomerCard lead={lead} />
      </div>

      <Card title="What they sent" level={3} class="lead-card">
        {lead.message && (
          <blockquote class="lead-message">
            <p>{lead.message}</p>
            <footer>— {personName(lead)}</footer>
          </blockquote>
        )}
        {fields.length > 0 && <Details items={fields.map(([k, v]) => [k, v] as [string, string])} columns={2} />}
        {!!lead.photos && (
          <div class="lead-photos">
            <p class="lead-photos__label">
              {plural(lead.photos, 'photo')} attached <span class="muted">(placeholders in this demo)</span>
            </p>
            <ul class="lead-photos__grid" role="list">
              {Array.from({ length: lead.photos }, (_, i) => (
                <li key={i} class="lead-photo">
                  <Icon name="camera" size={22} />
                  <span>Photo {i + 1}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {!lead.message && fields.length === 0 && !lead.photos && <p class="muted">{lead.summary}</p>}
      </Card>

      <Card title="Conversation" subtitle={`Follow up with ${first} and keep the whole team in the loop`} level={3} class="lead-card">
        <Composer key={lead.id} lead={lead} />
        <h4 class="section-label">Activity</h4>
        <Timeline lead={lead} />
      </Card>

      {losing && <LostDialog lead={lead} onClose={() => setLosing(false)} />}
    </article>
  );
}
