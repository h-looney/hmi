/**
 * Live smoke test — `npm run links:smoke`. Runs the real checker (network, headless Chrome) against the links from
 * the 2026-10-21 audit of HMI's current site and checks they're classified as expected:
 *
 *   Avalon, Heatilator Eco Choice      → wrong page (they land on other brands' sites)
 *   the retired Fireplaces.com links   → dead
 *   Cultured Stone, Thermo-Rite        → moved (right content, new address)
 *   Dimplex                            → ok after the browser retry, or unverified — never dead
 *
 * A site that challenges automated clients at that moment (AWS WAF, Akamai…) may come back "unverified" instead of
 * "moved"; that's reported as a warning, because it's the correct, honest result.
 */
import { checkAll } from './run.ts';
import { findChrome } from './browser.ts';
import type { LinkStatus, OutboundLink } from '../../src/data/links.ts';

const FPC = 'http://www.fireplaces.com/Syndicated';
const fireplacesCom = [
  `${FPC}/Catalog/Browse.aspx?did=0013000000MqUbdAAF&type=fireplace&fuel=wood&brand=hng`,
  `${FPC}/Catalog/Browse.aspx?did=0013000000MqUbdAAF&type=fireplace&fuel=wood&brand=qdf`,
  `${FPC}/Catalog/Browse.aspx?did=0013000000MqUbdAAF&type=fireplace&fuel=wood&brand=har`,
  `${FPC}/Catalog/Browse.aspx?http://www.fireplaces.com/Syndicated/Catalog/Browse.aspx?did=0013000000MqUbdAAF&type=fireplace&fuel=gas&brand=htl`,
  `${FPC}/Catalog/Browse.aspx?did=0013000000MqUbdAAF&type=fireplace&fuel=gas&brand=qdf`,
  `${FPC}/Catalog/Browse.aspx?http://www.fireplaces.com/Syndicated/Catalog/Browse.aspx?did=0013000000MqUbdAAF&type=fireplace&fuel=gas&brand=mon`,
  `${FPC}/Widgets/GasCostCalculator.aspx?did=0013000000MqUbdAAF`,
  `${FPC}/Catalog/Browse.aspx?did=0013000000MqUbdAAF&type=fireplace&brand=htl`,
  `${FPC}/Catalog/Browse.aspx?did=0013000000MqUbdAAF&type=fireplace&brand=hng`,
  `${FPC}/Widgets/FuelCalculator.aspx?did=0013000000MqUbdAAF`,
  'http://www.fireplaces.com/Browse/Mantels-and-Surrounds.aspx/',
];

interface Case {
  link: OutboundLink;
  expect: LinkStatus[];
  /** Also acceptable, with a warning (bot checks) */
  tolerate?: LinkStatus[];
}

const link = (slug: string, url: string, fingerprint: string[], hosts: string[] = [], kind: OutboundLink['kind'] = 'brand'): OutboundLink => ({ slug, kind, url, label: slug, brand: slug, fingerprint, hosts, fallbacks: ['/products/'] });

const cases: Case[] = [
  { link: link('avalon', 'http://www.avalonproduct.com', ['Avalon'], ['avalonproduct.com']), expect: ['wrong-page'] },
  { link: link('eco-choice', 'http://www.heatilatorecochoice.com/', ['Eco Choice', 'EcoChoice'], ['heatilatorecochoice.com']), expect: ['wrong-page'] },
  ...fireplacesCom.map((url, i) => ({ link: link(`fireplaces-com-${i + 1}`, url, ['Fireplaces.com'], [], 'model'), expect: ['dead'] as LinkStatus[] })),
  { link: link('cultured-stone', 'https://www.culturedstone.com', ['Cultured Stone'], ['culturedstone.com']), expect: ['moved'], tolerate: ['unverified'] },
  { link: link('thermo-rite', 'https://www.thermo-rite.com', ['Thermo-Rite', 'TK Fireside'], ['thermo-rite.com', 'tkfireside.com']), expect: ['moved'], tolerate: ['unverified'] },
  { link: link('dimplex', 'http://www.dimplex.com/en/', ['Dimplex'], ['dimplex.com']), expect: ['ok', 'unverified'] },
  { link: link('dimplex-root', 'https://www.dimplex.com', ['Dimplex'], ['dimplex.com']), expect: ['ok', 'unverified'] },
];

console.log(`Live smoke test: ${cases.length} audit links${findChrome() ? ', headless Chrome for retries' : ' (no Chrome found — bot checks will be unverified)'}\n`);
const results = await checkAll(
  cases.map((c) => c.link),
  { log: () => {} },
);

let failed = 0;
let warned = 0;
for (const c of cases) {
  const r = results.find((x) => x.link.slug === c.link.slug)!;
  const s = r.verdict.status;
  const pass = c.expect.includes(s);
  const tolerated = !pass && c.tolerate?.includes(s);
  if (!pass && !tolerated) failed++;
  if (tolerated) warned++;
  const mark = pass ? '✓' : tolerated ? '!' : '✗';
  console.log(`${mark} ${c.link.slug.padEnd(20)} ${s.padEnd(11)} expected ${c.expect.join(' or ')}${r.verdict.via === 'browser' ? ' [browser]' : ''}\n    ${c.link.url}\n    ${r.verdict.reason}`);
}
console.log(`\n${cases.length - failed - warned} as expected · ${warned} unverified because of a bot check (acceptable) · ${failed} wrong`);
process.exit(failed ? 1 : 0);
