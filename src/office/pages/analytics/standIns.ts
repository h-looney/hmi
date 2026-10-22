/**
 * The sample-data rule: invented figures never sit next to a real product or brand. HMI mode's sales and service
 * history are generated for the demo, so the reports that rank or rate how things sold or held up — Best sellers,
 * Problem units and Inventory health — show the catalog's real brands and models under stand-in names ("Gas fireplace
 * C", "Brand F") that stay the same throughout the demo. They don't link to the real item either, since that would
 * give the name away. In the live system these reports read HMI's own history and show the real names. HMI's house
 * items ("HMI Supply") keep their names.
 */
import type { DB, Item, ItemCategory } from '../../data/types';

const HOUSE = 'HMI Supply';

const SINGULAR: Record<ItemCategory, string> = {
  'Gas fireplaces': 'Gas fireplace',
  'Wood fireplaces': 'Wood fireplace',
  'Electric fireplaces': 'Electric fireplace',
  Inserts: 'Insert',
  Stoves: 'Stove',
  'Gas logs': 'Gas log set',
  Outdoor: 'Outdoor fireplace',
  'Doors & screens': 'Door or screen',
  'Mantels & stone': 'Mantel or stone',
  Venting: 'Venting part',
  'Service parts': 'Service part',
  Accessories: 'Accessory',
};

/** A, B … Z, AA, AB … */
const letters = (n: number): string => (n < 26 ? String.fromCharCode(65 + n) : letters(Math.floor(n / 26) - 1) + letters(n % 26));

const cache = new WeakMap<Item[], { items: Map<string, string>; brands: Map<string, string> }>();

function standIns(items: Item[]) {
  const hit = cache.get(items);
  if (hit) return hit;
  const byCategory = new Map<ItemCategory, Item[]>();
  for (const it of items) if (it.brand !== HOUSE) byCategory.set(it.category, [...(byCategory.get(it.category) ?? []), it]);
  const names = new Map<string, string>();
  for (const [category, list] of byCategory) {
    [...list].sort((a, b) => a.id.localeCompare(b.id)).forEach((it, i) => names.set(it.id, `${SINGULAR[category]} ${letters(i)}`));
  }
  const brands = new Map([...new Set(items.map((i) => i.brand).filter((b) => b !== HOUSE))].sort().map((b, i) => [b, `Brand ${letters(i)}`]));
  const made = { items: names, brands };
  cache.set(items, made);
  return made;
}

/** Shown under a stand-in name in the reports (everything but HMI's house items) */
export const isStandIn = (it: Item) => it.brand !== HOUSE;

/** What a report calls an item: its stand-in, or its own name for HMI's house items */
export const reportItemName = (d: DB, it: Item) => standIns(d.items).items.get(it.id) ?? it.name;

/** What a report calls a brand */
export const reportBrandName = (d: DB, brand: string) => standIns(d.items).brands.get(brand) ?? brand;

/** Said wherever the stand-ins show */
export const STAND_IN_NOTE =
  'These figures are randomly generated for the demo, so models, parts and brands appear under stand-in names (“Gas fireplace C”, “Brand F”) — invented numbers never sit next to a real product. In the live system the figures come from HMI’s own history, with the real names.';
