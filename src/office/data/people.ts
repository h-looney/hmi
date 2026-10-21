/**
 * People and places for the demo data.
 *
 * Office staff come from HMI's public About page. Technicians are placeholder names — HMI's
 * installers aren't listed publicly — and they are the only people the reports rate.
 * Every customer is fictional: phone numbers use the reserved 555-01xx range and emails use
 * example.com/.net/.org.
 */
import type { Role, Section, Staff, StoreId } from './types';

export const staff: Staff[] = [
  { id: 'cheryl', name: 'Cheryl Wormek', role: 'owner', title: 'Owner', store: 'both', color: '#ad4118', active: true },
  { id: 'charlie', name: 'Charlie Wormek', role: 'owner', title: 'Owner', store: 'both', color: '#7f6030', active: true },
  { id: 'mike', name: 'Mike Swanigan', role: 'manager', title: 'General Manager', store: 'osage-beach', photo: 'mike-swanigan', color: '#2f6db0', active: true },
  { id: 'gabe', name: 'Gabe Kurtz', role: 'manager', title: 'General Manager', store: 'nixa', photo: 'gabriel-kurtz', color: '#277553', active: true },
  { id: 'matt', name: 'Matthew Kirtley', role: 'sales', title: 'Showroom Sales', store: 'osage-beach', photo: 'matthew-kirtley', color: '#8a5a1c', active: true },
  { id: 'mark', name: 'Mark Ranum', role: 'sales', title: 'Showroom Sales', store: 'nixa', photo: 'mark-ranum', color: '#6b4fa3', active: true },
  { id: 'melanie', name: 'Melanie Powers', role: 'office', title: 'Accounts Payable', store: 'osage-beach', photo: 'melanie-powers', color: '#a2456b', active: true },
  { id: 'amanda', name: 'Amanda Fahlsing', role: 'coordinator', title: 'Sales & Service Coordinator', store: 'nixa', photo: 'amanda-fahlsing', color: '#1f7a8c', active: true },
  // Technicians (placeholder names)
  { id: 'cody', name: 'Cody Barnes', role: 'tech', title: 'Lead Installer', store: 'osage-beach', color: '#a8461a', tech: true, active: true },
  { id: 'brandon', name: 'Brandon Hale', role: 'tech', title: 'Installer', store: 'osage-beach', color: '#87590f', tech: true, active: true },
  { id: 'luis', name: 'Luis Ortega', role: 'tech', title: 'Service Technician', store: 'osage-beach', color: '#2f6db0', tech: true, active: true },
  { id: 'wes', name: 'Wes Carter', role: 'tech', title: 'Service Technician', store: 'osage-beach', color: '#3d7d5a', tech: true, active: true },
  { id: 'nate', name: 'Nate Poole', role: 'tech', title: 'Lead Installer', store: 'nixa', color: '#8c3b5e', tech: true, active: true },
  { id: 'dylan', name: 'Dylan Reyes', role: 'tech', title: 'Installer', store: 'nixa', color: '#5b5fa8', tech: true, active: true },
  { id: 'jared', name: 'Jared Simms', role: 'tech', title: 'Service Technician', store: 'nixa', color: '#1f7a8c', tech: true, active: true },
  { id: 'eli', name: 'Eli Turner', role: 'tech', title: 'Service Technician (apprentice)', store: 'nixa', color: '#7a6a2f', tech: true, active: true },
];

/** Demo sign-in profiles */
export const profiles: { id: string; blurb: string }[] = [
  { id: 'charlie', blurb: 'Everything: requests, jobs, inventory, books, reports and settings.' },
  { id: 'gabe', blurb: 'Runs the Nixa store: its requests, schedule, stock, sales and reports. Opens on Nixa.' },
  { id: 'amanda', blurb: 'Scheduling and dispatch, service requests, warranty claims and parts.' },
  { id: 'melanie', blurb: 'Invoices, bills, banking, QuickBooks and customer accounts.' },
  { id: 'luis', blurb: 'A phone-friendly day view: today’s calls, checklists, parts and signatures.' },
];

