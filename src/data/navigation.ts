import { categories, groups, categoryHref } from './categories';
import { locations } from './site';
import { withBase } from '../scripts/url';

export interface NavLink {
  label: string;
  href: string;
  description?: string;
}

export interface NavItem {
  label: string;
  href: string;
  /** Mega menu (products) */
  mega?: boolean;
  children?: NavLink[];
}

export const productColumns = groups.map((g) => ({
  ...g,
  links: categories
    .filter((c) => c.group === g.id)
    .map((c) => ({ label: c.name, href: categoryHref(c.slug) })),
}));

export const mainNav: NavItem[] = [
  { label: 'Products', href: withBase('/products/'), mega: true },
  { label: 'Fireplace Finder', href: withBase('/fireplace-finder/') },
  {
    label: 'Services',
    href: withBase('/services/'),
    children: [
      { label: 'Design & showroom visits', href: withBase('/services/#design'), description: 'Talk through options with a hearth pro.' },
      { label: 'Professional installation', href: withBase('/services/#installation'), description: 'Certified crews, done right the first time.' },
      { label: 'Service & repair', href: withBase('/services/#service'), description: 'Keep your fireplace safe and efficient.' },
      { label: 'Builders & contractors', href: withBase('/services/#builders'), description: 'A dependable partner since 1975.' },
      { label: 'Request service', href: withBase('/service-request/'), description: 'Schedule a visit from our service team.' },
    ],
  },
  { label: 'Inspiration', href: withBase('/gallery/') },
  {
    label: 'About',
    href: withBase('/about/'),
    children: [
      { label: 'Our story', href: withBase('/about/'), description: 'Family-owned since 1975.' },
      { label: 'Meet the team', href: withBase('/about/team/'), description: 'The people behind the fire.' },
      { label: 'Owner resources', href: withBase('/resources/'), description: 'Manuals, videos and FAQs.' },
      { label: 'Careers', href: withBase('/careers/'), description: 'Join the HMI family.' },
    ],
  },
  {
    label: 'Locations',
    href: withBase('/contact/'),
    children: [
      ...locations.map((l) => ({
        label: l.shortName,
        href: withBase(`/locations/${l.slug}/`),
        description: `${l.street}, ${l.city}`,
      })),
      { label: 'Contact us', href: withBase('/contact/'), description: 'Request a quote or ask a question.' },
    ],
  },
];

export const footerNav = [
  {
    title: 'Products',
    links: [
      { label: 'Gas fireplaces', href: withBase('/products/gas-fireplaces/') },
      { label: 'Wood fireplaces', href: withBase('/products/wood-fireplaces/') },
      { label: 'Fireplace inserts', href: withBase('/products/fireplace-inserts/') },
      { label: 'Wood & gas stoves', href: withBase('/products/wood-stoves/') },
      { label: 'Electric fireplaces', href: withBase('/products/electric-fireplaces/') },
      { label: 'Outdoor fireplaces', href: withBase('/products/outdoor-fireplaces/') },
      { label: 'All products', href: withBase('/products/') },
    ],
  },
  {
    title: 'Services',
    links: [
      { label: 'Installation', href: withBase('/services/#installation') },
      { label: 'Service & repair', href: withBase('/services/#service') },
      { label: 'Request service', href: withBase('/service-request/') },
      { label: 'Builders & contractors', href: withBase('/services/#builders') },
      { label: 'Fireplace Finder', href: withBase('/fireplace-finder/') },
      { label: 'Fuel cost calculator', href: withBase('/fireplace-finder/#calculator') },
    ],
  },
  {
    title: 'Company',
    links: [
      { label: 'Our story', href: withBase('/about/') },
      { label: 'Meet the team', href: withBase('/about/team/') },
      { label: 'Inspiration gallery', href: withBase('/gallery/') },
      { label: 'Owner resources', href: withBase('/resources/') },
      { label: 'Careers', href: withBase('/careers/') },
      { label: 'Contact', href: withBase('/contact/') },
    ],
  },
];
