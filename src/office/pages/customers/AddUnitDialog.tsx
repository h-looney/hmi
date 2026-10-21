/** Add an appliance to a customer's equipment list — one HMI installed, or one that came with the house. */
import { useState } from 'preact/hooks';
import type { Fuel, Item, ItemCategory } from '../../data/types';
import { rooms } from '../../data/people';
import { today } from '../../lib/dates';
import { itemLabel, storeName } from '../../selectors';
import { db } from '../../store';
import { toast } from '../../toast';
import { Button, Field, Segmented } from '../../ui/core';
import { Dialog } from '../../ui/Dialog';
import { ItemPicker } from '../../ui/pickers';
import { addUnit } from './helpers';

const categories: ItemCategory[] = ['Gas fireplaces', 'Wood fireplaces', 'Electric fireplaces', 'Inserts', 'Stoves', 'Gas logs', 'Outdoor'];
const fuels: Fuel[] = ['Natural gas', 'Propane', 'Wood', 'Pellet', 'Electric'];

export function AddUnitDialog({ customerId, onClose }: { customerId: string; onClose: () => void }) {
  const customer = db.value.customers.find((c) => c.id === customerId)!;
  const [source, setSource] = useState<'HMI' | 'Other'>('Other');
  const [item, setItem] = useState<Item | undefined>();
  const [brand, setBrand] = useState('');
  const [model, setModel] = useState('');
  const [category, setCategory] = useState<ItemCategory>('Gas fireplaces');
  const [fuel, setFuel] = useState<Fuel>('Natural gas');
  const [serial, setSerial] = useState('');
  const [installedOn, setInstalledOn] = useState(today());
  const [room, setRoom] = useState('Living room');

  const ready = source === 'HMI' ? !!item : model.trim().length > 0;

  const save = () => {
    if (!ready) return;
    const unitFuel: Fuel = item?.fuel === 'Gas' ? (fuel === 'Propane' ? 'Propane' : 'Natural gas') : (item?.fuel ?? fuel);
    addUnit({
      customerId,
      installedBy: source,
      itemId: source === 'HMI' ? item?.id : undefined,
      brand: source === 'HMI' ? item!.brand : brand,
      model: source === 'HMI' ? item!.name : model.trim(),
      category: source === 'HMI' ? item!.category : category,
      fuel: source === 'HMI' ? unitFuel : fuel,
      serial,
      installedOn,
      room,
    });
    toast(`Added to ${customer.name}’s equipment`);
    onClose();
  };

  return (
    <Dialog
      title="Add equipment"
      description={`For ${customer.name}`}
      onClose={onClose}
      size="md"
      class="cust-dialog"
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" disabled={!ready} onClick={save}>
            Add equipment
          </Button>
        </>
      }
    >
      <div class="stack">
        <Segmented<'HMI' | 'Other'>
          label="Who installed it"
          value={source}
          onChange={setSource}
          items={[
            { key: 'Other', label: 'Installed by someone else' },
            { key: 'HMI', label: 'Installed by HMI' },
          ]}
        />
        {source === 'HMI' ? (
          <>
            {item ? (
              <div class="picked">
                <span class="picked__text">
                  <strong>{itemLabel(item)}</strong>
                  <span class="muted small">
                    {item.category} · {item.id}
                  </span>
                </span>
                <Button size="sm" variant="ghost" onClick={() => setItem(undefined)}>
                  Change
                </Button>
              </div>
            ) : (
              <ItemPicker label="Model" store={customer.store} filter={(it) => it.kind === 'unit'} onSelect={setItem} placeholder="Search models by name or brand" />
            )}
            {item?.fuel === 'Gas' && (
              <Field label="Gas supply">
                <select class="select" value={fuel === 'Propane' ? 'Propane' : 'Natural gas'} onChange={(e) => setFuel((e.target as HTMLSelectElement).value as Fuel)}>
                  <option>Natural gas</option>
                  <option>Propane</option>
                </select>
              </Field>
            )}
            <p class="muted small">Warranty dates are filled in from the model’s standard terms. Stock at {storeName(customer.store)} isn’t touched.</p>
          </>
        ) : (
          <div class="form-grid">
            <Field label="Brand" optional>
              <input class="input" value={brand} placeholder="e.g. Majestic, or leave blank" onInput={(e) => setBrand((e.target as HTMLInputElement).value)} />
            </Field>
            <Field label="Model or description">
              <input class="input" value={model} placeholder="e.g. 36-inch direct-vent fireplace" data-autofocus onInput={(e) => setModel((e.target as HTMLInputElement).value)} />
            </Field>
            <Field label="Type">
              <select class="select" value={category} onChange={(e) => setCategory((e.target as HTMLSelectElement).value as ItemCategory)}>
                {categories.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </Field>
            <Field label="Fuel">
              <select class="select" value={fuel} onChange={(e) => setFuel((e.target as HTMLSelectElement).value as Fuel)}>
                {fuels.map((f) => (
                  <option key={f}>{f}</option>
                ))}
              </select>
            </Field>
          </div>
        )}
        <div class="form-grid">
          <Field label="Serial number" optional>
            <input class="input" value={serial} onInput={(e) => setSerial((e.target as HTMLInputElement).value)} />
          </Field>
          <Field label={source === 'HMI' ? 'Installed on' : 'Installed (approximately)'}>
            <input class="input" type="date" value={installedOn} max={today()} onInput={(e) => setInstalledOn((e.target as HTMLInputElement).value || today())} />
          </Field>
          <Field label="Room" class="span-2">
            <select class="select" value={room} onChange={(e) => setRoom((e.target as HTMLSelectElement).value)}>
              {[...rooms, 'Outdoor kitchen', 'Lake deck', 'Other'].map((r) => (
                <option key={r}>{r}</option>
              ))}
            </select>
          </Field>
        </div>
      </div>
    </Dialog>
  );
}
