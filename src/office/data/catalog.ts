/**
 * Sample catalog, vendors and service reference data for HMI mode.
 *
 * Appliance models come from the product list (src/data/products.ts): names, brands and showroom display counts are
 * read from there, so HMI mode and the public model pages always agree. The commercial data below — costs, prices,
 * stock on hand, reorder points and warranty terms — is invented, as is every performance figure built on it.
 * Parts, venting and accessories are catalog-only items.
 */
import { brands } from '../../data/brands.ts';
import { products, type Product } from '../../data/products.ts';
import type { Fuel, Item, ItemCategory, JobType, StoreId, Vendor } from './types';

type Stock = [onHand: number, display: number];

interface CatalogEntry {
  id: string;
  brand: string;
  name: string;
  category: ItemCategory;
  kind: Item['kind'];
  fuel?: Item['fuel'];
  uom?: Item['uom'];
  cost: number;
  price: number;
  reorder: [point: number, qty: number];
  vendorId: string;
  stock: Record<StoreId, Stock>;
  warranty?: Item['warranty'];
  specialOrder?: boolean;
}

const W = {
  hht: { partsYears: 2, laborYears: 1, fireboxLifetime: true },
  premium: { partsYears: 5, laborYears: 2, fireboxLifetime: true },
  standard: { partsYears: 3, laborYears: 1, fireboxLifetime: true },
  stove: { partsYears: 5, laborYears: 1, fireboxLifetime: true },
  pellet: { partsYears: 3, laborYears: 1, fireboxLifetime: false },
  electric: { partsYears: 2, laborYears: 1, fireboxLifetime: false },
  basic: { partsYears: 1, laborYears: 1, fireboxLifetime: false },
} satisfies Record<string, NonNullable<Item['warranty']>>;

/** Invented commercial data for each model on the product list (keyed by HMI SKU = product id). */
interface UnitEntry {
  category: ItemCategory;
  cost: number;
  price: number;
  reorder: [point: number, qty: number];
  vendorId: string;
  /** Units in stock at each store, showroom displays included (displays themselves come from the product list) */
  onHand: Record<StoreId, number>;
  warranty: NonNullable<Item['warranty']>;
}

const u = (category: ItemCategory, cost: number, price: number, reorder: [number, number], vendorId: string, osageBeach: number, nixa: number, warranty: NonNullable<Item['warranty']>): UnitEntry => ({
  category,
  cost,
  price,
  reorder,
  vendorId,
  onHand: { 'osage-beach': osageBeach, nixa },
  warranty,
});

