/**
 * The brand directory: names, short descriptions and product types for the brands HMI lists.
 *
 * Every outbound link (each brand's site, owner-support page and model pages) lives in the product list,
 * src/data/products.ts, so the nightly link checker can test it and /go/<brand>/ can fall back if it breaks.
 * Avalon and Heatilator Eco Choice were dropped — their old links now land on other brands' sites. TODO: confirm
 * with HMI.
 */

export type BrandCategory =
  | 'Fireplaces'
  | 'Inserts'
  | 'Stoves'
  | 'Gas logs'
  | 'Outdoor'
  | 'Electric'
  | 'Doors & mantels'
  | 'Stone'
  | 'Accessories';

export interface Brand {
  id: string;
  name: string;
  blurb: string;
  categories: BrandCategory[];
}

export const brands: Brand[] = [
  {
    id: 'heat-glo',
    name: 'Heat & Glo',
    blurb: 'Gas, wood and outdoor fireplaces, inserts and log sets.',
    categories: ['Fireplaces', 'Inserts', 'Outdoor', 'Gas logs'],
  },
  {
    id: 'heatilator',
    name: 'Heatilator',
    blurb: 'Gas, wood and electric fireplaces and inserts.',
    categories: ['Fireplaces', 'Inserts', 'Electric'],
  },
  {
    id: 'quadra-fire',
    name: 'Quadra-Fire',
    blurb: 'Wood, gas and pellet stoves, inserts and fireplaces.',
    categories: ['Fireplaces', 'Inserts', 'Stoves'],
  },
  {
    id: 'vermont-castings',
    name: 'Vermont Castings',
    blurb: 'Classic cast-iron wood and gas stoves.',
    categories: ['Stoves'],
  },
  {
    id: 'harman',
    name: 'Harman',
    blurb: 'Pellet and wood stoves and inserts.',
    categories: ['Stoves', 'Inserts'],
  },
  {
    id: 'hearthstone',
    name: 'Hearthstone',
    blurb: 'Soapstone and cast-iron stoves, inserts and fireplaces.',
    categories: ['Stoves', 'Inserts', 'Fireplaces'],
  },
  {
    id: 'lopi',
    name: 'Lopi',
    blurb: 'Wood, gas and pellet stoves and inserts.',
    categories: ['Stoves', 'Inserts'],
  },
  {
    id: 'fireplace-x',
    name: 'Fireplace Xtrordinair',
    blurb: 'High-output wood and gas fireplaces and inserts.',
    categories: ['Fireplaces', 'Inserts'],
  },
  {
    id: 'kozy-heat',
    name: 'Kozy Heat',
    blurb: 'Gas and wood fireplaces and inserts.',
    categories: ['Fireplaces', 'Inserts'],
  },
  {
    id: 'davinci',
    name: 'DaVinci Custom Fireplaces',
    blurb: 'Made-to-order linear gas fireplaces.',
    categories: ['Fireplaces', 'Outdoor'],
  },
  {
    id: 'montigo',
    name: 'Montigo',
    blurb: 'Contemporary gas fireplaces and inserts.',
    categories: ['Fireplaces', 'Inserts', 'Outdoor'],
  },
  {
    id: 'monessen',
    name: 'Monessen',
    blurb: 'Gas fireplaces, vent-free products and log sets.',
    categories: ['Fireplaces', 'Gas logs', 'Inserts', 'Outdoor'],
  },
  {
    id: 'empire',
    name: 'Empire Comfort Systems',
    blurb: 'Gas fireplaces, stoves, inserts, logs and vent-free heat.',
    categories: ['Fireplaces', 'Gas logs', 'Inserts', 'Stoves', 'Outdoor'],
  },
  {
    id: 'mason-lite',
    name: 'Mason-Lite',
    blurb: 'Lightweight precast masonry fireplace kits.',
    categories: ['Fireplaces', 'Outdoor'],
  },
  {
    id: 'kuma',
    name: 'Kuma Stoves',
    blurb: 'Hand-built wood stoves and inserts.',
    categories: ['Stoves', 'Inserts'],
  },
  {
    id: 'hpc',
    name: 'HPC Fire',
    blurb: 'Outdoor fire pits and fire features.',
    categories: ['Outdoor'],
  },
  {
    id: 'dimplex',
    name: 'Dimplex',
    blurb: 'Electric fireplaces, inserts and media walls.',
    categories: ['Electric'],
  },
  {
    id: 'hargrove',
    name: 'Hargrove',
    blurb: 'Hand-painted gas log sets.',
    categories: ['Gas logs'],
  },
  {
    id: 'magrahearth',
    name: 'MagraHearth',
    blurb: 'Lightweight stone-look mantels and hearths.',
    categories: ['Doors & mantels'],
  },
  {
    id: 'iron-haus',
    name: 'Iron Haus',
    blurb: 'Custom fireplace doors and screens.',
    categories: ['Doors & mantels'],
  },
  {
    id: 'stoll',
    name: 'Stoll',
    blurb: 'Custom fireplace doors and screens.',
    categories: ['Doors & mantels'],
  },
  {
    id: 'design-specialties',
    name: 'Design Specialties',
    blurb: 'Custom glass fireplace doors.',
    categories: ['Doors & mantels'],
  },
  {
    id: 'thermo-rite',
    name: 'Thermo-Rite',
    blurb: 'Fireplace doors and screens.',
    categories: ['Doors & mantels'],
  },
  {
    id: 'cultured-stone',
    name: 'Cultured Stone',
    blurb: 'Manufactured stone veneer.',
    categories: ['Stone'],
  },
  {
    id: 'realstone',
    name: 'Realstone Systems',
    blurb: 'Natural thin-stone veneer panels.',
    categories: ['Stone'],
  },
  {
    id: 'imperial',
    name: 'Imperial',
    blurb: 'Hearth tools, care and maintenance products.',
    categories: ['Accessories'],
  },
  {
    id: 'hy-c',
    name: 'Hy-C',
    blurb: 'Chimney, venting and hearth care products.',
    categories: ['Accessories'],
  },
  {
    id: 'uniflame',
    name: 'Uniflame',
    blurb: 'Fireplace screens, tool sets and accessories.',
    categories: ['Accessories'],
  },
  {
    id: 'blue-rhino',
    name: 'Blue Rhino',
    blurb: 'Propane and outdoor living products.',
    categories: ['Accessories', 'Outdoor'],
  },
  {
    id: 'stone-county',
    name: 'Stone County Ironworks',
    blurb: 'Hand-forged iron hearth accessories.',
    categories: ['Accessories'],
  },
];

export const brandCategories: BrandCategory[] = [
  'Fireplaces',
  'Inserts',
  'Stoves',
  'Gas logs',
  'Outdoor',
  'Electric',
  'Doors & mantels',
  'Stone',
  'Accessories',
];

const byId = new Map(brands.map((b) => [b.id, b]));

export const getBrands = (ids: string[]) =>
  ids.map((id) => {
    const brand = byId.get(id);
    if (!brand) throw new Error(`Unknown brand id: ${id}`);
    return brand;
  });

/** Featured hearth brands for marquee strips (most recognizable first). */
export const featuredBrandIds = [
  'heat-glo',
  'quadra-fire',
  'vermont-castings',
  'heatilator',
  'hearthstone',
  'lopi',
  'fireplace-x',
  'harman',
  'kozy-heat',
  'davinci',
  'montigo',
  'monessen',
  'empire',
  'dimplex',
  'hargrove',
  'mason-lite',
  'kuma',
];
