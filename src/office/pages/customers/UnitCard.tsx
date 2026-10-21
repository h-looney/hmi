/** One appliance on a customer's equipment list: warranty coverage, registration, claims, history. */
import { useMemo } from 'preact/hooks';
import { registerUnit } from '../../actions';
import { useAssets } from '../../assets';
import type { Unit } from '../../data/types';
import { openDialog } from '../../dialogs';
import { shortDate } from '../../lib/format';
import { firstName, itemOf, serviceDueOn, unitLabel, warrantyState } from '../../selectors';
import { can, db, history, markTried } from '../../store';
import { toast } from '../../toast';
import { Badge, Button, Details, Link } from '../../ui/core';
import { Icon } from '../../ui/Icon';
import { claimStatusMeta, jobTypeMeta, StatusBadge, warrantyMeta } from '../../ui/status';
import { daysUntil, serviceHistory } from './helpers';
import { CoverageBar } from './parts';

export function UnitCard({ unit }: { unit: Unit }) {
  const d = db.value;
  const { photos } = useAssets();
  const customer = d.customers.find((c) => c.id === unit.customerId);
  const state = warrantyState(unit);
  const claims = d.claims.filter((c) => c.unitId === unit.id);
  const visits = useMemo(() => serviceHistory(d, history.value, { unitId: unit.id }), [d, unit.id]);
  const item = itemOf(d, unit.itemId);
  const photo = item?.photo ? photos[item.photo] : undefined;
  const due = unit.fuel !== 'Electric' ? serviceDueOn(unit) : undefined;
  const reminder = d.reminders.find((r) => r.unitId === unit.id);
  const byHmi = unit.installedBy === 'HMI';
  const titleId = `unit-${unit.id}`;

  const register = () => {
    registerUnit(unit.id);
    toast(`${unitLabel(unit)} registered with the manufacturer (simulated)`);
  };

  return (
    <article class="unit-card card" aria-labelledby={titleId}>
      <header class="unit-card__head">
        {photo ? (
          <img class="thumb unit-card__thumb" src={photo} alt="" width={48} height={48} loading="lazy" />
        ) : (
          <span class="thumb unit-card__thumb">
            <Icon name="flame" size={20} />
          </span>
        )}
        <div class="unit-card__title">
          <h3 id={titleId}>{unitLabel(unit)}</h3>
          <p class="muted small">
            {unit.category} · {unit.fuel}
            {unit.room ? ` · ${unit.room}` : ''}
          </p>
        </div>
        <StatusBadge meta={warrantyMeta[state]} />
      </header>

      <Details
        columns={2}
        items={[
          ['Serial number', <span class="tabular">{unit.serial}</span>],
          ['Installed', `${shortDate(unit.installedOn, true)} by ${byHmi ? 'HMI' : 'another installer'}`],
          ['Warranty terms', unit.warranty.terms],
          [
            'Manufacturer registration',
            byHmi ? (
              unit.warranty.registered ? (
                <span class="reg-yes">
                  <Icon name="check" size={14} stroke={2.4} /> Registered · <span class="tabular">{unit.warranty.registrationNo}</span>
                </span>
              ) : (
                <span class="reg-no">
                  <Icon name="alert" size={14} /> Not registered yet
                </span>
              )
            ) : (
              'Not applicable'
            ),
          ],
          [
            'Annual service',
            due ? (
              <span>
                {daysUntil(due) < 0 ? (
                  <span class="is-bad">Overdue since {shortDate(due, true)}</span>
                ) : (
                  `Due ${shortDate(due, true)}`
                )}
                {reminder && <span class="muted small"> · reminder sent {shortDate(reminder.at)}</span>}
              </span>
            ) : (
              'Not needed (electric)'
            ),
          ],
          ['Last serviced', unit.lastServiceOn ? shortDate(unit.lastServiceOn, true) : 'No visits on file'],
        ]}
      />

      {byHmi && unit.warranty.partsUntil && (
        <div class="coverage" role="group" aria-label={`Warranty coverage for ${unitLabel(unit)}`}>
          <CoverageBar label="Parts" from={unit.installedOn} until={unit.warranty.partsUntil} />
          {unit.warranty.laborUntil && <CoverageBar label="HMI labor" from={unit.installedOn} until={unit.warranty.laborUntil} />}
          {unit.warranty.fireboxLifetime && (
            <p class="coverage__lifetime">
              <Icon name="shield" size={14} /> Firebox and heat exchanger: limited lifetime
            </p>
          )}
        </div>
      )}
      {!byHmi && (
        <p class="callout unit-card__note">
          <Icon name="info" size={16} />
          <span>Installed by someone else, so HMI has no warranty on file. Older units like this are good candidates for a replacement conversation.</span>
        </p>
      )}

      <div class="unit-card__actions">
        {byHmi && !unit.warranty.registered && state !== 'expired' && (
          <Button size="sm" variant="primary" icon="shield" onClick={register}>
            Register now
          </Button>
        )}
        {byHmi && (
          <Button size="sm" icon="file" onClick={() => openDialog({ kind: 'claim', unitId: unit.id })}>
            Start warranty claim
          </Button>
        )}
        {can('jobs') && customer && (
          <Button
            size="sm"
            icon="calendar-plus"
            onClick={() => {
              markTried('schedule');
              openDialog({ kind: 'job', preset: { type: 'maintenance', customerId: customer.id, unitId: unit.id, store: customer.store } });
            }}
          >
            Schedule service
          </Button>
        )}
      </div>

      {claims.length > 0 && (
        <div class="unit-card__section">
          <h4 class="section-label">Warranty claims</h4>
          <ul class="unit-card__list" role="list">
            {claims.map((c) => (
              <li key={c.id}>
                {can('warranty') ? <Link to={`/office/warranty/?tab=claims&id=${c.id}`}>{c.id}</Link> : c.id}
                <span class="muted">
                  {' '}
                  · {c.part} · opened {shortDate(c.openedOn, true)}
                </span>
                <StatusBadge meta={claimStatusMeta[c.status]} />
              </li>
            ))}
          </ul>
        </div>
      )}

      <details class="unit-card__history">
        <summary>
          <Icon name="chevron-right" size={14} class="unit-card__chev" />
          Service history <span class="pill-count">{visits.length}</span>
        </summary>
        {visits.length === 0 ? (
          <p class="muted small">No service visits on file.</p>
        ) : (
          <ul class="unit-card__list" role="list">
            {visits.slice(0, 12).map((v) => (
              <li key={v.id}>
                <span class="nowrap tabular">{shortDate(v.day, true)}</span>
                <Badge tone={jobTypeMeta[v.type].tone}>{jobTypeMeta[v.type].label}</Badge>
                <span class="unit-card__visit">
                  {v.jobId && can('jobs') ? <Link to={`/office/jobs/?id=${v.jobId}`}>{v.title}</Link> : v.title}
                  {v.detail && <span class="muted small"> · {v.detail}</span>}
                  {v.techs.length > 0 && <span class="muted small"> · {v.techs.map((t) => firstName(d, t)).join(', ')}</span>}
                </span>
              </li>
            ))}
            {visits.length > 12 && <li class="muted small">…and {visits.length - 12} earlier visits (see the History tab)</li>}
          </ul>
        )}
      </details>
    </article>
  );
}
