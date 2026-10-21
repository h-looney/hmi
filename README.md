# HMI Fireplace Shops — website redesign concept

A modern, front-end-only redesign of [hmifireplaceshop.com](https://www.hmifireplaceshop.com/) for HMI
Fireplace Shops (Osage Beach & Nixa, MO). It keeps HMI’s classic, family-business character — serif type, warm
hearth colors, real product photography — and adds the tools today’s customers expect.

Built with [Astro](https://astro.build) 7: every page is pre-rendered static HTML with responsive images and only a
few kilobytes of JavaScript.

The concept also includes **HMI mode** — the business side of the site, where staff work requests, schedule jobs,
track customers, warranty, stock and the books, and read reports. Use the **Demo · Public | HMI mode** switch at the
bottom-left of any page (or "Staff sign-in" in the footer). See [HMI mode](#hmi-mode-the-staff-side) below.

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
| `/office/…` | **HMI mode** (staff app, not indexed): dashboard, my day, inbox, jobs & schedule, customers, warranty, inventory, accounting, analytics, settings |

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

## HMI mode (the staff side)

HMI mode shows what running the business from the same system could look like. It's a working front-end demo:
everything can be clicked, edited and saved, but **nothing leaves the browser** — emails, texts, QuickBooks and
payment providers are simulated. Data is stored in the visitor's own browser (IndexedDB), so each person exploring the
demo gets their own copy. **Reset demo data** (account menu or Settings → Demo data) starts over.

**Sign-in profiles** show how roles change what people see: Owner (everything), Service coordinator, Office &
accounting, and a Technician with a phone-friendly day view. Owners can change each role's access under Settings →
Team & permissions.

| Section | What it does |
| --- | --- |
| Dashboard | Today at a glance: revenue, today's schedule, new requests, receivables, and a "needs attention" list (overdue invoices, unscheduled jobs, low stock, unregistered installs…) |
| My day | Technician view: today's stops with call / directions, checklist, parts, photos and a customer signature to close out a job |
| Inbox | Every request in one list — website quote and service forms, phone calls, walk-ins, Facebook. Assign, reply, log calls, and turn a request into a customer, site visit, job or estimate |
| Jobs & schedule | Installs, maintenance, repairs, warranty work and estimates on a board (drag between stages), a list, and a weekly dispatch board by technician |
| Customers | Contact details, appliances with serial numbers and warranty coverage, service history, invoices and an activity log |
| Warranty | Coverage registry (expiring, unregistered), manufacturer claims from draft to credit, and service reminders |
| Inventory | Stock at Osage Beach and Nixa (on hand, reserved for jobs, showroom displays), transfers, adjustments, purchase orders and receiving |
| Accounting | Invoices, estimates, payments, vendor bills, bank transactions and reports (P&L, sales tax, AR aging). Books can be kept **in-house** or **synced to QuickBooks Online** (simulated connection, sync settings, account mapping and log) |
| Analytics | Reports filtered by date range and showroom — see below |
| Settings | Business profile, team & permissions, website-form routing and auto-reply, invoicing & tax, notifications, demo data |

**The public site and HMI mode are connected.** Submit the quote or service-request form on the public site and the
request lands in the HMI inbox — live, if HMI mode is open in another tab. The confirmation message links straight to it.

### Analytics reports

All reports filter by date range (last 30/90 days, heating season, year to date, last 12 months, custom) and showroom,
compare with the same dates last year where the data allows, have a table view for every chart, and export CSV.

| Report | Answers |
| --- | --- |
| Technicians | Average install and service-visit time per technician against the estimate, on-time arrival, first-visit fix rate and return visits, with a drill-down per person |
| Problem units | Service calls and warranty work per 100 installed units by model, brand or category; most common problems and parts; appliances with 3+ visits in a year (replacement opportunities) |
| Best sellers | Top models, brands and categories by units, revenue or gross margin, split by store, with stock on hand and days of supply |
| Leads & conversion | Requests by source, win rates, first-reply times — and how reply speed affects winning the job |
| Inventory health | Slow movers, low and out-of-stock items, overstock and days of supply |
| Maintenance due | Appliances due (or overdue) for annual service, with bulk reminders and one-click booking |

Other reports worth adding with real data: customer satisfaction / review requests after each job, job profitability
(quoted vs. actual hours and parts), marketing ROI by campaign or lead source, financing uptake, permit and
inspection tracking, and a seasonal staffing forecast from last year's volume.

### Sample data

The demo generates a realistic two-store business around today's date — about 15 months of history behind the reports,
five weeks of detailed jobs, invoices and requests, and three weeks of schedule ahead — so it always looks current.
Brands and model names are products HMI carries; **customers, figures and every performance number are invented**
(phone numbers use the reserved 555-01xx range, emails use example.com). Office staff profiles use names from the
public About page; **technician names are placeholders**, and they're the only people the reports rate. The
problem-unit report is labeled as sample data, and its high-service groups are older appliances installed by others.

### How it's built

- A client-only [Preact](https://preactjs.com) app (`src/office/`) mounted by `src/pages/office/[...section].astro`.
  Each section is its own pre-rendered page, so links and refreshes work on any static host. The public pages ship no
  framework JavaScript.
- `src/office/data/types.ts` is the data model, written the way an API would return it. `seed.ts` builds the sample
  data; `actions.ts` holds every change (with side effects such as using up parts when a job is completed);
  `selectors.ts` and `pages/analytics/metrics.ts` hold the calculations.
- To make it real, replace `store.ts` (IndexedDB) and the actions with calls to a backend, and swap the simulated
  integrations (email/SMS, QuickBooks Online, payments) for their APIs. `src/office/bridge.ts` is where the public
  forms hand off today; with a backend they'd POST to it instead (see "Forms & a future backend").

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
submissions are logged to the browser console and, for the concept demo, handed to HMI mode in the same browser. To connect a backend, add a `data-endpoint` attribute to the
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
- **HMI mode:** which accounting system is used today (QuickBooks Online, QuickBooks Desktop, other), real technician
  names and roles, sample tax rates and service prices (Settings → Invoicing & tax), and who should receive website
  requests at each store.
- Three videos embedded on the current site (YouTube `BEMclJONFJA`, `ZKVq-oZLSFE`, `iee2VhpqFRI`) no longer
  resolve publicly and were left out.
