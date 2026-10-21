/** A single job: status actions, details, checklist, parts, notes and sign-off. */
import { useState } from 'preact/hooks';
import { addJobNote, addJobPart, removeJobPart, setJobStatus, toggleChecklistItem } from '../../actions';
import { issues } from '../../data/catalog';
import type { Activity, Item, Job, StoreId } from '../../data/types';
import { openDialog } from '../../dialogs';
import { addMinutes, diffMinutes } from '../../lib/dates';
import { dayTime, duration, hours, money, phone, relative, shortDate, telHref, time, mapsUrl, address } from '../../lib/format';
import { navigate } from '../../router';
import { available, customerOf, firstName, itemLabel, itemOf, staffOf, storeName, unitLabel, unitOf, warrantyState } from '../../selectors';
import { db, ui } from '../../store';
import { toast } from '../../toast';
import { Avatar, Badge, Button, Card, Checkbox, Details, EmptyState, Field, Link, Menu, Meter, PageHeader, type MenuItem } from '../../ui/core';
import { Confirm } from '../../ui/Dialog';
import { Icon, type IconName } from '../../ui/Icon';
import { ItemPicker } from '../../ui/pickers';
import { StatusBadge, jobStatusMeta, jobTypeMeta, warrantyMeta } from '../../ui/status';
import { CompleteDialog, HoldDialog } from './dialogs';
import { closeOutAction, jobPath } from './helpers';

const activityIcon: Record<Activity['kind'], IconName> = {
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

function Notes({ job }: { job: Job }) {
  const d = db.value;
  const [text, setText] = useState('');
  const notes = [...job.notes].sort((a, b) => (a.at < b.at ? -1 : 1));
  const canNote = job.status !== 'cancelled';
  return (
    <Card title="Notes & activity" subtitle={notes.length === 1 ? '1 entry' : `${notes.length} entries`}>
      <ol class="timeline">
        {notes.map((n) => (
          <li key={n.id}>
            <span class="timeline__icon">
              <Icon name={activityIcon[n.kind] ?? 'note'} size={14} />
            </span>
            <div class="timeline__text">
              <p>{n.text}</p>
              <p class="timeline__meta">
                {firstName(d, n.by)} · {dayTime(n.at)}
              </p>
            </div>
          </li>
        ))}
      </ol>
      {canNote && (
        <form
          class="note-form"
          onSubmit={(e) => {
            e.preventDefault();
            if (!text.trim()) return;
            addJobNote(job.id, text.trim());
            setText('');
            toast('Note added');
          }}
        >
          <label class="sr-only" for="job-note">
            Add a note
          </label>
          <textarea id="job-note" class="textarea" rows={2} value={text} placeholder="Add a note for the crew or the office…" onInput={(e) => setText((e.target as HTMLTextAreaElement).value)} />
          <Button type="submit" variant="secondary" icon="send" disabled={!text.trim()}>
            Add note
          </Button>
        </form>
      )}
    </Card>
  );
}

function Parts({ job }: { job: Job }) {
  const d = db.value;
  const [picked, setPicked] = useState<Item | null>(null);
  const [qty, setQty] = useState(1);
  const [store, setStore] = useState<StoreId>(job.store);
  const editable = job.status !== 'closed' && job.status !== 'cancelled';
  const avail = picked ? available(picked, store) : 0;

  return (
    <Card title="Parts & materials" subtitle={job.parts.length ? `${job.parts.length} line${job.parts.length === 1 ? '' : 's'}` : 'Nothing reserved yet'}>
      {job.parts.length > 0 && (
        <ul class="parts" role="list">
          {job.parts.map((p, i) => {
            const it = itemOf(d, p.itemId);
            return (
              <li key={`${p.itemId}-${i}`} class="parts__row">
                <span class="parts__main">
                  <span class="parts__name">{it ? itemLabel(it) : p.itemId}</span>
                  <span class="muted small">
                    {p.itemId} · {storeName(p.store)}
                  </span>
                </span>
                <span class="parts__qty tabular">
                  {p.qty}
                  {it && it.uom !== 'ea' ? ` ${it.uom}` : ''}
                </span>
                <Badge tone={p.status === 'used' ? 'green' : 'blue'} icon={p.status === 'used' ? 'check' : 'lock'}>
                  {p.status === 'used' ? 'Used' : 'Reserved'}
                </Badge>
                {editable && p.status === 'reserved' ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    icon="trash"
                    aria-label={`Release ${it?.name ?? p.itemId}`}
                    onClick={() => {
                      removeJobPart(job.id, i);
                      toast('Reservation released');
                    }}
                  />
                ) : (
                  <span />
                )}
              </li>
            );
          })}
        </ul>
      )}
      {editable && (
        <div class="parts-add">
          {picked ? (
            <div class="parts-add__form">
              <p class="parts-add__item">
                <strong>{itemLabel(picked)}</strong>
                <span class="muted small"> · {picked.id}</span>
                <Button size="sm" variant="ghost" onClick={() => setPicked(null)}>
                  Change
                </Button>
              </p>
              <div class="parts-add__row">
                <Field label="Quantity">
                  <input class="input" type="number" min={1} step={1} value={qty} onInput={(e) => setQty(Math.max(1, Number((e.target as HTMLInputElement).value) || 1))} />
                </Field>
                <Field label="From">
                  <select class="select" value={store} onChange={(e) => setStore((e.target as HTMLSelectElement).value as StoreId)}>
                    <option value="osage-beach">Osage Beach</option>
                    <option value="nixa">Nixa</option>
                  </select>
                </Field>
                <Button
                  variant="primary"
                  icon="plus"
                  onClick={() => {
                    addJobPart(job.id, picked.id, qty, store);
                    toast(`Reserved ${qty} × ${picked.name}`);
                    setPicked(null);
                    setQty(1);
                  }}
                >
                  Reserve
                </Button>
              </div>
              <p class={avail >= qty ? 'muted small' : 'is-bad small'}>
                {avail >= qty ? `${avail} available at ${storeName(store)}.` : avail > 0 ? `Only ${avail} available at ${storeName(store)} — the rest will need to be ordered.` : `None available at ${storeName(store)} — this will need to be ordered or transferred.`}
              </p>
            </div>
          ) : (
            <ItemPicker store={store} label="Reserve a part from stock" onSelect={(it) => setPicked(it)} />
          )}
        </div>
      )}
    </Card>
  );
}

