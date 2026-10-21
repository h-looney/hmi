/**
 * Showroom tags: a printable card per model with a QR code for HMI's own model page. The code never points at a
 * manufacturer — HMI's page can't go dead and always carries the current "Full specs" link — so tags never break.
 */
import qrcode from 'qrcode-generator';
import { useMemo, useState } from 'preact/hooks';
import { productPath, products, type Product } from '../../../data/products';
import type { StoreId } from '../../data/types';
import { plural } from '../../lib/format';
import { Button, Card, Checkbox, EmptyState, Segmented } from '../../ui/core';
import { Icon } from '../../ui/Icon';
import { brandName, webProducts } from './data';

const BASE = import.meta.env.BASE_URL.replace(/\/$/, '');

export function QrCode({ text, label, size = 132 }: { text: string; label: string; size?: number }) {
  const { n, path } = useMemo(() => {
    const qr = qrcode(0, 'M');
    qr.addData(text);
    qr.make();
    const count = qr.getModuleCount();
    let d = '';
    for (let r = 0; r < count; r++) for (let c = 0; c < count; c++) if (qr.isDark(r, c)) d += `M${c} ${r}h1v1h-1z`;
    return { n: count, path: d };
  }, [text]);
  return (
    <svg class="qr" viewBox={`-4 -4 ${n + 8} ${n + 8}`} width={size} height={size} role="img" aria-label={label} shape-rendering="crispEdges">
      <rect x={-4} y={-4} width={n + 8} height={n + 8} fill="#fff" />
      <path d={path} fill="#1b1714" />
    </svg>
  );
}

const pageUrl = (p: Product) => `${location.origin}${BASE}${productPath(p)}`;

function Tag({ p }: { p: Product }) {
  const url = pageUrl(p);
  const brand = brandName(p.brand);
  // A tag has room for a few short facts: skip long values like efficiency breakdowns
  const short = p.specs.filter((s) => s.value.length <= 30);
  const facts = (short.length >= 2 ? short : p.specs).slice(0, 3);
  return (
    <article class="tag" aria-label={`Showroom tag: ${brand} ${p.model}`}>
      <div class="tag__text">
        <p class="tag__brand">{brand}</p>
        <h3 class="tag__model">{p.model}</h3>
        <p class="tag__type">{p.type}</p>
        {facts.length > 0 && (
          <dl class="tag__specs">
            {facts.map((s) => (
              <div key={s.label}>
                <dt>{s.label}</dt>
                <dd>{s.value}</dd>
              </div>
            ))}
          </dl>
        )}
      </div>
      <div class="tag__qr">
        <QrCode text={url} label={`QR code for HMI’s ${p.model} page`} />
        <p>Scan for specs &amp; a quote</p>
      </div>
      <p class="tag__url">{url.replace(/^https?:\/\//, '')}</p>
    </article>
  );
}

export function TagsTab({ focus, onClearFocus }: { focus?: string; onClearFocus: () => void }) {
  const [store, setStore] = useState<StoreId | 'all'>('all');
  const [onlyDisplayed, setOnlyDisplayed] = useState(true);
  const live = new Map(webProducts.value.map((w) => [w.id, w]));
  const list = products.filter((p) => {
    if (p.status !== 'current') return false;
    if (focus) return p.id === focus;
    if (!onlyDisplayed) return true;
    const d = live.get(p.id)?.display ?? p.display;
    return store === 'all' ? d['osage-beach'] + d.nixa > 0 : d[store] > 0;
  });

  return (
    <div class="stack">
      <Card
        title="Showroom tags"
        subtitle="One card per model with a QR code for HMI’s own model page — the page can’t go dead, so the tag never breaks."
        actions={
          <Button variant="primary" icon="printer" onClick={() => window.print()} disabled={!list.length}>
            Print {plural(list.length, 'tag')}
          </Button>
        }
      >
        <div class="toolbar no-print">
          {focus ? (
            <Button size="sm" variant="ghost" icon="arrow-left" onClick={onClearFocus}>
              Show every tag
            </Button>
          ) : (
            <>
              <Segmented<StoreId | 'all'>
                label="Showroom"
                size="sm"
                value={store}
                onChange={setStore}
                items={[
                  { key: 'all', label: 'Both' },
                  { key: 'osage-beach', label: 'Osage Beach' },
                  { key: 'nixa', label: 'Nixa' },
                ]}
              />
              <Checkbox checked={onlyDisplayed} onChange={setOnlyDisplayed}>
                Only models on display
              </Checkbox>
            </>
          )}
        </div>
        <p class="muted small no-print">
          <Icon name="info" size={14} /> Printed from this demo, the codes open this copy of the site; from the live site they’d open hmifireplaceshop.com.
        </p>
      </Card>
      {list.length === 0 ? (
        <EmptyState icon="printer" title="No models to print" />
      ) : (
        <div class="tags-sheet">
          {list.map((p) => (
            <Tag key={p.id} p={p} />
          ))}
        </div>
      )}
    </div>
  );
}
