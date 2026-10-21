/**
 * My day — the technician's phone view: today's stops in order, then one stop at a time with
 * checklist, parts, photos, notes and the customer's signature.
 */
import { useState } from 'preact/hooks';
import { addJobNote, addJobPart, setJobStatus, toggleChecklistItem, completeJob } from '../../actions';
import { issues } from '../../data/catalog';
import type { Job, Staff } from '../../data/types';
import { addDays, addMinutes, diffMinutes, today } from '../../lib/dates';
import { dayLabel, duration, longDate, phone, plural, telHref, time, mapsUrl, shortDate } from '../../lib/format';
import { param, setParams } from '../../router';
import { customerOf, itemLabel, itemOf, jobsOn, staffOf, storeName, unitLabel, unitOf, warrantyState } from '../../selectors';
import { db, me, ui } from '../../store';
import { toast } from '../../toast';
import { Avatar, Badge, Button, Card, Checkbox, cx, EmptyState, Field, Link, LinkButton, Meter, PageHeader, Segmented } from '../../ui/core';
import { Icon } from '../../ui/Icon';
import { ItemPicker } from '../../ui/pickers';
import { StatusBadge, jobStatusMeta, jobTypeMeta, warrantyMeta } from '../../ui/status';
import { addJobPhoto, defaultTimes, jobPath } from '../jobs/helpers';
import { SignaturePad } from './SignaturePad';

const stopPath = (id: string) => `/office/my-day/?id=${id}`;
const endOf = (j: Job) => addMinutes(j.start!, Math.round(j.hours * 60));
const isDone = (j: Job) => j.status === 'completed' || j.status === 'closed';
const smsHref = (p: string) => `sms:+1${p.replace(/\D/g, '').slice(-10)}`;
const doneMeta = { label: 'Done', tone: 'green' as const, icon: 'check-circle' as const };
const stopStatus = (j: Job) => (isDone(j) ? doneMeta : jobStatusMeta[j.status]);

function myStops(day: string, user: Staff) {
  return db.value.jobs
    .filter((j) => j.start && j.start.slice(0, 10) === day && j.crew.includes(user.id) && j.status !== 'cancelled')
    .sort((a, b) => (a.start! < b.start! ? -1 : 1));
}

export default function MyDay() {
  const id = param('id');
  return id ? <Stop key={id} id={id} /> : <DayList />;
}

/* ---------- The day ---------- */

function StopCard({ job, index }: { job: Job; index: number }) {
  const d = db.value;
  const c = customerOf(d, job.customerId);
  const unit = unitOf(d, job.unitId);
  const type = jobTypeMeta[job.type];
  const bring = job.parts.filter((p) => p.status === 'reserved');
  const done = job.checklist.filter((x) => x.done).length;
  const cta = job.status === 'scheduled' ? 'Start' : job.status === 'in-progress' ? 'Continue' : 'View';
  return (
    <li class={cx('stop', `jt--${type.tone}`, isDone(job) && 'is-done', job.status === 'in-progress' && 'is-active')}>
      <div class="stop__rail" aria-hidden="true">
        <span class="stop__num">{isDone(job) ? <Icon name="check" size={14} stroke={2.6} /> : index + 1}</span>
      </div>
      <article class="stop__card" aria-labelledby={`stop-${job.id}`}>
        <div class="stop__head">
          <p class="stop__time">
            {time(job.start!)} – {time(endOf(job))}
          </p>
          <StatusBadge meta={stopStatus(job)} />
        </div>
        <h2 class="stop__title" id={`stop-${job.id}`}>
          <Link to={stopPath(job.id)}>{c?.name ?? 'Customer'}</Link>
        </h2>
        <p class="stop__what">
          <Icon name={type.icon} size={14} /> {job.title}
        </p>
        {c && (
          <p class="stop__addr">
            <Icon name="pin" size={14} /> {c.address.street}, {c.address.city}
          </p>
        )}
        {unit && (
          <p class="stop__unit">
            {unitLabel(unit)} <span class="muted">· serial {unit.serial}</span> <StatusBadge meta={warrantyMeta[warrantyState(unit)]} />
          </p>
        )}
        {job.description && <p class="stop__notes">{job.description}</p>}
        {bring.length > 0 && !isDone(job) && (
          <p class="stop__bring">
            <Icon name="box" size={14} /> Bring: {bring.map((p) => `${p.qty} × ${itemOf(d, p.itemId)?.name ?? p.itemId}`).join(', ')}
          </p>
        )}
        {job.status === 'in-progress' && (
          <div class="stop__progress">
            <Meter value={done} max={job.checklist.length || 1} tone="ember" label="Checklist progress" />
            <span class="muted small">
              {done} of {job.checklist.length} checklist items
            </span>
          </div>
        )}
        <div class="stop__actions">
          {c?.phone && (
            <a class="btn btn--secondary" href={telHref(c.phone)} aria-label={`Call ${c.name}`}>
              <Icon name="phone" size={18} /> <span>Call</span>
            </a>
          )}
          {c && (
            <a class="btn btn--secondary" href={mapsUrl(c.address)} target="_blank" rel="noopener" aria-label={`Directions to ${c.address.street}`}>
              <Icon name="map" size={18} /> <span>Directions</span>
            </a>
          )}
          <LinkButton to={stopPath(job.id)} variant={isDone(job) ? 'secondary' : 'primary'} iconRight="arrow-right" aria-label={`${cta}: ${c?.name ?? job.title}`}>
            {cta}
          </LinkButton>
        </div>
      </article>
    </li>
  );
}

