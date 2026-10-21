/** Inbox: every request — website forms, phone calls, walk-ins, Facebook — in one shared list. */
import { useEffect, useMemo, useState } from 'preact/hooks';
import { markLeadRead } from '../../actions';
import type { Lead, LeadKind } from '../../data/types';
import { openDialog } from '../../dialogs';
import { relative } from '../../lib/format';
import { param, route, setParams } from '../../router';
import { matchStore, staffOf, storeName } from '../../selectors';
import { db, me, ui } from '../../store';
import { Avatar, Button, Chips, cx, EmptyState, Link, PageHeader, SearchInput, Sr } from '../../ui/core';
import { Icon } from '../../ui/Icon';
import { leadKindMeta, leadStageMeta } from '../../ui/status';
import { inFilter, type InboxFilter } from './helpers';
import { LeadDetail } from './LeadDetail';

const filters: { key: InboxFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'new', label: 'New' },
  { key: 'open', label: 'Open' },
  { key: 'closed', label: 'Closed' },
];

const kinds: { key: LeadKind | 'all'; label: string }[] = [
  { key: 'all', label: 'All types' },
  { key: 'quote', label: 'Quote requests' },
  { key: 'service', label: 'Service requests' },
  { key: 'question', label: 'Questions' },
];

function LeadRow({ lead, active, to }: { lead: Lead; active: boolean; to: string }) {
  const d = db.value;
  const kind = leadKindMeta[lead.kind];
  const assignee = staffOf(d, lead.assignee);
  return (
    <Link to={to} class={cx('inbox-row', lead.unread && 'is-unread', active && 'is-active')} aria-current={active ? 'true' : undefined}>
      <span class="inbox-row__dot" aria-hidden="true">
        {lead.unread && <span />}
      </span>
      <span class="inbox-row__main">
        <span class="inbox-row__top">
          <span class="inbox-row__name">{lead.name}</span>
          {lead.starred && <Icon name="star" size={13} class="inbox-row__star" label="Starred" />}
          <span class="inbox-row__time">{relative(lead.receivedAt)}</span>
        </span>
        <span class="inbox-row__summary">
          <Icon name={kind.icon} size={13} label={kind.label} />
          <span>{lead.summary}</span>
        </span>
        <span class="inbox-row__meta">
          {storeName(lead.store)}
          {lead.stage !== 'new' && <> · {leadStageMeta[lead.stage].label}</>}
          {lead.demo && <> · From this demo</>}
        </span>
      </span>
      <span class="inbox-row__who">
        <Avatar person={assignee} size={24} />
        <Sr>{lead.unread ? 'Unread. ' : ''}{assignee ? `Assigned to ${assignee.name}` : 'Unassigned'}</Sr>
      </span>
    </Link>
  );
}

