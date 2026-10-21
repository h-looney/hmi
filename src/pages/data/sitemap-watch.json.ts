import type { APIRoute } from 'astro';
import { linkHealth } from '../../data/linkHealth';

/** The latest weekly sitemap watch: new and vanished product pages, for HMI mode's "New & discontinued". */
export const GET: APIRoute = () => {
  const { feed } = linkHealth();
  const body = feed ?? { none: true, reason: 'The sitemap watcher hasn’t run for this build — run `npm run links:sitemaps` before building.' };
  return new Response(JSON.stringify(body), { headers: { 'Content-Type': 'application/json; charset=utf-8' } });
};
