/**
 * Sample catalog, vendors and service reference data for HMI mode.
 *
 * Brands and model names are products HMI carries (see src/data/brands.ts) so the demo feels
 * familiar. Costs, prices, stock and every performance figure built on them are invented.
 */
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

const entries: CatalogEntry[] = [
  // Gas fireplaces
  { id: 'HG-6000C', brand: 'Heat & Glo', name: '6000C Clean Face Gas Fireplace', category: 'Gas fireplaces', kind: 'unit', fuel: 'Gas', cost: 2650, price: 4290, reorder: [2, 2], vendorId: 'v-hht', stock: { 'osage-beach': [3, 1], nixa: [2, 1] }, warranty: W.hht },
  { id: 'HG-SL750', brand: 'Heat & Glo', name: 'SL-750TRS-IPI Gas Fireplace', category: 'Gas fireplaces', kind: 'unit', fuel: 'Gas', cost: 1890, price: 3150, reorder: [2, 2], vendorId: 'v-hht', stock: { 'osage-beach': [3, 0], nixa: [2, 0] }, warranty: W.hht },
  { id: 'HG-MEZZO48', brand: 'Heat & Glo', name: 'Mezzo 48 Linear Gas Fireplace', category: 'Gas fireplaces', kind: 'unit', fuel: 'Gas', cost: 3890, price: 6290, reorder: [1, 1], vendorId: 'v-hht', stock: { 'osage-beach': [2, 1], nixa: [1, 1] }, warranty: W.hht },
  { id: 'HTL-CNXT36', brand: 'Heatilator', name: 'Caliber nXt 36 Gas Fireplace', category: 'Gas fireplaces', kind: 'unit', fuel: 'Gas', cost: 1420, price: 2390, reorder: [3, 3], vendorId: 'v-hht', stock: { 'osage-beach': [4, 0], nixa: [3, 0] }, warranty: W.hht },
  { id: 'FPX-564TRV', brand: 'Fireplace Xtrordinair', name: '564 TRV 31K Deluxe Gas Fireplace', category: 'Gas fireplaces', kind: 'unit', fuel: 'Gas', cost: 3350, price: 5490, reorder: [1, 2], vendorId: 'v-travis', stock: { 'osage-beach': [3, 1], nixa: [1, 1] }, warranty: W.premium },
  { id: 'FPX-PB42', brand: 'Fireplace Xtrordinair', name: 'ProBuilder 42 Linear GSR2', category: 'Gas fireplaces', kind: 'unit', fuel: 'Gas', cost: 2210, price: 3690, reorder: [2, 2], vendorId: 'v-travis', stock: { 'osage-beach': [2, 0], nixa: [2, 0] }, warranty: W.premium },
  { id: 'KH-CHASKA34', brand: 'Kozy Heat', name: 'Chaska 34 Gas Fireplace', category: 'Gas fireplaces', kind: 'unit', fuel: 'Gas', cost: 2080, price: 3450, reorder: [1, 2], vendorId: 'v-kozy', stock: { 'osage-beach': [1, 0], nixa: [2, 1] }, warranty: W.standard },
  { id: 'KH-CALLAWAY50', brand: 'Kozy Heat', name: 'Callaway 50 Linear Gas Fireplace', category: 'Gas fireplaces', kind: 'unit', fuel: 'Gas', cost: 3120, price: 5150, reorder: [1, 1], vendorId: 'v-kozy', stock: { 'osage-beach': [0, 0], nixa: [1, 1] }, warranty: W.standard },
  { id: 'EMP-TAHOE36', brand: 'Empire', name: 'Tahoe Premium 36 Direct-Vent Fireplace', category: 'Gas fireplaces', kind: 'unit', fuel: 'Gas', cost: 1750, price: 2890, reorder: [1, 2], vendorId: 'v-empire', stock: { 'osage-beach': [2, 0], nixa: [1, 0] }, warranty: W.standard },
  { id: 'EMP-BLVD48', brand: 'Empire', name: 'Boulevard 48 Linear Fireplace', category: 'Gas fireplaces', kind: 'unit', fuel: 'Gas', cost: 2380, price: 3950, reorder: [1, 1], vendorId: 'v-empire', stock: { 'osage-beach': [1, 1], nixa: [1, 0] }, warranty: W.standard },
  { id: 'MON-ART42', brand: 'Monessen', name: 'Artisan 42 Vent-Free Fireplace', category: 'Gas fireplaces', kind: 'unit', fuel: 'Gas', cost: 1580, price: 2650, reorder: [1, 1], vendorId: 'v-monessen', stock: { 'osage-beach': [1, 1], nixa: [0, 0] }, warranty: W.standard },

  // Wood fireplaces
  { id: 'HTL-ICON100', brand: 'Heatilator', name: 'Icon 100 Wood Fireplace', category: 'Wood fireplaces', kind: 'unit', fuel: 'Wood', cost: 2450, price: 3990, reorder: [1, 1], vendorId: 'v-hht', stock: { 'osage-beach': [1, 0], nixa: [1, 0] }, warranty: W.hht },
  { id: 'FPX-42APEX', brand: 'Fireplace Xtrordinair', name: '42 Apex Clean-Face Wood Fireplace', category: 'Wood fireplaces', kind: 'unit', fuel: 'Wood', cost: 3980, price: 6450, reorder: [1, 1], vendorId: 'v-travis', stock: { 'osage-beach': [1, 1], nixa: [0, 0] }, warranty: W.premium },
  { id: 'ML-36', brand: 'Mason-Lite', name: '36 Precast Masonry Fireplace Kit', category: 'Wood fireplaces', kind: 'unit', fuel: 'Wood', cost: 2900, price: 4750, reorder: [0, 1], vendorId: 'v-ozark', stock: { 'osage-beach': [0, 0], nixa: [1, 0] }, warranty: W.standard },

  // Electric
  { id: 'DIM-RBF42', brand: 'Dimplex', name: 'Revillusion 42 Built-in Firebox', category: 'Electric fireplaces', kind: 'unit', fuel: 'Electric', cost: 980, price: 1690, reorder: [2, 3], vendorId: 'v-dimplex', stock: { 'osage-beach': [3, 1], nixa: [2, 1] }, warranty: W.electric },
  { id: 'DIM-XLF60', brand: 'Dimplex', name: 'IgniteXL 60 Linear Electric Fireplace', category: 'Electric fireplaces', kind: 'unit', fuel: 'Electric', cost: 760, price: 1299, reorder: [2, 4], vendorId: 'v-dimplex', stock: { 'osage-beach': [2, 0], nixa: [4, 1] }, warranty: W.electric },
  { id: 'DIM-OMC1000', brand: 'Dimplex', name: 'Opti-myst Pro 1000 Cassette', category: 'Electric fireplaces', kind: 'unit', fuel: 'Electric', cost: 1050, price: 1850, reorder: [1, 2], vendorId: 'v-dimplex', stock: { 'osage-beach': [1, 1], nixa: [1, 0] }, warranty: W.electric },

  // Inserts
  { id: 'HG-ESC-I35', brand: 'Heat & Glo', name: 'Escape-I35 Gas Insert', category: 'Inserts', kind: 'unit', fuel: 'Gas', cost: 2050, price: 3390, reorder: [2, 2], vendorId: 'v-hht', stock: { 'osage-beach': [2, 1], nixa: [2, 0] }, warranty: W.hht },
  { id: 'LOPI-DVL', brand: 'Lopi', name: 'DVL GS2 Gas Insert', category: 'Inserts', kind: 'unit', fuel: 'Gas', cost: 2290, price: 3790, reorder: [2, 2], vendorId: 'v-travis', stock: { 'osage-beach': [1, 0], nixa: [3, 1] }, warranty: W.premium },
  { id: 'LOPI-REVERE', brand: 'Lopi', name: 'Revere NexGen-Fyre Wood Insert', category: 'Inserts', kind: 'unit', fuel: 'Wood', cost: 2380, price: 3890, reorder: [1, 2], vendorId: 'v-travis', stock: { 'osage-beach': [1, 0], nixa: [2, 1] }, warranty: W.premium },
  { id: 'FPX-616GSR2', brand: 'Fireplace Xtrordinair', name: '616 GSR2 Grand Deluxe Gas Insert', category: 'Inserts', kind: 'unit', fuel: 'Gas', cost: 2780, price: 4590, reorder: [1, 1], vendorId: 'v-travis', stock: { 'osage-beach': [1, 1], nixa: [1, 0] }, warranty: W.premium },
  { id: 'KH-SPRING22', brand: 'Kozy Heat', name: 'Springfield 22 Gas Insert', category: 'Inserts', kind: 'unit', fuel: 'Gas', cost: 1690, price: 2790, reorder: [1, 2], vendorId: 'v-kozy', stock: { 'osage-beach': [0, 0], nixa: [2, 0] }, warranty: W.standard },
  { id: 'HAR-ACC52I', brand: 'Harman', name: 'Accentra52i Pellet Insert', category: 'Inserts', kind: 'unit', fuel: 'Pellet', cost: 2950, price: 4890, reorder: [1, 1], vendorId: 'v-ff', stock: { 'osage-beach': [1, 0], nixa: [1, 1] }, warranty: W.pellet },
  { id: 'QF-CASTILE', brand: 'Quadra-Fire', name: 'Castile Pellet Insert', category: 'Inserts', kind: 'unit', fuel: 'Pellet', cost: 2380, price: 3950, reorder: [1, 1], vendorId: 'v-ff', stock: { 'osage-beach': [1, 0], nixa: [0, 0] }, warranty: W.pellet },
  { id: 'HS-CLYDESDALE', brand: 'Hearthstone', name: 'Clydesdale Wood Insert', category: 'Inserts', kind: 'unit', fuel: 'Wood', cost: 2160, price: 3550, reorder: [0, 1], vendorId: 'v-hearthstone', stock: { 'osage-beach': [0, 0], nixa: [1, 0] }, warranty: W.stove },

  // Stoves
  { id: 'VC-DEFIANT', brand: 'Vermont Castings', name: 'Defiant Wood Stove', category: 'Stoves', kind: 'unit', fuel: 'Wood', cost: 2280, price: 3790, reorder: [1, 2], vendorId: 'v-ff', stock: { 'osage-beach': [2, 1], nixa: [2, 1] }, warranty: W.stove },
  { id: 'VC-RADIANCE', brand: 'Vermont Castings', name: 'Radiance Gas Stove', category: 'Stoves', kind: 'unit', fuel: 'Gas', cost: 1890, price: 3150, reorder: [1, 1], vendorId: 'v-ff', stock: { 'osage-beach': [1, 1], nixa: [1, 0] }, warranty: W.stove },
  { id: 'QF-3100M', brand: 'Quadra-Fire', name: '3100 Millennium Wood Stove', category: 'Stoves', kind: 'unit', fuel: 'Wood', cost: 1750, price: 2890, reorder: [2, 2], vendorId: 'v-ff', stock: { 'osage-beach': [2, 0], nixa: [1, 0] }, warranty: W.stove },
  { id: 'HAR-P43', brand: 'Harman', name: 'P43 Pellet Stove', category: 'Stoves', kind: 'unit', fuel: 'Pellet', cost: 2050, price: 3390, reorder: [1, 2], vendorId: 'v-ff', stock: { 'osage-beach': [1, 1], nixa: [2, 1] }, warranty: W.pellet },
  { id: 'LOPI-ANSWER', brand: 'Lopi', name: 'Answer NexGen-Fyre Wood Stove', category: 'Stoves', kind: 'unit', fuel: 'Wood', cost: 1490, price: 2490, reorder: [2, 2], vendorId: 'v-travis', stock: { 'osage-beach': [2, 0], nixa: [2, 1] }, warranty: W.premium },
  { id: 'LOPI-NORTHFIELD', brand: 'Lopi', name: 'Northfield GS2 Gas Stove', category: 'Stoves', kind: 'unit', fuel: 'Gas', cost: 1840, price: 3050, reorder: [1, 1], vendorId: 'v-travis', stock: { 'osage-beach': [1, 0], nixa: [1, 1] }, warranty: W.premium },
  { id: 'HS-CASTLETON', brand: 'Hearthstone', name: 'Castleton 8030 Soapstone Wood Stove', category: 'Stoves', kind: 'unit', fuel: 'Wood', cost: 1990, price: 3290, reorder: [1, 1], vendorId: 'v-hearthstone', stock: { 'osage-beach': [1, 1], nixa: [0, 0] }, warranty: W.stove },
  { id: 'KUMA-ASPEN', brand: 'Kuma Stoves', name: 'Aspen LE Wood Stove', category: 'Stoves', kind: 'unit', fuel: 'Wood', cost: 1520, price: 2550, reorder: [0, 1], vendorId: 'v-kuma', stock: { 'osage-beach': [0, 0], nixa: [1, 1] }, warranty: W.stove },

  // Gas logs
  { id: 'HRG-OAK24', brand: 'Hargrove', name: 'Classic Oak 24 in. Vented Log Set', category: 'Gas logs', kind: 'unit', fuel: 'Gas', cost: 520, price: 890, reorder: [3, 4], vendorId: 'v-ozark', stock: { 'osage-beach': [5, 1], nixa: [3, 1] }, warranty: W.basic },
  { id: 'EMP-VFL30', brand: 'Empire', name: 'Rustic Oak 30 in. Vent-Free Log Set', category: 'Gas logs', kind: 'unit', fuel: 'Gas', cost: 610, price: 1050, reorder: [2, 3], vendorId: 'v-empire', stock: { 'osage-beach': [2, 0], nixa: [2, 1] }, warranty: W.basic },

  // Outdoor
  { id: 'EMP-CRO42', brand: 'Empire', name: 'Carol Rose 42 Outdoor Fireplace', category: 'Outdoor', kind: 'unit', fuel: 'Gas', cost: 2650, price: 4390, reorder: [1, 1], vendorId: 'v-empire', stock: { 'osage-beach': [1, 1], nixa: [1, 0] }, warranty: W.standard },
  { id: 'HPC-FP30', brand: 'HPC Fire', name: '30 in. Fire Pit Insert, Match-Lit', category: 'Outdoor', kind: 'unit', fuel: 'Gas', cost: 640, price: 1090, reorder: [2, 3], vendorId: 'v-hpc', stock: { 'osage-beach': [3, 1], nixa: [2, 0] }, warranty: W.basic },
  { id: 'HG-TWILIGHT', brand: 'Heat & Glo', name: 'Twilight Modern Indoor/Outdoor', category: 'Outdoor', kind: 'unit', fuel: 'Gas', cost: 3580, price: 5890, reorder: [0, 1], vendorId: 'v-hht', stock: { 'osage-beach': [1, 0], nixa: [0, 0] }, warranty: W.hht },

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
  return entries.map((e) => ({
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
