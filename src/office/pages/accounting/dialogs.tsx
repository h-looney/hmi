/** Invoice / estimate editor and payment dialog — opened from anywhere via openDialog(). */
import { useMemo, useState } from 'preact/hooks';
import { createInvoice, linesForJob, recordPayment, sendInvoice, updateInvoice } from '../../actions';
import { installStandards } from '../../data/catalog';
import type { Invoice, InvoiceLine, Item, PaymentMethod, RevenueCategory, StoreId } from '../../data/types';
import { addDays, today } from '../../lib/dates';
import { money } from '../../lib/format';
import { navigate } from '../../router';
import { customerOf, invoiceTotals, itemLabel, storeName } from '../../selectors';
import { db, ui, uid } from '../../store';
import { toast } from '../../toast';
import { Badge, Button, Field, Segmented } from '../../ui/core';
import { Dialog } from '../../ui/Dialog';
import { Icon } from '../../ui/Icon';
import { CustomerPicker, ItemPicker } from '../../ui/pickers';
import { linkInvoiceToJob, markSynced, REVENUE_CATEGORIES } from './helpers';

type InvoicePreset = { kind?: 'invoice' | 'estimate'; customerId?: string; jobId?: string; leadId?: string };

const round2 = (n: number) => Math.round(n * 100) / 100;

const termDays = (kind: 'invoice' | 'estimate', builder: boolean, terms: string) =>
  kind === 'estimate' ? 30 : builder ? 30 : terms === 'Net 30' ? 30 : terms === 'Net 15' ? 15 : 0;

const termLabel = (kind: 'invoice' | 'estimate', builder: boolean, terms: string) =>
  kind === 'estimate' ? 'Estimates are good for 30 days' : builder ? 'Builder accounts are Net 30' : terms === 'Due on receipt' ? 'Due on receipt (from Settings)' : `${terms} (from Settings)`;