export default function Inbox() {
  const d = db.value;
  const store = ui.value.store;
  const userId = me.value?.id;
  const filterParam = param('filter');
  const filter: InboxFilter = filterParam === 'new' || filterParam === 'open' || filterParam === 'closed' ? filterParam : 'all';
  const kindParam = param('kind');
  const kind: LeadKind | 'all' = kindParam === 'quote' || kindParam === 'service' || kindParam === 'question' ? kindParam : 'all';
  const selectedId = param('id');
  const ref = param('ref');
  const [query, setQuery] = useState('');
  const [mine, setMine] = useState(false);

  // The public site's confirmation links here with ?ref=… — swap it for the request's id.
  useEffect(() => {
    if (!ref) return;
    const lead = d.leads.find((l) => l.ref === ref);
    if (lead) setParams({ ref: undefined, id: lead.id }, { replace: true });
  }, [ref, d.leads]);

  const selected = selectedId ? d.leads.find((l) => l.id === selectedId) : undefined;

  useEffect(() => {
    if (selected?.unread) markLeadRead(selected.id);
  }, [selected?.id]);

  const term = query.trim().toLowerCase();
  const base = useMemo(
    () =>
      d.leads.filter(
        (l) =>
          matchStore(store, l.store) &&
          (kind === 'all' || l.kind === kind) &&
          (!mine || l.assignee === userId) &&
          (!term || [l.name, l.summary, l.city, l.id, l.email, l.message].some((f) => f?.toLowerCase().includes(term))),
      ),
    [d.leads, store, kind, mine, term, userId],
  );
  const counts = Object.fromEntries(filters.map((f) => [f.key, base.filter((l) => inFilter(l, f.key)).length])) as Record<InboxFilter, number>;
  const list = base.filter((l) => inFilter(l, filter)).sort((a, b) => (a.receivedAt < b.receivedAt ? 1 : -1));
  const unread = base.filter((l) => l.unread).length;

  const linkFor = (id: string) => {
    const p = new URLSearchParams(route.value.params);
    p.set('id', id);
    p.delete('ref');
    return `/office/inbox/?${p.toString()}`;
  };

  const clearFilters = () => {
    setQuery('');
    setMine(false);
    setParams({ filter: undefined, kind: undefined }, { replace: true });
  };

  return (
    <div class="inbox">
      <PageHeader
        title="Inbox"
        description="Website forms, phone calls, showroom visits and Facebook messages — one shared list, so nothing slips through."
        actions={
          <Button icon="phone" onClick={() => openDialog({ kind: 'request' })}>
            Log a request
          </Button>
        }
      />

      <div class={cx('inbox__panes', selected && 'has-selection')}>
        <section class="inbox__list card" aria-labelledby="inbox-list-title">
          <h2 id="inbox-list-title" class="sr-only">
            Requests
          </h2>
          <div class="inbox__filters">
            <Chips label="Show requests" items={filters.map((f) => ({ key: f.key, label: f.label, count: counts[f.key] }))} value={filter} onChange={(k) => setParams({ filter: k === 'all' ? undefined : k }, { replace: true })} />
            <SearchInput value={query} onInput={setQuery} placeholder="Search name, city or request #" label="Search requests" class="inbox__search" />
            <div class="inbox__filter-row">
              <select class="select select--sm" aria-label="Request type" value={kind} onChange={(e) => setParams({ kind: (e.target as HTMLSelectElement).value === 'all' ? undefined : (e.target as HTMLSelectElement).value }, { replace: true })}>
                {kinds.map((k) => (
                  <option key={k.key} value={k.key}>
                    {k.label}
                  </option>
                ))}
              </select>
              <button type="button" class="chip" aria-pressed={mine} onClick={() => setMine(!mine)}>
                <Icon name="user" size={14} />
                Mine
              </button>
            </div>
            <p class="inbox__count" aria-live="polite">
              {list.length === 1 ? '1 request' : `${list.length} requests`}
              {unread ? ` · ${unread} unread` : ''}
            </p>
          </div>
          {list.length === 0 ? (
            <EmptyState
              icon="inbox"
              title="No requests here"
              action={
                <Button size="sm" onClick={clearFilters}>
                  Clear filters
                </Button>
              }
            >
              Try a different filter or search.
            </EmptyState>
          ) : (
            <ul role="list" class="inbox__items">
              {list.map((l) => (
                <li key={l.id}>
                  <LeadRow lead={l} active={l.id === selectedId} to={linkFor(l.id)} />
                </li>
              ))}
            </ul>
          )}
        </section>

        <section class="inbox__detail" aria-label="Request details">
          {selected ? (
            <LeadDetail key={selected.id} lead={selected} onBack={() => setParams({ id: undefined })} />
          ) : (
            <div class="card inbox__empty">
              <EmptyState icon="inbox" title={selectedId ? 'That request isn’t here' : 'Select a request'}>
                {selectedId ? 'It may have been removed when the demo data was reset.' : 'Pick a request on the left to see the details, reply, or schedule a visit.'}
              </EmptyState>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
