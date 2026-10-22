/** Listings written in HMI mode: what has to be fixed before saving, what counts as a change, and what the site shows. */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { productById } from '../../src/data/products.ts';
import type { Listing } from '../../src/office/data/types.ts';
import { fuelOf, isListingPending, listingFromProduct, listingProblems, sameListing, siteListings, specIndex, tidySpecs } from '../../src/office/pages/website/listings.ts';

const fresh = (over: Partial<Listing> = {}): Listing => ({
  id: 'NEW-1',
  isNew: true,
  brand: 'empire',
  model: 'Vail 32',
  type: 'Vent-free gas fireplace',
  category: 'vent-free-gas',
  summary: 'A compact vent-free fireplace.',
  specs: [
    { label: 'Fuel', value: 'Natural gas or propane' },
    { label: 'Heat input', value: '20,000 BTU/hr' },
  ],
  status: 'current',
  display: { 'osage-beach': 0, nixa: 1 },
  by: 'cheryl',
  at: '2026-10-22T09:00',
  ...over,
});

describe('listings written in HMI mode', () => {
  it('a new listing needs a brand, model, what it is and a category', () => {
    assert.deepEqual(listingProblems(fresh()), []);
    const problems = listingProblems(fresh({ brand: '', model: ' ', type: '', category: '' }));
    assert.equal(problems.length, 4);
  });

  it('a model on the list keeps its brand and category, so only the words are checked', () => {
    const l = listingFromProduct(productById('HG-MEZZO48')!);
    assert.deepEqual(listingProblems({ ...l, brand: '', category: '' }), []);
  });

  it('a spec needs both a label and a value, once each; empty rows are dropped', () => {
    assert.deepEqual(tidySpecs([{ label: ' Venting ', value: ' Direct vent ' }, { label: '', value: '  ' }]), [{ label: 'Venting', value: 'Direct vent' }]);
    assert.match(listingProblems(fresh({ specs: [{ label: 'Venting', value: '' }] })).join(' '), /value for “Venting”/);
    assert.match(listingProblems(fresh({ specs: [{ label: '', value: 'Direct vent' }] })).join(' '), /no label/);
    assert.match(listingProblems(fresh({ specs: [{ label: 'Fuel', value: 'Gas' }, { label: 'fuel ', value: 'Propane' }] })).join(' '), /twice/);
  });

  it('a manufacturer page has to be a full https address', () => {
    assert.deepEqual(listingProblems(fresh({ url: 'https://www.empirehearth.com/products/vail' })), []);
    assert.equal(listingProblems(fresh({ url: 'empirehearth.com/vail' })).length, 1);
  });

  it('specs are found by label whatever the case, and the Fuel spec drives the drawing', () => {
    assert.equal(specIndex(fresh().specs, 'heat INPUT'), 1);
    assert.equal(fuelOf(fresh().specs), 'gas');
    assert.equal(fuelOf([{ label: 'Fuel', value: 'Wood pellets' }]), 'pellet');
    assert.equal(fuelOf([]), undefined);
  });

  it('a model on the list starts from its page: the Fuel row first, then its checked specs', () => {
    const p = productById('HG-MEZZO48')!;
    const l = listingFromProduct(p);
    assert.equal(l.specs[0].label, 'Fuel');
    assert.equal(l.specs.length, p.specs.length + 1);
    assert.ok(!l.isNew);
  });

  it('pending: never-published new listings, anything different from the last publish, and removals', () => {
    const base = listingFromProduct(productById('HG-MEZZO48')!);
    assert.ok(isListingPending(fresh(), undefined, undefined));
    assert.ok(!isListingPending(fresh(), fresh(), undefined));
    assert.ok(isListingPending(fresh({ summary: 'Changed' }), fresh(), undefined));
    assert.ok(isListingPending(undefined, fresh(), undefined));
    assert.ok(!isListingPending({ ...base }, undefined, base));
    assert.ok(isListingPending({ ...base, specs: base.specs.slice(1) }, undefined, base));
    assert.ok(!sameListing(fresh(), fresh({ specs: [...fresh().specs].reverse() })), 'order matters');
    assert.ok(!sameListing(fresh(), fresh({ linkText: 'Specs at our distributor' })), 'the link’s words count');
  });

  it('the site gets live new listings and every change to a model on the list — not drafts', () => {
    const base = listingFromProduct(productById('HG-MEZZO48')!);
    const site = siteListings({ 'NEW-1': fresh(), 'NEW-2': fresh({ id: 'NEW-2', status: 'hidden' }), 'HG-MEZZO48': base }, (id) => (id === 'empire' ? 'Empire' : id));
    assert.deepEqual(Object.keys(site).sort(), ['HG-MEZZO48', 'NEW-1']);
    assert.equal(site['NEW-1'].brandName, 'Empire');
  });

  it('a model whose only change is its manufacturer/distributor link still gets it on its page', () => {
    const p = productById('KH-CALLAWAY50')!;
    const site = siteListings({}, (id) => id, { [p.id]: { url: 'https://www.example.com/callaway-50/', base: listingFromProduct(p) } });
    assert.equal(site[p.id].url, 'https://www.example.com/callaway-50/');
    assert.equal(site[p.id].model, p.model);
  });
});
