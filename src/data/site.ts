/**
 * Single source of truth for business details.
 * Everything here was carried over from the current hmifireplaceshop.com site.
 * Items marked TODO need confirmation from HMI before launch.
 */

export type DayHours = { open: string; close: string } | null;

/** 0 = Sunday … 6 = Saturday. `null` = closed / by appointment only. */
export type WeeklyHours = [DayHours, DayHours, DayHours, DayHours, DayHours, DayHours, DayHours];

export interface Location {
  slug: string;
  name: string;
  shortName: string;
  region: string;
  street: string;
  city: string;
  state: string;
  zip: string;
  phone: string;
  tollFree: string;
  fax: string;
  geo: { lat: number; lng: number };
  hours: WeeklyHours;
  mapEmbed: string;
  directionsUrl: string;
  nearby: string[];
  blurb: string;
}

const standardHours: WeeklyHours = [
  null, // Sunday — by appointment
  { open: '08:00', close: '17:00' },
  { open: '08:00', close: '17:00' },
  { open: '08:00', close: '17:00' },
  { open: '08:00', close: '17:00' },
  { open: '08:00', close: '17:00' },
  { open: '09:00', close: '13:00' },
];

export const site = {
  name: 'HMI Fireplace Shops',
  legalName: 'HMI Fireplace Shop',
  tagline: 'No one warms you like HMI.',
  motto: 'The hearth is the heart of the home.',
  founded: 1975,
  incorporated: 1978,
  url: 'https://www.hmifireplaceshop.com',
  timezone: 'America/Chicago',
  description:
    'Family-owned fireplace, insert and stove showrooms in Osage Beach (Lake of the Ozarks) and Nixa, Missouri. Sales, certified installation and service since 1975.',
  hoursSummary: [
    { days: 'Monday – Friday', time: '8:00 AM – 5:00 PM' },
    { days: 'Saturday', time: '9:00 AM – 1:00 PM' },
    { days: 'Evenings & Sundays', time: 'By appointment' },
  ],
  social: {
    facebook: 'https://www.facebook.com/HMIFireplaceShop/',
    youtube: 'https://www.youtube.com/channel/UCmCfiR_81ePeMxSJAIj9ctw',
    x: 'https://twitter.com/satisfyyourburn',
    houzz: 'https://www.houzz.com/pro/cwormek/hmi-fireplace-shop',
  },
  links: {
    // Existing Wufoo forms on the current site — kept until a backend exists.
    employmentApplication: 'https://mswinteractive.wufoo.com/forms/z1g36t8q05jggf5/',
    fireBuilder: 'https://firebuilder.travisindustries.com/embed/oH4CL2-I/#/',
  },
} as const;

export const locations: Location[] = [
  {
    slug: 'osage-beach',
    name: 'HMI Fireplace Shop — Osage Beach',
    shortName: 'Osage Beach',
    region: 'Lake of the Ozarks',
    street: '6656 Highway 54',
    city: 'Osage Beach',
    state: 'MO',
    zip: '65065',
    phone: '573-348-9002',
    tollFree: '800-401-2623',
    fax: '573-348-9010',
    geo: { lat: 38.0917, lng: -92.6874 },
    hours: standardHours,
    mapEmbed:
      'https://www.google.com/maps/embed?pb=!1m14!1m8!1m3!1d200903.98964843035!2d-92.666931!3d38.11403!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x87c4c4d03c669331%3A0x18b34d9d21fa7aea!2sHMI+Fireplace+Shop!5e0!3m2!1sen!2sus!4v1466177743550',
    directionsUrl:
      'https://www.google.com/maps/dir/?api=1&destination=6656+Highway+54,+Osage+Beach,+MO+65065',
    // TODO: confirm service area with HMI
    nearby: ['Lake Ozark', 'Camdenton', 'Eldon', 'Sunrise Beach', 'Laurie', 'Linn Creek', 'Versailles', 'Four Seasons'],
    blurb:
      'Our original home on Highway 54, serving lake homes, cabins and year-round residences all around the Lake of the Ozarks.',
  },
  {
    slug: 'nixa',
    name: 'HMI Fireplace Shop — Nixa',
    shortName: 'Nixa',
    region: 'Springfield & Southwest Missouri',
    street: '1744 N Deffer Dr',
    city: 'Nixa',
    state: 'MO',
    zip: '65714',
    phone: '417-725-2550',
    tollFree: '800-240-2550',
    fax: '417-725-2560',
    geo: { lat: 37.0782, lng: -93.3016 },
    hours: standardHours,
    mapEmbed:
      'https://www.google.com/maps/embed?pb=!1m14!1m8!1m3!1d407216.9761949581!2d-93.306885!3d37.119811!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x0%3A0x532ccbcff1d7fb54!2sHMI+Fireplace+Shops!5e0!3m2!1sen!2sus!4v1466177694652',
    directionsUrl:
      'https://www.google.com/maps/dir/?api=1&destination=1744+N+Deffer+Dr,+Nixa,+MO+65714',
    // TODO: confirm service area with HMI
    nearby: ['Springfield', 'Ozark', 'Republic', 'Clever', 'Sparta', 'Rogersville', 'Branson', 'Battlefield'],
    blurb:
      'Just south of Springfield, our Nixa showroom serves homeowners and builders across Southwest Missouri.',
  },
];

export const getLocation = (slug: string) => locations.find((l) => l.slug === slug);

/** "573-348-9002" → "tel:+15733489002" */
export const tel = (phone: string) => `tel:+1${phone.replace(/\D/g, '')}`;

/** "573-348-9002" → "(573) 348-9002" */
export const prettyPhone = (phone: string) => {
  const d = phone.replace(/\D/g, '');
  return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
};

export const yearsInBusiness = () => new Date().getFullYear() - site.founded;
