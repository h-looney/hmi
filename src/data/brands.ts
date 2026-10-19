/**
 * Brands HMI lists on the current site. URLs were checked in Oct 2026:
 * Quadra-Fire, Harman and Vermont Castings now live under Forge & Flame.
 * Avalon and Heatilator Eco Choice were dropped — their old links now redirect
 * to other brands (likely discontinued). TODO: confirm with HMI.
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
  url?: string;
  blurb: string;
  categories: BrandCategory[];
}

export const brands: Brand[] = [
  {
    id: 'heat-glo',
    name: 'Heat & Glo',
    url: 'https://www.heatnglo.com',
    blurb: 'Gas, wood and outdoor fireplaces, inserts and log sets.',
    categories: ['Fireplaces', 'Inserts', 'Outdoor', 'Gas logs'],
  },
  {
    id: 'heatilator',
    name: 'Heatilator',
    url: 'https://www.heatilator.com',
    blurb: 'Gas, wood and electric fireplaces and inserts.',
    categories: ['Fireplaces', 'Inserts', 'Electric'],
  },
  {
    id: 'quadra-fire',
    name: 'Quadra-Fire',
    url: 'https://forgenflame.com/pages/quadra-fire',
    blurb: 'Wood, gas and pellet stoves, inserts and fireplaces.',
    categories: ['Fireplaces', 'Inserts', 'Stoves'],
  },
  {
    id: 'vermont-castings',
    name: 'Vermont Castings',
    url: 'https://forgenflame.com/pages/vermont-castings',
    blurb: 'Classic cast-iron wood and gas stoves.',
    categories: ['Stoves'],
  },
  {
    id: 'harman',
    name: 'Harman',
    url: 'https://forgenflame.com/pages/harman',
    blurb: 'Pellet and wood stoves and inserts.',
    categories: ['Stoves', 'Inserts'],
  },
  {
    id: 'hearthstone',
    name: 'Hearthstone',
    url: 'https://www.hearthstonestoves.com',
    blurb: 'Soapstone and cast-iron stoves, inserts and fireplaces.',
    categories: ['Stoves', 'Inserts', 'Fireplaces'],
  },
  {
    id: 'lopi',
    name: 'Lopi',
    url: 'https://www.lopistoves.com',
    blurb: 'Wood, gas and pellet stoves and inserts.',
    categories: ['Stoves', 'Inserts'],
  },
  {
    id: 'fireplace-x',
    name: 'Fireplace Xtrordinair',
    url: 'https://www.fireplacex.com',
    blurb: 'High-output wood and gas fireplaces and inserts.',
    categories: ['Fireplaces', 'Inserts'],
  },
  {
    id: 'kozy-heat',
    name: 'Kozy Heat',
    url: 'https://www.kozyheat.com',
    blurb: 'Gas and wood fireplaces and inserts.',
    categories: ['Fireplaces', 'Inserts'],
  },
  {
    id: 'davinci',
    name: 'DaVinci Custom Fireplaces',
    url: 'https://www.davincifireplace.com',
    blurb: 'Made-to-order linear gas fireplaces.',
    categories: ['Fireplaces', 'Outdoor'],
  },
  {
    id: 'montigo',
    name: 'Montigo',
    url: 'https://www.montigo.com',
    blurb: 'Contemporary gas fireplaces and inserts.',
    categories: ['Fireplaces', 'Inserts', 'Outdoor'],
  },
  {
    id: 'monessen',
    name: 'Monessen',
    url: 'https://www.monessenhearth.com',
    blurb: 'Gas fireplaces, vent-free products and log sets.',
    categories: ['Fireplaces', 'Gas logs', 'Inserts', 'Outdoor'],
  },
  {
    id: 'empire',
    name: 'Empire Comfort Systems',
    url: 'https://www.empirecomfort.com',
    blurb: 'Gas fireplaces, stoves, inserts, logs and vent-free heat.',
    categories: ['Fireplaces', 'Gas logs', 'Inserts', 'Stoves', 'Outdoor'],
  },
  {
    id: 'mason-lite',
    name: 'Mason-Lite',
    url: 'https://www.mason-lite.com',
    blurb: 'Lightweight precast masonry fireplace kits.',
    categories: ['Fireplaces', 'Outdoor'],
  },
  {
    id: 'kuma',
    name: 'Kuma Stoves',
    url: 'https://www.kumastoves.com',
    blurb: 'Hand-built wood stoves and inserts.',
    categories: ['Stoves', 'Inserts'],
  },
  {
    id: 'hpc',
    name: 'HPC Fire',
    url: 'https://www.hpcfire.com',
    blurb: 'Outdoor fire pits and fire features.',
    categories: ['Outdoor'],
  },
  {
    id: 'dimplex',
    name: 'Dimplex',
    url: 'https://www.dimplex.com',
    blurb: 'Electric fireplaces, inserts and media walls.',
    categories: ['Electric'],
  },
  {
    id: 'hargrove',
    name: 'Hargrove',
    url: 'https://www.hargrovegaslogs.com',
    blurb: 'Hand-painted gas log sets.',
    categories: ['Gas logs'],
  },
  {
    id: 'magrahearth',
    name: 'MagraHearth',
    url: 'https://magrahearth.com',
    blurb: 'Lightweight stone-look mantels and hearths.',
    categories: ['Doors & mantels'],
  },
  {
    id: 'iron-haus',
    name: 'Iron Haus',
    url: 'https://ironhaus.com',
    blurb: 'Custom fireplace doors and screens.',
    categories: ['Doors & mantels'],
  },
  {
    id: 'stoll',
    name: 'Stoll',
    url: 'https://www.stollindustries.com',
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
    url: 'https://www.thermo-rite.com',
    blurb: 'Fireplace doors and screens.',
    categories: ['Doors & mantels'],
  },
  {
    id: 'cultured-stone',
    name: 'Cultured Stone',
    url: 'https://www.culturedstone.com',
    blurb: 'Manufactured stone veneer.',
    categories: ['Stone'],
  },
  {
    id: 'realstone',
    name: 'Realstone Systems',
    url: 'https://www.realstonesystems.com',
    blurb: 'Natural thin-stone veneer panels.',
    categories: ['Stone'],
  },
  {
    id: 'imperial',
    name: 'Imperial',
    url: 'https://www.imperialgroup.ca',
    blurb: 'Hearth tools, care and maintenance products.',
    categories: ['Accessories'],
  },
  {
    id: 'hy-c',
    name: 'Hy-C',
    url: 'https://www.hy-c.com',
    blurb: 'Chimney, venting and hearth care products.',
    categories: ['Accessories'],
  },
  {
    id: 'uniflame',
    name: 'Uniflame',
    url: 'https://www.uniflame.com',
    blurb: 'Fireplace screens, tool sets and accessories.',
    categories: ['Accessories'],
  },
  {
    id: 'blue-rhino',
    name: 'Blue Rhino',
    url: 'https://bluerhino.com',
    blurb: 'Propane and outdoor living products.',
    categories: ['Accessories', 'Outdoor'],
  },
  {
    id: 'stone-county',
    name: 'Stone County Ironworks',
    url: 'https://www.stonecountyironworks.com',
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
