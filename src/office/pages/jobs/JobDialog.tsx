/** Create or edit a job: who, what, where, when and which crew. */
import { useMemo, useState } from 'preact/hooks';
import { addJobPart, createJob, defaultHours, removeJobPart, scheduleJob, updateJob } from '../../actions';
import { jobTypeLabels } from '../../data/catalog';
import type { DialogRequest } from '../../dialogs';
import type { Item, JobType, StoreId } from '../../data/types';
import { addDays, now, today, weekday } from '../../lib/dates';
import { navigate } from '../../router';
import { available, customerOf, itemLabel, itemOf, storeName, unitLabel } from '../../selectors';
import { db, me, ui } from '../../store';
import { toast } from '../../toast';
import { Avatar, Button, Field } from '../../ui/core';
import { Dialog } from '../../ui/Dialog';
import { Icon } from '../../ui/Icon';
import { CustomerPicker, ItemPicker } from '../../ui/pickers';
import { bookedHours, fieldStaff, firstFreeStart, jobPath } from './helpers';

type Preset = Extract<DialogRequest, { kind: 'job' }>['preset'];

const TYPES: JobType[] = ['maintenance', 'repair', 'warranty', 'install', 'estimate', 'delivery'];
const SERVICE_TYPES: JobType[] = ['maintenance', 'repair', 'warranty'];

function nextBusinessDay(day: string) {
  let d = addDays(day, 1);
  while (weekday(d) === 0) d = addDays(d, 1);
  return d;
}

