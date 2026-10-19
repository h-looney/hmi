import type { ImageMetadata } from 'astro';

import mike from '../assets/team/mike-swanigan.jpg';
import matt from '../assets/team/matthew-kirtley.jpg';
import melanie from '../assets/team/melanie-powers.jpg';
import gabe from '../assets/team/gabriel-kurtz.jpg';
import mark from '../assets/team/mark-ranum.jpg';
import amanda from '../assets/team/amanda-fahlsing.jpg';

export interface TeamMember {
  name: string;
  role: string;
  location: 'osage-beach' | 'nixa';
  since: number;
  photo: ImageMetadata;
  /** CSS object-position for the portrait crop */
  focus?: string;
  credentials?: string[];
  bio: string;
}

/**
 * Bios condensed from the current About page. The originals include personal
 * family details; these keep the professional highlights plus a human touch.
 */
export const team: TeamMember[] = [
  {
    name: 'Mike Swanigan',
    role: 'General Manager',
    location: 'osage-beach',
    since: 2008,
    photo: mike,
    focus: '50% 30%',
    credentials: ['NFI Certified — Wood', 'NFI Certified — Gas', 'Manufacturer trained'],
    bio: 'Mike started at HMI as an installer and quickly became a go-to salesman and service tech, too. Today he runs the Osage Beach store — installs, sales, service and staff — and believes honesty and integrity matter most when you’re putting fire into someone’s home.',
  },
  {
    name: 'Matthew Kirtley',
    role: 'Showroom Sales',
    location: 'osage-beach',
    since: 2023,
    photo: matt,
    focus: '50% 30%',
    credentials: ['Manufacturer trained'],
    bio: 'Matt brings a background in sales and finance to the Osage Beach showroom, where he helps customers with all things hearth. He’s completed multiple manufacturer trainings and keeps learning. Stop by — he’ll gladly talk fireplaces over a cup of coffee.',
  },
  {
    name: 'Melanie Powers',
    role: 'Accounts Payable',
    location: 'osage-beach',
    since: 2019,
    photo: melanie,
    focus: '50% 30%',
    bio: 'Melanie keeps HMI’s books in order, with years of experience in payables, receivables and sales. A proud Camdenton graduate, she’s a fixture at Camdenton sporting events — and easily the happiest person in the building.',
  },
  {
    name: 'Gabriel Kurtz',
    role: 'General Manager',
    location: 'nixa',
    since: 2019,
    photo: gabe,
    focus: '50% 35%',
    credentials: ['NFI Certified — Wood', 'NFI Certified — Gas', 'Hearth & Home Technologies trained', 'Travis Industries trained'],
    bio: 'Gabe joined HMI part-time while in technical school and earned a reputation for doing things right the first time. Now he leads the installers and sales team in Nixa. When he’s not on a job site, you’ll find him hunting, fishing or anywhere outdoors.',
  },
  {
    name: 'Mark Ranum',
    role: 'Showroom Sales',
    location: 'nixa',
    since: 2021,
    photo: mark,
    focus: '50% 25%',
    credentials: ['Manufacturer trained'],
    bio: 'Mark brings 40 years of retail, retail management and interior design experience to the Nixa showroom. He studied business, fine art and art history, and loves helping clients find a look they’ll be proud of for years.',
  },
  {
    name: 'Amanda Fahlsing',
    role: 'Sales & Service Coordinator',
    location: 'nixa',
    since: 2023,
    photo: amanda,
    focus: '50% 30%',
    credentials: ['Manufacturer trained', 'Missouri LPG training', 'NFI certification in progress'],
    bio: 'Amanda coordinates and schedules HMI’s service department, and has helped modernize everything from technician routing to parts and warranty tracking. She’s trained on Heat & Glo, Fireplace Xtrordinair, Lopi and more.',
  },
];

export const owners = {
  names: 'Cheryl & Charlie Wormek',
  role: 'Owners',
  bio: [
    'Cheryl, the daughter of HMI founder Norm Buechting, has worked in the hearth industry day to day since 1987. She helped open the Nixa location, has held many industry accreditations, and has served on the board of the Midwest Hearth, Patio & Barbecue Association.',
    'Charlie joined HMI in 1996, bringing years of sales and sales-management experience, and has earned numerous national, local and manufacturer certifications in the specialty hearth industry.',
    'Together they have led HMI for more than 20 years — and they still love running into longtime customers who share photos of their families gathered around an HMI fireplace.',
  ],
};

export const teamAt = (slug: TeamMember['location']) => team.filter((m) => m.location === slug);
