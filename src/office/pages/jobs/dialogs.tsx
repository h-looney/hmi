/** Small dialogs used by the board and the job page: put on hold, mark complete. */
import { useState } from 'preact/hooks';
import { completeJob, setJobStatus } from '../../actions';
import type { Job } from '../../data/types';
import { diffMinutes } from '../../lib/dates';
import { duration } from '../../lib/format';
import { customerOf } from '../../selectors';
import { db } from '../../store';
import { toast } from '../../toast';
import { Button, Field } from '../../ui/core';
import { Dialog } from '../../ui/Dialog';
import { closeOutAction, defaultTimes } from './helpers';

const HOLD_REASONS = ['Waiting on parts', 'Waiting on the customer', 'Waiting on a permit or inspection', 'Weather', 'Other'];

export function HoldDialog({ job, onClose }: { job: Job; onClose: () => void }) {
  const [reason, setReason] = useState(HOLD_REASONS[0]);
  const [details, setDetails] = useState('');
  const submit = (e?: Event) => {
    e?.preventDefault();
    const text = details.trim();
    setJobStatus(job.id, 'on-hold', { holdReason: text ? `${reason} — ${text}` : reason });
    toast(`${job.id} is on hold`);
    onClose();
  };
  return (
    <Dialog
      title="Put this job on hold"
      description={`${job.id} · ${job.title}`}
      size="sm"
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={() => submit()}>
            Put on hold
          </Button>
        </>
      }
    >
      <form class="stack" onSubmit={submit}>
        <Field label="Reason">
          <select class="select" value={reason} onChange={(e) => setReason((e.target as HTMLSelectElement).value)}>
            {HOLD_REASONS.map((r) => (
              <option key={r}>{r}</option>
            ))}
          </select>
        </Field>
        <Field label="Details" optional hint="Shown on the board so everyone knows what it’s waiting for.">
          <textarea class="textarea" rows={3} value={details} placeholder="e.g. Replacement glass ships Thursday" onInput={(e) => setDetails((e.target as HTMLTextAreaElement).value)} />
        </Field>
      </form>
    </Dialog>
  );
}

export function CompleteDialog({ job, onClose }: { job: Job; onClose: () => void }) {
  const c = customerOf(db.value, job.customerId);
  const times = defaultTimes(job);
  const [arrived, setArrived] = useState(times.arrivedAt);
  const [finished, setFinished] = useState(times.finishedAt);
  const [note, setNote] = useState('');
  const [signer, setSigner] = useState(c?.contact ?? c?.name.split(' & ')[0] ?? '');
  const mins = arrived && finished ? diffMinutes(finished, arrived) : 0;
  const valid = mins > 0;

  const submit = (e?: Event) => {
    e?.preventDefault();
    if (!valid) return;
    completeJob(job.id, { arrivedAt: arrived, finishedAt: finished, note: note.trim() || undefined, signature: signer.trim() ? { name: signer.trim() } : undefined });
    const next = closeOutAction(job);
    toast(`${job.id} marked complete`, { tone: 'success', action: { label: next.label, run: next.run } });
    onClose();
  };

  return (
    <Dialog
      title="Mark job complete"
      description={`${job.id} · ${job.title}`}
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" icon="check" disabled={!valid} onClick={() => submit()}>
            Mark complete
          </Button>
        </>
      }
    >
      <form class="stack" onSubmit={submit}>
        <div class="form-grid">
          <Field label="Arrived">
            <input class="input" type="datetime-local" value={arrived} onInput={(e) => setArrived((e.target as HTMLInputElement).value)} />
          </Field>
          <Field label="Finished" hint={valid ? `Time on site: ${duration(mins)}` : 'Finish time must be after arrival.'}>
            <input class="input" type="datetime-local" value={finished} aria-invalid={!valid} onInput={(e) => setFinished((e.target as HTMLInputElement).value)} />
          </Field>
          <Field label="Signed off by" optional class="span-2" hint="Customers usually sign on the technician’s phone. You can record the name here.">
            <input class="input" value={signer} onInput={(e) => setSigner((e.target as HTMLInputElement).value)} />
          </Field>
          <Field label="Completion note" optional class="span-2">
            <textarea class="textarea" rows={3} value={note} placeholder="What was done, anything to follow up on" onInput={(e) => setNote((e.target as HTMLTextAreaElement).value)} />
          </Field>
        </div>
        {job.parts.some((p) => p.status === 'reserved') && <p class="muted small">Reserved parts will be marked as used and taken out of {job.store === 'nixa' ? 'Nixa' : 'Osage Beach'} stock.</p>}
      </form>
    </Dialog>
  );
}
