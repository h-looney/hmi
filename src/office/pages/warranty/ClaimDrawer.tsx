/** A warranty claim, start to finish: details, progress, and the next step with the manufacturer. */
import { useState } from 'preact/hooks';
import { setClaimStatus } from '../../actions';
import { issues } from '../../data/catalog';
import type { ClaimStatus } from '../../data/types';
import { money, shortDate } from '../../lib/format';
import { customerOf, jobOf, unitLabel, unitOf, warrantyState } from '../../selectors';
import { can, db } from '../../store';
import { toast } from '../../toast';
import { Button, Details, EmptyState, Field, Link } from '../../ui/core';
import { Dialog } from '../../ui/Dialog';
import { Icon } from '../../ui/Icon';
import { claimStatusMeta, StatusBadge, warrantyMeta } from '../../ui/status';

const steps: { key: ClaimStatus; label: string }[] = [
  { key: 'draft', label: 'Drafted' },
  { key: 'submitted', label: 'Submitted' },
  { key: 'approved', label: 'Approved' },
  { key: 'parts-shipped', label: 'Parts shipped' },
  { key: 'credited', label: 'Credited' },
];

export function ClaimDrawer({ id, onClose }: { id: string; onClose: () => void }) {
  const d = db.value;
  const claim = d.claims.find((c) => c.id === id);
  const [mode, setMode] = useState<'idle' | 'credit' | 'deny'>('idle');
  const [amount, setAmount] = useState(claim ? String(claim.credit) : '0');
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState(claim?.notes ?? '');

  if (!claim) {
    return (
      <Dialog title="Claim not found" onClose={onClose} drawer size="md">
        <EmptyState icon="file" title="We couldn’t find that claim">
          It may have been removed when the demo data was reset.
        </EmptyState>
      </Dialog>
    );
  }

  const unit = unitOf(d, claim.unitId);
  const customer = customerOf(d, claim.customerId);
  const job = jobOf(d, claim.jobId);
  const denied = claim.status === 'denied';
  const current = steps.findIndex((s) => s.key === claim.status);

  const move = (status: ClaimStatus, message: string, patch = {}) => {
    setClaimStatus(claim.id, status, patch);
    setMode('idle');
    toast(message);
  };

  const footer = (() => {
    if (mode === 'credit') {
      return (
        <>
          <Field label="Credit received" class="claim-inline-field">
            <input class="input" type="number" min="0" step="0.01" inputMode="decimal" value={amount} data-autofocus onInput={(e) => setAmount((e.target as HTMLInputElement).value)} />
          </Field>
          <span class="spacer" />
          <Button onClick={() => setMode('idle')}>Cancel</Button>
          <Button variant="primary" disabled={!(Number(amount) >= 0)} onClick={() => move('credited', `Credit of ${money(Number(amount) || 0)} recorded on ${claim.id}`, { credit: Math.round((Number(amount) || 0) * 100) / 100 })}>
            Record credit
          </Button>
        </>
      );
    }
    if (mode === 'deny') {
      return (
        <>
          <Field label="Reason" class="claim-inline-field claim-inline-field--wide">
            <input class="input" value={reason} placeholder="e.g. Damage from improper venting" data-autofocus onInput={(e) => setReason((e.target as HTMLInputElement).value)} />
          </Field>
          <span class="spacer" />
          <Button onClick={() => setMode('idle')}>Cancel</Button>
          <Button variant="danger" disabled={!reason.trim()} onClick={() => move('denied', `${claim.id} marked denied`, { notes: [claim.notes, `Denied: ${reason.trim()}`].filter(Boolean).join('\n') })}>
            Mark denied
          </Button>
        </>
      );
    }
    switch (claim.status) {
      case 'draft':
        return (
          <Button variant="primary" icon="send" onClick={() => move('submitted', `${claim.id} submitted to ${claim.manufacturer} (simulated)`)}>
            Submit to manufacturer
          </Button>
        );
      case 'submitted':
        return (
          <>
            <Button variant="ghost" onClick={() => setMode('deny')}>
              Deny…
            </Button>
            <Button variant="primary" icon="check" onClick={() => move('approved', `${claim.id} approved by ${claim.manufacturer}`)}>
              Mark approved
            </Button>
          </>
        );
      case 'approved':
        return (
          <>
            <Button onClick={() => setMode('credit')}>Mark credited…</Button>
            <Button variant="primary" icon="truck" onClick={() => move('parts-shipped', `Replacement parts shipped for ${claim.id}`)}>
              Parts shipped
            </Button>
          </>
        );
      case 'parts-shipped':
        return (
          <Button variant="primary" icon="dollar" onClick={() => setMode('credit')}>
            Mark credited…
          </Button>
        );
      case 'denied':
        return (
          <Button icon="undo" onClick={() => move('submitted', `${claim.id} resubmitted (simulated)`)}>
            Resubmit
          </Button>
        );
      default:
        return <span class="muted small">This claim is closed.</span>;
    }
  })();

  return (
    <Dialog
      title={`${claim.id} · ${claim.part}`}
      description={`${claim.manufacturer} · ${claim.claimNo ? `Claim ${claim.claimNo}` : claim.status === 'draft' ? 'not submitted yet' : 'claim number pending'}`}
      onClose={onClose}
      drawer
      size="md"
      headerExtra={<StatusBadge meta={claimStatusMeta[claim.status]} />}
      footer={footer}
    >
      <div class="stack">
        <ol class={`claim-steps${denied ? ' is-denied' : ''}`} aria-label="Claim progress" tabIndex={-1} data-autofocus>
          {steps.map((s, i) => {
            const done = !denied && i <= current;
            return (
              <li key={s.key} class={done ? 'is-done' : undefined} aria-current={!denied && i === current ? 'step' : undefined}>
                <span class="claim-steps__dot" aria-hidden="true">
                  {done && <Icon name="check" size={11} stroke={3} />}
                </span>
                <span class="claim-steps__label">{s.label}</span>
              </li>
            );
          })}
        </ol>
        {denied && (
          <p class="callout callout--amber">
            <Icon name="x-circle" size={16} />
            <span>The manufacturer denied this claim. You can resubmit with more detail or photos.</span>
          </p>
        )}

        <Details
          columns={2}
          items={[
            ['Customer', customer ? <Link to={`/office/customers/?id=${customer.id}&tab=equipment`}>{customer.name}</Link> : '—'],
            ['Appliance', unit ? unitLabel(unit) : '—'],
            ['Serial number', unit ? <span class="tabular">{unit.serial}</span> : '—'],
            ['Coverage', unit ? <StatusBadge meta={warrantyMeta[warrantyState(unit)]} /> : '—'],
            ['Issue', issues[claim.issue]?.label ?? claim.issue],
            ['Part', claim.part],
            ['Opened', shortDate(claim.openedOn, true)],
            ['Last update', shortDate(claim.updatedOn, true)],
            [claim.status === 'credited' ? 'Credit received' : 'Expected credit', <span class="tabular">{money(claim.credit)}</span>],
            ['Service job', job ? can('jobs') ? <Link to={`/office/jobs/?id=${job.id}`}>{job.id}</Link> : job.id : 'None linked'],
          ]}
        />

        {unit?.warranty.partsUntil && (
          <p class="muted small">
            Parts coverage {unit.warranty.partsUntil < claim.openedOn ? 'had ended' : 'runs until'} {shortDate(unit.warranty.partsUntil, true)} · {unit.warranty.registered ? `registered (${unit.warranty.registrationNo})` : 'not registered with the manufacturer'}
          </p>
        )}

        <div class="field">
          <label class="field__label" for="claim-notes">
            Notes
          </label>
          <textarea id="claim-notes" class="textarea" rows={4} value={notes} placeholder="Tracking numbers, RMA, what the rep said…" onInput={(e) => setNotes((e.target as HTMLTextAreaElement).value)} />
          <div class="row">
            <Button
              size="sm"
              disabled={notes === (claim.notes ?? '')}
              onClick={() => {
                setClaimStatus(claim.id, claim.status, { notes: notes.trim() || undefined });
                toast('Claim notes saved');
              }}
            >
              Save notes
            </Button>
          </div>
        </div>
      </div>
    </Dialog>
  );
}