const units: Record<string, UnitEntry> = {
  // Gas fireplaces
  'HG-MEZZO48': u('Gas fireplaces', 3890, 6290, [1, 1], 'v-hht', 2, 1, W.hht),
  'FPX-PB42': u('Gas fireplaces', 2210, 3690, [2, 2], 'v-travis', 2, 2, W.premium),
  'KH-CALLAWAY50': u('Gas fireplaces', 3120, 5150, [1, 1], 'v-kozy', 0, 1, W.standard),
  'EMP-TAHOE36': u('Gas fireplaces', 1750, 2890, [1, 2], 'v-empire', 2, 1, W.standard),
  'EMP-BLVD48': u('Gas fireplaces', 2380, 3950, [1, 1], 'v-empire', 1, 1, W.standard),
  'MON-ART42': u('Gas fireplaces', 1580, 2650, [1, 1], 'v-monessen', 1, 0, W.standard),
  // Discontinued: still in customers' homes, no longer stocked
  'HG-6000C': u('Gas fireplaces', 2650, 4290, [0, 0], 'v-hht', 0, 0, W.hht),
  'HG-SL750': u('Gas fireplaces', 1890, 3150, [0, 0], 'v-hht', 0, 0, W.hht),
  'HTL-CNXT36': u('Gas fireplaces', 1420, 2390, [0, 0], 'v-hht', 0, 0, W.hht),

  // Wood fireplaces
  'HTL-ICON100': u('Wood fireplaces', 2450, 3990, [1, 1], 'v-hht', 1, 1, W.hht),
  'FPX-42APEX': u('Wood fireplaces', 3980, 6450, [1, 1], 'v-travis', 1, 0, W.premium),

  // Electric
  'DIM-RBF42': u('Electric fireplaces', 980, 1690, [2, 3], 'v-dimplex', 3, 2, W.electric),
  'DIM-XLF60': u('Electric fireplaces', 760, 1299, [2, 4], 'v-dimplex', 2, 4, W.electric),
  'DIM-OMC1000': u('Electric fireplaces', 1050, 1850, [1, 2], 'v-dimplex', 1, 1, W.electric),

  // Inserts
  'HG-ESC-I35': u('Inserts', 2050, 3390, [2, 2], 'v-hht', 2, 2, W.hht),
  'LOPI-DVL': u('Inserts', 2290, 3790, [2, 2], 'v-travis', 1, 3, W.premium),
  'FPX-616GSR2': u('Inserts', 2780, 4590, [1, 1], 'v-travis', 1, 1, W.premium),
  'KH-CHASKA34': u('Inserts', 2080, 3450, [1, 2], 'v-kozy', 1, 2, W.standard),
  'HAR-ACC52I': u('Inserts', 2950, 4890, [1, 1], 'v-ff', 1, 1, W.pellet),
  'HS-CLYDESDALE': u('Inserts', 2160, 3550, [0, 1], 'v-hearthstone', 0, 1, W.stove),
  'QF-CASTILE': u('Inserts', 2380, 3950, [0, 0], 'v-ff', 0, 0, W.pellet),

  // Stoves
  'VC-DEFIANT': u('Stoves', 2280, 3790, [1, 2], 'v-ff', 2, 2, W.stove),
  'VC-RADIANCE': u('Stoves', 1890, 3150, [1, 1], 'v-ff', 1, 1, W.stove),
  'QF-3100M': u('Stoves', 1750, 2890, [2, 2], 'v-ff', 2, 1, W.stove),
  'HAR-P43': u('Stoves', 2050, 3390, [1, 2], 'v-ff', 1, 2, W.pellet),
  'LOPI-ANSWER': u('Stoves', 1490, 2490, [2, 2], 'v-travis', 2, 2, W.premium),
  'LOPI-NORTHFIELD': u('Stoves', 1840, 3050, [1, 1], 'v-travis', 1, 1, W.premium),
  'HS-CASTLETON': u('Stoves', 1990, 3290, [1, 1], 'v-hearthstone', 1, 0, W.stove),
  'KUMA-ASPEN': u('Stoves', 1520, 2550, [0, 1], 'v-kuma', 0, 1, W.stove),

  // Gas logs
  'HRG-OAK24': u('Gas logs', 520, 890, [3, 4], 'v-ozark', 5, 3, W.basic),

  // Outdoor
  'EMP-CRO42': u('Outdoor', 2650, 4390, [1, 1], 'v-empire', 1, 1, W.standard),
  'HPC-FP30': u('Outdoor', 640, 1090, [2, 3], 'v-hpc', 3, 2, W.basic),
  'HG-TWILIGHT': u('Outdoor', 3580, 5890, [0, 1], 'v-hht', 1, 0, W.hht),
};

/** HMI SKUs of every appliance model — must match the product list one-for-one (checked by the link checker). */
export const unitIds = () => Object.keys(units);

const brandName = (id: string) => brands.find((b) => b.id === id)?.name ?? id;
const fuelOf: Record<Product['fuel'], NonNullable<Item['fuel']>> = { gas: 'Gas', wood: 'Wood', pellet: 'Pellet', electric: 'Electric' };
const SMALL = new Set(['and', 'or', 'of', 'the', 'a', 'with']);
const titleCase = (s: string) => s.replace(/[A-Za-z][^\s/-]*/g, (w, i) => (i > 0 && SMALL.has(w) ? w : w[0].toUpperCase() + w.slice(1)));

