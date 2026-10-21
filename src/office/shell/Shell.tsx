/** The HMI mode frame: sidebar, top bar, page area, toasts and app-wide dialogs. */
import type { ComponentChildren } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { useAssets } from '../assets';
import type { Section, StoreFilter } from '../data/types';
import { activeDialog, openDialog } from '../dialogs';
import { PUBLIC_HOME, route, sectionPath } from '../router';
import { lowStock } from '../selectors';
import { can, db, me, setUI, ui } from '../store';
import { cx, Link, Menu } from '../ui/core';
import { Icon, type IconName } from '../ui/Icon';
import { CommandPalette, paletteOpen } from './CommandPalette';
import { DialogHost } from './DialogHost';
import { Notifications } from './Notifications';
import { Toaster } from './Toaster';
import { UserMenu } from './UserMenu';

interface NavItem {
  section: Section;
  label: string;
  icon: IconName;
  badge?: () => { count: number; label: string } | null;
}

const groups: { label: string; items: NavItem[] }[] = [
  {
    label: 'Today',
    items: [
      { section: 'dashboard', label: 'Dashboard', icon: 'dashboard' },
      { section: 'my-day', label: 'My day', icon: 'sun' },
      {
        section: 'inbox',
        label: 'Inbox',
        icon: 'inbox',
        badge: () => {
          const n = db.value.leads.filter((l) => l.stage === 'new' && (ui.value.store === 'all' || l.store === ui.value.store)).length;
          return n ? { count: n, label: `${n} new` } : null;
        },
      },
    ],
  },
  {
    label: 'Operations',
    items: [
      {
        section: 'jobs',
        label: 'Jobs & schedule',
        icon: 'clipboard',
        badge: () => {
          const n = db.value.jobs.filter((j) => j.status === 'requested' && (ui.value.store === 'all' || j.store === ui.value.store)).length;
          return n ? { count: n, label: `${n} need scheduling` } : null;
        },
      },
      { section: 'customers', label: 'Customers', icon: 'users' },
      { section: 'warranty', label: 'Warranty', icon: 'shield' },
      {
        section: 'inventory',
        label: 'Inventory',
        icon: 'box',
        badge: () => {
          const n = lowStock(db.value, ui.value.store).length;
          return n ? { count: n, label: `${n} low on stock` } : null;
        },
      },
    ],
  },
  {
    label: 'Business',
    items: [
      { section: 'accounting', label: 'Accounting', icon: 'bank' },
      { section: 'analytics', label: 'Analytics', icon: 'chart' },
      { section: 'settings', label: 'Settings', icon: 'sliders' },
    ],
  },
];

export const sectionTitles: Record<Section, string> = {
  dashboard: 'Dashboard',
  'my-day': 'My day',
  inbox: 'Inbox',
  jobs: 'Jobs & schedule',
  customers: 'Customers',
  warranty: 'Warranty',
  inventory: 'Inventory',
  accounting: 'Accounting',
  analytics: 'Analytics',
  settings: 'Settings',
};

