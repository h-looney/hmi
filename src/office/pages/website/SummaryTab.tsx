/** Weekly summary: the Monday email to whoever owns the website — about five minutes of reading and clicking. */
import { toDateTime } from '../../lib/dates';
import { plural, relative } from '../../lib/format';
import { db } from '../../store';
import { toast } from '../../toast';
import { Avatar, Button, Card, Field } from '../../ui/core';
import { Icon } from '../../ui/Icon';
import { markDigestSent, setDigestTo } from './actions';
import { brandName, clicks, failingLinks, feed, movedLinks, openSuggestions, pendingCount, report, unverifiedLinks } from './data';
import { targetText } from './helpers';

const BASE = import.meta.env.BASE_URL.replace(/\/$/, '');

export interface Digest {
  subject: string;
  lines: { icon: 'shield' | 'link' | 'sparkle' | 'archive' | 'external' | 'clock' | 'check-circle' | 'lock'; text: string; detail?: string[] }[];
}

/** What the Monday summary says, from the latest link check, sitemap watch, clicks and pending changes. */
export function buildDigest(): Digest {
  const fixed = failingLinks.value;
  const moved = movedLinks.value;
  const fresh = openSuggestions.value.filter((s) => s.type === 'new');
  const gone = openSuggestions.value.filter((s) => s.type === 'discontinued');
  const weekClicks = clicks.value.filter((c) => c.at >= toDateTime(new Date(Date.now() - 7 * 86_400_000))).length;
  const pending = pendingCount.value;
  const firstRun = feed.value.state === 'ready' && feed.value.data.mode === 'first-run';

  const byBrand = new Map<string, number>();
  for (const s of fresh) byBrand.set(s.brand, (byBrand.get(s.brand) ?? 0) + 1);
  const topBrands = [...byBrand].sort((a, b) => b[1] - a[1]);

  const parts: string[] = [];
  if (fixed.length) parts.push(`${plural(fixed.length, 'link')} fixed automatically`);
  if (moved.length) parts.push(`${plural(moved.length, 'stored URL')} to update`);
  if (topBrands.length) {
    const [brand, n] = topBrands[0];
    parts.push(topBrands.length === 1 ? `${n} new ${brandName(brand)} ${n === 1 ? 'model' : 'models'} to review` : `${plural(fresh.length, 'new product page')} to review`);
  }
  if (gone.length) parts.push(`${plural(gone.length, 'model')} possibly discontinued`);
  const subject = parts.length ? `Website this week: ${parts.join(', ')}` : 'Website this week: all links working, nothing to review';

  const lines: Digest['lines'] = [];
  if (report.value.state !== 'ready') lines.push({ icon: 'clock', text: 'No link check results yet — the first nightly check will fill this in.' });
  else if (!fixed.length) lines.push({ icon: 'check-circle', text: `All ${plural(report.value.data.summary.total, 'manufacturer link')} checked every night — none broken.` });
  else
    lines.push({
      icon: 'shield',
      text: `${plural(fixed.length, 'link')} broke on the manufacturer’s side and ${fixed.length === 1 ? 'was' : 'were'} fixed automatically — customers get a safe page instead:`,
      detail: fixed.map((x) => `${x.label}: ${x.reason} → now goes to ${targetText(x.target).replace(/^The /, 'the ')}`),
    });
  if (moved.length) lines.push({ icon: 'link', text: `${plural(moved.length, 'link')} moved to a new address — one click each to store it:`, detail: moved.map((x) => `${x.label} → ${(x.suggestedUrl ?? x.finalUrl).replace(/^https?:\/\/(www\.)?/, '')}`) });
  const nUnverified = unverifiedLinks.value.length;
  if (nUnverified) lines.push({ icon: 'lock', text: `${plural(nUnverified, 'site')} ${nUnverified === 1 ? 'sits' : 'sit'} behind a bot check, so we couldn’t verify ${nUnverified === 1 ? 'it' : 'them'} (still linked as usual).` });
  if (topBrands.length)
    lines.push({
      icon: 'sparkle',
      text: firstRun ? 'First sitemap read — product pages not on your list yet, by brand:' : 'New on manufacturers’ sites this week:',
      detail: topBrands.slice(0, 6).map(([b, n]) => `${brandName(b)}: ${plural(n, firstRun ? 'page' : 'new product')}`),
    });
  if (gone.length) lines.push({ icon: 'archive', text: 'Possibly discontinued (gone from their sitemap):', detail: gone.map((s) => `${brandName(s.brand)} ${s.name}`) });
  lines.push({ icon: 'external', text: `${plural(weekClicks, 'outbound click')} in the last 7 days (this browser — production would count every visitor).` });
  if (pending) lines.push({ icon: 'clock', text: `${plural(pending, 'change')} waiting for the next publish.` });
  return { subject, lines };
}

