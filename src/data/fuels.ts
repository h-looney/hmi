import type { Fuel } from './categories';

export interface FuelProfile {
  id: Fuel;
  name: string;
  tagline: string;
  bestFor: string;
  pros: string[];
  cons: string[];
  /** 1–5, higher is better for the homeowner */
  ratings: { label: string; value: number }[];
  categories: string[];
}

export const fuelProfiles: FuelProfile[] = [
  {
    id: 'wood',
    name: 'Wood',
    tagline: 'The classic experience',
    bestFor: 'Ambiance lovers, serious heating and homes with access to firewood.',
    pros: [
      'Authentic crackle, aroma and glow',
      'Works without electricity',
      'Can heat large spaces',
      'Very low fuel cost if you cut your own',
    ],
    cons: ['Hauling, stacking and ash cleanup', 'Needs a chimney and a yearly inspection'],
    ratings: [
      { label: 'Ambiance', value: 5 },
      { label: 'Heating power', value: 5 },
      { label: 'Convenience', value: 2 },
      { label: 'Works in an outage', value: 5 },
    ],
    categories: ['wood-fireplaces', 'wood-stoves', 'fireplace-inserts', 'outdoor-fireplaces'],
  },
  {
    id: 'gas',
    name: 'Gas',
    tagline: 'Push-button comfort',
    bestFor: 'Busy households, lake homes on propane and anyone who wants instant fire.',
    pros: [
      'Instant on and off by remote or wall switch',
      'Natural gas or propane',
      'No ash, smoke or wood to haul',
      'Flexible venting through a wall or roof',
    ],
    cons: ['Needs a gas line or propane tank', 'Annual service recommended'],
    ratings: [
      { label: 'Ambiance', value: 4 },
      { label: 'Heating power', value: 4 },
      { label: 'Convenience', value: 5 },
      { label: 'Works in an outage', value: 3 },
    ],
    categories: ['gas-fireplaces', 'fireplace-inserts', 'gas-stoves', 'gas-logs', 'vent-free-gas'],
  },
  {
    id: 'electric',
    name: 'Electric',
    tagline: 'Install-anywhere ambiance',
    bestFor: 'Condos, apartments, bedrooms, offices and media walls.',
    pros: [
      'No chimney, venting or gas line',
      'Flame effect with or without heat',
      'Lowest upfront and installation cost',
      'Practically maintenance-free',
    ],
    cons: ['Supplemental heat only', 'Doesn’t run during a power outage'],
    ratings: [
      { label: 'Ambiance', value: 3 },
      { label: 'Heating power', value: 2 },
      { label: 'Convenience', value: 5 },
      { label: 'Works in an outage', value: 1 },
    ],
    categories: ['electric-fireplaces', 'mantels-surrounds'],
  },
  {
    id: 'pellet',
    name: 'Pellet',
    tagline: 'Automated, efficient heat',
    bestFor: 'Efficiency-minded homeowners who want wood heat without the woodpile.',
    pros: [
      'Thermostat-controlled, steady heat',
      'Clean-burning renewable fuel',
      'Bagged fuel is easy to store',
      'Excellent insert option for old fireplaces',
    ],
    cons: ['Needs electricity to operate', 'Regular hopper filling and ash cleanout'],
    ratings: [
      { label: 'Ambiance', value: 3 },
      { label: 'Heating power', value: 4 },
      { label: 'Convenience', value: 4 },
      { label: 'Works in an outage', value: 1 },
    ],
    categories: ['pellet-stoves', 'fireplace-inserts'],
  },
];
