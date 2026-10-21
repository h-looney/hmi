/** Settings: business details, team & permissions, website forms, invoicing, notifications, demo data. */
import type { ComponentChildren } from 'preact';
import { useState } from 'preact/hooks';
import { setPermission, updateSettings } from '../../actions';
import { allSections, roleLabels } from '../../data/people';
import type { Role, Section, Settings as SettingsData, Staff, StoreId } from '../../data/types';
import { openDialog } from '../../dialogs';
import { today } from '../../lib/dates';
import { number, phone, plural, telHref } from '../../lib/format';
import { param, setParams } from '../../router';
import { storeName } from '../../selectors';
import { db, me, resetDemo } from '../../store';
import { toast } from '../../toast';
import { Avatar, Badge, Button, Card, cx, Field, Menu, PageHeader, Switch, TabPanel, Tabs, type TabItem } from '../../ui/core';
import { Dialog } from '../../ui/Dialog';
import { Icon } from '../../ui/Icon';
import { DataTable, type Column } from '../../ui/Table';
import { locations, site, type WeeklyHours } from '../../../data/site';
import { formatTime } from '../../../scripts/hours';
import { cancelInvite, defaultTitles, downloadJson, inviteStaff, isInvited, updateStaff } from './helpers';

type Tab = 'profile' | 'team' | 'forms' | 'invoicing' | 'notifications' | 'demo';

const tabs: TabItem<Tab>[] = [
  { key: 'profile', label: 'Business profile', icon: 'store' },
  { key: 'team', label: 'Team & permissions', icon: 'users' },
  { key: 'forms', label: 'Website forms', icon: 'globe' },
  { key: 'invoicing', label: 'Invoicing & tax', icon: 'receipt' },
  { key: 'notifications', label: 'Notifications', icon: 'bell' },
  { key: 'demo', label: 'Demo data', icon: 'refresh' },
];

const sectionLabels: Record<Section, string> = {
  dashboard: 'Dashboard',
  'my-day': 'My day',
  inbox: 'Inbox',
  jobs: 'Jobs',
  customers: 'Customers',
  warranty: 'Warranty',
  inventory: 'Inventory',
  accounting: 'Accounting',
  analytics: 'Analytics',
  settings: 'Settings',
};

const roles: Role[] = ['owner', 'manager', 'coordinator', 'office', 'sales', 'tech'];
const BASE = import.meta.env.BASE_URL.replace(/\/$/, '');

/* ---------- Business profile ---------- */

const DAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function hoursLines(hours: WeeklyHours): string[] {
  const groups: { days: number[]; label: string }[] = [];
  for (const i of [1, 2, 3, 4, 5, 6, 0]) {
    const h = hours[i];
    const label = h ? `${formatTime(h.open)} – ${formatTime(h.close)}` : 'By appointment';
    const last = groups[groups.length - 1];
    if (last && last.label === label) last.days.push(i);
    else groups.push({ days: [i], label });
  }
  return groups.map((g) => `${g.days.length > 1 ? `${DAY[g.days[0]]}–${DAY[g.days[g.days.length - 1]]}` : DAY[g.days[0]]}: ${g.label}`);
}

type Business = NonNullable<SettingsData['business']>;

const defaultBusiness = (): Business => ({
  displayName: site.name,
  email: '',
  phone: locations[0].phone,
  website: site.url,
  licenseNo: '',
});