/** "Mezzo 48" + "Linear gas fireplace" → "Mezzo 48 Linear Gas Fireplace" */
export const unitName = (p: Pick<Product, 'model' | 'type'>) => `${p.model} ${titleCase(p.type)}`;

function unitItems(): Item[] {
  return products.map((p) => {
    const e = units[p.id];
    if (!e) throw new Error(`No catalog data for ${p.id} — add it to units in src/office/data/catalog.ts`);
    const level = (store: StoreId) => ({ onHand: Math.max(e.onHand[store], p.display[store]), reserved: 0, display: p.display[store] });
    return {
      id: p.id,
      name: unitName(p),
      model: p.model,
      brand: brandName(p.brand),
      category: e.category,
      kind: 'unit',
      fuel: fuelOf[p.fuel],
      uom: 'ea',
      cost: e.cost,
      price: e.price,
      reorderPoint: e.reorder[0],
      reorderQty: e.reorder[1],
      vendorId: e.vendorId,
      stock: { 'osage-beach': level('osage-beach'), nixa: level('nixa') },
      warranty: e.warranty,
      photo: photoFor[e.category],
      productStatus: p.status,
    } satisfies Item;
  });
}

const entries: CatalogEntry[] = [
  // Doors & screens
  { id: 'STOLL-BF36', brand: 'Stoll', name: 'Bi-Fold Fireplace Door 36 in., Matte Black', category: 'Doors & screens', kind: 'accessory', cost: 610, price: 1050, reorder: [1, 2], vendorId: 'v-ozark', stock: { 'osage-beach': [1, 1], nixa: [1, 0] } },
  { id: 'DS-TEMPCO', brand: 'Design Specialties', name: 'Tempco Glass Fireplace Door', category: 'Doors & screens', kind: 'accessory', cost: 420, price: 740, reorder: [1, 2], vendorId: 'v-ozark', stock: { 'osage-beach': [2, 0], nixa: [1, 0] } },
  { id: 'TR-OVATION42', brand: 'Thermo-Rite', name: 'Ovation Glass Door 42 in.', category: 'Doors & screens', kind: 'accessory', cost: 520, price: 890, reorder: [1, 1], vendorId: 'v-ozark', stock: { 'osage-beach': [0, 0], nixa: [1, 1] } },
  { id: 'UNI-SCREEN3', brand: 'Uniflame', name: '3-Panel Fireplace Screen', category: 'Doors & screens', kind: 'accessory', cost: 58, price: 119, reorder: [3, 6], vendorId: 'v-ozark', stock: { 'osage-beach': [6, 1], nixa: [4, 1] } },

  // Mantels & stone
  { id: 'MAG-MANTEL60', brand: 'MagraHearth', name: 'Stone Mantel 60 in., Bluestone', category: 'Mantels & stone', kind: 'accessory', cost: 380, price: 690, reorder: [1, 2], vendorId: 'v-stone', stock: { 'osage-beach': [2, 1], nixa: [1, 0] } },
  { id: 'CS-SLEDGE', brand: 'Cultured Stone', name: 'Southern Ledgestone, 10 sq ft box', category: 'Mantels & stone', kind: 'accessory', uom: 'box', cost: 78, price: 135, reorder: [10, 20], vendorId: 'v-stone', stock: { 'osage-beach': [24, 0], nixa: [18, 0] } },
  { id: 'RS-SHADOW', brand: 'Realstone Systems', name: 'Shadowstone Panels, Charcoal, 6 sq ft', category: 'Mantels & stone', kind: 'accessory', uom: 'box', cost: 64, price: 115, reorder: [8, 16], vendorId: 'v-stone', stock: { 'osage-beach': [20, 0], nixa: [12, 0] } },

  // Venting
  { id: 'DV-DVP36', brand: 'DuraVent', name: 'DirectVent Pro 4×6⅝ in. Pipe, 36 in.', category: 'Venting', kind: 'part', cost: 46, price: 89, reorder: [8, 12], vendorId: 'v-venting', stock: { 'osage-beach': [14, 0], nixa: [10, 0] } },
  { id: 'DV-DVP-ELB', brand: 'DuraVent', name: 'DirectVent Pro 4×6⅝ in. 45° Elbow', category: 'Venting', kind: 'part', cost: 31, price: 59, reorder: [6, 10], vendorId: 'v-venting', stock: { 'osage-beach': [9, 0], nixa: [6, 0] } },
  { id: 'DV-DB648', brand: 'DuraVent', name: 'DuraBlack 6 in. Stove Pipe, 48 in.', category: 'Venting', kind: 'part', cost: 38, price: 72, reorder: [4, 8], vendorId: 'v-venting', stock: { 'osage-beach': [6, 0], nixa: [2, 0] } },
  { id: 'LINER-6SS', brand: 'HMI Supply', name: '6 in. Stainless Chimney Liner Kit, 25 ft', category: 'Venting', kind: 'part', cost: 390, price: 690, reorder: [2, 2], vendorId: 'v-venting', stock: { 'osage-beach': [2, 0], nixa: [1, 0] } },
  { id: 'HYC-CAP13', brand: 'Hy-C', name: 'Stainless Chimney Cap, 13×13 in.', category: 'Venting', kind: 'part', cost: 62, price: 119, reorder: [3, 4], vendorId: 'v-venting', stock: { 'osage-beach': [5, 0], nixa: [3, 0] } },

  // Service parts
  { id: 'P-THERMOCPL', brand: 'HMI Supply', name: 'Thermocouple, universal 24 in.', category: 'Service parts', kind: 'part', cost: 9, price: 29, reorder: [6, 12], vendorId: 'v-ozark', stock: { 'osage-beach': [14, 0], nixa: [3, 0] } },
  { id: 'P-THERMOPILE', brand: 'HMI Supply', name: 'Thermopile 750 mV', category: 'Service parts', kind: 'part', cost: 18, price: 49, reorder: [4, 8], vendorId: 'v-ozark', stock: { 'osage-beach': [4, 0], nixa: [2, 0] } },
  { id: 'P-PILOT', brand: 'SIT', name: 'Pilot Assembly, 3-Flame', category: 'Service parts', kind: 'part', cost: 64, price: 139, reorder: [2, 4], vendorId: 'v-ozark', stock: { 'osage-beach': [3, 0], nixa: [2, 0] } },
  { id: 'P-PROFLAME2', brand: 'SIT', name: 'Proflame 2 Remote Transmitter', category: 'Service parts', kind: 'part', cost: 95, price: 189, reorder: [2, 4], vendorId: 'v-ozark', stock: { 'osage-beach': [3, 0], nixa: [1, 0] } },
  { id: 'P-RECEIVER', brand: 'SIT', name: 'Proflame 2 Receiver Module', category: 'Service parts', kind: 'part', cost: 118, price: 229, reorder: [2, 3], vendorId: 'v-ozark', stock: { 'osage-beach': [2, 0], nixa: [2, 0] } },
  { id: 'P-IFT-CM', brand: 'Heat & Glo', name: 'IntelliFire Touch Control Module', category: 'Service parts', kind: 'part', cost: 210, price: 385, reorder: [1, 2], vendorId: 'v-hht', stock: { 'osage-beach': [1, 0], nixa: [1, 0] } },
  { id: 'P-VALVE', brand: 'SIT', name: '885 Proflame Gas Valve', category: 'Service parts', kind: 'part', cost: 245, price: 449, reorder: [1, 2], vendorId: 'v-ozark', stock: { 'osage-beach': [1, 0], nixa: [1, 0] } },
  { id: 'P-BATT-BACKUP', brand: 'Heat & Glo', name: 'IntelliFire Battery Backup Pack', category: 'Service parts', kind: 'part', cost: 42, price: 79, reorder: [4, 8], vendorId: 'v-hht', stock: { 'osage-beach': [8, 0], nixa: [5, 0] } },
  { id: 'P-GASKET34', brand: 'HMI Supply', name: 'Fiberglass Rope Gasket ¾ in.', category: 'Service parts', kind: 'part', uom: 'ft', cost: 1.1, price: 3.5, reorder: [40, 100], vendorId: 'v-ozark', stock: { 'osage-beach': [120, 0], nixa: [80, 0] } },
  { id: 'P-GLASS36', brand: 'HMI Supply', name: 'Ceramic Glass Panel, 36 in.', category: 'Service parts', kind: 'part', cost: 210, price: 395, reorder: [0, 1], vendorId: 'v-ozark', stock: { 'osage-beach': [0, 0], nixa: [0, 0] }, specialOrder: true },
  { id: 'P-BLOWER-GFK', brand: 'Heat & Glo', name: 'GFK-160A Blower Kit', category: 'Service parts', kind: 'part', cost: 165, price: 299, reorder: [1, 2], vendorId: 'v-hht', stock: { 'osage-beach': [2, 0], nixa: [0, 0] } },
  { id: 'P-COMB-BLWR', brand: 'Quadra-Fire', name: 'Combustion Blower', category: 'Service parts', kind: 'part', cost: 128, price: 239, reorder: [1, 2], vendorId: 'v-ff', stock: { 'osage-beach': [1, 0], nixa: [1, 0] } },
  { id: 'P-IGNITER', brand: 'Harman', name: 'Pellet Igniter', category: 'Service parts', kind: 'part', cost: 38, price: 79, reorder: [2, 4], vendorId: 'v-ff', stock: { 'osage-beach': [3, 0], nixa: [2, 0] } },
  { id: 'P-AUGER', brand: 'Harman', name: 'Auger Feed Motor', category: 'Service parts', kind: 'part', cost: 96, price: 189, reorder: [1, 2], vendorId: 'v-ff', stock: { 'osage-beach': [1, 0], nixa: [1, 0] } },

  // Accessories & retail
  { id: 'ACC-RUTLAND', brand: 'Rutland', name: 'Gas Fireplace Glass Cleaner, 16 oz', category: 'Accessories', kind: 'accessory', cost: 4.2, price: 11.99, reorder: [12, 36], vendorId: 'v-ozark', stock: { 'osage-beach': [36, 0], nixa: [28, 0] } },
  { id: 'ACC-TOOLSET', brand: 'Stone County Ironworks', name: 'Hand-Forged 4-Piece Tool Set', category: 'Accessories', kind: 'accessory', cost: 92, price: 169, reorder: [2, 4], vendorId: 'v-ozark', stock: { 'osage-beach': [4, 1], nixa: [3, 1] } },
  { id: 'ACC-LOGRACK', brand: 'Hy-C', name: 'Log Rack with Kindling Holder', category: 'Accessories', kind: 'accessory', cost: 54, price: 99, reorder: [2, 4], vendorId: 'v-venting', stock: { 'osage-beach': [5, 1], nixa: [4, 1] } },
  { id: 'ACC-HEARTHPAD', brand: 'Imperial', name: 'Hearth Pad 36×52 in.', category: 'Accessories', kind: 'accessory', cost: 160, price: 289, reorder: [1, 2], vendorId: 'v-ozark', stock: { 'osage-beach': [2, 0], nixa: [2, 0] } },
  { id: 'ACC-PELLETS', brand: 'HMI Supply', name: 'Premium Wood Pellets, 40 lb bag', category: 'Accessories', kind: 'accessory', uom: 'bag', cost: 4.9, price: 7.99, reorder: [100, 200], vendorId: 'v-ozark', stock: { 'osage-beach': [160, 0], nixa: [240, 0] } },
];