/** Who does what in the simulation (and in the crew pickers) */
export const crews: Record<StoreId, { installers: [lead: string, helper: string]; service: string[]; estimators: string[] }> = {
  'osage-beach': { installers: ['cody', 'brandon'], service: ['luis', 'wes'], estimators: ['matt', 'mike'] },
  nixa: { installers: ['nate', 'dylan'], service: ['jared', 'eli'], estimators: ['mark', 'gabe'] },
};

/** Technician tendencies that shape the sample time reports */
export const techProfiles: Record<string, { speed: number; onTime: number; callback: number }> = {
  cody: { speed: 0.92, onTime: 0.96, callback: 0.03 },
  brandon: { speed: 1.1, onTime: 0.9, callback: 0.05 },
  luis: { speed: 1.0, onTime: 0.94, callback: 0.04 },
  wes: { speed: 1.08, onTime: 0.87, callback: 0.05 },
  nate: { speed: 1.0, onTime: 0.91, callback: 0.04 },
  dylan: { speed: 1.14, onTime: 0.9, callback: 0.06 },
  jared: { speed: 0.84, onTime: 0.95, callback: 0.09 },
  eli: { speed: 1.24, onTime: 0.85, callback: 0.05 },
};

export const allSections: Section[] = ['dashboard', 'my-day', 'inbox', 'jobs', 'customers', 'warranty', 'inventory', 'accounting', 'analytics', 'settings'];

export const defaultPermissions: Record<Role, Section[]> = {
  owner: allSections,
  manager: ['dashboard', 'my-day', 'inbox', 'jobs', 'customers', 'warranty', 'inventory', 'accounting', 'analytics'],
  coordinator: ['dashboard', 'inbox', 'jobs', 'customers', 'warranty', 'inventory', 'analytics'],
  office: ['dashboard', 'inbox', 'customers', 'accounting', 'analytics'],
  sales: ['dashboard', 'my-day', 'inbox', 'jobs', 'customers', 'inventory'],
  tech: ['my-day', 'jobs', 'customers', 'inventory'],
};

export const roleLabels: Record<Role, string> = {
  owner: 'Owner',
  manager: 'Store manager',
  coordinator: 'Service coordinator',
  office: 'Office & accounting',
  sales: 'Showroom sales',
  tech: 'Technician',
};

export const firstNames = [
  'James', 'Mary', 'Robert', 'Linda', 'Michael', 'Karen', 'David', 'Susan', 'Richard', 'Lisa', 'Joseph', 'Nancy', 'Thomas',
  'Betty', 'Mark', 'Sandra', 'Steven', 'Donna', 'Paul', 'Carol', 'Kevin', 'Michelle', 'Brian', 'Amy', 'Gary', 'Angela',
  'Timothy', 'Melissa', 'Jeffrey', 'Rebecca', 'Ryan', 'Laura', 'Jacob', 'Emily', 'Nicholas', 'Megan', 'Eric', 'Rachel',
  'Jonathan', 'Heather', 'Scott', 'Julie', 'Brandon', 'Kelly', 'Gregory', 'Christina', 'Dale', 'Glenda', 'Darrell', 'Brenda',
  'Wayne', 'Tammy', 'Randy', 'Sheila', 'Travis', 'Kristen', 'Craig', 'Tara', 'Dustin', 'Leah', 'Curtis', 'Holly', 'Marcus',
  'Priya', 'Andre', 'Rosa', 'Hector', 'Mei', 'Samir', 'Ana', 'Victor', 'Joy', 'Kurt', 'Faye', 'Lyle', 'Darla', 'Roger',
  'Connie', 'Shane', 'Tonya', 'Grant', 'Paige', 'Wade', 'Jill', 'Brent', 'Robin', 'Clint', 'Dana',
];