function ProfileTab() {
  const saved = db.value.settings.business ?? defaultBusiness();
  const [form, setForm] = useState<Business>(saved);
  const dirty = JSON.stringify(form) !== JSON.stringify(saved);
  const set = (k: keyof Business) => (e: Event) => setForm({ ...form, [k]: (e.target as HTMLInputElement).value });

  return (
    <div class="settings-grid">
      <Card title="Business profile" subtitle="Shown on invoices, estimates and customer emails">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            updateSettings((s) => (s.business = { ...form, displayName: form.displayName.trim() || site.name }));
            toast('Business profile saved', { tone: 'success' });
          }}
        >
          <div class="form-grid">
            <Field label="Business name" class="span-2">
              <input class="input" value={form.displayName} onInput={set('displayName')} required />
            </Field>
            <Field label="Main phone">
              <input class="input" type="tel" value={form.phone} onInput={set('phone')} />
            </Field>
            <Field label="Reply-to email" hint="Customers see this on emails and invoices">
              <input class="input" type="email" value={form.email} placeholder="name@yourcompany.com" onInput={set('email')} />
            </Field>
            <Field label="Website">
              <input class="input" type="url" value={form.website} onInput={set('website')} />
            </Field>
            <Field label="License number" optional>
              <input class="input" value={form.licenseNo} placeholder="Shown at the bottom of invoices" onInput={set('licenseNo')} />
            </Field>
          </div>
          <div class="settings-actions">
            <Button type="submit" variant="primary" disabled={!dirty}>
              Save changes
            </Button>
            <Button variant="ghost" disabled={!dirty} onClick={() => setForm(saved)}>
              Discard
            </Button>
          </div>
        </form>
      </Card>

      <Card title="Showrooms" subtitle="From the website’s shared business details — edit once and the site, invoices and HMI Office all update">
        <ul class="showrooms" role="list">
          {locations.map((l) => (
            <li key={l.slug} class="showroom">
              <p class="showroom__name">
                <Icon name="store" size={16} /> {l.shortName}
                <span class="muted small"> · {l.region}</span>
              </p>
              <p>
                {l.street}, {l.city}, {l.state} {l.zip}
              </p>
              <p>
                <a href={telHref(l.phone)}>{phone(l.phone)}</a>
                <span class="muted"> · toll-free {phone(l.tollFree)} · fax {phone(l.fax)}</span>
              </p>
              <ul class="showroom__hours" role="list">
                {hoursLines(l.hours).map((h) => (
                  <li key={h}>{h}</li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
        <p class="muted small">Editing showroom details is turned off in this demo.</p>
      </Card>
    </div>
  );
}

/* ---------- Team & permissions ---------- */

function InviteDialog({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<Role>('tech');
  const [title, setTitle] = useState(defaultTitles.tech);
  const [titleTouched, setTitleTouched] = useState(false);
  const [store, setStore] = useState<StoreId | 'both'>('osage-beach');
  const valid = name.trim().length > 1 && /.+@.+\..+/.test(email.trim());

  const send = () => {
    if (!valid) return;
    inviteStaff({ name: name.trim(), role, title: title.trim() || defaultTitles[role], store });
    toast(`Invitation sent to ${email.trim()} — sending is simulated in this demo`, { tone: 'success' });
    onClose();
  };

  return (
    <Dialog
      title="Invite a teammate"
      description="They’ll get an email to set up their own sign-in. Until then they show as invited."
      size="sm"
      class="settings-dialog"
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" icon="send" disabled={!valid} onClick={send}>
            Send invitation
          </Button>
        </>
      }
    >
      <form
        class="stack"
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
      >
        <Field label="Full name">
          <input class="input" value={name} autocomplete="off" onInput={(e) => setName((e.target as HTMLInputElement).value)} />
        </Field>
        <Field label="Work email">
          <input class="input" type="email" value={email} placeholder="name@yourcompany.com" onInput={(e) => setEmail((e.target as HTMLInputElement).value)} />
        </Field>
        <div class="form-grid">
          <Field label="Role" hint="Decides which sections they can use">
            <select
              class="select"
              value={role}
              onChange={(e) => {
                const r = (e.target as HTMLSelectElement).value as Role;
                setRole(r);
                if (!titleTouched) setTitle(defaultTitles[r]);
              }}
            >
              {roles
                .filter((r) => r !== 'owner')
                .map((r) => (
                  <option key={r} value={r}>
                    {roleLabels[r]}
                  </option>
                ))}
            </select>
          </Field>
          <Field label="Showroom">
            <select class="select" value={store} onChange={(e) => setStore((e.target as HTMLSelectElement).value as StoreId | 'both')}>
              <option value="osage-beach">Osage Beach</option>
              <option value="nixa">Nixa</option>
              <option value="both">Both</option>
            </select>
          </Field>
          <Field label="Job title" class="span-2">
            <input
              class="input"
              value={title}
              onInput={(e) => {
                setTitle((e.target as HTMLInputElement).value);
                setTitleTouched(true);
              }}
            />
          </Field>
        </div>
        <button type="submit" hidden />
      </form>
    </Dialog>
  );
}

function TeamTab() {
  const d = db.value;
  const user = me.value!;
  const [inviting, setInviting] = useState(false);
  const perms = d.settings.permissions;

  const status = (s: Staff) =>
    s.active ? (
      <Badge tone="green" icon="check">
        Active
      </Badge>
    ) : isInvited(s) ? (
      <Badge tone="amber" icon="mail">
        Invitation sent
      </Badge>
    ) : (
      <Badge tone="neutral" icon="minus">
        Inactive
      </Badge>
    );

  const columns: Column<Staff>[] = [
    {
      key: 'name',
      label: 'Name',
      sortValue: (s) => s.name,
      render: (s) => (
        <span class="team-person">
          <Avatar person={s} size={32} />
          <span>
            <span class="cell-main">
              {s.name}
              {s.id === user.id && (
                <Badge tone="ember" class="team-you">
                  You
                </Badge>
              )}
            </span>
            <span class="cell-sub">{s.title}</span>
          </span>
        </span>
      ),
    },
    {
      key: 'role',
      label: 'Role',
      sortValue: (s) => roles.indexOf(s.role),
      render: (s) =>
        s.role === 'owner' ? (
          <span>{roleLabels.owner}</span>
        ) : (
          <select
            class="select select--sm team-role"
            aria-label={`Role for ${s.name}`}
            value={s.role}
            onChange={(e) => {
              const r = (e.target as HTMLSelectElement).value as Role;
              updateStaff(s.id, { role: r });
              toast(`${s.name.split(' ')[0]} is now ${roleLabels[r].toLowerCase()}`);
            }}
          >
            {roles
              .filter((r) => r !== 'owner')
              .map((r) => (
                <option key={r} value={r}>
                  {roleLabels[r]}
                </option>
              ))}
          </select>
        ),
    },
    { key: 'store', label: 'Showroom', sortValue: (s) => s.store, render: (s) => storeName(s.store), hide: 'sm' },
    { key: 'status', label: 'Status', sortValue: (s) => (s.active ? 0 : isInvited(s) ? 1 : 2), render: status },
    {
      key: 'actions',
      label: <span class="sr-only">Actions</span>,
      align: 'right',
      class: 'team-actions',
      render: (s) => {
        if (s.role === 'owner' || s.id === user.id) return null;
        const items = isInvited(s)
          ? [
              { label: 'Resend invitation', icon: 'send' as const, onSelect: () => toast(`Invitation resent to ${s.name} — simulated`) },
              { label: 'Cancel invitation', icon: 'x-circle' as const, danger: true, onSelect: () => (cancelInvite(s.id), toast('Invitation cancelled')) },
            ]
          : s.active
            ? [{ label: 'Deactivate', icon: 'lock' as const, danger: true, onSelect: () => (updateStaff(s.id, { active: false }), toast(`${s.name} can no longer sign in`)) }]
            : [{ label: 'Reactivate', icon: 'check-circle' as const, onSelect: () => (updateStaff(s.id, { active: true }), toast(`${s.name} can sign in again`)) }];
        return <Menu label={`Actions for ${s.name}`} items={items} size="sm" />;
      },
    },
  ];

  return (
    <div class="stack">
      <Card
        title="Team"
        subtitle={`${plural(d.staff.filter((s) => s.active).length, 'person', 'people')} can sign in`}
        actions={
          <Button icon="plus" onClick={() => setInviting(true)}>
            Invite teammate
          </Button>
        }
        flush
      >
        <DataTable rows={d.staff} columns={columns} rowKey={(s) => s.id} caption="Team members" pageSize={40} />
      </Card>

      <Card title="What each role can use" subtitle="Changes apply right away — switch profiles from the account menu (top right) to see each role’s view." flush>
        <div class="table-wrap">
          <table class="table perm-table">
            <caption class="sr-only">Sections each role can use</caption>
            <thead>
              <tr>
                <th scope="col">Role</th>
                {allSections.map((s) => (
                  <th key={s} scope="col" class="is-center">
                    {sectionLabels[s]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {roles.map((r) => {
                const people = d.staff.filter((s) => s.role === r && s.active).length;
                const locked = r === 'owner';
                return (
                  <tr key={r}>
                    <th scope="row">
                      <span class="perm-role">{roleLabels[r]}</span>
                      <span class="cell-sub">
                        {plural(people, 'person', 'people')}
                        {locked ? ' · always full access' : ''}
                      </span>
                    </th>
                    {allSections.map((s) => {
                      const on = locked || perms[r].includes(s);
                      return (
                        <td key={s} class="is-center">
                          <input
                            type="checkbox"
                            checked={on}
                            disabled={locked}
                            aria-label={`${roleLabels[r]} can use ${sectionLabels[s]}`}
                            onChange={(e) => {
                              const allowed = (e.target as HTMLInputElement).checked;
                              setPermission(r, s, allowed);
                              toast(`${roleLabels[r]} ${allowed ? 'can now use' : 'can no longer use'} ${sectionLabels[s]}`);
                            }}
                          />
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {inviting && <InviteDialog onClose={() => setInviting(false)} />}
    </div>
  );
}

/* ---------- Website forms ---------- */

function FormsTab() {
  const d = db.value;
  const forms = d.settings.forms;
  const [reply, setReply] = useState(forms.autoReplyText);
  const people = d.staff.filter((s) => s.active);
  const business = d.settings.business?.displayName || site.name;

  const route = (kind: 'quote' | 'service', store: StoreId, staffId: string) => {
    updateSettings((s) => (s.forms.routing[kind][store] = staffId));
    toast(`New ${kind === 'quote' ? 'quote' : 'service'} requests for ${storeName(store)} now go to ${d.staff.find((x) => x.id === staffId)?.name}`);
  };

  return (
    <div class="stack">
      <Card title="Who gets new requests" subtitle="Each request is assigned automatically by type and showroom. Requests you log from the Inbox use the same rules." flush>
        <div class="table-wrap">
          <table class="table routing-table">
            <caption class="sr-only">Request routing by type and showroom</caption>
            <thead>
              <tr>
                <th scope="col">Request type</th>
                <th scope="col">Osage Beach</th>
                <th scope="col">Nixa</th>
              </tr>
            </thead>
            <tbody>
              {(['quote', 'service'] as const).map((kind) => (
                <tr key={kind}>
                  <th scope="row">
                    <span class="perm-role">{kind === 'quote' ? 'Quote requests' : 'Service requests & questions'}</span>
                    <span class="cell-sub">{kind === 'quote' ? 'Website “Request a quote” form' : 'Website “Request service” form, Facebook'}</span>
                  </th>
                  {(['osage-beach', 'nixa'] as const).map((store) => (
                    <td key={store}>
                      <select class="select select--sm" aria-label={`${kind === 'quote' ? 'Quote' : 'Service'} requests at ${storeName(store)} go to`} value={forms.routing[kind][store]} onChange={(e) => route(kind, store, (e.target as HTMLSelectElement).value)}>
                        {people.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name}
                          </option>
                        ))}
                      </select>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <div class="settings-grid">
        <Card title="Automatic reply" subtitle="Sent the moment someone submits a website form">
          <Switch
            checked={forms.autoReply}
            onChange={(v) => {
              updateSettings((s) => (s.forms.autoReply = v));
              toast(v ? 'Automatic replies turned on' : 'Automatic replies turned off');
            }}
            label="Send an automatic reply"
            description="Lets people know their request arrived and when to expect a call."
          />
          <Field label="Message" class="settings-reply">
            <textarea class="textarea" rows={5} value={reply} disabled={!forms.autoReply} onInput={(e) => setReply((e.target as HTMLTextAreaElement).value)} />
          </Field>
          <div class="settings-actions">
            <Button
              variant="primary"
              disabled={reply === forms.autoReplyText || !reply.trim()}
              onClick={() => {
                updateSettings((s) => (s.forms.autoReplyText = reply.trim()));
                toast('Automatic reply saved', { tone: 'success' });
              }}
            >
              Save message
            </Button>
          </div>
        </Card>

        <Card title="Preview" subtitle="What a customer sees in their inbox">
          <div class={cx('email-preview', !forms.autoReply && 'is-off')}>
            <p class="email-preview__row">
              <span>From</span> {business}
            </p>
            <p class="email-preview__row">
              <span>Subject</span> We got your request
            </p>
            <p class="email-preview__body">{reply || ' '}</p>
          </div>
          {!forms.autoReply && <p class="muted small">Automatic replies are off — nothing is sent.</p>}
        </Card>
      </div>

      <Card title="Where requests come from">
        <ul class="sources" role="list">
          <li>
            <Icon name="chat" size={18} />
            <span>
              <strong>Request a quote</strong> — the three-step form on the website’s contact page.{' '}
              <a href={`${BASE}/contact/`}>Open the form</a>
            </span>
          </li>
          <li>
            <Icon name="wrench" size={18} />
            <span>
              <strong>Request service</strong> — appliance, issue, photos and preferred times.{' '}
              <a href={`${BASE}/service-request/`}>Open the form</a>
            </span>
          </li>
          <li>
            <Icon name="phone" size={18} />
            <span>
              <strong>Phone calls and showroom visits</strong> — logged by your team in a few seconds.{' '}
              <button type="button" class="link-btn" onClick={() => openDialog({ kind: 'request' })}>
                Log a request
              </button>
            </span>
          </li>
          <li>
            <Icon name="facebook" size={18} />
            <span>
              <strong>Facebook messages</strong> — logged by staff in this demo; the live version can connect your Facebook page.
            </span>
          </li>
        </ul>
      </Card>
    </div>
  );
}

/* ---------- Invoicing & tax ---------- */

interface MoneyForm {
  terms: SettingsData['terms'];
  footer: string;
  taxOB: string;
  taxNixa: string;
  labor: string;
  trip: string;
  gas: string;
  wood: string;
  pellet: string;
}

const pct = (n: number) => String(Math.round(n * 100000) / 1000);

function fromSettings(s: SettingsData): MoneyForm {
  return {
    terms: s.terms,
    footer: s.invoiceFooter,
    taxOB: pct(s.taxRates['osage-beach']),
    taxNixa: pct(s.taxRates.nixa),
    labor: String(s.laborRate),
    trip: String(s.tripCharge),
    gas: String(s.annualService.gas),
    wood: String(s.annualService.wood),
    pellet: String(s.annualService.pellet),
  };
}

function Affix({ prefix, suffix, children }: { prefix?: string; suffix?: string; children: ComponentChildren }) {
  return (
    <span class={cx('affix', prefix && 'affix--prefix', suffix && 'affix--suffix')}>
      {prefix && (
        <span class="affix__text" aria-hidden="true">
          {prefix}
        </span>
      )}
      {children}
      {suffix && (
        <span class="affix__text" aria-hidden="true">
          {suffix}
        </span>
      )}
    </span>
  );
}

function InvoicingTab() {
  const s = db.value.settings;
  const saved = fromSettings(s);
  const [form, setForm] = useState<MoneyForm>(saved);
  const dirty = JSON.stringify(form) !== JSON.stringify(saved);
  const set = (k: keyof MoneyForm) => (e: Event) => setForm({ ...form, [k]: (e.target as HTMLInputElement).value });
  const nums = [form.labor, form.trip, form.gas, form.wood, form.pellet].map(Number);
  const taxes = [form.taxOB, form.taxNixa].map(Number);
  const valid = nums.every((n) => Number.isFinite(n) && n >= 0) && taxes.every((n) => Number.isFinite(n) && n >= 0 && n <= 20);

  const save = (e: Event) => {
    e.preventDefault();
    if (!valid) return;
    updateSettings((x) => {
      x.terms = form.terms;
      x.invoiceFooter = form.footer.trim();
      x.taxRates = { 'osage-beach': Number(form.taxOB) / 100, nixa: Number(form.taxNixa) / 100 };
      x.laborRate = Number(form.labor);
      x.tripCharge = Number(form.trip);
      x.annualService = { gas: Number(form.gas), wood: Number(form.wood), pellet: Number(form.pellet) };
    });
    toast('Invoicing settings saved — new invoices and estimates use them', { tone: 'success' });
  };

  return (
    <form class="stack" onSubmit={save}>
      <div class="settings-grid">
        <Card title="Invoices" subtitle="Defaults for new invoices and estimates">
          <div class="stack">
            <Field label="Payment terms" hint="Builders are always billed Net 30">
              <select class="select" value={form.terms} onChange={(e) => setForm({ ...form, terms: (e.target as HTMLSelectElement).value as SettingsData['terms'] })}>
                <option>Due on receipt</option>
                <option>Net 15</option>
                <option>Net 30</option>
              </select>
            </Field>
            <Field label="Invoice footer">
              <textarea class="textarea" rows={3} value={form.footer} onInput={set('footer')} />
            </Field>
          </div>
        </Card>

        <Card title="Sales tax" subtitle="Sample rates for this demo — confirm current rates with your accountant">
          <div class="form-grid">
            <Field label="Osage Beach">
              <Affix suffix="%">
                <input class="input" type="number" inputMode="decimal" step="0.001" min="0" max="20" value={form.taxOB} onInput={set('taxOB')} />
              </Affix>
            </Field>
            <Field label="Nixa">
              <Affix suffix="%">
                <input class="input" type="number" inputMode="decimal" step="0.001" min="0" max="20" value={form.taxNixa} onInput={set('taxNixa')} />
              </Affix>
            </Field>
          </div>
          <p class="muted small settings-note">Tax applies to equipment, parts and retail items. Labor is not taxed.</p>
        </Card>
      </div>

      <Card title="Service pricing" subtitle="Used when a finished job is turned into an invoice">
        <div class="price-grid">
          <Field label="Labor, per hour">
            <Affix prefix="$">
              <input class="input" type="number" inputMode="decimal" min="0" step="1" value={form.labor} onInput={set('labor')} />
            </Affix>
          </Field>
          <Field label="Service call (trip charge)">
            <Affix prefix="$">
              <input class="input" type="number" inputMode="decimal" min="0" step="1" value={form.trip} onInput={set('trip')} />
            </Affix>
          </Field>
          <Field label="Annual service — gas">
            <Affix prefix="$">
              <input class="input" type="number" inputMode="decimal" min="0" step="1" value={form.gas} onInput={set('gas')} />
            </Affix>
          </Field>
          <Field label="Annual service — wood (with sweep)">
            <Affix prefix="$">
              <input class="input" type="number" inputMode="decimal" min="0" step="1" value={form.wood} onInput={set('wood')} />
            </Affix>
          </Field>
          <Field label="Annual service — pellet">
            <Affix prefix="$">
              <input class="input" type="number" inputMode="decimal" min="0" step="1" value={form.pellet} onInput={set('pellet')} />
            </Affix>
          </Field>
        </div>
      </Card>

      <div class={cx('settings-actions settings-actions--bar', dirty && 'is-dirty')}>
        {!valid ? (
          <span class="is-bad small">Amounts need to be numbers, and tax rates between 0 and 20%.</span>
        ) : (
          <span class="settings-actions__status" aria-live="polite">
            {dirty ? 'You have unsaved changes' : 'All changes saved'}
          </span>
        )}
        <Button variant="ghost" disabled={!dirty} onClick={() => setForm(saved)}>
          Discard
        </Button>
        <Button type="submit" variant="primary" disabled={!dirty || !valid}>
          Save changes
        </Button>
      </div>
    </form>
  );
}

/* ---------- Notifications ---------- */

const notificationRows: { key: keyof SettingsData['notifications']; label: string; description: string }[] = [
  { key: 'newLead', label: 'New website requests', description: 'When a quote or service request comes in from the website.' },
  { key: 'jobCompleted', label: 'Jobs finished in the field', description: 'When a technician marks a job complete and the customer signs.' },
  { key: 'paymentReceived', label: 'Payments received', description: 'Card, check and ACH payments recorded against invoices.' },
  { key: 'lowStock', label: 'Low stock', description: 'When an item drops below its reorder point at either showroom.' },
  { key: 'dailyDigest', label: 'Morning summary email', description: 'A 7 AM recap of today’s schedule, new requests and overdue invoices.' },
];

function NotificationsTab() {
  const n = db.value.settings.notifications;
  return (
    <Card title="Notifications" subtitle="These show up under the bell in the top bar. In the live version they can also go out by email or text.">
      {notificationRows.map((row) => (
        <Switch
          key={row.key}
          checked={n[row.key]}
          label={row.label}
          description={row.description}
          onChange={(v) => {
            updateSettings((s) => (s.notifications[row.key] = v));
            toast(`${row.label}: ${v ? 'on' : 'off'}`);
          }}
        />
      ))}
    </Card>
  );
}

/* ---------- Demo data ---------- */

function DemoTab() {
  const d = db.value;
  const [confirming, setConfirming] = useState(false);
  const stats: [string, number][] = [
    ['Customers', d.customers.length],
    ['Appliances', d.units.length],
    ['Requests', d.leads.length],
    ['Jobs', d.jobs.length],
    ['Invoices & estimates', d.invoices.length],
    ['Products & parts', d.items.length],
  ];
  return (
    <div class="settings-grid">
      <Card title="About the demo data">
        <div class="prose-sm settings-prose">
          <p>Everything in HMI mode is sample data made for this concept — the customers, jobs, invoices and figures are invented, and the technician names are placeholders.</p>
          <p>
            What you change is saved <strong>only in this browser</strong>. Nothing is sent anywhere, and other people viewing the demo see their own copy. Dates move forward automatically, so the schedule always
            looks current.
          </p>
          <p>Requests you submit on the public website in this browser are handed to the Inbox, just like they would be in the live version.</p>
        </div>
        <ul class="demo-stats" role="list">
          {stats.map(([label, value]) => (
            <li key={label}>
              <span class="demo-stats__value">{number(value)}</span>
              <span class="demo-stats__label">{label}</span>
            </li>
          ))}
        </ul>
      </Card>
      <Card title="Start over or take a copy">
        <div class="stack">
          <div class="demo-action">
            <div>
              <p class="demo-action__title">Reset demo data</p>
              <p class="muted small">Puts every request, job, invoice and stock level back the way it started. Your profile stays signed in.</p>
            </div>
            <Button variant="danger" icon="refresh" onClick={() => setConfirming(true)}>
              Reset
            </Button>
          </div>
          <div class="demo-action">
            <div>
              <p class="demo-action__title">Download my demo data</p>
              <p class="muted small">A JSON file of everything in this browser — handy for showing developers what a real backend would store.</p>
            </div>
            <Button
              icon="download"
              onClick={() => {
                downloadJson(`hmi-office-demo-${today()}.json`, db.value);
                toast('Download started');
              }}
            >
              Download
            </Button>
          </div>
        </div>
      </Card>
      {confirming && (
        <Dialog
          title="Reset the demo?"
          size="sm"
          class="settings-dialog"
          onClose={() => setConfirming(false)}
          footer={
            <>
              <Button onClick={() => setConfirming(false)}>Cancel</Button>
              <Button
                variant="danger"
                data-autofocus
                onClick={async () => {
                  setConfirming(false);
                  await resetDemo();
                  toast('Demo data reset — everything is back to the starting point.', { tone: 'success' });
                }}
              >
                Reset demo data
              </Button>
            </>
          }
        >
          <p>This puts every request, job, invoice and stock level back the way it started, in this browser only.</p>
        </Dialog>
      )}
    </div>
  );
}

/* ---------- Page ---------- */

export default function Settings() {
  const raw = param('tab');
  const tab: Tab = tabs.some((t) => t.key === raw) ? (raw as Tab) : 'profile';
  return (
    <div class="settings">
      <PageHeader title="Settings" description="How HMI Office works for your team — business details, who can see what, website forms, invoicing and notifications." />
      <Tabs idBase="settings" label="Settings sections" items={tabs} value={tab} onChange={(k) => setParams({ tab: k === 'profile' ? undefined : k }, { replace: true })} />
      <TabPanel idBase="settings" active={tab}>
        {tab === 'profile' && <ProfileTab />}
        {tab === 'team' && <TeamTab />}
        {tab === 'forms' && <FormsTab />}
        {tab === 'invoicing' && <InvoicingTab />}
        {tab === 'notifications' && <NotificationsTab />}
        {tab === 'demo' && <DemoTab />}
      </TabPanel>
    </div>
  );
}