function TeamDay({ day }: { day: string }) {
  const d = db.value;
  const jobs = jobsOn(d, day, ui.value.store).filter((j) => j.crew.length);
  const byPerson = new Map<string, Job[]>();
  for (const j of jobs) for (const id of j.crew) byPerson.set(id, [...(byPerson.get(id) ?? []), j]);
  const people = [...byPerson.keys()].map((id) => staffOf(d, id)!).filter(Boolean).sort((a, b) => Number(!!b.tech) - Number(!!a.tech) || a.name.localeCompare(b.name));
  if (!jobs.length) {
    return (
      <EmptyState icon="calendar" title={`No one is scheduled ${dayLabel(day).toLowerCase() === 'today' ? 'today' : `on ${dayLabel(day)}`}`}>
        Jobs show up here once they’re on the schedule.
      </EmptyState>
    );
  }
  return (
    <>
      <div class="callout callout--blue myday__team-note">
        <Icon name="info" size={18} />
        <div>
          <p class="callout__title">You don’t have any stops {dayLabel(day).toLowerCase() === 'today' ? 'today' : `on ${dayLabel(day)}`}</p>
          <p class="callout__text">Here’s the whole team’s day instead. Technicians see only their own stops on this page — sign in as Luis to try it.</p>
        </div>
      </div>
      <div class="team-day">
        {people.map((p) => (
          <Card
            key={p.id}
            level={2}
            title={
              <span class="team-day__who">
                <Avatar person={p} size={28} /> {p.name}
              </span>
            }
            subtitle={`${p.title} · ${plural(byPerson.get(p.id)!.length, 'stop')}`}
            flush
          >
            <ul class="team-day__list" role="list">
              {byPerson.get(p.id)!.map((j) => {
                const c = customerOf(d, j.customerId);
                return (
                  <li key={j.id}>
                    <Link to={jobPath(j.id)} class={cx('team-day__row', `jt--${jobTypeMeta[j.type].tone}`)}>
                      <span class="team-day__time">{time(j.start!)}</span>
                      <span class="team-day__main">
                        <span class="team-day__title">{c?.name}</span>
                        <span class="muted small">
                          {jobTypeMeta[j.type].label} · {c?.address.city}
                        </span>
                      </span>
                      <StatusBadge meta={jobStatusMeta[j.status]} />
                    </Link>
                  </li>
                );
              })}
            </ul>
          </Card>
        ))}
      </div>
    </>
  );
}

