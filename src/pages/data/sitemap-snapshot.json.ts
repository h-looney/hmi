import type { APIRoute } from 'astro';
import { linkHealth } from '../../data/linkHealth';

/** Every brand's product pages as of the last sitemap watch — what the next weekly run compares with. */
export const GET: APIRoute = () => {
  const { snapshot } = linkHealth();
  const body = snapshot ?? { none: true, reason: 'No sitemap snapshot yet.' };
  return new Response(JSON.stringify(body), { headers: { 'Content-Type': 'application/json; charset=utf-8' } });
};
