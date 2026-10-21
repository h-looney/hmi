/** Start a warranty claim with the manufacturer. Opened via openDialog({ kind: 'claim', unitId?, jobId? }). */
import { useState } from 'preact/hooks';
import { createClaim, registerUnit } from '../../actions';
import { issues } from '../../data/catalog';
import type { Item } from '../../data/types';
import { shortDate } from '../../lib/format';
import { navigate } from '../../router';
import { customerOf, itemOf, jobOf, unitLabel, unitOf, warrantyState } from '../../selectors';
import { db } from '../../store';
import { toast } from '../../toast';
import { Button, Field, Switch } from '../../ui/core';
import { Dialog } from '../../ui/Dialog';
import { Icon } from '../../ui/Icon';
import { CustomerPicker, ItemPicker } from '../../ui/pickers';
import { StatusBadge, warrantyMeta } from '../../ui/status';

export function ClaimDialog({ unitId, jobId, onClose }: { unitId?: string; jobId?: string; onClose: () => void }) {
  const d = db.value;
  const job = jobOf(d, jobId);
  const presetUnit = unitId ?? job?.unitId;
  const jobPart = job?.parts.map((p) => itemOf(d, p.itemId)).find((it) => it?.kind === 'part');

  const [customerId, setCustomerId] = useState<string | undefined>(presetUnit ? unitOf(d, presetUnit)?.customerId : job?.customerId);
  const [selUnit, setSelUnit] = useState<string | undefined>(presetUnit);
  const [issue, setIssue] = useState(job?.issue && issues[job.issue] ? job.issue : 'pilot');
  const [part, setPart] = useState(jobPart?.name ?? '');
  const [credit, setCredit] = useState(String(Math.round((jobPart?.cost ?? 30) + 120)));
  const [notes, setNotes] = useState('');
  const [submit, setSubmit] = useState(true);
  const [tried, setTried] = useState(false);

  const customer = customerOf(d, customerId);
  const customerUnits = customerId ? d.units.filter((u) => u.customerId === customerId) : [];
  const eligible = customerUnits.filter((u) => u.installedBy === 'HMI');
  const unit = unitOf(d, selUnit);
  const state = unit ? warrantyState(unit) : undefined;
  const notCovered = !!unit && unit.installedBy !== 'HMI';
  const canCreate = !!unit && !notCovered && part.trim().length > 0;

  const pickPart = (it: Item) => {
    setPart(it.name);
    setCredit(String(Math.round(it.cost + 120)));
  };

  const create = () => {
    setTried(true);
    if (!canCreate || !unit) return;
    if (submit && !unit.warranty.registered) registerUnit(unit.id);
    const id = createClaim({ unitId: unit.id, jobId, issue, part: part.trim(), credit: Math.max(0, Number(credit) || 0), notes: notes.trim() || undefined, submit });
    toast(submit ? `${id} submitted to the manufacturer (simulated)` : `${id} saved as a draft`);
    onClose();
    navigate(`/office/warranty/?tab=claims&id=${id}`);
  };

  return (
    <Dialog
      title="New warranty claim"
      description={job ? `From job ${job.id}` : 'Ask the manufacturer to cover a failed part.'}
      onClose={onClose}
      size="md"
      class="cust-dialog"
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" icon={submit ? 'send' : undefined} disabled={tried && !canCreate} onClick={create}>
            {submit ? 'Create & submit' : 'Save draft'}
          </Button>
        </>
      }
    >
      <div class="stack">
        {presetUnit && unit ? (
          <div class="picked">
            <span class="picked__icon">
              <Icon name="flame" size={16} />
            </span>
            <span class="picked__text">
              <strong>{unitLabel(unit)}</strong>
              <span class="muted small">
                {customer?.name} · Serial {unit.serial} · installed {shortDate(unit.installedOn, true)}
              </span>
            </span>
            {state && <StatusBadge meta={warrantyMeta[state]} />}
          </div>
        ) : (
          <>
            <CustomerPicker
              value={customerId}
              label="Customer"
              autoFocus
              onChange={(id) => {
                setCustomerId(id);
                const units = id ? d.units.filter((u) => u.customerId === id && u.installedBy === 'HMI') : [];
                setSelUnit(units.length === 1 ? units[0].id : undefined);
              }}
            />
            {customer && (
              <fieldset class="claim-units">
                <legend class="field__label">Appliance</legend>
                {eligible.length === 0 ? (
                  <p class="muted small">
                    {customerUnits.length ? 'None of this customer’s appliances were installed by HMI, so there’s no warranty to claim.' : 'No appliances on file for this customer.'}
                  </p>
                ) : (
                  eligible.map((u) => {
                    const st = warrantyState(u);
                    return (
                      <label key={u.id} class={`claim-units__option${selUnit === u.id ? ' is-selected' : ''}`}>
                        <input type="radio" name="claim-unit" checked={selUnit === u.id} onChange={() => setSelUnit(u.id)} />
                        <span class="claim-units__text">
                          <strong>{unitLabel(u)}</strong>
                          <span class="muted small">
                            Serial {u.serial} · installed {shortDate(u.installedOn, true)}
                          </span>
                        </span>
                        <StatusBadge meta={warrantyMeta[st]} />
                      </label>
                    );
                  })
                )}
                {tried && !unit && eligible.length > 0 && <span class="field__error-text">Choose the appliance the claim is for.</span>}
              </fieldset>
            )}
          </>
        )}

        {notCovered && (
          <p class="callout callout--amber">
            <Icon name="alert" size={16} />
            <span>This appliance wasn’t installed by HMI, so there’s no warranty to claim. Quote the repair instead.</span>
          </p>
        )}
        {unit && state === 'expired' && (
          <p class="callout callout--amber">
            <Icon name="alert" size={16} />
            <span>Parts coverage ended {shortDate(unit.warranty.partsUntil!, true)}. The manufacturer will likely deny this claim.</span>
          </p>
        )}
        {unit && unit.installedBy === 'HMI' && !unit.warranty.registered && state !== 'expired' && (
          <p class="callout">
            <Icon name="info" size={16} />
            <span>This unit isn’t registered with the manufacturer yet — it will be registered when the claim is submitted.</span>
          </p>
        )}

        <div class="form-grid">
          <Field label="What failed">
            <select class="select" value={issue} onChange={(e) => setIssue((e.target as HTMLSelectElement).value)}>
              {Object.entries(issues).map(([key, def]) => (
                <option key={key} value={key}>
                  {def.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Expected credit ($)" hint="Parts plus warranty labor rate">
            <input class="input" type="number" min="0" step="1" inputMode="numeric" value={credit} onInput={(e) => setCredit((e.target as HTMLInputElement).value)} />
          </Field>
        </div>
        <ItemPicker
          label="Replacement part (from inventory)"
          store={customer?.store ?? 'osage-beach'}
          filter={(it) => it.kind === 'part'}
          placeholder="Search parts — or type it below"
          onSelect={pickPart}
        />
        <Field label="Part or failure description">
          <input class="input" value={part} aria-invalid={tried && !part.trim() ? 'true' : undefined} placeholder="e.g. Thermopile 750 mV" onInput={(e) => setPart((e.target as HTMLInputElement).value)} />
          {tried && !part.trim() && <span class="field__error-text">Describe the part that failed.</span>}
        </Field>
        <Field label="Notes for the manufacturer" optional>
          <textarea class="textarea" rows={3} value={notes} placeholder="Symptoms, troubleshooting done, photos taken…" onInput={(e) => setNotes((e.target as HTMLTextAreaElement).value)} />
        </Field>
        <Switch checked={submit} onChange={setSubmit} label="Submit to the manufacturer now" description="Off saves a draft you can finish later." />
      </div>
    </Dialog>
  );
}
