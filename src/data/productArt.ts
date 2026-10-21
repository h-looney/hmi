/**
 * The labelled placeholder shown until HMI has a real photo for a model. Manufacturer images are never copied or
 * hotlinked into this public repo; production would use each manufacturer's dealer media kit (see the README).
 * One SVG per model, served at /products/<category>/<model>/photo.svg and used by the page and its JSON-LD.
 */
import type { Product } from './products.ts';

export type ArtKind = 'fireplace' | 'linear' | 'insert' | 'stove' | 'logs' | 'firepit' | 'electric';

export function artFor(p: Pick<Product, 'category' | 'type' | 'fuel'>): ArtKind {
  if (p.category === 'gas-logs' || /\blog set\b/i.test(p.type)) return 'logs';
  if (/fire ?pit/i.test(p.type)) return 'firepit';
  if (p.fuel === 'electric') return 'electric';
  if (p.category === 'fireplace-inserts' || /\binsert\b/i.test(p.type)) return 'insert';
  if (/\bstove\b/i.test(p.type) || ['wood-stoves', 'gas-stoves', 'pellet-stoves'].includes(p.category)) return 'stove';
  if (/linear/i.test(p.type)) return 'linear';
  return 'fireplace';
}

const flame = (x: number, y: number, s = 1) =>
  `<path d="M${x} ${y}c${-22 * s} ${-8 * s} ${-30 * s} ${-30 * s} ${-14 * s} ${-58 * s}c${2 * s} ${16 * s} ${10 * s} ${22 * s} ${16 * s} ${24 * s}c${-4 * s} ${-26 * s} ${6 * s} ${-44 * s} ${22 * s} ${-56 * s}c${-2 * s} ${28 * s} ${24 * s} ${40 * s} ${16 * s} ${66 * s}c${-4 * s} ${14 * s} ${-18 * s} ${24 * s} ${-40 * s} ${24 * s}z" fill="url(#f)" stroke="none"/>`;

const ART: Record<ArtKind, string> = {
  fireplace: `<rect x="250" y="110" width="300" height="250" rx="10"/><rect x="292" y="160" width="216" height="180" rx="4"/><path d="M220 360h360"/><path d="M318 330h164"/>${flame(400, 326, 1.15)}`,
  linear: `<rect x="160" y="170" width="480" height="160" rx="10"/><rect x="192" y="198" width="416" height="104" rx="4"/>${[250, 330, 410, 490, 560].map((x) => flame(x, 296, 0.62)).join('')}<path d="M210 296h380"/>`,
  insert: `<rect x="236" y="120" width="328" height="246" rx="10"/><rect x="282" y="166" width="236" height="160" rx="6"/>${flame(400, 312, 1)}<path d="M300 346h200M300 356h200"/>`,
  stove: `<path d="M385 60v74M415 60v74"/><rect x="290" y="134" width="220" height="40" rx="12"/><rect x="304" y="174" width="192" height="160" rx="16"/><rect x="334" y="204" width="132" height="100" rx="8"/>${flame(400, 294, 0.8)}<path d="M318 334l-12 40M482 334l12 40"/>`,
  logs: `<path d="M248 330l300-46M262 284l292 50" stroke-width="22" stroke-linecap="round"/><path d="M300 262l200 0" stroke-width="20" stroke-linecap="round"/>${flame(360, 248, 0.95)}${flame(440, 252, 0.8)}<path d="M220 356h360"/>`,
  firepit: `<ellipse cx="400" cy="300" rx="190" ry="44"/><path d="M210 300v30c0 26 85 46 190 46s190-20 190-46v-30"/>${flame(350, 292, 0.8)}${flame(430, 290, 1)}`,
  electric: `<rect x="140" y="170" width="520" height="160" rx="10"/><rect x="170" y="196" width="460" height="108" rx="4"/><path d="M190 290c40-50 70 10 110-34s70 24 110-20 70 30 110-12 60 22 90-6" stroke="#e8835a" stroke-width="7"/><path d="M380 330v26h40v-26"/>`,
};

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Long model names go on two lines, split at the space nearest the middle */
function lines(model: string): string[] {
  if (model.length <= 20) return [model];
  const mid = model.length / 2;
  const spaces = [...model.matchAll(/ /g)].map((m) => m.index!);
  if (!spaces.length) return [model];
  const at = spaces.reduce((best, i) => (Math.abs(i - mid) < Math.abs(best - mid) ? i : best));
  return [model.slice(0, at), model.slice(at + 1)];
}

export function placeholderSvg(p: Pick<Product, 'category' | 'type' | 'fuel' | 'model'>, brandName: string): string {
  const rows = lines(p.model);
  const size = rows.length > 1 || p.model.length > 16 ? 34 : 42;
  const modelText =
    rows.length === 1
      ? `<text x="400" y="492" text-anchor="middle" font-family="Fraunces, Georgia, serif" font-size="${size}" fill="#2b2420">${esc(rows[0])}</text>`
      : `<text x="400" y="478" text-anchor="middle" font-family="Fraunces, Georgia, serif" font-size="${size}" fill="#2b2420"><tspan x="400">${esc(rows[0])}</tspan><tspan x="400" dy="38">${esc(rows[1])}</tspan></text>`;
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600" width="800" height="600" role="img" aria-label="Photo coming soon: ${esc(brandName)} ${esc(p.model)}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f6efe4"/><stop offset="1" stop-color="#e6d9c6"/></linearGradient>
    <radialGradient id="glow" cx="0.5" cy="0.42" r="0.5"><stop offset="0" stop-color="#f0a04b" stop-opacity="0.28"/><stop offset="1" stop-color="#f0a04b" stop-opacity="0"/></radialGradient>
    <linearGradient id="f" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#ad4118"/><stop offset="0.6" stop-color="#e8835a"/><stop offset="1" stop-color="#f0a04b"/></linearGradient>
  </defs>
  <rect width="800" height="600" fill="url(#bg)"/>
  <rect width="800" height="600" fill="url(#glow)"/>
  <g fill="none" stroke="#3a302a" stroke-width="6" stroke-linejoin="round" stroke-linecap="round" opacity="0.9">${ART[artFor(p)]}</g>
  <text x="400" y="440" text-anchor="middle" font-family="Inter, system-ui, sans-serif" font-size="22" font-weight="600" letter-spacing="4" fill="#7f6030">${esc(brandName.toUpperCase())}</text>
  ${modelText}
  <text x="400" y="${rows.length > 1 ? 560 : 540}" text-anchor="middle" font-family="Inter, system-ui, sans-serif" font-size="20" fill="#6a5d52">Photo coming soon</text>
</svg>
`;
}
