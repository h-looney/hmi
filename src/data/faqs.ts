import { withBase } from '../scripts/url';

export interface Faq {
  id: string;
  q: string;
  /** Simple HTML allowed (links, emphasis). */
  a: string;
  topic: 'Buying' | 'Installation' | 'Service & safety' | 'Visiting';
}

export const faqs: Faq[] = [
  {
    id: 'which-fuel',
    topic: 'Buying',
    q: 'Wood, gas, electric or pellet — which is right for me?',
    a: `It depends on how you want to use your fire. Wood delivers the classic experience and works without power; gas is the most convenient; electric installs almost anywhere; pellet offers automated, efficient heat. Our <a href="${withBase('/fireplace-finder/')}">Fireplace Finder</a> will point you in the right direction in about a minute — and our team is always happy to talk it through.`,
  },
  {
    id: 'install',
    topic: 'Installation',
    q: 'Do you install what you sell?',
    a: 'Yes. HMI handles installation with our own trained crews, and our service department supports the products we sell long after installation day. One team, start to finish.',
  },
  {
    id: 'certified',
    topic: 'Installation',
    q: 'Are your installers and technicians certified?',
    a: 'Our team includes National Fireplace Institute (NFI) certified specialists in wood and gas, and our staff regularly completes manufacturer-specific training. Continuing education is one of our guiding principles.',
  },
  {
    id: 'insert-fit',
    topic: 'Buying',
    q: 'Can I put an insert or gas logs in my existing fireplace?',
    a: 'In most cases, yes. We’ll measure your firebox and check your chimney to recommend an insert or log set that fits and vents safely. Bringing a photo of your fireplace and its width, height and depth to the showroom speeds things up.',
  },
  {
    id: 'power-outage',
    topic: 'Service & safety',
    q: 'Will my fireplace or stove work during a power outage?',
    a: `Wood stoves and fireplaces work without electricity. Many gas appliances can, too — models with a standing-pilot (millivolt) system or a battery backup will still light, though blowers won’t run. Pellet appliances need power unless they have a backup. See our <a href="${withBase('/resources/#battery-backup')}">battery backup help</a> or ask about your model.`,
  },
  {
    id: 'vent-free',
    topic: 'Buying',
    q: 'What is a vent-free gas appliance, and is it right for my home?',
    a: 'Vent-free fireplaces, stoves and log sets don’t need a chimney or vent, so nearly all of their heat stays in the room. They must be sized for the space and aren’t permitted in some rooms or jurisdictions. We’ll help you confirm whether vent-free fits your home before you buy.',
  },
  {
    id: 'annual-service',
    topic: 'Service & safety',
    q: 'How often should my fireplace, stove or insert be serviced?',
    a: `The National Fire Protection Association recommends that chimneys, fireplaces and vents be inspected at least once a year. Regular service keeps your appliance safe, efficient and looking its best. <a href="${withBase('/service-request/')}">Request service</a> online or call the store nearest you.`,
  },
  {
    id: 'builders',
    topic: 'Installation',
    q: 'Do you work with builders and contractors?',
    a: `Absolutely. HMI has worked alongside builders since 1975, from spec homes to custom lake houses. Loop us in early and we’ll help with product selection, framing and venting requirements, and scheduling. <a href="${withBase('/services/#builders')}">Learn more</a>.`,
  },
  {
    id: 'visit',
    topic: 'Visiting',
    q: 'Do I need an appointment to visit a showroom?',
    a: 'No appointment is needed during showroom hours: Monday – Friday 8 AM – 5 PM and Saturday 9 AM – 1 PM. Evening and Sunday visits are available by appointment — just give us a call.',
  },
  {
    id: 'quote',
    topic: 'Buying',
    q: 'How do I get a quote?',
    a: `Stop by either showroom, call us, or <a href="${withBase('/contact/')}">request a quote online</a>. Tell us a little about your space and what you’re hoping for, and a member of our team will follow up.`,
  },
];

export const getFaqs = (ids: string[]) =>
  ids.map((id) => {
    const f = faqs.find((x) => x.id === id);
    if (!f) throw new Error(`Unknown FAQ id: ${id}`);
    return f;
  });
