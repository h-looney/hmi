/** Create or edit a customer. Opened from anywhere via openDialog({ kind: 'customer' }). */
import { useMemo, useState } from 'preact/hooks';
import { createCustomer, updateCustomer } from '../../actions';
import type { Customer, StoreId } from '../../data/types';
import { navigate } from '../../router';
import { db, ui } from '../../store';
import { toast } from '../../toast';
import { Button, Field, Switch } from '../../ui/core';
import { Dialog } from '../../ui/Dialog';
import { Icon } from '../../ui/Icon';
import { contactPrefLabels, kindLabels, suggestedTags } from './helpers';

interface Props {
  customerId?: string;
  preset?: Partial<Customer>;
  onCreated?: (id: string) => void;
  onClose: () => void;
}

const emailOk = (v: string) => !v.trim() || /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v.trim());

export function CustomerDialog({ customerId, preset, onCreated, onClose }: Props) {
  const d = db.value;
  const existing = customerId ? d.customers.find((c) => c.id === customerId) : undefined;
  const base: Partial<Customer> = existing ?? preset ?? {};
  const defaultStore: StoreId = base.store ?? (ui.value.store === 'all' ? 'osage-beach' : ui.value.store);

  const [name, setName] = useState(base.name ?? '');
  const [kind, setKind] = useState<Customer['kind']>(base.kind ?? 'homeowner');
  const [contact, setContact] = useState(base.contact ?? '');
  const [phone, setPhone] = useState(base.phone ?? '');
  const [email, setEmail] = useState(base.email ?? '');
  const [street, setStreet] = useState(base.address?.street ?? '');
  const [city, setCity] = useState(base.address?.city ?? '');
  const [state, setState] = useState(base.address?.state ?? 'MO');
  const [zip, setZip] = useState(base.address?.zip ?? '');
  const [store, setStore] = useState<StoreId>(defaultStore);
  const [contactPref, setContactPref] = useState<Customer['contactPref']>(base.contactPref ?? 'phone');
  const [servicePlan, setServicePlan] = useState(!!base.servicePlan || !!base.tags?.includes('Service plan'));
  const [tags, setTags] = useState<string[]>((base.tags ?? []).filter((t) => t !== 'Service plan'));
  const [newTag, setNewTag] = useState('');
  const [notes, setNotes] = useState(base.notes ?? '');
  const [tried, setTried] = useState(false);

  const tagOptions = useMemo(() => {
    const inUse = new Set(d.customers.flatMap((c) => c.tags));
    inUse.delete('Service plan');
    inUse.delete('Counter sales');
    return [...new Set([...suggestedTags, ...inUse, ...tags])];
  }, [d.customers, tags]);

  const nameError = tried && !name.trim() ? 'Please enter a name.' : '';
  const emailError = tried && !emailOk(email) ? 'That email address doesn’t look right.' : '';

  const toggleTag = (t: string) => setTags(tags.includes(t) ? tags.filter((x) => x !== t) : [...tags, t]);
  const addTag = () => {
    const t = newTag.trim();
    if (t && !tags.includes(t)) setTags([...tags, t]);
    setNewTag('');
  };

  const save = (e?: Event) => {
    e?.preventDefault();
    setTried(true);
    if (!name.trim() || !emailOk(email)) return;
    const record = {
      name: name.trim(),
      kind,
      contact: kind === 'homeowner' ? undefined : contact.trim() || undefined,
      phone: phone.trim(),
      email: email.trim(),
      address: { street: street.trim(), city: city.trim(), state: state.trim() || 'MO', zip: zip.trim() },
      store,
      contactPref,
      servicePlan,
      tags: [...(servicePlan ? ['Service plan'] : []), ...tags],
      notes: notes.trim() || undefined,
    };
    if (existing) {
      updateCustomer(existing.id, record);
      toast('Customer details saved');
      onClose();
      return;
    }
    const id = createCustomer(record);
    toast(`${record.name} added as a customer`);
    onClose();
    if (onCreated) onCreated(id);
    else navigate(`/office/customers/?id=${id}`);
  };

  return (
    <Dialog
      title={existing ? `Edit ${existing.name}` : 'New customer'}
      description={existing ? `Customer ${existing.id}` : 'Add a homeowner, builder or business.'}
      onClose={onClose}
      size="lg"
      class="cust-dialog"
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={() => save()}>
            {existing ? 'Save changes' : 'Add customer'}
          </Button>
        </>
      }
    >
      <form class="stack" onSubmit={save} noValidate>
        <div class="form-grid">
          <Field label={kind === 'homeowner' ? 'Name' : 'Company name'}>
            <input class="input" value={name} aria-invalid={nameError ? 'true' : undefined} data-autofocus onInput={(e) => setName((e.target as HTMLInputElement).value)} />
            {nameError && <span class="field__error-text">{nameError}</span>}
          </Field>
          <Field label="Customer type">
            <select class="select" value={kind} onChange={(e) => setKind((e.target as HTMLSelectElement).value as Customer['kind'])}>
              {(Object.keys(kindLabels) as Customer['kind'][]).map((k) => (
                <option key={k} value={k}>
                  {kindLabels[k]}
                </option>
              ))}
            </select>
          </Field>
          {kind !== 'homeowner' && (
            <Field label="Contact person" class="span-2">
              <input class="input" value={contact} onInput={(e) => setContact((e.target as HTMLInputElement).value)} />
            </Field>
          )}
          <Field label="Phone">
            <input class="input" type="tel" autocomplete="off" value={phone} onInput={(e) => setPhone((e.target as HTMLInputElement).value)} />
          </Field>
          <Field label="Email">
            <input class="input" type="email" autocomplete="off" value={email} aria-invalid={emailError ? 'true' : undefined} onInput={(e) => setEmail((e.target as HTMLInputElement).value)} />
            {emailError && <span class="field__error-text">{emailError}</span>}
          </Field>
          <Field label="Street address" class="span-2">
            <input class="input" value={street} onInput={(e) => setStreet((e.target as HTMLInputElement).value)} />
          </Field>
          <Field label="City">
            <input class="input" value={city} onInput={(e) => setCity((e.target as HTMLInputElement).value)} />
          </Field>
          <div class="cust-form__statezip">
            <Field label="State">
              <input class="input" value={state} maxLength={2} onInput={(e) => setState((e.target as HTMLInputElement).value.toUpperCase())} />
            </Field>
            <Field label="ZIP">
              <input class="input" inputMode="numeric" value={zip} maxLength={10} onInput={(e) => setZip((e.target as HTMLInputElement).value)} />
            </Field>
          </div>
          <Field label="Home store">
            <select class="select" value={store} onChange={(e) => setStore((e.target as HTMLSelectElement).value as StoreId)}>
              <option value="osage-beach">Osage Beach</option>
              <option value="nixa">Nixa</option>
            </select>
          </Field>
          <Field label="Best way to reach them">
            <select class="select" value={contactPref} onChange={(e) => setContactPref((e.target as HTMLSelectElement).value as Customer['contactPref'])}>
              {(Object.keys(contactPrefLabels) as Customer['contactPref'][]).map((k) => (
                <option key={k} value={k}>
                  {contactPrefLabels[k]}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <Switch checked={servicePlan} onChange={setServicePlan} label="Annual maintenance plan" description="Gets a reminder each fall and priority booking for annual service." />

        <fieldset class="cust-form__tags">
          <legend class="field__label">Tags</legend>
          <div class="chips">
            {tagOptions.map((t) => (
              <button key={t} type="button" class="chip" aria-pressed={tags.includes(t)} onClick={() => toggleTag(t)}>
                {tags.includes(t) && <Icon name="check" size={13} stroke={2.6} />}
                {t}
              </button>
            ))}
          </div>
          <div class="cust-form__newtag">
            <label class="sr-only" for="new-tag">
              New tag
            </label>
            <input
              id="new-tag"
              class="input input--sm"
              placeholder="Add a tag"
              value={newTag}
              onInput={(e) => setNewTag((e.target as HTMLInputElement).value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addTag();
                }
              }}
            />
            <Button size="sm" icon="plus" disabled={!newTag.trim()} onClick={addTag}>
              Add
            </Button>
          </div>
        </fieldset>

        <Field label="Notes" optional hint="Gate codes, pets, parking, anything the crew should know.">
          <textarea class="textarea" rows={3} value={notes} onInput={(e) => setNotes((e.target as HTMLTextAreaElement).value)} />
        </Field>
        <button type="submit" hidden />
      </form>
    </Dialog>
  );
}