const photoFor: Partial<Record<ItemCategory, string>> = {
  'Gas fireplaces': 'gas',
  'Wood fireplaces': 'wood',
  'Electric fireplaces': 'electric',
  Inserts: 'insert',
  Stoves: 'stove',
  'Gas logs': 'logs',
  Outdoor: 'outdoor',
  'Doors & screens': 'doors',
  'Mantels & stone': 'stone',
  Accessories: 'accessories',
};

export function buildItems(): Item[] {
  const others: Item[] = entries.map((e) => ({
    id: e.id,
    name: e.name,
    brand: e.brand,
    category: e.category,
    kind: e.kind,
    fuel: e.fuel,
    uom: e.uom ?? 'ea',
    cost: e.cost,
    price: e.price,
    reorderPoint: e.reorder[0],
    reorderQty: e.reorder[1],
    vendorId: e.vendorId,
    stock: {
      'osage-beach': { onHand: e.stock['osage-beach'][0], reserved: 0, display: e.stock['osage-beach'][1] },
      nixa: { onHand: e.stock.nixa[0], reserved: 0, display: e.stock.nixa[1] },
    },
    warranty: e.warranty,
    photo: e.id === 'ACC-RUTLAND' ? 'care' : photoFor[e.category],
    specialOrder: e.specialOrder,
  }));
  return [...unitItems(), ...others];
}