export const lastNames = [
  'Anderson', 'Baker', 'Bennett', 'Brooks', 'Burke', 'Caldwell', 'Carlson', 'Chandler', 'Collins', 'Crawford', 'Dawson',
  'Dillard', 'Ellison', 'Fletcher', 'Foster', 'Garrison', 'Gibbs', 'Graves', 'Hampton', 'Harlan', 'Hartley', 'Hayes',
  'Hendricks', 'Holloway', 'Hutchins', 'Jennings', 'Keller', 'Kendrick', 'Lambert', 'Lawson', 'Lindquist', 'Mabry',
  'Marsh', 'McAllister', 'McCoy', 'Mercer', 'Morrow', 'Nolan', 'Oakley', 'Osborne', 'Parrish', 'Pierce', 'Pruitt',
  'Ramsey', 'Reeves', 'Rhodes', 'Riggs', 'Sanderson', 'Sawyer', 'Schaefer', 'Sexton', 'Shelton', 'Simmons', 'Slater',
  'Stafford', 'Stanton', 'Sullivan', 'Tate', 'Thornton', 'Tillman', 'Vance', 'Wakefield', 'Walsh', 'Whitfield', 'Wilder',
  'Winslow', 'Yates', 'Brandt', 'Ortiz', 'Raman', 'Chen', 'Nguyen', 'Patel', 'Delgado', 'Kowalski', 'Lindgren', 'Moreau',
  'Okafor', 'Petrov', 'Haugen', 'Romero', 'Santos', 'Weaver', 'Zimmerman',
];

export const builders = [
  { name: 'Ridgeline Custom Homes', contact: 'Jake Morrow' },
  { name: 'Lakepoint Builders', contact: 'Dana Kessler' },
  { name: 'Ozark Craftsman Homes', contact: 'Wade Pruitt' },
  { name: 'Bluestem Homes', contact: 'Leah Garrison' },
  { name: 'Cedar Ridge Builders', contact: 'Clint Hartley' },
  { name: 'Shoreline Remodeling', contact: 'Grant Ellison' },
];

/** Towns each store serves, with ZIP codes and a rough share of customers */
export const towns: Record<StoreId, { city: string; zip: string; weight: number }[]> = {
  'osage-beach': [
    { city: 'Osage Beach', zip: '65065', weight: 28 },
    { city: 'Lake Ozark', zip: '65049', weight: 22 },
    { city: 'Camdenton', zip: '65020', weight: 18 },
    { city: 'Sunrise Beach', zip: '65079', weight: 9 },
    { city: 'Linn Creek', zip: '65052', weight: 7 },
    { city: 'Eldon', zip: '65026', weight: 8 },
    { city: 'Laurie', zip: '65037', weight: 8 },
  ],
  nixa: [
    { city: 'Nixa', zip: '65714', weight: 26 },
    { city: 'Springfield', zip: '65804', weight: 18 },
    { city: 'Springfield', zip: '65810', weight: 10 },
    { city: 'Ozark', zip: '65721', weight: 18 },
    { city: 'Republic', zip: '65738', weight: 9 },
    { city: 'Clever', zip: '65631', weight: 5 },
    { city: 'Sparta', zip: '65753', weight: 4 },
    { city: 'Rogersville', zip: '65742', weight: 5 },
    { city: 'Battlefield', zip: '65619', weight: 5 },
  ],
};

export const streets: Record<StoreId, string[]> = {
  'osage-beach': [
    'Lakeview Dr', 'Harbor Point Dr', 'Shoreline Ct', 'Bluff Ridge Rd', 'Sunset Cove Dr', 'Eagle Bluff Ln', 'Osage Hills Rd',
    'Timber Trail', 'Cedar Hollow Ln', 'Hidden Cove Rd', 'Lighthouse Ln', 'Deer Run Rd', 'Red Oak Ln', 'Driftwood Ct',
    'Anchor Point Rd', 'Pine Valley Rd', 'Bittersweet Rd', 'Quail Hollow Ct', 'Woodland Bay Dr', 'Gravois Arm Rd',
  ],
  nixa: [
    'Sycamore St', 'Hickory Ridge Dr', 'Walnut Grove Dr', 'Copper Creek Rd', 'Prairie View Ln', 'Bent Tree Dr', 'Fox Run Ln',
    'Mill Creek Rd', 'Willow Bend Ct', 'Kingsway Dr', 'Chestnut Ln', 'Meadowlark Ln', 'Ridgecrest Dr', 'Stone Bridge Ln',
    'Tracker Rd', 'Cheyenne Rd', 'Juniper Ct', 'Aldersgate Dr', 'Sunflower Ln', 'Riverbluff Dr',
  ],
};

export const rooms = ['Living room', 'Great room', 'Family room', 'Basement', 'Primary bedroom', 'Den', 'Covered patio', 'Hearth room', 'Lake room', 'Kitchen'];
