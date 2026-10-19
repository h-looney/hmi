# HMI Fireplace Shops — website redesign concept

A modern, front-end-only redesign of [hmifireplaceshop.com](https://www.hmifireplaceshop.com/) for HMI
Fireplace Shops (Osage Beach & Nixa, MO). It keeps HMI’s classic, family-business character — serif type, warm
hearth colors, real product photography — and adds the tools today’s customers expect.

Built with [Astro](https://astro.build) 7: every page is pre-rendered static HTML with responsive images and only a
few kilobytes of JavaScript.

## Quick start

Requires Node.js 22.22 or newer.

```bash
npm install
npm run dev       # http://localhost:4321 with hot reload
npm run build     # static site → dist/
npm run preview   # serve the production build locally
npm run check     # TypeScript + Astro diagnostics
```

## Sharing a preview online

`npm run build` produces plain static files in `dist/`, so any static host can serve the site — no server needed:

- **Netlify Drop** (quickest): build, then drag the `dist` folder onto <https://app.netlify.com/drop>.
- **GitHub + Cloudflare Pages or Netlify**: push the repo and connect it to the host (build command `npm run build`,
  output folder `dist`); every push redeploys.
- **GitHub Pages**: `.github/workflows/deploy.yml` builds and publishes the site on every push to `main`. Turn it on
  once under the repo’s Settings → Pages → Source: “GitHub Actions”. The site is served from a subfolder
  (`https://<user>.github.io/<repo>/`); to try that locally, run
  `npm run build -- --site https://<user>.github.io --base /<repo>` and then `npm run preview -- --base /<repo>`.

So the site works in a subfolder, internal links go through `withBase()` from `src/scripts/url.ts` — write
`href={withBase('/contact/')}` rather than `href="/contact/"`. At the site root it changes nothing.

Copies served from any domain other than hmifireplaceshop.com add a `noindex` tag (`src/components/SEO.astro`), so
previews stay out of search results.

## Pages

| URL | What it is |
| --- | --- |
| `/` | Home: hero with live store status, fuel comparison, categories, seasonal feature, services, story, brands, locations, FAQ |
| `/products/` | Product hub with fuel/use filters and a searchable brand directory |
| `/products/[category]/` | 14 category pages (wood, gas, electric, outdoor, vent-free, gas logs, inserts, wood/gas/pellet stoves, mantels, doors, stone, accessories) |
| `/fireplace-finder/` | 4-question quiz, side-by-side fuel comparison, fuel cost calculator |
| `/services/` | Design help, installation, service & repair, builders, battery-backup help |
| `/service-request/` | Service request form with photo upload preview |
| `/contact/` | 3-step quote request, store contacts, after-hours visits |
| `/locations/osage-beach/`, `/locations/nixa/` | Local store pages (hours, map, team, service area) |
| `/gallery/` | Filterable inspiration gallery with lightbox |
| `/about/`, `/about/team/`, `/careers/` | Story & timeline, mission & principles, team bios, careers |
| `/resources/` | Owner resources: battery backup, manuals, safety, tools, videos, FAQ |
| `/sitemap.xml`, `/404` | Sitemap and a custom not-found page |

## What’s new compared with the current site

- **Live “Open now / Closed” status** for each showroom (Central time), in the header, footer and store cards.
- **Fireplace Finder quiz** that recommends three product categories, with shareable result links and a
  one-click hand-off into the quote form.
- **Fuel cost calculator** comparing natural gas, propane, firewood, pellets and electricity at the visitor’s own prices.
- **Multi-step quote form** and **service request form** with inline validation (front-end only — see below).
- **Mega menu**, mobile drawer, and a phone **action bar** (Call · Visit · Get a quote) for local customers.
- **Filterable product catalog**, searchable **brand directory**, and an **inspiration gallery** with lightbox.
- **Local SEO**: per-page titles and descriptions, Open Graph images, `LocalBusiness` + `FAQPage` +
  `BreadcrumbList` structured data, a sitemap, and dedicated location pages.
- **Performance**: static HTML, WebP images at responsive sizes, self-hosted fonts, click-to-load maps and videos.
- **Accessibility**: semantic landmarks, skip link, keyboard-friendly menus, tabs, accordions and dialogs,
  reduced-motion support, WCAG AA color contrast (axe-core reports no violations).

## Editing content

Almost everything lives in `src/data/`:

| File | Contents |
| --- | --- |
| `site.ts` | Business name, phones, addresses, hours, map embeds, social links, service areas |
| `categories.ts` | Product categories: copy, highlights, options, brands, photos, related items |
| `brands.ts` | Brand directory (name, URL, short description, product types) |
| `team.ts` | Team bios, photos, certifications, owners |
| `faqs.ts` | FAQ questions and answers (also used for structured data) |
| `fuels.ts` | Fuel comparison ratings and pros/cons |
| `gallery.ts` | Inspiration gallery photos, titles and tags |
| `videos.ts` | YouTube/Vimeo videos |
| `navigation.ts` | Main menu and footer links |

Store hours drive the live status badges, so updating `site.ts` updates everything. The seasonal announcement bar is
set in `src/layouts/BaseLayout.astro` — change the text and bump `announcementId` to show it again to visitors who
dismissed the previous one.

Design tokens (colors, type scale, spacing) are CSS custom properties at the top of `src/styles/global.css`.

## Forms & a future backend

The quote and service forms validate in the browser and show a confirmation, but **nothing is sent anywhere yet** —
submissions are only logged to the browser console. To connect a backend, add a `data-endpoint` attribute to the
`<form>` (in `src/components/QuoteForm.astro` or `src/pages/service-request.astro`); the fields are POSTed as JSON.
See `src/scripts/forms.ts`. Photo uploads are previewed locally and would need multipart handling server-side.

The careers page links to HMI’s existing employment application form.

## Images

Photos, team portraits and the logo come from the current website. Many are small (the panoramic banners are
1500×400 and most product shots are 400–600 px wide), so the design shows them at or below their native size.
Higher-resolution originals would let us use larger, full-bleed photography.

## To confirm with HMI

- **Logo** — the current logo file is cropped tight, so the edges of the “H” and final “p” are clipped. A vector
  (SVG/EPS) logo would fix this.
- **Brands** — Avalon and Heatilator Eco Choice were left out because their links now redirect to other brands.
  Is the brand list current? Which central vacuum brands are carried?
- **Service areas** listed on the location pages are an educated guess.
- **Services** — do you service brands you didn’t sell? Offer routine annual service, chimney sweeping or financing?
- **Photos** — a Nixa storefront photo and real HMI installation photos for the gallery (current site: “Coming soon”).
- **Reviews** — real customer reviews (e.g. from Google) could be added; none were invented for this concept.
- **Fuel calculator defaults** are sample prices for comparison only.
- Three videos embedded on the current site (YouTube `BEMclJONFJA`, `ZKVq-oZLSFE`, `iee2VhpqFRI`) no longer
  resolve publicly and were left out.