export const vendors: Vendor[] = [
  { id: 'v-hht', name: 'Hearth & Home Technologies', kind: 'manufacturer', terms: 'Net 30', account: 'HMI-20417', category: 'Inventory purchases' },
  { id: 'v-ff', name: 'Forge & Flame', kind: 'manufacturer', terms: 'Net 30', account: 'FF-88120', category: 'Inventory purchases' },
  { id: 'v-travis', name: 'Travis Industries', kind: 'manufacturer', terms: 'Net 30', account: 'TI-5521', category: 'Inventory purchases' },
  { id: 'v-hearthstone', name: 'HearthStone Stoves', kind: 'manufacturer', terms: 'Net 30', category: 'Inventory purchases' },
  { id: 'v-kozy', name: 'Kozy Heat Fireplaces', kind: 'manufacturer', terms: 'Net 30', category: 'Inventory purchases' },
  { id: 'v-empire', name: 'Empire Comfort Systems', kind: 'manufacturer', terms: 'Net 30', category: 'Inventory purchases' },
  { id: 'v-monessen', name: 'Monessen Hearth', kind: 'manufacturer', terms: 'Net 30', category: 'Inventory purchases' },
  { id: 'v-dimplex', name: 'Dimplex North America', kind: 'manufacturer', terms: 'Net 30', category: 'Inventory purchases' },
  { id: 'v-kuma', name: 'Kuma Stoves', kind: 'manufacturer', terms: 'Net 30', category: 'Inventory purchases' },
  { id: 'v-hpc', name: 'HPC Fire', kind: 'manufacturer', terms: 'Net 30', category: 'Inventory purchases' },
  // Fictional suppliers for parts, venting and stone
  { id: 'v-ozark', name: 'Ozark Hearth Supply', kind: 'distributor', terms: 'Net 30', account: 'OHS-1975', category: 'Inventory purchases' },
  { id: 'v-venting', name: 'Show-Me Venting & Supply', kind: 'distributor', terms: 'Net 30', category: 'Inventory purchases' },
  { id: 'v-stone', name: 'Midwest Stone Source', kind: 'distributor', terms: 'Net 30', category: 'Inventory purchases' },
  // Operating expenses (fictional payees)
  { id: 'v-lease-ob', name: 'Lakeview Commercial Properties', kind: 'property', terms: 'Due on receipt', category: 'Rent & utilities' },
  { id: 'v-lease-nixa', name: 'Northpoint Holdings LLC', kind: 'property', terms: 'Due on receipt', category: 'Rent & utilities' },
  { id: 'v-util-ob', name: 'Utilities — Osage Beach', kind: 'utilities', terms: 'Net 15', category: 'Rent & utilities' },
  { id: 'v-util-nixa', name: 'Utilities — Nixa', kind: 'utilities', terms: 'Net 15', category: 'Rent & utilities' },
  { id: 'v-fuel', name: 'Fleet Fuel Card', kind: 'services', terms: 'Net 15', category: 'Vehicles & fuel' },
  { id: 'v-insurance', name: 'Show-Me Commercial Insurance', kind: 'services', terms: 'Net 30', category: 'Insurance' },
  { id: 'v-media', name: 'Lake Area Media Group', kind: 'services', terms: 'Net 30', category: 'Marketing' },
  { id: 'v-cpa', name: 'Miller & Associates CPAs', kind: 'services', terms: 'Net 30', category: 'Professional services' },
  { id: 'v-software', name: 'Phone, internet & software', kind: 'services', terms: 'Due on receipt', category: 'Software & fees' },
  { id: 'v-tools', name: 'Contractor Tool & Supply', kind: 'distributor', terms: 'Net 30', category: 'Supplies & tools' },
];

