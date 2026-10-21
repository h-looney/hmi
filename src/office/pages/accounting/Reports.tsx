/** Reports: profit & loss by showroom, sales tax, and receivables by customer — with CSV and print. */
import { useMemo, useRef } from 'preact/hooks';
import type { Customer, StoreId } from '../../data/types';
import { diffDays, inRange, today } from '../../lib/dates';
import { money } from '../../lib/format';
import { param, setParams } from '../../router';
import { customerOf, invoiceTotals, matchStore, revenueEvents, STORES, storeName } from '../../selectors';
import { db, history, ui } from '../../store';
import { Button, Card, Link, Segmented } from '../../ui/core';
import { cogsEvents, downloadCsv, isReceivable, OPEX_CATEGORIES, PERIODS, periodRange, printElement, profitAndLoss, REVENUE_CATEGORIES, type PeriodKey } from './helpers';

type PL = ReturnType<typeof profitAndLoss>;
const cents = (n: number) => Math.round(n * 100) / 100;
const pct = (part: number, whole: number) => (whole ? `${Math.round((part / whole) * 100)}%` : '—');

function ReportActions({ onCsv, onPrint, name }: { onCsv: () => void; onPrint: () => void; name: string }) {
  return (
    <>
      <Button size="sm" variant="ghost" icon="download" onClick={onCsv} aria-label={`Download ${name} as CSV`}>
        CSV
      </Button>
      <Button size="sm" variant="ghost" icon="printer" onClick={onPrint} aria-label={`Print ${name}`}>
        Print
      </Button>
    </>
  );
}