function DayList() {
  const user = me.value!;
  const t = today();
  const raw = param('day');
  const day = raw && /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : t;
  const stops = myStops(day, user);
  const doneCount = stops.filter(isDone).length;
  const next = stops.find((j) => !isDone(j));
  const tomorrow = day === t ? myStops(addDays(t, 1), user) : [];
  const days = [addDays(t, -1), t, addDays(t, 1)];
  const dayOptions = days.map((k, i) => ({ key: k, label: ['Yesterday', 'Today', 'Tomorrow'][i] }));
  const totalHours = stops.reduce((s, j) => s + j.hours, 0);

  return (
    <div class="myday">
      <PageHeader
        eyebrow={longDate(day)}
        title="My day"
        description={stops.length ? `${plural(stops.length, 'stop')} · first at ${time(stops[0].start!)} · about ${Math.round(totalHours * 10) / 10} h of work` : `${user.name.split(' ')[0]}, you have no stops ${day === t ? 'today' : `on ${dayLabel(day)}`}.`}
        actions={
          days.includes(day) ? (
            <Segmented label="Day" size="sm" items={dayOptions} value={day} onChange={(k) => setParams({ day: k === t ? undefined : k }, { replace: true })} />
          ) : (
            <Button size="sm" variant="secondary" onClick={() => setParams({ day: undefined }, { replace: true })}>
              Back to today
            </Button>
          )
        }
      />

      {stops.length > 0 && (
        <div class="myday__summary card">
          <div class="myday__summary-text">
            <p class="myday__summary-title">{doneCount === stops.length ? 'All done — nice work.' : next ? `Next: ${time(next.start!)} · ${customerOf(db.value, next.customerId)?.name ?? next.title}` : ''}</p>
            <p class="muted small">
              {doneCount} of {stops.length} stops finished
            </p>
          </div>
          <Meter value={doneCount} max={stops.length} tone="green" label="Stops finished" />
        </div>
      )}

      {stops.length > 0 ? (
        <ol class="stops" role="list">
          {stops.map((j, i) => (
            <StopCard key={j.id} job={j} index={i} />
          ))}
        </ol>
      ) : user.role === 'tech' ? (
        <EmptyState icon="sun" title={`No stops ${day === t ? 'today' : `on ${dayLabel(day)}`}`}>
          When the office schedules you, your stops show up here in order.
        </EmptyState>
      ) : (
        <TeamDay day={day} />
      )}

      {day === t && stops.length > 0 && (
        <section class="myday__tomorrow" aria-labelledby="tomorrow-title">
          <h2 id="tomorrow-title" class="section-label">
            Tomorrow · {shortDate(addDays(t, 1))}
          </h2>
          {tomorrow.length ? (
            <ul class="tomorrow" role="list">
              {tomorrow.map((j) => {
                const c = customerOf(db.value, j.customerId);
                return (
                  <li key={j.id}>
                    <Link to={stopPath(j.id)} class="tomorrow__row">
                      <span class="tomorrow__time">{time(j.start!)}</span>
                      <span class="tomorrow__main">
                        <span class="tomorrow__title">{c?.name}</span>
                        <span class="muted small">
                          {jobTypeMeta[j.type].label} · {c?.address.city}
                        </span>
                      </span>
                      <Icon name="chevron-right" size={16} />
                    </Link>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p class="muted">Nothing on the schedule yet.</p>
          )}
        </section>
      )}
    </div>
  );
}

/* ---------- One stop ---------- */

function Stop({ id }: { id: string }) {
  const d = db.value;
  const user = me.value!;
  const job = d.jobs.find((j) => j.id === id);
  const c = customerOf(d, job?.customerId);
  const [arriveEdit, setArrive] = useState<string | null>(null);
  const [finishEdit, setFinishT] = useState<string | null>(null);
  const [signer, setSigner] = useState(c?.contact ?? c?.name.split(' & ')[0] ?? '');
  const [signature, setSignature] = useState<string | null>(null);
  const [typed, setTyped] = useState(false);
  const [note, setNote] = useState('');
  const [justDone, setJustDone] = useState(false);

  if (!job) {
    return (
      <div class="myday">
        <Link to="/office/my-day/" class="back-link">
          <Icon name="arrow-left" size={16} /> My day
        </Link>
        <EmptyState icon="clipboard" title="Stop not found">
          {id} isn’t in this demo’s data.
        </EmptyState>
      </div>
    );
  }

  const unit = unitOf(d, job.unitId);
  const model = itemOf(d, job.itemId);
  const type = jobTypeMeta[job.type];
  const checked = job.checklist.filter((x) => x.done).length;
  // Defaults follow the job (arrival = when it was started) until someone edits the times
  const times = defaultTimes(job);
  const arrive = arriveEdit ?? times.arrivedAt.slice(11, 16);
  const finishT = finishEdit ?? times.finishedAt.slice(11, 16);
  const baseDay = times.arrivedAt.slice(0, 10);
  const arrivedAt = `${baseDay}T${arrive}`;
  // Time-only inputs: a finish earlier than the arrival means the work ran past midnight
  const finishedAt = finishT < arrive ? addDays(`${baseDay}T${finishT}`, 1) : `${baseDay}T${finishT}`;
  const mins = arrive && finishT ? diffMinutes(finishedAt, arrivedAt) : 0;
  const signed = typed ? signer.trim().length > 1 : !!signature;
  const canFinish = mins > 0 && signer.trim().length > 1 && signed;
  const nextStop = myStops(job.start?.slice(0, 10) ?? today(), user).find((j) => j.id !== job.id && !isDone(j) && (j.start ?? '') > (job.start ?? ''));
  const onMyCrew = job.crew.includes(user.id);

  const complete = () => {
    if (!canFinish) return;
    completeJob(job.id, { arrivedAt, finishedAt, note: note.trim() || undefined, signature: { name: signer.trim(), image: typed ? undefined : signature ?? undefined } });
    setJustDone(true);
    window.scrollTo({ top: 0 });
  };

  if (justDone) {
    return (
      <div class="myday">
        <div class="done-panel card" role="status">
          <span class="done-panel__icon">
            <Icon name="check" size={30} stroke={2.6} />
          </span>
          <h1 class="done-panel__title" data-page-title tabIndex={-1}>
            Job complete
          </h1>
          <p class="muted">
            {c?.name} signed off at {time(finishedAt)}. The office has been notified and can invoice it right away.
          </p>
          <div class="done-panel__actions">
            {nextStop ? (
              <LinkButton to={stopPath(nextStop.id)} variant="primary" iconRight="arrow-right">
                Next stop: {time(nextStop.start!)} · {customerOf(d, nextStop.customerId)?.name}
              </LinkButton>
            ) : null}
            <LinkButton to="/office/my-day/" variant={nextStop ? 'secondary' : 'primary'}>
              Back to my day
            </LinkButton>
          </div>
        </div>
      </div>
    );
  }

  const status = job.status;

  return (
    <div class="myday myday--stop">
      <Link to="/office/my-day/" class="back-link">
        <Icon name="arrow-left" size={16} /> My day
      </Link>

      <header class={cx('stop-hero card', `jt--${type.tone}`)}>
        <div class="stop-hero__top">
          <span class="stop-hero__time">
            {job.start ? `${dayLabel(job.start)} · ${time(job.start)} – ${time(endOf(job))}` : 'Not scheduled'}
          </span>
          <StatusBadge meta={stopStatus(job)} />
        </div>
        <h1 class="stop-hero__name" data-page-title tabIndex={-1}>
          {c?.name ?? 'Customer'}
        </h1>
        <p class="stop-hero__what">
          <Icon name={type.icon} size={15} /> {job.title} <span class="muted">· {job.id}</span>
        </p>
        {c && (
          <p class="stop-hero__addr">
            <Icon name="pin" size={15} /> {c.address.street}, {c.address.city}, {c.address.state} {c.address.zip}
          </p>
        )}
        {c && (
          <div class="stop-hero__actions">
            {c.phone && (
              <a class="btn btn--secondary" href={telHref(c.phone)}>
                <Icon name="phone" size={18} /> <span>Call</span>
              </a>
            )}
            {c.phone && (
              <a class="btn btn--secondary" href={smsHref(c.phone)}>
                <Icon name="message" size={18} /> <span>Text</span>
              </a>
            )}
            <a class="btn btn--secondary" href={mapsUrl(c.address)} target="_blank" rel="noopener">
              <Icon name="map" size={18} /> <span>Directions</span>
            </a>
          </div>
        )}
        {c?.phone && <p class="muted small stop-hero__phone">{phone(c.phone)}</p>}
      </header>

      {!onMyCrew && (
        <p class="callout callout--blue">
          <Icon name="info" size={18} />
          <span>You’re not on this job’s crew — you can still follow along.</span>
        </p>
      )}

      {status === 'scheduled' && (
        <div class="start-panel">
          <Button
            variant="primary"
            icon="play"
            class="btn--xl"
            onClick={() => {
              setJobStatus(job.id, 'in-progress');
              toast('Job started — the office can see you’re on site');
            }}
          >
            I’m here — start job
          </Button>
          <p class="muted small">Starting the job records your arrival time. You can adjust it when the customer signs.</p>
        </div>
      )}

      {(unit || model || job.description || job.issue) && (
        <Card title="What you’re working on" level={2}>
          {(unit || model) && (
            <div class="unit-card">
              <span class="unit-card__icon">
                <Icon name="flame" size={18} />
              </span>
              <div class="unit-card__text">
                <p class="unit-card__name">{unit ? unitLabel(unit) : itemLabel(model!)}</p>
                {unit ? (
                  <>
                    <p class="muted small">
                      Serial {unit.serial} · {unit.fuel}
                      {unit.room ? ` · ${unit.room}` : ''} · installed {shortDate(unit.installedOn, true)}
                      {unit.installedBy === 'Other' ? ' by others' : ''}
                    </p>
                    <p class="unit-card__warranty">
                      <StatusBadge meta={warrantyMeta[warrantyState(unit)]} />
                      {unit.warranty.partsUntil && <span class="muted small">Parts until {shortDate(unit.warranty.partsUntil, true)}</span>}
                    </p>
                  </>
                ) : (
                  <p class="muted small">New install · from {storeName(job.store)} stock</p>
                )}
              </div>
            </div>
          )}
          {job.issue && (
            <p class="stop-issue">
              <Icon name="wrench" size={15} /> Reported: <strong>{issues[job.issue]?.label ?? job.issue}</strong>
            </p>
          )}
          {job.description && <p class="stop-office-notes">{job.description}</p>}
        </Card>
      )}

      <Card title="Checklist" subtitle={`${checked} of ${job.checklist.length} done`} level={2}>
        <Meter value={checked} max={job.checklist.length || 1} tone={checked === job.checklist.length ? 'green' : 'ember'} label="Checklist progress" />
        <ul class="big-checks" role="list">
          {job.checklist.map((item) => (
            <li key={item.id}>
              <Checkbox checked={item.done} onChange={() => toggleChecklistItem(job.id, item.id)} class={cx('big-check', item.done && 'is-done')}>
                {item.label}
              </Checkbox>
            </li>
          ))}
        </ul>
      </Card>

      <Card title="Parts" subtitle={job.parts.length ? 'Reserved parts are marked used when you finish' : 'Nothing reserved for this job'} level={2}>
        {job.parts.length > 0 && (
          <ul class="stop-parts" role="list">
            {job.parts.map((p, i) => {
              const it = itemOf(d, p.itemId);
              return (
                <li key={`${p.itemId}-${i}`}>
                  <span>
                    <strong>{p.qty} ×</strong> {it ? itemLabel(it) : p.itemId}
                  </span>
                  <Badge tone={p.status === 'used' ? 'green' : 'blue'} icon={p.status === 'used' ? 'check' : 'box'}>
                    {p.status === 'used' ? 'Used' : 'In the van'}
                  </Badge>
                </li>
              );
            })}
          </ul>
        )}
        {!isDone(job) && (
          <ItemPicker
            store={job.store}
            label="Used something else? Add a part"
            placeholder="Search parts by name or SKU"
            onSelect={(it) => addJobPart(job.id, it.id, 1, job.store)}
          />
        )}
      </Card>

      <Card title="Photos & notes" level={2}>
        <div class="photo-row">
          {Array.from({ length: job.photos ?? 0 }, (_, i) => (
            <span key={i} class="photo-tile" role="img" aria-label={`Photo ${i + 1}`}>
              <Icon name="camera" size={18} />
              <span>Photo {i + 1}</span>
            </span>
          ))}
          {!isDone(job) && (
            <button
              type="button"
              class="photo-tile photo-tile--add"
              onClick={() => addJobPhoto(job.id)}
              aria-label="Add photo (demo — adds a placeholder)"
            >
              <Icon name="plus" size={18} />
              <span>Add photo</span>
            </button>
          )}
        </div>
        {!isDone(job) && (
          <form
            class="note-form"
            onSubmit={(e) => {
              e.preventDefault();
              if (!note.trim()) return;
              addJobNote(job.id, note.trim());
              setNote('');
              toast('Note saved to the job');
            }}
          >
            <label class="field__label" for="stop-note">
              Note for the office
            </label>
            <textarea id="stop-note" class="textarea" rows={3} value={note} placeholder="What you found, what you did, anything to follow up" onInput={(e) => setNote((e.target as HTMLTextAreaElement).value)} />
            <Button type="submit" variant="secondary" icon="send" disabled={!note.trim()}>
              Save note
            </Button>
          </form>
        )}
      </Card>

      {status === 'in-progress' && (
        <Card title="Finish & get a signature" subtitle="The customer signs on your screen" level={2} class="finish-card">
          <div class="finish-times">
            <Field label="Arrived">
              <input class="input" type="time" value={arrive} onInput={(e) => setArrive((e.target as HTMLInputElement).value)} />
            </Field>
            <Field label="Finished">
              <input class="input" type="time" value={finishT} aria-invalid={mins <= 0} onInput={(e) => setFinishT((e.target as HTMLInputElement).value)} />
            </Field>
          </div>
          <p class={mins > 0 ? 'muted small' : 'is-bad small'}>{mins > 0 ? `Time on site: ${duration(mins)}` : 'Finish time must be after arrival.'}</p>
          <Field label="Customer name">
            <input class="input" value={signer} autocomplete="off" onInput={(e) => setSigner((e.target as HTMLInputElement).value)} />
          </Field>
          {typed ? (
            <div class="typed-sig" aria-live="polite">
              <span class="typed-sig__name">{signer || 'Customer name'}</span>
              <span class="muted small">Signed by typing their name</span>
            </div>
          ) : (
            <SignaturePad label="Customer signature" onChange={setSignature} />
          )}
          <button type="button" class="link-btn finish-card__alt" onClick={() => setTyped(!typed)}>
            {typed ? 'Draw a signature instead' : 'Can’t draw? Sign by typing the name instead'}
          </button>
          <Button variant="primary" icon="check" class="btn--xl finish-card__submit" disabled={!canFinish} onClick={complete}>
            Mark job complete
          </Button>
          {!canFinish && <p class="muted small">{!signed ? 'Waiting for the customer’s signature.' : signer.trim().length < 2 ? 'Add the customer’s name.' : 'Check the arrival and finish times.'}</p>}
        </Card>
      )}

      {isDone(job) && (
        <Card title="Signed off" level={2}>
          {job.signature ? (
            <div class="signoff">
              {job.signature.image && <img class="signoff__img" src={job.signature.image} alt={`Signature of ${job.signature.name}`} />}
              <p>
                {job.signature.name} · {time(job.signature.at)}
              </p>
            </div>
          ) : (
            <p class="muted">Completed {job.completedAt ? `at ${time(job.completedAt)}` : ''} without a signature.</p>
          )}
          {job.startedAt && job.completedAt && <p class="muted small">Time on site: {duration(diffMinutes(job.completedAt, job.startedAt))}</p>}
        </Card>
      )}

      {(status === 'on-hold' || status === 'requested') && (
        <p class="callout callout--amber">
          <Icon name="alert" size={18} />
          <span>{status === 'on-hold' ? `On hold — ${job.holdReason ?? 'check with the office'}` : 'This job isn’t scheduled yet.'}</span>
        </p>
      )}
    </div>
  );
}