export function InvoiceDialog({ invoiceId, preset, onClose }: { invoiceId?: string; preset?: InvoicePreset; onClose: () => void }) {
  const d = db.value;
  const settings = d.settings;
  const existing = invoiceId ? d.invoices.find((i) => i.id === invoiceId) : undefined;
  const job = preset?.jobId ? d.jobs.find((j) => j.id === preset.jobId) : undefined;
  const lead = preset?.leadId ? d.leads.find((l) => l.id === preset.leadId) : undefined;
  const presetCustomer = existing?.customerId ?? preset?.customerId ?? job?.customerId ?? lead?.customerId;

  const [kind, setKind] = useState<'invoice' | 'estimate'>(existing?.kind ?? preset?.kind ?? 'invoice');
  const [customerId, setCustomerId] = useState<string | undefined>(presetCustomer);
  const [store, setStore] = useState<StoreId>(
    existing?.store ?? job?.store ?? lead?.store ?? customerOf(d, presetCustomer)?.store ?? (ui.value.store !== 'all' ? ui.value.store : 'osage-beach'),
  );
  const [issuedOn, setIssuedOn] = useState(existing?.issuedOn ?? today());
  /** undefined = follow the payment terms */
  const [dueOn, setDueOn] = useState<string | undefined>(existing?.dueOn);
  const [lines, setLines] = useState<InvoiceLine[]>(() => (existing ? structuredClone(existing.lines) : job ? linesForJob(d, job) : []));
  /** undefined = the store's rate from Settings */
  const [taxRate, setTaxRate] = useState<number | undefined>(existing?.taxRate);
  const [memo, setMemo] = useState(existing?.memo ?? (lead ? `For your request: ${lead.summary}` : job ? `${job.title} (${job.id})` : ''));
  const [error, setError] = useState('');

  const customer = customerOf(d, customerId);
  const builder = customer?.kind === 'builder';
  const due = dueOn ?? addDays(issuedOn, termDays(kind, builder, settings.terms));
  const rate = taxRate ?? settings.taxRates[store];
  const totals = invoiceTotals({ lines, taxRate: rate, payments: existing?.payments ?? [] } as unknown as Invoice);
  const noun = kind === 'estimate' ? 'Estimate' : 'Invoice';

  const updateLine = (id: string, patch: Partial<InvoiceLine>) => setLines((ls) => ls.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  const removeLine = (id: string) => setLines((ls) => ls.filter((l) => l.id !== id));
  const addLine = (line: Omit<InvoiceLine, 'id'>, focus = false) => {
    const id = uid('l');
    setLines((ls) => [...ls, { ...line, id }]);
    setError('');
    if (focus) setTimeout(() => document.querySelector<HTMLInputElement>(`[data-line="${id}"]`)?.focus(), 30);
  };
  const addItem = (it: Item) =>
    addLine({ description: itemLabel(it), qty: 1, rate: it.price, itemId: it.id, category: it.kind === 'unit' ? 'Equipment' : it.kind === 'part' ? 'Parts' : 'Retail', taxable: true });

  const quick: { label: string; line: Omit<InvoiceLine, 'id'>; focus?: boolean }[] = [
    { label: 'Annual service — gas', line: { description: 'Annual service — gas appliance', qty: 1, rate: settings.annualService.gas, category: 'Service', taxable: false } },
    { label: 'Annual service — wood', line: { description: 'Annual service — wood appliance & chimney sweep', qty: 1, rate: settings.annualService.wood, category: 'Service', taxable: false } },
    { label: 'Annual service — pellet', line: { description: 'Annual service — pellet appliance', qty: 1, rate: settings.annualService.pellet, category: 'Service', taxable: false } },
    { label: 'Service call', line: { description: 'Service call', qty: 1, rate: settings.tripCharge, category: 'Service', taxable: false } },
    { label: 'Labor hour', line: { description: 'Labor', qty: 1, rate: settings.laborRate, category: 'Service', taxable: false } },
    { label: 'Installation labor', line: { description: 'Installation labor', qty: 1, rate: installStandards['Gas fireplaces']?.labor ?? 1850, category: 'Installation', taxable: false } },
    { label: 'Custom line', line: { description: '', qty: 1, rate: 0, category: 'Service', taxable: true }, focus: true },
  ];

  function save(send: boolean) {
    if (!customerId || !customer) return setError('Choose a customer first.');
    const clean = lines
      .filter((l) => l.description.trim() || l.rate)
      .map((l) => ({ ...l, description: l.description.trim() || 'Item', qty: Number(l.qty) || 0, rate: round2(Number(l.rate) || 0) }));
    if (!clean.length) return setError('Add at least one line.');
    if (clean.some((l) => l.qty <= 0)) return setError('Every line needs a quantity above zero.');
    if (due < issuedOn) return setError(`The ${kind === 'estimate' ? 'valid-until' : 'due'} date can’t be before the issue date.`);
    const contact = customer.email || customer.name;

    if (existing) {
      updateInvoice(existing.id, { customerId, store, issuedOn, dueOn: due, lines: clean, taxRate: rate, memo: memo.trim() || undefined });
      if (send) sendInvoice(existing.id);
      toast(send ? `${noun} ${existing.id} sent to ${contact} (simulated)` : `${noun} ${existing.id} saved`);
      onClose();
      return;
    }

    const id = createInvoice({ kind, customerId, store, lines: clean, jobId: kind === 'invoice' ? job?.id : undefined, leadId: lead?.id, issuedOn, dueOn: due, memo: memo.trim() || undefined, status: send ? 'sent' : 'draft' });
    if (rate !== settings.taxRates[store]) updateInvoice(id, { taxRate: rate });
    if (job && kind === 'invoice') linkInvoiceToJob(id, job.id);
    if (send) markSynced(id, `${noun} ${id} sent to QuickBooks`);
    toast(send ? `${noun} ${id} sent to ${contact} (simulated — nothing leaves this browser)` : `${noun} ${id} saved as a draft`);
    onClose();
    navigate(`/office/accounting/?tab=${kind === 'estimate' ? 'estimates' : 'invoices'}&id=${id}`);
  }

  return (
    <Dialog
      title={existing ? `Edit ${noun.toLowerCase()} ${existing.id}` : `New ${noun.toLowerCase()}`}
      description={job ? `Billing ${job.id} — ${job.title}` : lead ? `From request ${lead.id} — ${lead.name}` : undefined}
      onClose={onClose}
      size="xl"
      class="inv-editor"
      footer={
        <>
          {error && (
            <p class="inv-editor__error" role="alert">
              <Icon name="alert" size={16} /> {error}
            </p>
          )}
          <span class="spacer" />
          <Button onClick={onClose}>Cancel</Button>
          <Button onClick={() => save(false)}>{existing && existing.status !== 'draft' ? 'Save changes' : 'Save draft'}</Button>
          <Button variant="primary" icon="send" onClick={() => save(true)}>
            {existing && existing.status !== 'draft' ? 'Save & resend' : `Save & send`}
          </Button>
        </>
      }
    >
      <form
        class="inv-form"
        onSubmit={(e) => {
          e.preventDefault();
          save(false);
        }}
      >
        <div class="inv-form__top">
          {existing ? (
            <p class="inv-form__kind">
              <Badge tone={kind === 'estimate' ? 'violet' : 'blue'} icon={kind === 'estimate' ? 'file' : 'receipt'}>
                {noun}
              </Badge>
            </p>
          ) : (
            <Segmented
              label="Document type"
              value={kind}
              onChange={(k) => {
                setKind(k);
                setDueOn(undefined);
              }}
              items={[
                { key: 'invoice', label: 'Invoice', icon: 'receipt' },
                { key: 'estimate', label: 'Estimate', icon: 'file' },
              ]}
            />
          )}
        </div>

        <div class="inv-form__grid">
          <div class="inv-form__customer">
            <CustomerPicker
              value={customerId}
              onChange={(id) => {
                setCustomerId(id);
                setError('');
                const c = customerOf(db.value, id);
                if (c && !existing && !job && !lead) setStore(c.store);
              }}
              store={store}
              autoFocus={!customerId}
            />
          </div>
          <Field label="Showroom">
            <select class="select" value={store} onChange={(e) => setStore((e.target as HTMLSelectElement).value as StoreId)}>
              <option value="osage-beach">Osage Beach</option>
              <option value="nixa">Nixa</option>
            </select>
          </Field>
          <Field label="Issue date">
            <input class="input" type="date" value={issuedOn} onInput={(e) => setIssuedOn((e.target as HTMLInputElement).value || today())} />
          </Field>
          <Field label={kind === 'estimate' ? 'Valid until' : 'Due date'} hint={dueOn ? 'Set by hand' : termLabel(kind, builder, settings.terms)}>
            <input class="input" type="date" value={due} min={issuedOn} onInput={(e) => setDueOn((e.target as HTMLInputElement).value || undefined)} />
          </Field>
        </div>

        <section class="inv-lines" aria-labelledby="inv-lines-title">
          <h3 id="inv-lines-title" class="section-label">
            Line items
          </h3>
          {lines.length === 0 ? (
            <p class="inv-lines__empty">No lines yet — search the catalog or use a quick add below.</p>
          ) : (
            <div class="table-wrap">
              <table class="line-table">
                <caption class="sr-only">Line items</caption>
                <thead>
                  <tr>
                    <th scope="col">Description</th>
                    <th scope="col">Category</th>
                    <th scope="col" class="is-right">
                      Qty
                    </th>
                    <th scope="col" class="is-right">
                      Rate
                    </th>
                    <th scope="col" class="is-center">
                      Taxable
                    </th>
                    <th scope="col" class="is-right">
                      Amount
                    </th>
                    <th scope="col">
                      <span class="sr-only">Remove</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((l, i) => (
                    <tr key={l.id}>
                      <td data-label="Description">
                        <input
                          class="input input--sm"
                          value={l.description}
                          data-line={l.id}
                          aria-label={`Description, line ${i + 1}`}
                          placeholder="What’s this for?"
                          onInput={(e) => updateLine(l.id, { description: (e.target as HTMLInputElement).value })}
                        />
                        {l.itemId && <span class="line-table__sku">{l.itemId}</span>}
                      </td>
                      <td data-label="Category">
                        <select class="select select--sm" value={l.category} aria-label={`Category, line ${i + 1}`} onChange={(e) => updateLine(l.id, { category: (e.target as HTMLSelectElement).value as RevenueCategory })}>
                          {REVENUE_CATEGORIES.map((c) => (
                            <option key={c} value={c}>
                              {c}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td data-label="Qty" class="is-right">
                        <input
                          class="input input--sm line-table__num"
                          type="number"
                          min="0"
                          step="0.25"
                          inputMode="decimal"
                          value={l.qty}
                          aria-label={`Quantity, line ${i + 1}`}
                          onInput={(e) => updateLine(l.id, { qty: parseFloat((e.target as HTMLInputElement).value) || 0 })}
                        />
                      </td>
                      <td data-label="Rate" class="is-right">
                        <input
                          class="input input--sm line-table__num"
                          type="number"
                          min="0"
                          step="0.01"
                          inputMode="decimal"
                          value={l.rate}
                          aria-label={`Rate, line ${i + 1}`}
                          onInput={(e) => updateLine(l.id, { rate: parseFloat((e.target as HTMLInputElement).value) || 0 })}
                        />
                      </td>
                      <td data-label="Taxable" class="is-center">
                        <input type="checkbox" checked={l.taxable} aria-label={`Taxable, line ${i + 1}`} onChange={(e) => updateLine(l.id, { taxable: (e.target as HTMLInputElement).checked })} />
                      </td>
                      <td data-label="Amount" class="is-right tabular line-table__amount">
                        {money(l.qty * l.rate)}
                      </td>
                      <td class="line-table__remove">
                        <button type="button" class="btn btn--ghost btn--sm btn--icon" aria-label={`Remove line ${i + 1}`} onClick={() => removeLine(l.id)}>
                          <Icon name="trash" size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div class="inv-add">
            <div class="inv-add__picker">
              <ItemPicker store={store} onSelect={addItem} label="Add from the catalog" placeholder="Search products and parts by name, brand or SKU" />
            </div>
            <div class="inv-add__quick" role="group" aria-label="Quick add">
              <span class="field__label">Quick add</span>
              <div class="chips">
                {quick.map((q) => (
                  <button key={q.label} type="button" class="chip" onClick={() => addLine(q.line, q.focus)}>
                    <Icon name="plus" size={14} />
                    {q.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>

        <div class="inv-form__bottom">
          <Field label={kind === 'estimate' ? 'Note to the customer' : 'Memo'} optional class="inv-form__memo">
            <textarea class="textarea" value={memo} onInput={(e) => setMemo((e.target as HTMLTextAreaElement).value)} placeholder={kind === 'estimate' ? 'Lead times, what’s included, next steps…' : 'Shown on the invoice'} />
          </Field>
          <div class="inv-totals" role="group" aria-label="Totals">
            <dl>
              <div>
                <dt>Subtotal</dt>
                <dd class="tabular">{money(totals.subtotal)}</dd>
              </div>
              <div class="inv-totals__tax">
                <dt>
                  <label for="inv-tax-rate">Sales tax</label>
                  <span class="inv-totals__rate">
                    <input
                      id="inv-tax-rate"
                      class="input input--sm"
                      type="number"
                      min="0"
                      max="20"
                      step="0.001"
                      inputMode="decimal"
                      value={(rate * 100).toFixed(3)}
                      aria-describedby="inv-tax-hint"
                      onChange={(e) => {
                        const v = parseFloat((e.target as HTMLInputElement).value);
                        setTaxRate(Number.isFinite(v) ? v / 100 : undefined);
                      }}
                    />
                    %
                  </span>
                </dt>
                <dd class="tabular">{money(totals.tax)}</dd>
              </div>
            </dl>
            <p class="inv-totals__hint" id="inv-tax-hint">
              Sample rate for {storeName(store)} — taxable lines only.
            </p>
            <dl>
              <div class="inv-totals__total">
                <dt>Total</dt>
                <dd class="tabular">{money(totals.total)}</dd>
              </div>
              {totals.paid > 0 && (
                <>
                  <div>
                    <dt>Paid</dt>
                    <dd class="tabular">−{money(totals.paid)}</dd>
                  </div>
                  <div class="inv-totals__total">
                    <dt>Balance due</dt>
                    <dd class="tabular">{money(totals.balance)}</dd>
                  </div>
                </>
              )}
            </dl>
          </div>
        </div>
        <button type="submit" hidden />
      </form>
    </Dialog>
  );
}

const METHODS: { key: PaymentMethod; label: string; ref: string }[] = [
  { key: 'card', label: 'Card', ref: 'Last 4 digits' },
  { key: 'check', label: 'Check', ref: 'Check number' },
  { key: 'cash', label: 'Cash', ref: 'Receipt number (optional)' },
  { key: 'ach', label: 'Bank transfer (ACH)', ref: 'Transaction ID' },
  { key: 'financing', label: 'Financing', ref: 'Approval or plan number' },
];

export function PaymentDialog({ invoiceId, onClose }: { invoiceId: string; onClose: () => void }) {
  const d = db.value;
  const inv = d.invoices.find((i) => i.id === invoiceId);
  const totals = useMemo(() => (inv ? invoiceTotals(inv) : { subtotal: 0, tax: 0, total: 0, paid: 0, balance: 0 }), [inv]);
  const [amount, setAmount] = useState(totals.balance.toFixed(2));
  const [date, setDate] = useState(today());
  const [method, setMethod] = useState<PaymentMethod>('card');
  const [ref, setRef] = useState('');
  const [error, setError] = useState('');

  if (!inv) {
    return (
      <Dialog title="Invoice not found" onClose={onClose} size="sm">
        <p>That invoice isn’t in the books anymore.</p>
      </Dialog>
    );
  }
  const customer = customerOf(d, inv.customerId);
  const value = round2(parseFloat(amount) || 0);
  const remaining = round2(totals.balance - value);
  const paidUp = totals.balance <= 0.004;

  const submit = () => {
    if (paidUp) return onClose();
    if (!(value > 0)) return setError('Enter an amount above zero.');
    if (value > totals.balance + 0.004) return setError(`That’s more than the ${money(totals.balance)} balance.`);
    if (date > today()) return setError('Payments can’t be dated in the future.');
    recordPayment(inv.id, value, method, date, ref.trim() || undefined);
    toast(`Payment of ${money(value)} recorded on ${inv.id}${d.books.connected ? ' and sent to QuickBooks (simulated)' : ''}`, { tone: 'success' });
    onClose();
  };

  return (
    <Dialog
      title="Record a payment"
      class="acct-dialog"
      description={`${inv.id} · ${customer?.name ?? 'Customer'}`}
      onClose={onClose}
      size="sm"
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" icon="check" onClick={submit} disabled={paidUp}>
            Record payment
          </Button>
        </>
      }
    >
      <form
        class="stack"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <dl class="pay-summary">
          <div>
            <dt>Invoice total</dt>
            <dd class="tabular">{money(totals.total)}</dd>
          </div>
          <div>
            <dt>Paid so far</dt>
            <dd class="tabular">{money(totals.paid)}</dd>
          </div>
          <div class="pay-summary__balance">
            <dt>Balance</dt>
            <dd class="tabular">{money(totals.balance)}</dd>
          </div>
        </dl>
        {paidUp ? (
          <p class="callout callout--green">
            <Icon name="check-circle" size={18} /> This invoice is paid in full.
          </p>
        ) : (
          <>
            <div class="form-grid">
              <Field label="Amount" hint={value > 0 && remaining > 0.004 ? `${money(remaining)} will still be due` : value > 0 && Math.abs(remaining) <= 0.004 ? 'Pays the invoice in full' : undefined}>
                <span class="money-input">
                  <span aria-hidden="true">$</span>
                  <input
                    class="input"
                    type="number"
                    min="0"
                    step="0.01"
                    inputMode="decimal"
                    value={amount}
                    data-autofocus
                    onInput={(e) => {
                      setAmount((e.target as HTMLInputElement).value);
                      setError('');
                    }}
                  />
                </span>
              </Field>
              <Field label="Date received">
                <input class="input" type="date" value={date} max={today()} onInput={(e) => setDate((e.target as HTMLInputElement).value || today())} />
              </Field>
              <Field label="Method">
                <select class="select" value={method} onChange={(e) => setMethod((e.target as HTMLSelectElement).value as PaymentMethod)}>
                  {METHODS.map((m) => (
                    <option key={m.key} value={m.key}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Reference" optional>
                <input class="input" value={ref} placeholder={METHODS.find((m) => m.key === method)?.ref} onInput={(e) => setRef((e.target as HTMLInputElement).value)} />
              </Field>
            </div>
            {error && (
              <p class="form-error" role="alert">
                <Icon name="alert" size={16} /> {error}
              </p>
            )}
          </>
        )}
        <button type="submit" hidden />
      </form>
    </Dialog>
  );
}