/* ---------- Service reference data ---------- */

export interface IssueDef {
  label: string;
  /** Inventory parts typically used to fix it */
  parts: string[];
}

export const issues: Record<string, IssueDef> = {
  pilot: { label: 'Pilot won’t stay lit', parts: ['P-THERMOCPL', 'P-THERMOPILE', 'P-PILOT'] },
  ignition: { label: 'Ignition failure', parts: ['P-IGNITER', 'P-PILOT'] },
  controls: { label: 'Remote or controls', parts: ['P-PROFLAME2', 'P-RECEIVER', 'P-IFT-CM'] },
  blower: { label: 'Blower noise or failure', parts: ['P-BLOWER-GFK', 'P-COMB-BLWR'] },
  glass: { label: 'Glass, door or gasket', parts: ['P-GASKET34', 'P-GLASS36'] },
  soot: { label: 'Sooting or odor', parts: [] },
  venting: { label: 'Venting or draft', parts: ['DV-DVP-ELB', 'HYC-CAP13'] },
  valve: { label: 'Gas valve', parts: ['P-VALVE'] },
  auger: { label: 'Auger or pellet feed', parts: ['P-AUGER'] },
  power: { label: 'Battery backup or power', parts: ['P-BATT-BACKUP'] },
  heater: { label: 'Heater or flame effect', parts: [] },
};