function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { logo } = useAssets();
  const current = route.value.section;
  return (
    <aside class={cx('sidebar', open && 'is-open')} aria-label="HMI mode">
      <div class="sidebar__brand">
        <Link to="/office/" class="sidebar__logo" aria-label="HMI Office — dashboard">
          <img src={logo} alt="" width={150} height={30} />
        </Link>
        <span class="sidebar__app">Office</span>
        <button type="button" class="btn btn--ghost btn--md btn--icon sidebar__close" aria-label="Close menu" onClick={onClose}>
          <Icon name="close" />
        </button>
      </div>

      <label class="sidebar__store">
        <span class="sr-only">Location</span>
        <Icon name="store" size={16} />
        <select class="select" value={ui.value.store} onChange={(e) => setUI({ store: (e.target as HTMLSelectElement).value as StoreFilter })}>
          <option value="all">All locations</option>
          <option value="osage-beach">Osage Beach</option>
          <option value="nixa">Nixa</option>
        </select>
      </label>

      <nav class="sidebar__nav" aria-label="Sections">
        {groups.map((g) => {
          const items = g.items.filter((it) => can(it.section));
          if (!items.length) return null;
          return (
            <div class="sidebar__group" key={g.label}>
              <p class="sidebar__group-label">{g.label}</p>
              <ul role="list">
                {items.map((it) => {
                  const badge = it.badge?.();
                  return (
                    <li key={it.section}>
                      <Link to={sectionPath(it.section)} class={cx('sidebar__link', current === it.section && 'is-active')} aria-current={current === it.section ? 'page' : undefined} onClick={onClose}>
                        <Icon name={it.icon} size={18} />
                        <span class="sidebar__label">{it.label}</span>
                        {badge && (
                          <span class="sidebar__badge" aria-label={badge.label}>
                            {badge.count}
                          </span>
                        )}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </nav>

      <div class="sidebar__foot">
        <a class="sidebar__public" href={lastPublic()}>
          <Icon name="globe" size={16} />
          View the public website
        </a>
        <p class="sidebar__demo">Concept demo · sample data</p>
      </div>
    </aside>
  );
}

const lastPublic = () => {
  try {
    return localStorage.getItem('hmi-last-public') || PUBLIC_HOME;
  } catch {
    return PUBLIC_HOME;
  }
};

/** Public ↔ HMI switch, mirrored on the public site */
export function ModeToggle() {
  return (
    <nav class="mode-toggle" aria-label="Site mode">
      <a href={lastPublic()} class="mode-toggle__opt">
        <Icon name="globe" size={15} />
        <span>Public</span>
      </a>
      <span class="mode-toggle__opt is-active" aria-current="page">
        <Icon name="briefcase" size={15} />
        <span>HMI</span>
      </span>
    </nav>
  );
}

function Topbar({ onMenu }: { onMenu: () => void }) {
  const user = me.value!;
  const unread = db.value.notices.filter((n) => !n.read).length;
  const [notifOpen, setNotifOpen] = useState(false);
  const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);
  const newItems = [
    can('jobs') && { label: 'Job', icon: 'clipboard' as const, onSelect: () => openDialog({ kind: 'job' }) },
    can('customers') && { label: 'Customer', icon: 'user' as const, onSelect: () => openDialog({ kind: 'customer' }) },
    can('inbox') && { label: 'Phone or walk-in request', icon: 'phone' as const, onSelect: () => openDialog({ kind: 'request' }) },
    can('accounting') && { label: 'Estimate', icon: 'file' as const, onSelect: () => openDialog({ kind: 'invoice', preset: { kind: 'estimate' } }) },
    can('accounting') && { label: 'Invoice', icon: 'receipt' as const, onSelect: () => openDialog({ kind: 'invoice', preset: { kind: 'invoice' } }) },
  ].filter(Boolean) as { label: string; icon: IconName; onSelect: () => void }[];

  return (
    <header class="topbar">
      <button type="button" class="btn btn--ghost btn--md btn--icon topbar__menu" aria-label="Open menu" onClick={onMenu}>
        <Icon name="menu" />
      </button>
      <button type="button" class="topbar__search" aria-label="Search customers, jobs and invoices" onClick={() => (paletteOpen.value = true)} aria-keyshortcuts={isMac ? 'Meta+K' : 'Control+K'}>
        <Icon name="search" size={16} />
        <span class="topbar__search-text">Search customers, jobs, invoices…</span>
        <kbd class="kbd">{isMac ? '⌘K' : 'Ctrl K'}</kbd>
      </button>
      <div class="topbar__end">
        {newItems.length > 0 && <Menu label="Create new" icon="plus" buttonLabel={<span class="hide-sm">New</span>} variant="primary" items={newItems} />}
        <button type="button" class="btn btn--ghost btn--md btn--icon topbar__bell" aria-label={unread ? `Notifications, ${unread} unread` : 'Notifications'} onClick={() => setNotifOpen(true)}>
          <Icon name="bell" />
          {unread > 0 && <span class="topbar__dot" aria-hidden="true">{unread}</span>}
        </button>
        <ModeToggle />
        <UserMenu user={user} />
      </div>
      {notifOpen && <Notifications onClose={() => setNotifOpen(false)} />}
    </header>
  );
}

export function Shell({ children }: { children: ComponentChildren }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const section = route.value.section;

  useEffect(() => {
    document.title = `${sectionTitles[section]} · HMI Office`;
    setMenuOpen(false);
    requestAnimationFrame(() => document.querySelector<HTMLElement>('[data-page-title]')?.focus({ preventScroll: true }));
  }, [section]);

  // Remember the last screen, so the public site's "HMI mode" switch returns here
  useEffect(() => {
    try {
      localStorage.setItem('hmi-last-office', location.pathname + location.search);
    } catch {
      /* storage unavailable */
    }
  }, [route.value]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        paletteOpen.value = !paletteOpen.value;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div class={cx('app', menuOpen && 'menu-open')}>
      <a class="skip-link" href="#office-main">
        Skip to content
      </a>
      <Sidebar open={menuOpen} onClose={() => setMenuOpen(false)} />
      {menuOpen && <div class="scrim" onClick={() => setMenuOpen(false)} aria-hidden="true" />}
      <div class="main">
        <Topbar onMenu={() => setMenuOpen(true)} />
        <main id="office-main" class="page" tabIndex={-1}>
          {children}
        </main>
      </div>
      {paletteOpen.value && <CommandPalette />}
      {activeDialog.value && <DialogHost request={activeDialog.value} />}
      <Toaster />
    </div>
  );
}
