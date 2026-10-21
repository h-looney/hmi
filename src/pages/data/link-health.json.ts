import type { APIRoute } from 'astro';
import { linkHealth } from '../../data/linkHealth';

/**
 * The latest link check, published with the site for HMI mode (and as the next run's baseline: first-failed and
 * last-ok dates carry over from it). Local builds without a check publish a placeholder that says so.
 */
export const GET: APIRoute = () => {
  const { report } = linkHealth();
  const body = report ?? { none: true, reason: 'No link check has run for this build yet — run `npm run links:check` before building.' };
  return new Response(JSON.stringify(body), { headers: { 'Content-Type': 'application/json; charset=utf-8' } });
};