export type FuelClass = 'gas' | 'wood' | 'pellet' | 'electric';

export const fuelClass = (fuel: string | undefined): FuelClass =>
  fuel === 'Wood' ? 'wood' : fuel === 'Pellet' ? 'pellet' : fuel === 'Electric' ? 'electric' : 'gas';

/** How often each issue shows up, by fuel */
export const issueWeights: Record<FuelClass, [string, number][]> = {
  gas: [['pilot', 26], ['controls', 18], ['ignition', 12], ['blower', 10], ['glass', 8], ['soot', 8], ['power', 7], ['venting', 6], ['valve', 5]],
  wood: [['glass', 42], ['venting', 40], ['blower', 18]],
  pellet: [['ignition', 30], ['auger', 22], ['blower', 22], ['venting', 14], ['glass', 12]],
  electric: [['controls', 55], ['heater', 45]],
};

/**
 * Appliances HMI services but didn't sell. These groups carry the high service rates in the
 * reliability report — no real product is singled out.
 */
export const legacyGroups: Record<string, { label: string; category: ItemCategory; fuel: Fuel; factor: number; boost: string[] }> = {
  'legacy-builder-gas': { label: 'Builder-grade gas fireplace (installed by others)', category: 'Gas fireplaces', fuel: 'Natural gas', factor: 4.6, boost: ['pilot', 'valve', 'soot'] },
  'legacy-vent-free': { label: 'Older vent-free log set (installed by others)', category: 'Gas logs', fuel: 'Propane', factor: 4.2, boost: ['pilot', 'soot'] },
  'legacy-pellet': { label: 'Older pellet stove (sold elsewhere)', category: 'Stoves', fuel: 'Pellet', factor: 3.9, boost: ['ignition', 'auger'] },
  'legacy-wood': { label: 'Older factory-built wood fireplace', category: 'Wood fireplaces', fuel: 'Wood', factor: 2.8, boost: ['venting', 'glass'] },
};

