/** Inbox helpers: filters, customer matching, suggestions and quick-reply templates. */
import type { Customer, DB, JobType, Lead, LeadStage } from '../../data/types';
import { now } from '../../lib/dates';
import { storeName } from '../../selectors';
import { edit, me, mutate, uid } from '../../store';

export type InboxFilter = 'all' | 'new' | 'open' | 'closed';

export const OPEN_STAGES: LeadStage[] = ['contacted', 'scheduled', 'quoted'];
export const CLOSED_STAGES: LeadStage[] = ['won', 'lost', 'closed'];

export const inFilter = (l: Lead, f: InboxFilter) =>
  f === 'all' || (f === 'new' ? l.stage === 'new' : f === 'open' ? OPEN_STAGES.includes(l.stage) : CLOSED_STAGES.includes(l.stage));

/** "Jake Morrow — Ridgeline Custom Homes" → "Jake Morrow" */
export const personName = (l: Lead) => l.name.replace(/ — .*/, '');

/** "Tom & Lisa Brandt" → "Tom" */
export const firstNameOf = (l: Lead) => personName(l).split(/\s+|&/)[0] || 'there';

export const field = (l: Lead, label: string) => l.fields.find(([k]) => k === label)?.[1];

/** Mark a request lost with a reason — one change, so the activity log reads cleanly. */
export function markLost(id: string, reason: string) {
  mutate((d) =>
    edit(d.leads, id, (l) => {
      const at = now();
      l.stage = 'lost';
      l.lostReason = reason;
      l.closedAt = at;
      l.unread = false;
      if (!l.firstResponseAt) l.firstResponseAt = at;
      l.activity.push({ id: uid('a'), at, by: me.value?.id ?? 'system', kind: 'status', text: `Marked lost — ${reason}` });
    }),
  );
}

/** Customers who might be the same person: same email, same name, or same phone and last name. */
export function possibleMatches(d: DB, l: Lead): Customer[] {
  const digits = (p?: string) => (p ?? '').replace(/\D/g, '').slice(-10);
  const name = personName(l).toLowerCase();
  const last = name.split(/\s+/).pop() ?? '';
  const email = l.email?.toLowerCase();
  const tel = digits(l.phone);
  return d.customers
    .filter((c) => !c.tags.includes('Counter sales'))
    .filter((c) => {
      const cname = c.name.toLowerCase();
      if (email && c.email.toLowerCase() === email) return true;
      if (cname === name) return true;
      // A shared phone number only counts when the last name matches too
      return tel.length === 10 && digits(c.phone) === tel && !!last && cname.split(/\s+/).pop() === last;
    })
    .slice(0, 3);
}

/** The kind of job to suggest when scheduling from a request */
export function suggestedJobType(l: Lead): JobType {
  if (l.kind !== 'service') return 'estimate';
  const need = `${field(l, 'What do you need?') ?? ''} ${l.summary}`.toLowerCase();
  return need.includes('annual') ? 'maintenance' : 'repair';
}

/** The customer's appliance this request is most likely about (brand match, or their only one). */
export function likelyUnit(d: DB, l: Lead, customerId: string | undefined): string | undefined {
  if (!customerId || l.kind !== 'service') return undefined;
  const units = d.units.filter((u) => u.customerId === customerId);
  const brand = field(l, 'Brand')?.toLowerCase();
  const byBrand = brand ? units.filter((u) => u.brand.toLowerCase() === brand) : [];
  if (byBrand.length === 1) return byBrand[0].id;
  return units.length === 1 ? units[0].id : undefined;
}

export type ComposerMode = 'email' | 'call' | 'text' | 'note';

interface TemplateContext {
  first: string;
  me: string;
  store: string;
}

export const templates: Record<ComposerMode, { label: string; text: (c: TemplateContext) => string }[]> = {
  email: [
    {
      label: 'Set up a visit',
      text: (c) =>
        `Hi ${c.first},\n\nThanks for reaching out to HMI Fireplace Shops! The best next step is a quick visit so we can measure, check the venting route and talk through options. Would a morning or an afternoon later this week work for you?\n\n${c.me}\nHMI Fireplace Shops — ${c.store}`,
    },
    {
      label: 'Ask for photos',
      text: (c) =>
        `Hi ${c.first},\n\nThanks for the details. Could you reply with a couple of photos of the fireplace and its rating plate (usually behind the lower grille or on the side panel)? That helps us bring the right parts the first time.\n\n${c.me}\nHMI Fireplace Shops — ${c.store}`,
    },
    {
      label: 'Pricing & next steps',
      text: (c) =>
        `Hi ${c.first},\n\nThanks for your interest! Installed pricing depends on the model, the venting route and the finishes, so we usually start with a free in-home measure. In the meantime I’m happy to send a few options to look at — just let me know which styles you like.\n\n${c.me}\nHMI Fireplace Shops — ${c.store}`,
    },
    {
      label: 'You’re on the schedule',
      text: (c) =>
        `Hi ${c.first},\n\nYou’re all set — we’ll confirm the day before, and your technician will call when they’re on the way. Reply here if anything changes.\n\n${c.me}\nHMI Fireplace Shops — ${c.store}`,
    },
  ],
  text: [
    { label: 'Quick intro', text: (c) => `Hi ${c.first}, this is ${c.me} with HMI Fireplace Shops. We got your request — is now a good time for a quick call?` },
    { label: 'Ask for a photo', text: (c) => `Hi ${c.first}, could you text us a photo of the fireplace’s rating plate? It helps us bring the right parts. Thanks! — ${c.me}, HMI` },
    { label: 'On the way', text: (c) => `Hi ${c.first}, you’re on the schedule. Your technician will call when they’re on the way. — HMI Fireplace Shops` },
  ],
  call: [
    { label: 'Talked — booking a visit', text: (c) => `Talked with ${c.first}. Booking a visit — sending a couple of time options by email.` },
    { label: 'Left a voicemail', text: (c) => `Left a voicemail for ${c.first} and sent a follow-up email.` },
    { label: 'No answer', text: (c) => `No answer. Will try ${c.first} again tomorrow morning.` },
  ],
  note: [
    { label: 'Waiting on photos', text: () => 'Waiting on photos from the customer before scheduling.' },
    { label: 'Check stock first', text: () => 'Check stock at both showrooms before quoting.' },
    { label: 'Builder pricing', text: () => 'Builder account — use builder pricing and Net 30 terms.' },
  ],
};

export const templateContext = (l: Lead): TemplateContext => ({
  first: firstNameOf(l),
  me: me.value?.name.split(' ')[0] ?? 'The HMI team',
  store: storeName(l.store),
});
