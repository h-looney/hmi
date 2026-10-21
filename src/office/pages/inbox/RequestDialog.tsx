/** Log a request that didn't come through the website: a phone call, showroom visit, Facebook message… */
import { useState } from 'preact/hooks';
import { logRequest } from '../../actions';
import type { LeadKind, LeadSource, StoreId } from '../../data/types';
import { navigate } from '../../router';
import { customerOf } from '../../selectors';
import { db, me, ui } from '../../store';
import { toast } from '../../toast';
import { Button, Field, Segmented } from '../../ui/core';
import { Dialog } from '../../ui/Dialog';
import { CustomerPicker } from '../../ui/pickers';
import { sourceLabels } from '../../ui/status';

const sources: LeadSource[] = ['phone', 'walk-in', 'facebook', 'referral', 'builder'];

const summaryHints: Record<LeadKind, string> = {
  quote: 'e.g. Gas insert for an existing brick fireplace',
  service: 'e.g. Pilot won’t stay lit — Heat & Glo insert',
  question: 'e.g. Asked about pellet delivery to Sunrise Beach',
};

export function RequestDialog({ onClose }: { onClose: () => void }) {
  const d = db.value;
  const user = me.value;
  const startStore: StoreId = ui.value.store !== 'all' ? ui.value.store : user?.store && user.store !== 'both' ? user.store : 'osage-beach';

  const [kind, setKind] = useState<LeadKind>('quote');
  const [source, setSource] = useState<LeadSource>('phone');
  const [who, setWho] = useState<'new' | 'existing'>('new');
  const [customerId, setCustomerId] = useState<string | undefined>();
  const [name, setName] = useState('');
  const [phoneNo, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [city, setCity] = useState('');
  const [store, setStore] = useState<StoreId>(startStore);
  const [summary, setSummary] = useState('');
  const [message, setMessage] = useState('');
  const [assignee, setAssignee] = useState<string | undefined>();

  const customer = who === 'existing' ? customerOf(d, customerId) : undefined;
  const routed = d.settings.forms.routing[kind === 'quote' ? 'quote' : 'service'][store];
  const assignTo = assignee ?? routed;
  const canSave = (who === 'existing' ? !!customer : name.trim().length > 0) && summary.trim().length > 0;

  const save = () => {
    if (!canSave) return;
    const id = logRequest({
      kind,
      source,
      name: customer ? customer.contact ?? customer.name : name.trim(),
      phone: customer ? customer.phone : phoneNo.trim() || undefined,
      email: customer ? customer.email : email.trim() || undefined,
      city: customer ? customer.address.city : city.trim() || undefined,
      store,
      summary: summary.trim(),
      message: message.trim() || undefined,
      assignee: assignTo,
      customerId: customer?.id,
    });
    onClose();
    navigate(`/office/inbox/?id=${id}`);
    toast(`Request ${id} logged`, { tone: 'success' });
  };

  return (
    <Dialog
      title="Log a request"
      description="For phone calls, showroom visits and messages that didn’t come through the website."
      size="md"
      class="inbox-dialog"
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" icon="check" disabled={!canSave} onClick={save}>
            Log request
          </Button>
        </>
      }
    >
      <form
        class="stack request-form"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <div class="form-grid">
          <div class="field span-2">
            <span class="field__label">
              What do they need?
            </span>
            <Segmented
              label="Request type"
              items={[
                { key: 'quote', label: 'A quote', icon: 'chat' },
                { key: 'service', label: 'Service', icon: 'wrench' },
                { key: 'question', label: 'A question', icon: 'message' },
              ]}
              value={kind}
              onChange={setKind}
            />
          </div>
          <Field label="How did they reach you?">
            <select class="select" value={source} onChange={(e) => setSource((e.target as HTMLSelectElement).value as LeadSource)}>
              {sources.map((s) => (
                <option key={s} value={s}>
                  {sourceLabels[s]}
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
        </div>

        <fieldset class="request-form__who">
          <legend class="field__label">Who is it from?</legend>
          <Segmented
            label="Contact"
            size="sm"
            items={[
              { key: 'new', label: 'New contact' },
              { key: 'existing', label: 'Existing customer' },
            ]}
            value={who}
            onChange={setWho}
          />
          {who === 'existing' ? (
            <CustomerPicker
              value={customerId}
              store={store}
              onChange={(id) => {
                setCustomerId(id);
                const c = customerOf(db.value, id);
                if (c) setStore(c.store);
              }}
            />
          ) : (
            <div class="form-grid">
              <Field label="Name" class="span-2">
                <input class="input" value={name} autocomplete="off" data-autofocus onInput={(e) => setName((e.target as HTMLInputElement).value)} />
              </Field>
              <Field label="Phone" optional>
                <input class="input" type="tel" value={phoneNo} onInput={(e) => setPhone((e.target as HTMLInputElement).value)} />
              </Field>
              <Field label="Email" optional>
                <input class="input" type="email" value={email} onInput={(e) => setEmail((e.target as HTMLInputElement).value)} />
              </Field>
              <Field label="Town" optional class="span-2">
                <input class="input" value={city} onInput={(e) => setCity((e.target as HTMLInputElement).value)} />
              </Field>
            </div>
          )}
        </fieldset>

        <Field label="Summary" hint="A short line the whole team will see in the inbox">
          <input class="input" value={summary} placeholder={summaryHints[kind]} onInput={(e) => setSummary((e.target as HTMLInputElement).value)} />
        </Field>
        <Field label="Details" optional>
          <textarea class="textarea" rows={3} value={message} placeholder="What they said, measurements, best times to call…" onInput={(e) => setMessage((e.target as HTMLTextAreaElement).value)} />
        </Field>
        <Field label="Assign to" hint={assignee ? undefined : 'Picked from your website-form routing in Settings'}>
          <select class="select" value={assignTo} onChange={(e) => setAssignee((e.target as HTMLSelectElement).value)}>
            {d.staff
              .filter((s) => s.active)
              .map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} — {s.title}
                </option>
              ))}
          </select>
        </Field>
        <button type="submit" hidden />
      </form>
    </Dialog>
  );
}