/** Standard hours, labor and materials for an installation, by category */
export const installStandards: Partial<Record<ItemCategory, { hours: number; labor: number; materials: number; materialsLabel: string }>> = {
  'Gas fireplaces': { hours: 8, labor: 1850, materials: 640, materialsLabel: 'Direct-vent kit, gas line & framing materials' },
  'Wood fireplaces': { hours: 11, labor: 2600, materials: 1450, materialsLabel: 'Class A chimney system & firestops' },
  'Electric fireplaces': { hours: 3.5, labor: 650, materials: 120, materialsLabel: 'Electrical rough-in & mounting hardware' },
  Inserts: { hours: 5.5, labor: 1150, materials: 690, materialsLabel: 'Liner kit, surround & block-off plate' },
  Stoves: { hours: 6, labor: 1050, materials: 560, materialsLabel: 'Stovepipe, chimney connector & hearth protection' },
  'Gas logs': { hours: 2.5, labor: 375, materials: 90, materialsLabel: 'Gas connector, key valve & media' },
  Outdoor: { hours: 8, labor: 1650, materials: 420, materialsLabel: 'Gas line & outdoor-rated components' },
};

export const checklists: Record<JobType | 'maintenance-wood' | 'maintenance-pellet', string[]> = {
  install: [
    'Confirm model, fuel type and clearances',
    'Protect floors and work area',
    'Set unit and secure framing',
    'Install venting and termination',
    'Connect gas or electrical',
    'Leak test and check manifold pressure',
    'Test burn and adjust flame',
    'Install trim, doors and media',
    'Walk customer through operation',
    'Register warranty with manufacturer',
  ],
  maintenance: [
    'Clean burner, pilot assembly and logs',
    'Clean glass and check gasket',
    'Test thermocouple / thermopile output',
    'Inspect venting and termination',
    'Test remote, batteries and battery backup',
    'Check gas pressure and leak test',
    'Clean blower and fan',
  ],
  'maintenance-wood': [
    'Sweep chimney and flue',
    'Inspect firebox, baffle and bricks',
    'Check door gasket and glass',
    'Inspect cap and termination',
    'Check clearances and hearth protection',
  ],
  'maintenance-pellet': [
    'Clean burn pot and heat exchanger',
    'Vacuum ash and exhaust passages',
    'Inspect igniter and auger',
    'Clean combustion and convection blowers',
    'Check door gasket and run a test cycle',
  ],
  repair: ['Diagnose and confirm the issue with the customer', 'Repair or replace parts', 'Test through a full cycle', 'Review the fix with the customer'],
  warranty: ['Confirm serial number and coverage', 'Photograph the failed part', 'Replace the part', 'Test operation', 'Submit claim paperwork'],
  estimate: ['Measure the opening and framing', 'Check venting route and gas supply', 'Photograph the space', 'Discuss options and budget', 'Send the estimate within 48 hours'],
  delivery: ['Confirm delivery window with customer', 'Load and secure the order', 'Deliver and place', 'Collect signature'],
};

export const jobTypeLabels: Record<JobType, string> = {
  estimate: 'Estimate',
  install: 'Installation',
  maintenance: 'Maintenance',
  repair: 'Repair',
  warranty: 'Warranty service',
  delivery: 'Delivery',
};

export const fuelLabel = (fuel: Item['fuel'] | Fuel | undefined) => (fuel === 'Gas' ? 'Gas (NG/LP)' : fuel ?? '—');
