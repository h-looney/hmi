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

npm run links:check     # check every manufacturer link (network) → .link-health/report.json
npm run links:sitemaps  # read the manufacturers' sitemaps (network) → .link-health/sitemap-*.json
npm test                # unit tests: link classifier, sitemaps, report (no network)
npm run test:site       # checks on the built site in dist/ (no direct manufacturer links…)
npm run test:browser    # browser tests against dist/ built with --base /hmi (needs Chrome)
npm run links:smoke     # live smoke test of the checker with the 2026-10-21 audit links
```

See [Product pages & manufacturer links](#product-pages--manufacturer-links) for how the link checker, the /go/ pages
and the sitemap watcher fit together.

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
| `/products/[category]/` | 14 category pages (wood, gas, electric, outdoor, vent-free, gas logs, inserts, wood/gas/pellet stoves, mantels, doors, stone, accessories), each listing its models |
| `/products/[category]/[model]/` | A page per model HMI carries: checked specs, which showroom has it on display, a quote button and a “Full specs at <brand>” link. Discontinued models keep their page |
| `/go/[slug]/` | Redirect pages every manufacturer link goes through (not indexed) — see below |
| `/data/*.json` | The latest link check and sitemap watch, published for HMI mode |
| `/fireplace-finder/` | 4-question quiz, side-by-side fuel comparison, fuel cost calculator |
| `/services/` | Design help, installation, service & repair, builders, battery-backup help |
| `/service-request/` | Service request form with photo upload preview |
| `/contact/` | 3-step quote request, store contacts, after-hours visits |
| `/locations/osage-beach/`, `/locations/nixa/` | Local store pages (hours, map, team, service area) |
| `/gallery/` | Filterable inspiration gallery with lightbox |
| `/about/`, `/about/team/`, `/careers/` | Story & timeline, mission & principles, team bios, careers |
| `/resources/` | Owner resources: battery backup, manuals, safety, tools, videos, FAQ |
| `/sitemap.xml`, `/404` | Sitemap and a custom not-found page |
| `/office/…` | **HMI mode** (staff app, not indexed): dashboard, my day, inbox, jobs & schedule, customers, warranty, inventory, accounting, analytics, website, settings |

## What’s new compared with the current site

- **Live “Open now / Closed” status** for each showroom (Central time), in the header, footer and store cards.
- **Fireplace Finder quiz** that recommends three product categories, with shareable result links and a
  one-click hand-off into the quote form.
- **Fuel cost calculator** comparing natural gas, propane, firewood, pellets and electricity at the visitor’s own prices.
- **Multi-step quote form** and **service request form** with inline validation (front-end only — see below).
- **Mega menu**, mobile drawer, and a phone **action bar** (Call · Visit · Get a quote) for local customers.
- **Filterable product catalog**, searchable **brand directory**, and an **inspiration gallery** with lightbox.
- **A page for every model** with specs checked against the manufacturer, which showroom has it on display, and a
  one-click quote — plus **manufacturer links that fix themselves**: checked every night, with a safe fallback when a
  manufacturer’s page breaks (see [Product pages & manufacturer links](#product-pages--manufacturer-links)).
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

**Sign-in profiles** show how roles change what people see: Cheryl as Owner (everything), Gabe as Store manager
(opens on the Nixa store), a Service coordinator, Office & accounting, and a Technician with a phone-friendly day view.
Owners can change each role's access under Settings → Team & permissions.

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
| Website | The product list behind the model pages and manufacturer links: status and replacements, link health from the nightly check, new and discontinued models from the weekly sitemap watch, outbound clicks, the Monday summary and printable showroom tags with QR codes. Owners and store managers by default |
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
Brands and model names are real products from the product list (`src/data/products.ts`, which also supplies the
showroom display counts); **customers, figures and every performance number are invented**
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
  forms hand off today, and where the /go/ pages record outbound clicks; with a backend they'd POST to it instead (see
  "Forms & a future backend").

## Product pages & manufacturer links

HMI’s current site sends customers straight to manufacturers’ pages, and those break: an audit on 2026-10-21 found 24
of its 59 product links failing (19 dead, 5 landing on the wrong page). The redesign turns that around:

1. **HMI’s own page first.** Every model has a page at `/products/<category>/<model>/` that HMI controls, so a link a
   customer has (a bookmark, a showroom QR code, a search result) can’t go dead. The manufacturer’s page is a secondary
   “Full specs at <brand>” link. A discontinued model’s page stays up with a notice, the replacement if the
   manufacturer names one, and “Ask us about service and parts”.
2. **Every manufacturer link goes through `/go/<slug>/`**, and a nightly check decides where each one sends people.
3. **When a manufacturer link breaks, customers get a safe page automatically** — nobody has to notice first.
4. **The manufacturers’ sitemaps work as a product feed**: a weekly read flags new and vanished product pages for
   someone to approve in HMI mode.

### One product list

`src/data/products.ts` is the single source of truth. It holds the models (from HMI mode’s appliance catalog), every
brand’s site and owner-support page, one tool (Travis Industries’ FireBuilder) and each brand’s sitemap pattern. It
feeds the model and category pages, the /go/ pages, the checker, the sitemap watcher and HMI mode — HMI mode’s catalog
(`src/office/data/catalog.ts`) takes model names and showroom display counts from it and keeps only its invented
commercial data (cost, price, stock, reorder points). The checker refuses to run if the two disagree.

- **Specs are only facts checked on the manufacturer’s own page** (or, for discontinued models, its owner’s manual),
  stored with the source URL and date (`verified`). Anything that couldn’t be verified is left out. No prices and no
  ratings appear on public pages; the checker fails if one sneaks into the list.
- **Model status:** `current`, `discontinued` (page stays up) or `hidden` (on the list, but no public page or link —
  used for a model HMI should confirm first).
- **Photos:** no manufacturer image is copied or hotlinked into this public repo. Model pages show a clean labelled
  placeholder (`src/data/productArt.ts`, one SVG per model, also used as the JSON-LD image). Production would use each
  manufacturer’s dealer media kit, or HMI’s own showroom photos, through `src/data/productPhotos.ts`.
- **Structured data:** each model page has schema.org `Product` JSON-LD (name, brand, model, image, the checked specs
  as properties) — no offers, prices, ratings or reviews.
- “Get a quote on this model” opens the quote form with the model filled in (`/contact/?model=<SKU>`), and the request
  arrives in HMI mode’s inbox with the model on it.

### /go/ links and fallbacks

GitHub Pages can’t do server redirects, so each `/go/<slug>/` is a tiny static page: a meta refresh, a
`location.replace()`, a visible “Continue to …” link and `noindex` (and `/go/` is disallowed in `robots.txt`). Before
redirecting it records the click through the `src/office/bridge.ts` hand-off, so HMI mode → Website → Clicks shows real
clicks from that browser; production would count them server-side (web analytics or the redirect service).

Where `/go/` sends people comes from the latest check (`resolveTarget` in `src/data/links.ts`):

| Latest result | Model link | Brand link | Owner-support link |
| --- | --- | --- | --- |
| ok | the stored URL | the stored URL | the stored URL |
| moved | the new address | the new address | the new address |
| unverified (bot check) | the stored URL | the stored URL | the stored URL |
| dead / wrong page / soft 404 | **HMI’s model page**, with a short notice | the parent brand’s site if it passes (Forge & Flame for Quadra-Fire, Harman, Vermont Castings), else HMI’s brand directory | the brand’s main site if it passes, else HMI’s owner resources |

A model page also drops its “Full specs” button while its link is failing. Builds without a report (local development)
use every stored URL as-is.

### The link checker (`scripts/link-health/`)

One Node checker for every outbound link — 80 today: 32 models, 31 brand sites, 16 owner-support pages and
FireBuilder — run with `npm run links:check`. Its only dependency is `puppeteer-core` (pinned), used for retries.

- **Requests:** a GET with normal browser headers, redirects followed hop by hop (cookies carried), a 25-second
  timeout, and one retry. One request at a time per host, 1.2 s apart.
- **Verdicts** (`classify.ts`, a pure function over a saved response):

  | Status | Meaning |
  | --- | --- |
  | ok | The right page at the stored address (https, www, trailing slash and a locale root like `/en-us` don’t count as moves) |
  | moved | The right page at a new address — “update the stored URL”; not a failure |
  | dead | DNS, TLS, connection or timeout errors, or HTTP 4xx/5xx |
  | wrong page | Loads, but it’s another site, the homepage, a general list, or doesn’t mention the model |
  | soft 404 | Loads, but says “not found” / “no longer available”, or marks the product discontinued |
  | unverified | A bot check (Cloudflare, Akamai, AWS WAF, Imperva, Vercel…) that a real browser couldn’t see past either. Never counted as dead; CAPTCHAs are never worked around |

  “Right page” is decided by **fingerprint**: each link stores text its page must show in the `<title>`, an `<h1>` or a
  JSON-LD Product name (usually the model name). Brand-level links may also match the site’s own name. Known moves
  are listed as allowed hosts (e.g. quadrafire.com → forgenflame.com).
- **Retries in a browser:** bot checks, and pages that render their headings with JavaScript, get the retry in headless
  Chrome (`CHROME_PATH`, or the usual install paths). A check that a browser passes on its own (Cloudflare’s “Just a
  moment…”, Vercel’s Security Checkpoint) gets up to 15 s to reload into the real page; anything still showing a check
  after that is “unverified”.
- **Report:** `.link-health/report.json` (published as `/data/link-health.json`): for each link its status, reason,
  final URL, HTTP status, where /go/ now sends people, and first-failed / last-ok dates carried over from the previous
  report.
- **Internal problems** (always fatal): a model without a valid page or /go/ slug, a replacement that isn’t on the
  list, a fingerprint that can’t match, a price or rating in the list, HMI mode’s catalog out of step, and so on
  (`validate.ts`).

Run it locally:

```bash
npm run links:check                 # all links (about 30 s), writes .link-health/report.json
npm run links:check -- --only heat-glo,lopi-northfield   # a few links by /go/ slug
npm run links:check -- --validate-only                   # just the internal checks, no network
npm run links:sitemaps              # the weekly sitemap watch (2–6 min, politely paced)
npm run build                       # the build reads .link-health/ for /go/ targets and HMI mode
```

**Tests:** `npm test` runs the classifier against responses saved from the real audit links on 2026-10-21
(`tests/fixtures/link-health/`, no network) plus edge cases, the retry logic, report history, /go/ targets and sitemap
parsing. `npm run links:smoke` runs the real checker on the audit links and checks Avalon and Eco Choice come back
“wrong page”, the Fireplaces.com links “dead”, Cultured Stone and Thermo-Rite “moved” and Dimplex “ok” or
“unverified”. A site may put up a bot check for automated clients at any moment (Westlake’s AWS WAF does, and
heatilator.com’s Vercel firewall showed GitHub’s servers a Security Checkpoint on the first deploy while loading
normally everywhere else): then the honest answer is “unverified”, which the smoke test accepts with a warning. The
browser retry itself is tested against a local server (skipped if Chrome isn’t installed). `npm run test:site` fails if any built
page links straight to a manufacturer instead of through `/go/`.

### The sitemap watcher

No manufacturer publishes a product API, but 26 of the 27 manufacturer sites publish a sitemap (robots.txt `Sitemap:`
lines or `/sitemap.xml`; several are indexes, some wrap `<loc>` in CDATA or gzip). Kuma has none, so its stove and
insert listing pages are read instead. Each brand’s product-URL pattern was worked out from its real sitemap and lives
next to the brand in `products.ts`.

Every Monday the watcher compares each brand’s product pages with last week’s snapshot:

- **New product pages** → “Lopi added 3 products — add them?”, with a name proposed from the page title and a link.
- **A listed model’s page gone from the sitemap** → “Discontinued?” on that model.
- **First run** (no snapshot yet): it compares with the product list instead, so there’s real data right away — the
  newest pages not on the list for each brand HMI carries models from, plus counts for everything else.
- A sitemap that’s unavailable, partly unreadable or suddenly half its size is treated as a problem on their side: last
  week’s snapshot is kept and nothing is flagged as gone. (Dimplex’s sitemap lists only series pages, so its models
  can’t be watched there; the nightly link check still covers them.)

The feed and snapshot are published as `/data/sitemap-watch.json` and `/data/sitemap-snapshot.json`. Nothing on the
public site changes until someone approves a suggestion in HMI mode.

### Publishing (`.github/workflows/deploy.yml`)

One workflow builds and deploys on every **push** to `main`, **nightly** (08:17 UTC, about 3 AM in Missouri) and on
**demand**. Every run checks the links before building, so tonight’s /go/ pages reflect tonight’s check; Mondays also
run the sitemap watcher (as does the first run, or tick “sitemaps” on a manual run). Nightly runs build and deploy in the same workflow — a
push made with `GITHUB_TOKEN` wouldn’t trigger another one — and nothing is committed back to `main`: first-failed
dates and the sitemap snapshot come from the JSON the previous run published with the site.

- **A deploy fails** on internal problems, on a built page linking to a manufacturer directly, and — on a push — on
  outbound links added or changed in that push that don’t work (compared with the published report, or the previous
  commit if that’s unavailable).
- **A deploy never fails** because a manufacturer broke a link that was already live: /go/ falls back instead.
- **Alert:** a single GitHub issue labelled `link-health` is opened or updated with what broke and which fallback is in
  effect, and closed when everything passes again (`scripts/link-health/issue.ts`).

### Managing it in HMI mode

**Website** (Business group; owners and store managers by default, adjustable under Settings → Team & permissions) is
built to take whoever owns it about five minutes a week:

- **Products** — the one list: brand, model, category, status and replacement, HMI page and manufacturer link, link
  health and last check, and which showroom has it on display (the same counts as Inventory and the public pages).
  Edits are saved in this browser like the rest of HMI mode and marked “goes live on next publish (simulated)”.
- **Link health** — the latest real report: counts, failures with reasons, fallbacks in effect, and “update stored
  URL” suggestions with one-click Accept. Shows a friendly empty state when the build has no report (local dev).
- **New & discontinued** — the sitemap suggestions, with Add / Dismiss / Mark discontinued.
- **Clicks** — outbound clicks per product from the /go/ pages in this browser.
- **Weekly summary** — pick who gets the Monday email (Gabe by default) and preview it (“3 links fixed automatically,
  2 new Lopi models to review”), with a simulated send.
- **Showroom tags** — a printable tag per model with a QR code for its HMI page, so tags never break.

The dashboard’s “Needs attention” list flags failing links, URLs to update and sitemap suggestions waiting.

### What’s real and what’s simulated

| Real | Simulated or sample |
| --- | --- |
| Every model on the list, its manufacturer URL and every spec shown — checked on the manufacturer’s site on 2026-10-21 | Showroom display counts, stock, costs and prices (HMI mode’s sample data — the public pages show displays, never prices) |
| The link checks, their verdicts, fallbacks and dates (`npm run links:check`, and the nightly job) | “Publish” of edits made in HMI mode (nothing on the public site changes) |
| The sitemap reads and suggestions (`npm run links:sitemaps`, and the Monday job) | Sending the weekly summary (previewed only) |
| /go/ redirects and the clicks recorded in your browser | Click counts across visitors (production would use server-side analytics) |
| The GitHub issue alert (once the workflow runs) | Model photos (labelled placeholders until HMI supplies media-kit or showroom photos) |

## Editing content

Almost everything lives in `src/data/`:

| File | Contents |
| --- | --- |
| `products.ts` | **The product list**: every model HMI shows (specs checked on the manufacturer’s page, with source and date; showroom displays; status), every brand’s site and owner-support page, and the sitemap patterns. The one place outbound links live |
| `site.ts` | Business name, phones, addresses, hours, map embeds, social links, service areas |
| `categories.ts` | Product categories: copy, highlights, options, brands, photos, related items |
| `brands.ts` | Brand directory (name, short description, product types) — URLs are in `products.ts` |
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

Model pages use labelled placeholders rather than manufacturer photos (none are copied or hotlinked into this public
repo). In production, add photos from the manufacturers’ dealer media kits — or HMI’s own showroom photos — to
`src/data/productPhotos.ts` and set `photo` on the model in `src/data/products.ts`.

## To confirm with HMI

- **Logo** — the logo file from the current site was cropped so tight that the final “p” and the left serifs of the
  “H” were cut off. The PNGs in `src/assets/brand/` are repaired (the final “p” rebuilt from the “p” in “Fireplace”,
  the “H” serifs mirrored, a transparent margin added), but a vector (SVG/EPS) original would still be better.
- **Brands** — Avalon and Heatilator Eco Choice were left out: the link checker confirms their old addresses now land
  on Lopi’s and Quadra-Fire’s sites. Is the brand list current? Which central vacuum brands are carried?
- **Thermo-Rite → TK Fireside?** thermo-rite.com now redirects to tkfireside.com, which looks like a rebrand. The
  checker reports it as moved and /go/ already sends people to the new address. Should the brand be listed as
  TK Fireside?
- **Cultured Stone** now lives on Westlake Royal Building Products’ site (reported as moved; /go/ follows it). Keep
  the brand name? Westlake’s firewall sometimes challenges automated checks, so that link can show as unverified.
- **Empire** — the hearth products moved to empirehearth.com (Empire Hearth); the brand link still goes to the
  parent company, empirecomfort.com. Switch it to Empire Hearth?
- **Design Specialties** now links to designspecialties.com (HMI’s old glassfireplacedoors.com link redirects there).
- **The models on the product list** start from HMI mode’s sample catalog, so they’re a guess at what HMI carries —
  which models does HMI actually stock and display? Checking each one against the manufacturer on 2026-10-21:
  - **Dropped (not on the maker’s site at all):** Fireplace Xtrordinair 564 TRV 31K (the 564 comes in 25K and 35K; the
    31K is the 864), Kozy Heat Springfield 22 (only a Springfield 36 fireplace exists), Empire “Rustic Oak” 30″
    vent-free logs, Lopi Revere NexGen-Fyre insert (Lopi only lists a 1993–2004 Revere) and a 36″ Mason-Lite kit
    (Mason-Lite’s sizes are 33, 39, 44, 49, 63 and 75″; there’s a new Azteca 36 spec sheet).
  - **Listed under the maker’s current name:** Lopi DVL GS2 → 34 DVL Deluxe Ember-Glo, Northfield GS2 → GSR2, Answer
    NexGen-Fyre → Answer NexGen-Hybrid; FPX 42 Apex Clean-Face → 42 Apex NexGen-Hybrid, 616 GSR2 Grand Deluxe → 616
    Deluxe Ember-Glo, ProBuilder 42 Linear GSR2 → ProBuilder 42 Linear Deluxe; Heat & Glo Escape-I35 → Escape-35;
    Heatilator Icon 100 → Icon 50 (Heatilator’s architect guides show the same unit); Harman Accentra52i →
    Accentra52i-TC, P43 → Pathfinder P43; Kuma Aspen LE → Aspen LE-1; HearthStone Castleton 8030 → model 8031.
  - **Discontinued (page kept, “service and parts”):** Heat & Glo 6000C and SL-750TRS-IPI, Heatilator Caliber nXt 36,
    Quadra-Fire Castile pellet insert. None of the makers names a replacement — is there one HMI recommends?
  - **Hidden until confirmed:** Dimplex Opti-myst Pro 1000 cassette (Dimplex mentions the 40″ cassette but only lists
    the 20″). Can it still be ordered?
  - **Which version:** Empire Boulevard 48 (direct-vent assumed; there’s also a vent-free one), HPC’s 30″ match-lit
    insert (round flat assumed; also square flat and square bowl), the Revillusion 42 finish (black assumed), and the
    Kozy Heat Chaska 34 is an insert, not a fireplace.
- **Showroom displays** on the model pages come from HMI mode’s sample inventory — the real list of floor models is
  needed before launch.
- **Website owner** — who should receive the Monday website summary (Gabe by default), and which roles should see the
  Website section?
- **Click counts** — production would count outbound clicks server-side; which analytics does HMI use, if any?
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