export function JobDialog({ jobId, preset, onClose }: { jobId?: string; preset?: Preset; onClose: () => void }) {
  const d = db.value;
  const job = jobId ? d.jobs.find((j) => j.id === jobId) : undefined;
  const presetCustomer = customerOf(d, preset?.customerId ?? job?.customerId);
  const fallbackStore: StoreId = ui.value.store !== 'all' ? ui.value.store : me.value && me.value.store !== 'both' ? me.value.store : 'osage-beach';

  const [type, setType] = useState<JobType>(job?.type ?? preset?.type ?? 'repair');
  const [customerId, setCustomerId] = useState<string | undefined>(job?.customerId ?? preset?.customerId);
  const [unitId, setUnitId] = useState<string | undefined>(job?.unitId ?? preset?.unitId);
  const [itemId, setItemId] = useState<string | undefined>(job?.itemId ?? preset?.itemId);
  const [store, setStore] = useState<StoreId>(job?.store ?? preset?.store ?? presetCustomer?.store ?? fallbackStore);
  const [title, setTitle] = useState(job?.title ?? preset?.title ?? '');
  const [description, setDescription] = useState(job?.description ?? preset?.description ?? '');
  const [date, setDate] = useState(job?.start?.slice(0, 10) ?? '');
  const [timeOfDay, setTimeOfDay] = useState(job?.start?.slice(11, 16) ?? '');
  const [hrs, setHrs] = useState<number>(job?.hours ?? defaultHours(d, job?.type ?? preset?.type ?? 'repair', preset?.itemId, preset?.unitId));
  const [hoursTouched, setHoursTouched] = useState(!!job);
  const [crew, setCrew] = useState<string[]>(job?.crew ?? []);
  const [priority, setPriority] = useState<'normal' | 'high'>(job?.priority ?? 'normal');
  const [error, setError] = useState('');

  const customer = customerOf(d, customerId);
  const units = customer ? d.units.filter((u) => u.customerId === customer.id) : [];
  const model = itemOf(d, itemId);
  const people = useMemo(() => fieldStaff(d, store).filter((s) => (type === 'estimate' ? true : s.tech || crew.includes(s.id))), [d, store, type, crew]);
  const isService = SERVICE_TYPES.includes(type);

  // Keep the estimated duration in step with the job type unless someone typed one
  const refreshHours = (t: JobType, item?: string, unit?: string) => {
    if (!hoursTouched) setHrs(defaultHours(d, t, item, unit));
  };

  const pickCustomer = (id: string | undefined) => {
    setCustomerId(id);
    setUnitId(undefined);
    const c = customerOf(db.value, id);
    if (c && !job) setStore(c.store);
  };

  const toggleCrew = (id: string) => setCrew((list) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]));

  /** First day (from the chosen date, or today) when the lead person has room for the job */
  const suggestTime = () => {
    const lead = crew[0] ?? people[0]?.id;
    if (!lead) return;
    const t = today();
    let day = date && date >= t ? date : weekday(t) !== 0 && now() < `${t}T15:00` ? t : nextBusinessDay(t);
    let start = firstFreeStart(db.value, lead, day, hrs, job?.id);
    for (let i = 0; i < 12 && (start.slice(11, 16) > '16:30' || (day === t && start < now())); i++) {
      day = nextBusinessDay(day);
      start = firstFreeStart(db.value, lead, day, hrs, job?.id);
    }
    setDate(day);
    setTimeOfDay(start.slice(11, 16));
    if (!crew.length) setCrew([lead]);
    setError('');
  };

  const submit = (e?: Event) => {
    e?.preventDefault();
    if (!customerId) return setError('Choose a customer for this job.');
    if ((date && !timeOfDay) || (!date && timeOfDay)) return setError('Set both a date and a start time — or leave both empty to schedule later.');
    if (!(hrs > 0)) return setError('Enter how long the job should take.');
    const start = date && timeOfDay ? `${date}T${timeOfDay}` : undefined;

    if (job) {
      const prevItem = job.itemId;
      updateJob(job.id, {
        type,
        customerId,
        unitId: isService ? unitId : type === 'install' ? job.unitId : undefined,
        itemId: type === 'install' ? itemId : job.itemId,
        store,
        title: title.trim() || job.title,
        description,
        hours: hrs,
        priority,
      });
      // Swap the reserved unit when the model on an install changes
      if (type === 'install' && itemId && itemId !== prevItem) {
        const i = job.parts.findIndex((p) => p.itemId === prevItem && p.status === 'reserved');
        if (i >= 0) removeJobPart(job.id, i);
        addJobPart(job.id, itemId, 1, store);
      }
      if (start !== job.start || crew.join() !== job.crew.join()) scheduleJob(job.id, start, crew);
      toast(`${job.id} updated`);
      onClose();
      return;
    }

    const id = createJob({
      type,
      customerId,
      store,
      title: title.trim() || undefined,
      description: description.trim(),
      unitId: isService ? unitId : undefined,
      itemId: type === 'install' ? itemId : undefined,
      leadId: preset?.leadId,
      start,
      hours: hrs,
      crew,
      priority,
    });
    toast(`${id} created${start ? ' and scheduled' : ' — it’s in Needs scheduling'}`, { tone: 'success' });
    onClose();
    navigate(jobPath(id));
  };

  const dayForLoad = date || undefined;

  return (
    <Dialog
      title={job ? `Edit ${job.id}` : 'New job'}
      description={job ? job.title : preset?.leadId ? `From request ${preset.leadId}` : 'Book an install, service call, warranty visit or site visit.'}
      size="lg"
      onClose={onClose}
      footer={
        <>
          {error && (
            <p class="job-form__error" role="alert">
              <Icon name="alert" size={16} /> {error}
            </p>
          )}
          <span class="spacer" />
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" icon={job ? 'check' : 'plus'} onClick={() => submit()}>
            {job ? 'Save changes' : date && timeOfDay ? 'Create & schedule' : 'Create job'}
          </Button>
        </>
      }
    >
      <form class="job-form" onSubmit={submit}>
        <div class="form-grid">
          <Field label="Type of job">
            <select
              class="select"
              value={type}
              onChange={(e) => {
                const t = (e.target as HTMLSelectElement).value as JobType;
                setType(t);
                refreshHours(t, itemId, unitId);
                setError('');
              }}
            >
              {TYPES.map((t) => (
                <option key={t} value={t}>
                  {jobTypeLabels[t]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Showroom">
            <select class="select" value={store} onChange={(e) => setStore((e.target as HTMLSelectElement).value as StoreId)}>
              <option value="osage-beach">Osage Beach</option>
              <option value="nixa">Nixa</option>
            </select>
          </Field>

          <div class="span-2">
            <CustomerPicker value={customerId} onChange={(id) => (pickCustomer(id), setError(''))} store={store} autoFocus={!customerId} />
          </div>

          {isService && customer && (
            <Field label="Appliance" class="span-2" hint={units.length ? undefined : 'No appliances on file for this customer yet.'}>
              <select
                class="select"
                value={unitId ?? ''}
                onChange={(e) => {
                  const v = (e.target as HTMLSelectElement).value || undefined;
                  setUnitId(v);
                  refreshHours(type, itemId, v);
                }}
              >
                <option value="">No specific appliance</option>
                {units.map((u) => (
                  <option key={u.id} value={u.id}>
                    {unitLabel(u)} — {u.room ?? 'room not noted'}, serial {u.serial}
                  </option>
                ))}
              </select>
            </Field>
          )}

          {type === 'install' && (
            <div class="span-2">
              {model ? (
                <div class="field">
                  <span class="field__label">Model to install</span>
                  <div class="picked">
                    <span class="picked__icon">
                      <Icon name="flame" size={16} />
                    </span>
                    <span class="picked__text">
                      <strong>{itemLabel(model)}</strong>
                      <span class="muted small">
                        {model.id} · {available(model, store)} available at {storeName(store)}
                      </span>
                    </span>
                    <Button size="sm" variant="ghost" onClick={() => setItemId(undefined)}>
                      Change
                    </Button>
                  </div>
                </div>
              ) : (
                <ItemPicker
                  store={store}
                  label="Model to install"
                  placeholder="Search fireplaces, inserts, stoves…"
                  filter={(it: Item) => it.kind === 'unit'}
                  onSelect={(it) => {
                    setItemId(it.id);
                    refreshHours(type, it.id, unitId);
                  }}
                />
              )}
            </div>
          )}

          <Field label="Title" optional class="span-2" hint="Leave blank and we’ll name it from the job type and appliance.">
            <input class="input" value={title} onInput={(e) => setTitle((e.target as HTMLInputElement).value)} />
          </Field>
          <Field label="Notes for the crew" optional class="span-2">
            <textarea class="textarea" rows={3} value={description} placeholder="What the customer reported, gate codes, what to bring…" onInput={(e) => setDescription((e.target as HTMLTextAreaElement).value)} />
          </Field>
        </div>

        <fieldset class="job-form__when">
          <legend class="field__label">When</legend>
          <div class="job-form__when-row">
            <Field label="Date">
              <input class="input" type="date" value={date} onInput={(e) => setDate((e.target as HTMLInputElement).value)} />
            </Field>
            <Field label="Start time">
              <input class="input" type="time" step={900} value={timeOfDay} onInput={(e) => setTimeOfDay((e.target as HTMLInputElement).value)} />
            </Field>
            <Field label="Hours on site">
              <input
                class="input"
                type="number"
                min={0.25}
                step={0.25}
                value={hrs}
                onInput={(e) => {
                  setHrs(Number((e.target as HTMLInputElement).value));
                  setHoursTouched(true);
                }}
              />
            </Field>
            <Button size="sm" variant="ghost" icon="sparkle" onClick={suggestTime} class="job-form__suggest">
              Find the next opening
            </Button>
          </div>
          {!date && <p class="muted small">No date yet? Leave it blank — the job goes to Needs scheduling.</p>}
        </fieldset>

        <fieldset class="job-form__crew">
          <legend class="field__label">
            Crew <span class="field__optional">· {storeName(store)}</span>
          </legend>
          <ul class="crew-pick" role="list">
            {people.map((p) => {
              const booked = dayForLoad ? bookedHours(d, p.id, dayForLoad, job?.id) : 0;
              const checked = crew.includes(p.id);
              return (
                <li key={p.id}>
                  <label class={`crew-pick__item${checked ? ' is-checked' : ''}`}>
                    <input type="checkbox" checked={checked} onChange={() => toggleCrew(p.id)} />
                    <Avatar person={p} size={28} />
                    <span class="crew-pick__text">
                      <span class="crew-pick__name">{p.name}</span>
                      <span class="crew-pick__meta">
                        {p.title}
                        {dayForLoad ? ` · ${booked ? `${booked} h booked` : 'open'}` : ''}
                      </span>
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
        </fieldset>

        <label class="check job-form__priority">
          <input type="checkbox" checked={priority === 'high'} onChange={(e) => setPriority((e.target as HTMLInputElement).checked ? 'high' : 'normal')} />
          <span class="check__box" aria-hidden="true">
            <Icon name="check" size={13} stroke={3} />
          </span>
          <span class="check__label">High priority — no heat, gas smell follow-up, or a promised date</span>
        </label>
      </form>
    </Dialog>
  );
}
