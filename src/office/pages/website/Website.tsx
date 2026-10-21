/**
 * Website — the product list behind every model page and manufacturer link, the nightly link check, the weekly
 * sitemap watch, outbound clicks, the Monday summary and showroom tags.
 *   /office/website/?tab=products|health|suggestions|clicks|summary|tags  (&model=<SKU> for one tag)
 */
import { useEffect } from 'preact/hooks';
import { plural } from '../../lib/format';
import { param, setParams } from '../../router';
import { toast } from '../../toast';
import { Button, PageHeader, Stat, TabPanel, Tabs } from '../../ui/core';
import { Icon } from '../../ui/Icon';
import { publishPending } from './actions';
import { ClicksTab } from './ClicksTab';
import { actionableSuggestions, clicks, failingLinks, feed, loadWebsiteData, movedLinks, openSuggestions, pendingCount, report, siteHref, webProducts } from './data';
import { HealthTab } from './HealthTab';
import { ago } from './helpers';
import { ProductsTab } from './ProductsTab';
import { SuggestionsTab } from './SuggestionsTab';
import { SummaryTab } from './SummaryTab';
import { TagsTab } from './TagsTab';

type TabKey = 'products' | 'health' | 'suggestions' | 'clicks' | 'summary' | 'tags';
const TAB_KEYS: TabKey[] = ['products', 'health', 'suggestions', 'clicks', 'summary', 'tags'];

const flag = (n: number, what: string) =>
  n > 0 ? (
    <>
      <span class="tabs__count" aria-hidden="true">
        {n}
      </span>
      <span class="sr-only">
        , {n} {what}
      </span>
    </>
  ) : null;

export default function Website() {
  useEffect(() => loadWebsiteData(), []);
  const requested = param('tab') as TabKey | undefined;
  const tab: TabKey = requested && TAB_KEYS.includes(requested) ? requested : 'products';
  const go = (k: TabKey) => setParams({ tab: k === 'products' ? undefined : k, model: undefined });

  const pending = pendingCount.value;
  const failing = failingLinks.value.length;
  const moved = movedLinks.value.length;
  const suggestions = openSuggestions.value.length;
  const actionable = actionableSuggestions.value.length;
  const list = webProducts.value;
  const rep = report.value.state === 'ready' ? report.value.data : null;
  const watch = feed.value.state === 'ready' ? feed.value.data : null;

  return (
    <div class="website">
      <PageHeader
        eyebrow="Business"
        title="Website"
        description="The product list behind every model page and manufacturer link — checked every night, with manufacturers’ new and discontinued models every Monday."
        actions={
          <a class="btn btn--secondary btn--md" href={siteHref('/products/')} target="_blank" rel="noopener">
            <Icon name="globe" size={18} />
            <span>Open the public site</span>
            <span class="sr-only"> (opens in a new tab)</span>
          </a>
        }
      />

      {pending > 0 && (
        <div class="callout callout--ember web-pending" role="status">
          <Icon name="clock" size={18} />
          <div>
            <p class="callout__title">{plural(pending, 'change')} waiting — {pending === 1 ? 'it goes' : 'they go'} live on the next publish (simulated)</p>
            <p class="callout__text">Saved in this browser. In production a publish commits the product list and redeploys the site; here nothing on the public site changes.</p>
          </div>
          <Button
            variant="primary"
            size="sm"
            icon="send"
            onClick={() => {
              const n = publishPending();
              toast(`Published ${plural(n, 'change')} (simulated)`, { tone: 'success' });
            }}
          >
            Publish now (simulated)
          </Button>
        </div>
      )}

      <div class="stats web-stats">
        <Stat label="Models on the list" icon="tag" value={list.filter((p) => !p.draft).length} hint={`${list.filter((p) => p.status === 'current').length} current · ${list.filter((p) => p.status === 'discontinued').length} discontinued`} />
        <Stat label="Manufacturer links" icon="link" value={rep ? rep.summary.total : '—'} hint={rep ? `${failing ? `${failing} with a fallback in effect` : 'All working'} · checked ${ago(rep.generatedAt)}` : 'No check results in this build'} to="/office/website/?tab=health" />
        <Stat
          label="To review"
          icon="sparkle"
          value={moved + actionable}
          hint={watch ? `${plural(moved, 'URL')} to update · ${plural(suggestions, 'sitemap suggestion')}${watch.mode === 'first-run' ? ' (first read)' : ''}` : `${plural(moved, 'URL')} to update`}
          to={actionable ? '/office/website/?tab=suggestions' : '/office/website/?tab=health'}
        />
        <Stat label="Outbound clicks" icon="external" value={clicks.value.length} hint="In this browser" to="/office/website/?tab=clicks" />
      </div>

      <Tabs<TabKey>
        label="Website sections"
        idBase="web"
        value={tab}
        onChange={go}
        items={[
          { key: 'products', label: 'Products' },
          { key: 'health', label: <>Link health{flag(failing + moved, 'to look at')}</> },
          { key: 'suggestions', label: <>New &amp; discontinued{flag(suggestions, 'suggestions')}</> },
          { key: 'clicks', label: 'Clicks' },
          { key: 'summary', label: 'Weekly summary' },
          { key: 'tags', label: 'Showroom tags' },
        ]}
      />
      <TabPanel idBase="web" active={tab}>
        {tab === 'products' && <ProductsTab onTag={(id) => setParams({ tab: 'tags', model: id })} />}
        {tab === 'health' && <HealthTab />}
        {tab === 'suggestions' && <SuggestionsTab />}
        {tab === 'clicks' && <ClicksTab />}
        {tab === 'summary' && <SummaryTab />}
        {tab === 'tags' && <TagsTab focus={param('model')} onClearFocus={() => setParams({ model: undefined })} />}
      </TabPanel>
    </div>
  );
}