export function SummaryTab() {
  const d = db.value;
  const owners = d.staff.filter((s) => s.active && d.settings.permissions[s.role].includes('website'));
  const to = d.staff.find((s) => s.id === d.website.digestTo) ?? owners[0];
  const digest = buildDigest();
  const first = to?.name.split(' ')[0] ?? 'there';
  const email = to ? `${to.name.split(' ')[0].toLowerCase()}@hmifireplaceshop.example` : '';

  return (
    <div class="web-digest-grid">
      <Card title="Who gets it" subtitle="Every Monday at 7 AM. It should take whoever owns the website about five minutes.">
        <div class="stack">
          <Field label="Send the weekly summary to">
            <select
              class="select"
              value={to?.id}
              onChange={(e) => {
                const id = (e.target as HTMLSelectElement).value;
                setDigestTo(id);
                toast(`The weekly summary now goes to ${d.staff.find((s) => s.id === id)?.name}`);
              }}
            >
              {owners.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} — {s.title}
                </option>
              ))}
            </select>
          </Field>
          {to && (
            <p class="web-digest-to">
              <Avatar person={to} size={32} />
              <span>
                <span class="cell-main">{to.name}</span>
                <span class="cell-sub">{email}</span>
              </span>
            </p>
          )}
          <Button
            variant="primary"
            icon="send"
            onClick={() => {
              markDigestSent();
              toast(`Weekly summary sent to ${to?.name} (simulated — nothing left this browser)`, { tone: 'success' });
            }}
          >
            Send now (simulated)
          </Button>
          <p class="muted small">{d.website.digestSentAt ? `Last sent ${relative(d.website.digestSentAt)}.` : 'Not sent yet from this browser.'} Only people whose role includes Website can receive it — owners decide that under Settings → Team &amp; permissions.</p>
        </div>
      </Card>

      <section class="card web-email" aria-label="Preview of the weekly summary email">
        <header class="web-email__head">
          <p>
            <span class="web-email__k">To</span> {to?.name} &lt;{email}&gt;
          </p>
          <p>
            <span class="web-email__k">Subject</span> <strong>{digest.subject}</strong>
          </p>
        </header>
        <div class="web-email__body">
          <p>Hi {first},</p>
          <p>Here’s the website this week — the nightly link checks and Monday’s look at the manufacturers’ sitemaps.</p>
          <ul role="list" class="web-email__lines">
            {digest.lines.map((l, i) => (
              <li key={i}>
                <Icon name={l.icon} size={16} />
                <div>
                  <p>{l.text}</p>
                  {l.detail && (
                    <ul class="web-email__detail">
                      {l.detail.slice(0, 6).map((x) => (
                        <li key={x}>{x}</li>
                      ))}
                      {l.detail.length > 6 && <li>…and {l.detail.length - 6} more</li>}
                    </ul>
                  )}
                </div>
              </li>
            ))}
          </ul>
          <p>
            <a class="btn btn--primary btn--md" href={`${BASE}/office/website/`}>
              Review in HMI mode
            </a>
          </p>
          <p class="muted small">Sent by HMI Office. Preview only — in this concept nothing is emailed.</p>
        </div>
      </section>
    </div>
  );
}
