/** Badges and formatting shared by the Website tabs. Color never carries meaning alone — every badge has a label. */
import type { LinkResult, LinkStatus, Target } from '../../../data/links';
import type { ProductStatus } from '../../../data/products';
import { toDateTime } from '../../lib/dates';
import { relative } from '../../lib/format';
import { Badge, type Tone } from '../../ui/core';
import type { IconName } from '../../ui/Icon';

type Meta = { label: string; tone: Tone; icon: IconName; help: string };

export const linkMeta: Record<LinkStatus | 'unchecked', Meta> = {
  ok: { label: 'OK', tone: 'green', icon: 'check', help: 'The right page, at the stored address' },
  moved: { label: 'Moved', tone: 'blue', icon: 'transfer', help: 'The right page at a new address — update the stored URL' },
  dead: { label: 'Dead', tone: 'red', icon: 'x-circle', help: 'Doesn’t load: DNS, security certificate, timeout or an HTTP error' },
  'wrong-page': { label: 'Wrong page', tone: 'amber', icon: 'alert', help: 'Loads, but it’s another site, the homepage, a general list, or doesn’t mention the model' },
  'soft-404': { label: 'Not found', tone: 'amber', icon: 'alert', help: 'Loads, but says “not found” or “no longer available”' },
  unverified: { label: 'Unverified', tone: 'neutral', icon: 'lock', help: 'Behind a bot check even in a real browser — never counted as dead' },
  unchecked: { label: 'Not checked yet', tone: 'neutral', icon: 'minus', help: 'No link report for this build yet' },
};

export const productMeta: Record<ProductStatus, Meta> = {
  current: { label: 'Current', tone: 'green', icon: 'check', help: 'On the public site' },
  discontinued: { label: 'Discontinued', tone: 'amber', icon: 'archive', help: 'Page stays up with a notice and service help' },
  hidden: { label: 'Hidden', tone: 'neutral', icon: 'eye', help: 'On the list, but not on the public site' },
};

export function LinkBadge({ result }: { result?: Pick<LinkResult, 'status' | 'reason'> }) {
  const m = linkMeta[result?.status ?? 'unchecked'];
  return (
    <Badge tone={m.tone} icon={m.icon} title={result?.reason ?? m.help}>
      {m.label}
    </Badge>
  );
}

export function ProductBadge({ status }: { status: ProductStatus }) {
  const m = productMeta[status];
  return (
    <Badge tone={m.tone} icon={m.icon} title={m.help}>
      {m.label}
    </Badge>
  );
}

export function PendingBadge() {
  return (
    <Badge tone="violet" icon="clock" title="Saved in this browser. In production it would go out with the next deploy.">
      Goes live on next publish (simulated)
    </Badge>
  );
}

/** ISO timestamp (from the checker) → "3 h ago" in HMI mode's style */
export const ago = (iso: string | null | undefined) => (iso ? relative(toDateTime(new Date(iso))) : '—');

/** ISO timestamp → "Oct 21, 2026, 3:04 AM" */
export const when = (iso: string | null | undefined) =>
  iso ? new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(iso)) : '—';

/** Short host + path for showing a URL in a table */
export function shortUrl(url: string): string {
  try {
    const u = new URL(url);
    const path = u.pathname.replace(/\/$/, '');
    return `${u.hostname.replace(/^www\./, '')}${path.length > 38 ? `${path.slice(0, 36)}…` : path}`;
  } catch {
    return url;
  }
}

/** Where /go/ sends people, in words */
export function targetText(t: Target): string {
  if (t.mode === 'direct' || t.mode === 'unchecked') return 'The stored URL';
  if (t.mode === 'moved') return `The new address (${shortUrl(t.href)})`;
  if (t.href.startsWith('/products/#') || t.href === '/products/') return 'HMI’s brand directory';
  if (t.href.startsWith('/products/')) return 'HMI’s own model page';
  if (t.href.startsWith('/resources')) return 'HMI’s owner resources page';
  return t.href.startsWith('/') ? `HMI page ${t.href}` : shortUrl(t.href);
}
