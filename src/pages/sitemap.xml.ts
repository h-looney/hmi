import type { APIRoute } from 'astro';
import { categories } from '../data/categories';
import { productPath, publicProducts } from '../data/products';
import { locations } from '../data/site';
import { withBase } from '../scripts/url';

/** Simple XML sitemap generated at build time — no extra dependencies. */
export const GET: APIRoute = ({ site }) => {
  const paths = [
    '/',
    '/products/',
    ...categories.map((c) => `/products/${c.slug}/`),
    // Model pages (discontinued ones too — they stay up). /go/ redirect pages are never listed.
    ...publicProducts().map(productPath),
    '/fireplace-finder/',
    '/services/',
    '/service-request/',
    '/gallery/',
    '/about/',
    '/about/team/',
    '/careers/',
    '/contact/',
    ...locations.map((l) => `/locations/${l.slug}/`),
    '/resources/',
  ];

  const urls = paths
    .map((p) => `  <url><loc>${new URL(withBase(p), site).toString()}</loc></url>`)
    .join('\n');

  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`,
    { headers: { 'Content-Type': 'application/xml; charset=utf-8' } },
  );
};