export function ReportsTab() {
  const d = db.value;
  const h = history.value;
  const store = ui.value.store;
  const t = today();
  const period = (param('period') as PeriodKey | undefined) ?? 'month';
  const range = periodRange(period, t);

  const revenue = useMemo(() => revenueEvents(d, h), [d, h]);
  const cogs = useMemo(() => cogsEvents(d, h), [d, h]);
  const pl = useMemo(() => {
    const out = {} as Record<StoreId | 'all', PL>;
    for (const s of [...STORES, 'all'] as const) out[s] = profitAndLoss(h, revenue, cogs, range.from, range.to, s);
    return out;
  }, [d, h, revenue, cogs, range.from, range.to]);
  const cols = ['osage-beach', 'nixa', 'all'] as const;

  // Sales tax: taxable sales by invoice date
  const tax = useMemo(() => {
    const rows = STORES.map((s) => ({ store: s, taxable: 0, exempt: 0, tax: 0, rate: d.settings.taxRates[s], count: 0 }));
    for (const inv of d.invoices) {
      if (inv.kind !== 'invoice' || inv.status === 'draft' || inv.status === 'void' || !inRange(inv.issuedOn, range.from, range.to)) continue;
      const row = rows.find((r) => r.store === inv.store)!;
      const taxable = inv.lines.filter((l) => l.taxable).reduce((s, l) => s + l.qty * l.rate, 0);
      row.taxable += taxable;
      row.exempt += inv.lines.filter((l) => !l.taxable).reduce((s, l) => s + l.qty * l.rate, 0);
      row.tax += invoiceTotals(inv).tax;
      row.count++;
    }
    return rows;
  }, [d.invoices, d.settings.taxRates, range.from, range.to]);

  // Receivables by customer
  const aging = useMemo(() => {
    const map = new Map<string, { customer?: Customer; b: number[] }>();
    for (const inv of d.invoices) {
      if (!matchStore(store, inv.store) || !isReceivable(d, inv)) continue;
      const late = diffDays(t, inv.dueOn);
      const i = late <= 0 ? 0 : late <= 30 ? 1 : late <= 60 ? 2 : late <= 90 ? 3 : 4;
      const row = map.get(inv.customerId) ?? { customer: customerOf(d, inv.customerId), b: [0, 0, 0, 0, 0] };
      row.b[i] += invoiceTotals(inv).balance;
      map.set(inv.customerId, row);
    }
    return [...map.entries()].map(([id, r]) => ({ id, ...r, total: r.b.reduce((a, b) => a + b, 0) })).sort((a, b) => b.total - a.total);
  }, [d, store, t]);
  const agingTotals = [0, 1, 2, 3, 4].map((i) => aging.reduce((s, r) => s + r.b[i], 0));

  const plRef = useRef<HTMLDivElement>(null);
  const taxRef = useRef<HTMLDivElement>(null);
  const arRef = useRef<HTMLDivElement>(null);

  const plCsv = () => {
    const rows: (string | number)[][] = [['Line', 'Osage Beach', 'Nixa', 'Total']];
    const line = (label: string, get: (p: PL) => number) => rows.push([label, ...cols.map((c) => cents(get(pl[c])))]);
    REVENUE_CATEGORIES.forEach((c) => line(`Revenue: ${c}`, (p) => p.rev[c]));
    line('Total revenue', (p) => p.revenueTotal);
    line('Cost of goods sold', (p) => p.cost);
    line('Gross profit', (p) => p.gross);
    OPEX_CATEGORIES.forEach((c) => line(`Expense: ${c}`, (p) => p.opex[c]));
    line('Total operating expenses', (p) => p.opexTotal);
    line('Net income', (p) => p.net);
    downloadCsv(`hmi-profit-and-loss-${range.from}-to-${range.to}.csv`, rows);
  };
  const taxCsv = () =>
    downloadCsv(`hmi-sales-tax-${range.from}-to-${range.to}.csv`, [
      ['Showroom', 'Invoices', 'Taxable sales', 'Non-taxable sales', 'Rate', 'Tax collected'],
      ...tax.map((r) => [storeName(r.store), r.count, cents(r.taxable), cents(r.exempt), `${(r.rate * 100).toFixed(3)}%`, cents(r.tax)]),
    ]);
  const arCsv = () =>
    downloadCsv(`hmi-receivables-by-customer-${t}.csv`, [
      ['Customer', 'Current', '1-30 days', '31-60 days', '61-90 days', 'Over 90 days', 'Total'],
      ...aging.map((r) => [r.customer?.name ?? r.id, ...r.b.map(cents), cents(r.total)]),
    ]);

  const money0 = (n: number) => money(n, false);
  const row = (label: string, get: (p: PL) => number, cls?: string, indent?: boolean) => (
    <tr class={cls}>
      <th scope="row" class={indent ? 'pl-indent' : undefined}>
        {label}
      </th>
      {cols.map((c) => (
        <td key={c} class="is-right tabular">
          {money0(get(pl[c]))}
        </td>
      ))}
    </tr>
  );

  return (
    <div class="acct-reports">
      <div class="toolbar">
        <Segmented label="Report period" value={period} onChange={(k) => setParams({ period: k === 'month' ? undefined : k }, { replace: true })} items={PERIODS.map((p) => ({ key: p.key, label: p.label }))} />
        <span class="toolbar__spacer" />
        <span class="muted small">{range.label} · work counted when it’s completed</span>
      </div>

      <Card title="Profit & loss" subtitle={`${range.label} · both showrooms side by side`} actions={<ReportActions name="profit and loss" onCsv={plCsv} onPrint={() => plRef.current && printElement(plRef.current, `Profit & loss — ${range.label}`)} />} flush>
        <div ref={plRef} class="report-print">
          <p class="report-print__title">HMI Fireplace Shops — Profit &amp; loss, {range.label}</p>
          <div class="table-wrap">
            <table class="table pl-table">
              <caption class="sr-only">Profit and loss, {range.label}</caption>
              <thead>
                <tr>
                  <th scope="col">Line</th>
                  <th scope="col" class="is-right">
                    Osage Beach
                  </th>
                  <th scope="col" class="is-right">
                    Nixa
                  </th>
                  <th scope="col" class="is-right">
                    Total
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr class="pl-section">
                  <th scope="rowgroup" colSpan={4}>
                    Revenue
                  </th>
                </tr>
                {REVENUE_CATEGORIES.map((c) => row(c, (p) => p.rev[c], undefined, true))}
                {row('Total revenue', (p) => p.revenueTotal, 'pl-subtotal')}
                {row('Cost of goods sold', (p) => p.cost, 'pl-cost')}
                <tr class="pl-subtotal">
                  <th scope="row">Gross profit</th>
                  {cols.map((c) => (
                    <td key={c} class={`is-right tabular${pl[c].gross < 0 ? ' is-bad' : ''}`}>
                      {money0(pl[c].gross)} <span class="pl-pct">{pct(pl[c].gross, pl[c].revenueTotal)}</span>
                    </td>
                  ))}
                </tr>
                <tr class="pl-section">
                  <th scope="rowgroup" colSpan={4}>
                    Operating expenses
                  </th>
                </tr>
                {OPEX_CATEGORIES.map((c) => row(c, (p) => p.opex[c], undefined, true))}
                {row('Total operating expenses', (p) => p.opexTotal, 'pl-subtotal')}
                <tr class="pl-total">
                  <th scope="row">Net income</th>
                  {cols.map((c) => (
                    <td key={c} class={`is-right tabular${pl[c].net < 0 ? ' is-bad' : ''}`}>
                      {money0(pl[c].net)} <span class="pl-pct">{pct(pl[c].net, pl[c].revenueTotal)}</span>
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </Card>

      <div class="acct-reports__pair">
        <Card title="Sales tax" subtitle={`Invoices dated ${range.label}`} actions={<ReportActions name="sales tax" onCsv={taxCsv} onPrint={() => taxRef.current && printElement(taxRef.current, `Sales tax — ${range.label}`)} />} flush>
          <div ref={taxRef} class="report-print">
            <p class="report-print__title">HMI Fireplace Shops — Sales tax, {range.label}</p>
            <div class="table-wrap">
              <table class="table">
                <caption class="sr-only">Sales tax by showroom</caption>
                <thead>
                  <tr>
                    <th scope="col">Showroom</th>
                    <th scope="col" class="is-right">
                      Taxable sales
                    </th>
                    <th scope="col" class="is-right hide-sm">
                      Non-taxable
                    </th>
                    <th scope="col" class="is-right">
                      Rate
                    </th>
                    <th scope="col" class="is-right">
                      Tax
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {tax.map((r) => (
                    <tr key={r.store}>
                      <th scope="row">{storeName(r.store)}</th>
                      <td class="is-right tabular">{money0(r.taxable)}</td>
                      <td class="is-right tabular hide-sm">{money0(r.exempt)}</td>
                      <td class="is-right tabular">{(r.rate * 100).toFixed(3)}%</td>
                      <td class="is-right tabular">{money(r.tax)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <th scope="row">Total</th>
                    <td class="is-right tabular">{money0(tax.reduce((s, r) => s + r.taxable, 0))}</td>
                    <td class="is-right tabular hide-sm">{money0(tax.reduce((s, r) => s + r.exempt, 0))}</td>
                    <td />
                    <td class="is-right tabular">{money(tax.reduce((s, r) => s + r.tax, 0))}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
            <p class="report-note">Sample tax rates — set real ones under Settings. Labor is non-taxable here; equipment, parts and retail are taxable.</p>
          </div>
        </Card>

        <Card
          title="Receivables by customer"
          subtitle={`${aging.length} customers owe ${money0(agingTotals.reduce((a, b) => a + b, 0))}${store === 'all' ? '' : ` · ${storeName(store)}`}`}
          actions={<ReportActions name="receivables by customer" onCsv={arCsv} onPrint={() => arRef.current && printElement(arRef.current, 'Receivables by customer')} />}
          flush
        >
          <div ref={arRef} class="report-print">
            <p class="report-print__title">HMI Fireplace Shops — Receivables by customer, as of today</p>
            <div class="table-wrap ar-table">
              <table class="table table--dense">
                <caption class="sr-only">Unpaid balances by customer and age</caption>
                <thead>
                  <tr>
                    <th scope="col">Customer</th>
                    <th scope="col" class="is-right">
                      Current
                    </th>
                    <th scope="col" class="is-right">
                      1–30
                    </th>
                    <th scope="col" class="is-right">
                      31–60
                    </th>
                    <th scope="col" class="is-right">
                      61–90
                    </th>
                    <th scope="col" class="is-right">
                      90+
                    </th>
                    <th scope="col" class="is-right">
                      Total
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {aging.slice(0, 15).map((r) => (
                    <tr key={r.id}>
                      <th scope="row">
                        <Link to={`/office/customers/?id=${r.id}`} class="cell-main">
                          {r.customer?.name ?? r.id}
                        </Link>
                      </th>
                      {r.b.map((v, i) => (
                        <td key={i} class={`is-right tabular${i > 1 && v > 0 ? ' is-bad' : ''}`}>
                          {v > 0 ? money0(v) : '—'}
                        </td>
                      ))}
                      <td class="is-right tabular">
                        <strong>{money0(r.total)}</strong>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <th scope="row">Total{aging.length > 15 ? ` (${aging.length} customers)` : ''}</th>
                    {agingTotals.map((v, i) => (
                      <td key={i} class="is-right tabular">
                        {money0(v)}
                      </td>
                    ))}
                    <td class="is-right tabular">{money0(agingTotals.reduce((a, b) => a + b, 0))}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