export function JobDetail({ id }: { id: string }) {
  const d = db.value;
  const job = d.jobs.find((j) => j.id === id);
  const [dialog, setDialog] = useState<'hold' | 'complete' | 'cancel' | null>(null);
  const backTo = `/office/jobs/?view=${ui.value.jobsView}`;

  if (!job) {
    return (
      <>
        <Link to={backTo} class="back-link">
          <Icon name="arrow-left" size={16} /> Jobs
        </Link>
        <EmptyState icon="clipboard" title="Job not found">
          {id} isn’t in this demo’s data — it may have been reset.
        </EmptyState>
      </>
    );
  }

  const c = customerOf(d, job.customerId);
  const unit = unitOf(d, job.unitId);
  const model = itemOf(d, job.itemId);
  const type = jobTypeMeta[job.type];
  const crew = job.crew.map((sid) => staffOf(d, sid)!).filter(Boolean);
  const done = job.checklist.filter((x) => x.done).length;
  const actualMins = job.startedAt && job.completedAt ? diffMinutes(job.completedAt, job.startedAt) : undefined;
  const lead = job.leadId ? d.leads.find((l) => l.id === job.leadId) : undefined;
  const invoice = job.invoiceId ? d.invoices.find((i) => i.id === job.invoiceId) : undefined;
  const estimate = d.invoices.find((i) => i.kind === 'estimate' && (i.id === job.estimateId || (lead && i.id === lead.estimateId)));
  const claim = job.claimId ? d.claims.find((cl) => cl.id === job.claimId) : undefined;
  const callbackOf = job.callbackOf ? d.jobs.find((j) => j.id === job.callbackOf) : undefined;
  const close = closeOutAction(job);
  const schedule = () => openDialog({ kind: 'job', jobId: job.id });

  // Status-aware actions: [primary, ...secondary], plus a menu for the rest
  const actions: { label: string; icon: IconName; run: () => void; primary?: boolean }[] = [];
  const more: (MenuItem | 'divider')[] = [];
  switch (job.status) {
    case 'requested':
      actions.push({ label: 'Schedule', icon: 'calendar', run: schedule, primary: true }, { label: 'Put on hold', icon: 'clock', run: () => setDialog('hold') });
      break;
    case 'scheduled':
      actions.push(
        {
          label: 'Start job',
          icon: 'play',
          primary: true,
          run: () => {
            setJobStatus(job.id, 'in-progress');
            toast(`${job.id} started`);
          },
        },
        { label: 'Reschedule', icon: 'calendar', run: schedule },
      );
      more.push({ label: 'Put on hold', icon: 'clock', onSelect: () => setDialog('hold') }, { label: 'Mark complete…', icon: 'check', onSelect: () => setDialog('complete') });
      break;
    case 'in-progress':
      actions.push({ label: 'Mark complete', icon: 'check', primary: true, run: () => setDialog('complete') }, { label: 'Put on hold', icon: 'clock', run: () => setDialog('hold') });
      more.push({ label: 'Reschedule', icon: 'calendar', onSelect: schedule });
      break;
    case 'on-hold':
      actions.push(
        {
          label: 'Resume',
          icon: 'play',
          primary: true,
          run: () => {
            setJobStatus(job.id, job.start ? 'scheduled' : 'requested');
            toast(`${job.id} is back on ${job.start ? 'the schedule' : 'the scheduling list'}`);
          },
        },
        { label: job.start ? 'Reschedule' : 'Schedule', icon: 'calendar', run: schedule },
      );
      break;
    case 'completed':
      actions.push({ label: close.label, icon: close.icon, primary: true, run: close.run });
      if (job.type === 'warranty') more.push({ label: 'Bill parts not covered', icon: 'receipt', onSelect: closeOutAction({ ...job, type: 'repair' }).run });
      if (job.type === 'estimate')
        more.push({
          label: 'Close job',
          icon: 'check-circle',
          onSelect: () => {
            setJobStatus(job.id, 'closed');
            toast(`${job.id} closed`);
          },
        });
      break;
    case 'closed':
      if (invoice) actions.push({ label: `View ${invoice.id}`, icon: 'receipt', primary: true, run: () => navigate(`/office/accounting/?tab=invoices&id=${invoice.id}`) });
      break;
    case 'cancelled':
      actions.push({
        label: 'Reopen',
        icon: 'undo',
        primary: true,
        run: () => {
          setJobStatus(job.id, 'requested');
          toast(`${job.id} reopened`);
        },
      });
      break;
  }
  if (job.status !== 'closed' && job.status !== 'cancelled') {
    more.push({ label: 'Edit job details', icon: 'edit', onSelect: schedule });
    more.push('divider', { label: 'Cancel job', icon: 'x-circle', danger: true, onSelect: () => setDialog('cancel') });
  }

  const warranty = unit ? warrantyMeta[warrantyState(unit)] : undefined;

  return (
    <div class="job-detail">
      <Link to={backTo} class="back-link">
        <Icon name="arrow-left" size={16} /> Jobs & schedule
      </Link>
      <PageHeader
        eyebrow={
          <span class="row job-detail__badges">
            <span>{job.id}</span>
            <StatusBadge meta={type} />
            <StatusBadge meta={jobStatusMeta[job.status]} />
            {job.priority === 'high' && (
              <Badge tone="red" icon="alert">
                High priority
              </Badge>
            )}
          </span>
        }
        title={job.title}
        description={
          <>
            {c ? (
              <Link to={`/office/customers/?id=${c.id}`} class="job-detail__cust">
                {c.name}
              </Link>
            ) : (
              'Unknown customer'
            )}
            {' · '}
            {storeName(job.store)}
            {job.start ? ` · ${dayTime(job.start)}` : ' · Not scheduled yet'}
          </>
        }
        actions={
          <>
            {actions.map((a) => (
              <Button key={a.label} variant={a.primary ? 'primary' : 'secondary'} icon={a.icon} onClick={a.run}>
                {a.label}
              </Button>
            ))}
            {more.length > 0 && <Menu label="More actions" items={more} variant="secondary" />}
          </>
        }
      />

      {job.status === 'on-hold' && job.holdReason && (
        <div class="callout callout--amber job-detail__callout">
          <Icon name="alert" size={18} />
          <div>
            <p class="callout__title">On hold</p>
            <p class="callout__text">{job.holdReason}</p>
          </div>
        </div>
      )}
      {job.status === 'completed' && (
        <div class="callout callout--green job-detail__callout">
          <Icon name="check-circle" size={18} />
          <div>
            <p class="callout__title">Work complete{job.completedAt ? ` — ${dayTime(job.completedAt)}` : ''}</p>
            <p class="callout__text">{job.type === 'estimate' ? 'Next step: send the customer an estimate.' : job.type === 'warranty' ? 'Covered by the manufacturer. Close it out, or bill any parts that weren’t covered.' : 'Ready to bill. Creating the invoice closes the job.'}</p>
          </div>
        </div>
      )}

      <div class="job-grid">
        <div class="job-main">
          <Card title="Scope of work">
            {job.description ? <p class="job-desc">{job.description}</p> : <p class="muted">No description yet.</p>}
            {job.issue && (
              <p class="job-issue">
                <Icon name="wrench" size={14} /> Reported issue: <strong>{issues[job.issue]?.label ?? job.issue}</strong>
              </p>
            )}
            {callbackOf && (
              <p class="job-issue">
                <Icon name="undo" size={14} /> Return visit for <Link to={jobPath(callbackOf.id)}>{callbackOf.id}</Link> ({callbackOf.completedAt ? shortDate(callbackOf.completedAt) : 'earlier visit'})
              </p>
            )}
          </Card>

          <Card title="Checklist" subtitle={`${done} of ${job.checklist.length} done`}>
            <Meter value={done} max={job.checklist.length || 1} tone={done === job.checklist.length ? 'green' : 'ember'} label="Checklist progress" />
            <ul class="checklist-items" role="list">
              {job.checklist.map((item) =>
                job.status === 'closed' || job.status === 'cancelled' ? (
                  <li key={item.id} class={`checklist-ro${item.done ? ' is-done' : ''}`}>
                    <Icon name={item.done ? 'check-circle' : 'minus'} size={16} />
                    <span>{item.label}</span>
                    <span class="sr-only">{item.done ? '(done)' : '(not done)'}</span>
                  </li>
                ) : (
                  <li key={item.id}>
                    <Checkbox checked={item.done} onChange={() => toggleChecklistItem(job.id, item.id)} class={item.done ? 'is-done' : undefined}>
                      {item.label}
                    </Checkbox>
                  </li>
                ),
              )}
            </ul>
          </Card>

          <Parts job={job} />
          <Notes job={job} />
        </div>

        <div class="job-side">
          <Card title="Details">
            <Details
              items={[
                ['When', job.start ? `${dayTime(job.start)} – ${time(addMinutes(job.start, Math.round(job.hours * 60)))}` : 'Not scheduled'],
                [
                  'Crew',
                  crew.length ? (
                    <span class="crew-list">
                      {crew.map((p) => (
                        <span key={p.id} class="crew-list__item">
                          <Avatar person={p} size={22} /> {p.name}
                        </span>
                      ))}
                    </span>
                  ) : (
                    <span class="muted">Not assigned</span>
                  ),
                ],
                ['Estimated time', hours(job.hours)],
                ['Time on site', actualMins !== undefined ? `${duration(actualMins)}${job.startedAt ? ` (arrived ${time(job.startedAt)})` : ''}` : job.startedAt ? `Started ${time(job.startedAt)}` : undefined],
                ['Expected value', job.value ? money(job.value, false) : undefined],
                ['Created', relative(job.createdAt)],
              ]}
            />
            {(lead || estimate || invoice || claim) && (
              <ul class="job-links" role="list">
                {lead && (
                  <li>
                    <Link to={`/office/inbox/?id=${lead.id}`}>
                      <Icon name="inbox" size={14} /> Request {lead.id}
                    </Link>
                  </li>
                )}
                {estimate && (
                  <li>
                    <Link to={`/office/accounting/?tab=estimates&id=${estimate.id}`}>
                      <Icon name="file" size={14} /> Estimate {estimate.id}
                    </Link>
                  </li>
                )}
                {invoice && (
                  <li>
                    <Link to={`/office/accounting/?tab=invoices&id=${invoice.id}`}>
                      <Icon name="receipt" size={14} /> Invoice {invoice.id}
                    </Link>
                  </li>
                )}
                {claim && (
                  <li>
                    <Link to={`/office/warranty/?tab=claims&id=${claim.id}`}>
                      <Icon name="shield" size={14} /> Warranty claim {claim.id}
                    </Link>
                  </li>
                )}
              </ul>
            )}
          </Card>

          {c && (
            <Card
              title="Customer & site"
              actions={
                <Link class="card-link" to={`/office/customers/?id=${c.id}`}>
                  Profile <Icon name="arrow-right" size={14} />
                </Link>
              }
            >
              <p class="site__name">{c.name}</p>
              <p class="muted">{address(c.address)}</p>
              <div class="site__actions">
                <a class="btn btn--secondary btn--sm" href={mapsUrl(c.address)} target="_blank" rel="noopener">
                  <Icon name="map" size={16} /> Directions
                </a>
                {c.phone && (
                  <a class="btn btn--secondary btn--sm" href={telHref(c.phone)}>
                    <Icon name="phone" size={16} /> {phone(c.phone)}
                  </a>
                )}
                {c.email && (
                  <a class="btn btn--ghost btn--sm" href={`mailto:${c.email}`}>
                    <Icon name="mail" size={16} /> Email
                  </a>
                )}
              </div>
              {(unit || model) && (
                <div class="unit-card">
                  <span class="unit-card__icon">
                    <Icon name="flame" size={18} />
                  </span>
                  <div class="unit-card__text">
                    <p class="unit-card__name">{unit ? unitLabel(unit) : `${model!.brand} ${model!.name}`}</p>
                    {unit ? (
                      <p class="muted small">
                        Serial {unit.serial} · {unit.room ? `${unit.room} · ` : ''}installed {shortDate(unit.installedOn, true)}
                        {unit.installedBy === 'Other' ? ' by others' : ''}
                      </p>
                    ) : (
                      <p class="muted small">Being installed on this job</p>
                    )}
                    {unit && warranty && (
                      <p class="unit-card__warranty">
                        <StatusBadge meta={warranty} />
                        {unit.warranty.partsUntil && <span class="muted small">Parts until {shortDate(unit.warranty.partsUntil, true)}</span>}
                      </p>
                    )}
                  </div>
                </div>
              )}
            </Card>
          )}

          {job.type !== 'estimate' && (
          <Card title="Customer sign-off">
            {job.signature ? (
              <div class="signoff">
                {job.signature.image && <img class="signoff__img" src={job.signature.image} alt={`Signature of ${job.signature.name}`} />}
                <p>
                  Signed by <strong>{job.signature.name}</strong>
                </p>
                <p class="muted small">{dayTime(job.signature.at)}</p>
              </div>
            ) : (
              <p class="muted">{job.status === 'closed' || job.status === 'completed' ? 'No signature recorded.' : 'The customer signs on the technician’s phone when the work is done.'}</p>
            )}
            {(job.photos ?? 0) > 0 && (
              <p class="muted small signoff__photos">
                <Icon name="camera" size={14} /> {job.photos} photo{job.photos === 1 ? '' : 's'} from the field
              </p>
            )}
          </Card>
          )}
        </div>
      </div>

      {dialog === 'hold' && <HoldDialog job={job} onClose={() => setDialog(null)} />}
      {dialog === 'complete' && <CompleteDialog job={job} onClose={() => setDialog(null)} />}
      {dialog === 'cancel' && (
        <Confirm
          title={`Cancel ${job.id}?`}
          confirmLabel="Cancel job"
          danger
          onClose={() => setDialog(null)}
          onConfirm={() => {
            setJobStatus(job.id, 'cancelled');
            toast(`${job.id} cancelled — reserved parts were released`);
          }}
        >
          <p>The job comes off the schedule and any parts reserved for it go back into stock. You can reopen it later.</p>
        </Confirm>
      )}
    </div>
  );
}
