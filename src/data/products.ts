/**
 * THE PRODUCT LIST — the one source of truth for every model HMI shows and every outbound manufacturer link.
 *
 * Used by: the model pages (/products/<category>/<model>/), the category pages, the /go/<slug>/ redirect pages, the
 * nightly link checker and weekly sitemap watcher (scripts/link-health/), and HMI mode (src/office/data/catalog.ts
 * takes model names and showroom display counts from here).
 *
 * Rules for this file:
 *  - Specs are facts verified on the manufacturer's own page, listed in `verified` with the date. Nothing else.
 *  - No prices and no ratings, ever (HMI mode's costs and prices are invented sample data and stay there).
 *  - Copy (`summary`) is written fresh — never copied from HMI's old site or a manufacturer.
 *  - Plain TypeScript, no Astro imports: Node runs this file directly for the link checker.
 */
/** Showroom slugs, as in src/data/site.ts (and HMI mode's StoreId) */
export type StoreSlug = 'osage-beach' | 'nixa';

export type ProductCategory =
  | 'wood-fireplaces'
  | 'gas-fireplaces'
  | 'electric-fireplaces'
  | 'outdoor-fireplaces'
  | 'vent-free-gas'
  | 'gas-logs'
  | 'fireplace-inserts'
  | 'wood-stoves'
  | 'gas-stoves'
  | 'pellet-stoves'
  | 'mantels-surrounds'
  | 'fireplace-doors'
  | 'cultured-stone'
  | 'accessories-care';

export type ProductFuel = 'gas' | 'wood' | 'pellet' | 'electric';
export type ProductStatus = 'current' | 'discontinued' | 'hidden';

export interface Spec {
  label: string;
  value: string;
}

export interface Product {
  /** HMI's SKU — the same id HMI mode's inventory uses */
  id: string;
  /** URL segment for /products/<category>/<slug>/ and /go/<slug>/ — brand + model */
  slug: string;
  /** Brand id from src/data/brands.ts */
  brand: string;
  /** The model as the manufacturer writes it, e.g. "Mezzo 48" */
  model: string;
  /** What it is, in a few words: "Linear gas fireplace" */
  type: string;
  /** The category page it lives under (its URL) */
  category: ProductCategory;
  /** Other category pages that list it too */
  alsoIn?: ProductCategory[];
  /** Appliances only: doors, mantels, stone and accessories have none */
  fuel?: ProductFuel;
  status: ProductStatus;
  /** Discontinued models: the model the manufacturer names as its replacement (only if they name one) */
  replacement?: { id?: string; name: string; url?: string };
  /** The manufacturer's page for this model ("Full specs at <brand>") */
  url: string;
  /** Link text when it isn't a spec page — e.g. a discontinued model's owner's manual */
  linkLabel?: string;
  /** Text the manufacturer's page must show in its <title>, an <h1> or a JSON-LD Product name */
  fingerprint: string[];
  /** Key facts, each verified on the manufacturer's page listed in `verified` */
  specs: Spec[];
  /** Where and when the specs (and the model's status) were checked */
  verified: { url: string; on: string; note?: string };
  /** Showroom display units — HMI mode's inventory reads the same numbers */
  display: Record<StoreSlug, number>;
  /** One or two sentences of HMI's own copy */
  summary: string;
}

/** How the weekly sitemap watcher finds a brand's product pages */
export interface SitemapSource {
  /** Site whose sitemaps (or listing pages) are read — brands on one site share a single fetch */
  origin: string;
  /** Explicit sitemap URLs, or listing pages for a site without a sitemap; default: robots.txt, then /sitemap.xml */
  urls?: string[];
  /** 'listing' reads product links from the `urls` pages instead of a sitemap */
  kind?: 'sitemap' | 'listing';
  /** Only expand child sitemaps whose URL matches */
  child?: RegExp;
  /** A page URL is one of this brand's products when it matches `product` and not `exclude` */
  product: RegExp;
  exclude?: RegExp;
}

export interface BrandSite {
  /** Display name when it differs from brands.ts (e.g. the parent brand used only as a fallback) */
  name?: string;
  /** The brand's main page — "Visit site" */
  url: string;
  fingerprint: string[];
  /** Other hosts the brand's pages legitimately live on (known moves, e.g. quadrafire.com → forgenflame.com) */
  hosts?: string[];
  /** Another brand-site entry to fall back to (e.g. the parent brand's home) */
  parent?: string;
  /** Owner's manuals / support page, linked from Resources */
  support?: { url: string; fingerprint: string[] };
  sitemap?: SitemapSource;
}

export interface Tool {
  slug: string;
  label: string;
  /** Brand whose site it belongs to (its fallback) */
  brand: string;
  url: string;
  fingerprint: string[];
  hosts?: string[];
}

/** Date the specs and links below were last verified by hand */
const CHECKED = '2026-10-21';
/** Models added on the second pass through each category */
const ADDED = '2026-10-22';

/* ------------------------------------------------------------------------------------------------ */
/* Brand sites                                                                                       */
/* ------------------------------------------------------------------------------------------------ */

/*
 * `sitemap` says where the weekly sitemap watcher finds each brand's product pages. Patterns were worked out on
 * 2026-10-21 by reading every brand's sitemap (robots.txt `Sitemap:` lines or /sitemap.xml); the comment on each
 * one notes what its product URLs look like. Paths are matched without a trailing slash.
 */
export const brandSites: Record<string, BrandSite> = {
  'heat-glo': {
    url: 'https://www.heatnglo.com',
    fingerprint: ['Heat & Glo', 'Heat-N-Glo'],
    // Owner's manuals are served from Hearth & Home Technologies' download host
    hosts: ['heatnglo.com', 'downloads.hearthnhome.com'],
    support: { url: 'https://www.heatnglo.com/manuals', fingerprint: ['Manuals'] },
    // /fireplaces/<fuel>/<type>/<model>, log sets one level deeper; /fireplaces/global/… are overseas models
    sitemap: { origin: 'https://www.heatnglo.com', product: /^\/fireplaces\/(gas|wood|electric)\/[^/]+\/[^/]+(\/[^/]+)?$/, exclude: /^\/fireplaces\/gas\/gas-log-set-collections\/(indoor|outdoor)$/ },
  },
  heatilator: {
    url: 'https://www.heatilator.com',
    fingerprint: ['Heatilator'],
    hosts: ['heatilator.com', 'downloads.hearthnhome.com'],
    support: { url: 'https://www.heatilator.com/owner-support/install-and-owners-manuals', fingerprint: ['Owners Manual', 'Manuals'] },
    // /fireplaces/<fuel>/<model>, log sets under /fireplaces/gas/gas-log-set-collections/<indoor|outdoor>/<set>
    sitemap: { origin: 'https://www.heatilator.com', product: /^\/fireplaces\/(gas|wood|outdoor)\/[^/]+(\/[^/]+\/[^/]+)?$/, exclude: /^\/fireplaces\/gas\/gas-log-set-collections$/ },
  },
  'forge-and-flame': { name: 'Forge & Flame', url: 'https://forgenflame.com', fingerprint: ['Forge & Flame', 'Forge and Flame'], hosts: ['forgenflame.com'] },
  // Quadra-Fire, Harman and Vermont Castings share Forge & Flame's Shopify store: /products/<brand>-<model>
  'quadra-fire': {
    url: 'https://forgenflame.com/pages/quadra-fire',
    fingerprint: ['Quadra-Fire'],
    hosts: ['forgenflame.com', 'quadrafire.com'],
    parent: 'forge-and-flame',
    support: { url: 'https://forgenflame.com/pages/product-manuals', fingerprint: ['Manuals'] },
    sitemap: { origin: 'https://forgenflame.com', child: /sitemap_products_/, product: /^\/products\/quadra-fire-/ },
  },
  'vermont-castings': {
    url: 'https://forgenflame.com/pages/vermont-castings',
    fingerprint: ['Vermont Castings'],
    // Forge & Flame's manuals page links the inactive models' owner's manuals on Hearth & Home's download host
    hosts: ['forgenflame.com', 'vermontcastings.com', 'downloads.hearthnhome.com'],
    parent: 'forge-and-flame',
    support: { url: 'https://forgenflame.com/pages/product-manuals', fingerprint: ['Manuals'] },
    sitemap: { origin: 'https://forgenflame.com', child: /sitemap_products_/, product: /^\/products\/vermont-castings-/ },
  },
  harman: {
    url: 'https://forgenflame.com/pages/harman',
    fingerprint: ['Harman'],
    hosts: ['forgenflame.com', 'harmanstoves.com'],
    parent: 'forge-and-flame',
    support: { url: 'https://forgenflame.com/pages/product-manuals', fingerprint: ['Manuals'] },
    sitemap: { origin: 'https://forgenflame.com', child: /sitemap_products_/, product: /^\/products\/harman-/ },
  },
  hearthstone: {
    url: 'https://www.hearthstonestoves.com',
    fingerprint: ['HearthStone'],
    hosts: ['hearthstonestoves.com'],
    support: { url: 'https://www.hearthstonestoves.com/resource/', fingerprint: ['Resources'] },
    // WordPress (Yoast): product-sitemap.xml → /product/<model>
    sitemap: { origin: 'https://www.hearthstonestoves.com', child: /product-sitemap/, product: /^\/product\/[^/]+$/ },
  },
  lopi: {
    url: 'https://www.lopistoves.com',
    fingerprint: ['Lopi'],
    hosts: ['lopistoves.com'],
    support: { url: 'https://www.lopistoves.com/owner-resources/manuals/', fingerprint: ['Manuals'] },
    // One flat sitemap; models at /product/<model>, category pages at /products/…
    sitemap: { origin: 'https://www.lopistoves.com', product: /^\/product\/[^/]+$/ },
  },
  'fireplace-x': {
    url: 'https://www.fireplacex.com',
    fingerprint: ['Fireplace Xtrordinair'],
    hosts: ['fireplacex.com'],
    support: { url: 'https://www.fireplacex.com/owner-resources/manuals/', fingerprint: ['Manuals'] },
    // Same platform as Lopi (Travis Industries): /product/<model>
    sitemap: { origin: 'https://www.fireplacex.com', product: /^\/product\/[^/]+$/ },
  },
  'kozy-heat': {
    url: 'https://www.kozyheat.com',
    fingerprint: ['Kozy Heat'],
    hosts: ['kozyheat.com'],
    support: { url: 'https://www.kozyheat.com/resources/', fingerprint: ['Resources', 'Resource Page'] },
    // WordPress core sitemaps: products-sitemap.xml → /product/<model>; /products/<x> are category pages
    sitemap: { origin: 'https://www.kozyheat.com', child: /products-sitemap/, product: /^\/product\/[^/]+$/ },
  },
  davinci: {
    url: 'https://www.davincifireplace.com',
    fingerprint: ['DaVinci'],
    hosts: ['davincifireplace.com'],
    // Made-to-order configurations: /<collection|series>/<configuration>
    sitemap: { origin: 'https://www.davincifireplace.com', product: /^\/[a-z-]+-(collection|series)\/[^/]+$/, exclude: /\/drawings$/ },
  },
  montigo: {
    url: 'https://www.montigo.com',
    fingerprint: ['Montigo'],
    hosts: ['montigo.com'],
    // Yoast product-sitemap.xml → /product/<model code>
    sitemap: { origin: 'https://www.montigo.com', child: /product-sitemap/, product: /^\/product\/[^/]+$/ },
  },
  monessen: {
    url: 'https://www.monessenhearth.com',
    fingerprint: ['Monessen'],
    hosts: ['monessenhearth.com'],
    support: { url: 'https://www.monessenhearth.com/help-is-here/user-guides-and-manuals', fingerprint: ['User Guides', 'Manuals'] },
    // /fireplaces/<type>/<model>; /fireplaces/<type> alone is a category page
    sitemap: { origin: 'https://www.monessenhearth.com', product: /^\/fireplaces\/[^/]+\/[^/]+$/ },
  },
  empire: {
    url: 'https://www.empirecomfort.com',
    fingerprint: ['Empire'],
    hosts: ['empirecomfort.com', 'empirehearth.com'],
    support: { url: 'https://empirehearth.com/docs/manuals/', fingerprint: ['Manuals'] },
    // empirecomfort.com is the parent company site; the hearth products are on empirehearth.com: /product/<model>
    sitemap: { origin: 'https://empirehearth.com', child: /product-sitemap/, product: /^\/product\/[^/]+$/ },
  },
  'mason-lite': {
    url: 'https://www.mason-lite.com',
    fingerprint: ['Mason-Lite', 'Masonry Fireplace Industries'],
    hosts: ['mason-lite.com'],
    support: { url: 'https://www.mason-lite.com/resources/manuals-specs/', fingerprint: ['Manuals'] },
    // Product lines at /products/<line> (page-sitemap.xml)
    sitemap: { origin: 'https://www.mason-lite.com', child: /page-sitemap/, product: /^\/products\/[^/]+$/ },
  },
  kuma: {
    url: 'https://www.kumastoves.com',
    fingerprint: ['Kuma'],
    hosts: ['kumastoves.com'],
    support: { url: 'https://www.kumastoves.com/Content/Page/manuals', fingerprint: ['Manuals', 'Manual'] },
    // No sitemap — the stove and insert listing pages link each model at /Store/ProductDetails/<model>
    sitemap: {
      origin: 'https://www.kumastoves.com',
      kind: 'listing',
      urls: ['https://www.kumastoves.com/Content/Page/wood-stoves', 'https://www.kumastoves.com/Content/Page/wood-inserts'],
      product: /^\/Store\/ProductDetails\/[^/?#]+$/i,
    },
  },
  hpc: {
    url: 'https://www.hpcfire.com',
    fingerprint: ['HPC'],
    hosts: ['hpcfire.com'],
    support: { url: 'https://hpcfire.com/product-instructions-2-0/', fingerprint: ['Product Instructions'] },
    // WooCommerce /product/<sku>; replacement parts and kits share the path, so they're filtered out by name
    sitemap: {
      origin: 'https://hpcfire.com',
      child: /product-sitemap/,
      product: /^\/product\/[^/]+$/,
      exclude: /(replacement|remote|kit|igniter|ignitor|thermocouple|valve|collar|lava-rock|cover|hose|regulator|switch|adapter|key|fitting|gasket|glass|media|pan|plate|bracket|wire|module|battery|harness|pilot|spark|orifice|manifold|electrode)/,
    },
  },
  dimplex: {
    url: 'https://www.dimplex.com',
    fingerprint: ['Dimplex'],
    hosts: ['dimplex.com'],
    support: { url: 'https://www.dimplex.com/en-us/product-resources', fingerprint: ['Product Resources'] },
    // Product pages at /en-us/electric-fireplaces/<family>/<model>, plus a few flat /en-us/<model> pages
    sitemap: {
      origin: 'https://www.dimplex.com',
      product: /^\/en-us\/(electric-fireplaces\/[^/]+\/[^/]+|(ignite|revillusion|optimyst|opti-myst|vital)[a-z0-9-]*-(fireplace|firebox|log-set|stove))$/,
    },
  },
  hargrove: {
    url: 'https://www.hargrovegaslogs.com',
    fingerprint: ['Hargrove'],
    hosts: ['hargrovegaslogs.com'],
    support: { url: 'https://www.hargrovegaslogs.com/instructions1', fingerprint: ['Instruction Manuals'] },
    // Wix site with every page at the top level: log sets are the pages that aren't parts, kits, instructions or info
    sitemap: {
      origin: 'https://www.hargrovegaslogs.com',
      product: /^\/[a-z0-9-]+$/,
      exclude:
        /^\/(contact|copy-of-.*|.*qr|instructions.*|.*-instructions|homeold|home|dealer.*|dlrf|about.*|faq|sizing-chart|calculator|glass-calculator|alert-page|challenges|\d+|instructionalvideos|accessories-catalog|.*valve.*|.*remote.*|.*burner.*|.*connectors|.*kits?|.*pilot|control-systems.*|.*ignition|woodgrates|grate-facings|coal-baskets|vfcoalbasket|h-tube|full-pan|drop-in|burners|system-4|aei|dei|mei|latchtap.*|millivolt.*|large-sets|rumford-sets|see-thru|firepits|firepit-log-stacks|stainless.*|ember-enhancing-system|pine-cones|radiant-heat|vent-free-radiant-heat|enclosed.*|hargrove-select)$/,
    },
  },
  magrahearth: {
    url: 'https://magrahearth.com',
    fingerprint: ['MagraHearth'],
    hosts: ['magrahearth.com'],
    // Flat site: every top-level page is a product line except the info pages below
    sitemap: { origin: 'https://magrahearth.com', product: /^\/[a-z0-9-]+$/, exclude: /^\/(welcome|about-us|color-guide|literature|artistry-sale|finishes-color|faqs|warranty-disclaimer|thank-you|contact-us)$/ },
  },
  'iron-haus': {
    url: 'https://ironhaus.com',
    fingerprint: ['Ironhaus', 'Iron Haus'],
    hosts: ['ironhaus.com'],
    // Door designs (/rectangular-…-design), door styles (/…-style) and Ironhaus gas fireplaces, all top-level pages
    sitemap: { origin: 'https://ironhaus.com', child: /post-sitemap|product-list-sitemap/, product: /^\/(rectangular-[a-z0-9-]+|[a-z0-9-]+-style(-\d)?|ironhaus-[a-z0-9-]+-fireplace|product-list\/[^/]+)$/ },
  },
  stoll: {
    url: 'https://www.stollindustries.com',
    fingerprint: ['Stoll'],
    hosts: ['stollindustries.com', 'stollfireplace.com'],
    // Door styles at /fireplace-products/fireplace-doors/<style>, other products at /product/<name>
    sitemap: { origin: 'https://www.stollindustries.com', product: /^\/(product|fireplace-products\/fireplace-doors)\/[^/]+$/ },
  },
  'design-specialties': {
    url: 'https://www.designspecialties.com',
    fingerprint: ['Design Specialties'],
    hosts: ['designspecialties.com', 'glassfireplacedoors.com'],
    // Flat site: door and screen models are top-level pages; collections and info pages are excluded
    sitemap: {
      origin: 'https://www.designspecialties.com',
      product: /^\/[A-Za-z0-9-]+$/,
      exclude:
        /^\/(about|contact|collections.*|fountains|dealer-.*|warranty-info|home-old|newpage|benefits-of-glass-fireplace-doors|design-specialties-living|living-shade-factory|electric-fireplaces|outdoor-gas-fireplaces|vent-free-fireplaces|outdoor-wood-fireplaces|vented-gas-logs|vent-free-gas-logs|wood-stoves|fireplace-grates|hearth-craft.*|masonry-fireplace-doors|factory-built-fireplace-doors|corner-multi-sided.*|operable-doors|outdoor-collection|freestandingscreens|refresh-dv-.*|.*-makeover)$/i,
    },
  },
  // Redirects to tkfireside.com, which looks like a rebrand — the checker reports it as moved (to confirm with HMI)
  'thermo-rite': {
    url: 'https://www.thermo-rite.com',
    fingerprint: ['Thermo-Rite', 'TK Fireside'],
    hosts: ['thermo-rite.com', 'tkfireside.com'],
    // tkfireside.com: /doors/<model> and /luxury/<shape>/<model>
    sitemap: { origin: 'https://tkfireside.com', product: /^\/(doors|luxury\/[^/]+)\/[^/]+$/ },
  },
  // Redirects to Westlake Royal Building Products' Cultured Stone pages — reported as moved
  'cultured-stone': {
    url: 'https://www.culturedstone.com',
    fingerprint: ['Cultured Stone'],
    hosts: ['culturedstone.com', 'westlakeroyalbuildingproducts.com'],
    // English pages only: /stone/cultured-stone/<profile>, minus the brand's info pages
    sitemap: {
      origin: 'https://www.westlakeroyalbuildingproducts.com',
      product: /^\/stone\/cultured-stone\/[^/]+$/,
      exclude: /\/(inspiration-overview|warranty-registration|resource-library|faqs|gallery|where-to-buy|our-products|contact-us|give-us-your-feedback|newsletter-subscribe|cultured-stone-bim-library|installation-accessories|electrical-boxes)$/,
    },
  },
  realstone: {
    url: 'https://www.realstonesystems.com',
    fingerprint: ['Realstone'],
    hosts: ['realstonesystems.com'],
    // Yoast product-sitemap.xml → /product/<panel or tile>
    sitemap: { origin: 'https://www.realstonesystems.com', child: /product-sitemap/, product: /^\/product\/[^/]+$/ },
  },
  imperial: {
    url: 'https://www.imperialgroup.ca',
    fingerprint: ['Imperial'],
    hosts: ['imperialgroup.ca'],
    // English product groups under /product/stove-fireplace/<category>/<group> (French pages live under /fr/)
    sitemap: { origin: 'https://www.imperialgroup.ca', product: /^\/product\/stove-fireplace\/[^/]+\/[^/]+$/ },
  },
  'hy-c': {
    url: 'https://www.hy-c.com',
    fingerprint: ['HY-C'],
    hosts: ['hy-c.com'],
    // /<line>-product/<name>; only the hearth lines (not the farm, pest-control or furnace lines)
    sitemap: { origin: 'https://www.hy-c.com', product: /^\/(draft-king|liberty-foundry|shelter|hy-c|flame-genie|gardus)-product\/[^/]+$/ },
  },
  uniflame: {
    url: 'https://www.uniflame.com',
    fingerprint: ['UniFlame'],
    hosts: ['uniflame.com'],
    // WooCommerce product-sitemap.xml → /product/<name>
    sitemap: { origin: 'https://www.uniflame.com', child: /product-sitemap/, product: /^\/product\/[^/]+$/ },
  },
  // Blue Rhino's sitemap lists recipes and articles but no product pages, so there's nothing to watch
  'blue-rhino': { url: 'https://bluerhino.com', fingerprint: ['Blue Rhino'], hosts: ['bluerhino.com'] },
  'stone-county': {
    url: 'https://www.stonecountyironworks.com',
    fingerprint: ['Stone County Ironworks'],
    hosts: ['stonecountyironworks.com'],
    // No individual product pages — the sitemap lists collection pages (/fireplace, /hardware…)
    sitemap: { origin: 'https://www.stonecountyironworks.com', child: /pages-sitemap/, product: /^\/(fireplace|hardware|lighting|home-accents|tables|seating|shelving|beds)$/ },
  },
};

/* ------------------------------------------------------------------------------------------------ */
/* Tools                                                                                             */
/* ------------------------------------------------------------------------------------------------ */

export const tools: Tool[] = [
  {
    slug: 'travis-firebuilder',
    label: 'FireBuilder by Travis Industries',
    brand: 'lopi',
    url: 'https://firebuilder.travisindustries.com/embed/oH4CL2-I/',
    fingerprint: ['Firebuilder'],
    hosts: ['firebuilder.travisindustries.com'],
  },
];

/* ------------------------------------------------------------------------------------------------ */
/* Models                                                                                            */
/* ------------------------------------------------------------------------------------------------ */

const shows = (osageBeach: number, nixa: number): Record<StoreSlug, number> => ({ 'osage-beach': osageBeach, nixa });
const on = (url: string, note?: string, date = CHECKED) => ({ url, on: date, ...(note ? { note } : {}) });

export const products: Product[] = [
  /* ----- Heat & Glo ----- */
  {
    id: 'HG-MEZZO48',
    slug: 'heat-glo-mezzo-48',
    brand: 'heat-glo',
    model: 'Mezzo 48',
    type: 'Linear gas fireplace',
    category: 'gas-fireplaces',
    fuel: 'gas',
    status: 'current',
    url: 'https://www.heatnglo.com/fireplaces/gas/indoor/mezzo-gas-fireplace',
    fingerprint: ['Mezzo'],
    specs: [
      { label: 'Heat input', value: '40,000 BTU/hr' },
      { label: 'Viewing area', value: '47-1/2″ × 12-1/2″' },
      { label: 'Venting', value: 'Direct vent' },
      { label: 'Framing', value: '60-1/4″ W × 42″ H × 18-1/4″ D' },
      { label: 'Sizes', value: '36″, 48″, 60″ and 72″' },
    ],
    verified: on('https://www.heatnglo.com/fireplaces/gas/indoor/mezzo-gas-fireplace', 'Series page; specs are from the “Mezzo 48 Rev C” column.'),
    display: shows(1, 1),
    summary: 'A 48-inch linear gas fireplace with a long ribbon of flame — one of four Mezzo widths.',
  },
  {
    id: 'HG-ESC-I35',
    slug: 'heat-glo-escape-35',
    brand: 'heat-glo',
    model: 'Escape-35',
    type: 'Gas fireplace insert',
    category: 'fireplace-inserts',
    fuel: 'gas',
    status: 'current',
    url: 'https://www.heatnglo.com/fireplaces/gas/inserts/escape-gas-fireplace-insert',
    fingerprint: ['Escape'],
    specs: [
      { label: 'Heat input', value: '40,000 BTU/hr (natural gas)' },
      { label: 'Viewing area', value: '31-3/8″ × 19-7/8″' },
      { label: 'Venting', value: 'Direct vent' },
      { label: 'Fits openings', value: '35-1/8″ wide at the front, 25-1/2″ at the back, 24-5/8″ high, 18-1/8″ deep' },
      { label: 'Sizes', value: '30″ and 35″' },
    ],
    verified: on('https://www.heatnglo.com/fireplaces/gas/inserts/escape-gas-fireplace-insert', 'Catalog listed the “Escape-I35” (Heat & Glo’s earlier I-35-F designation); the current model is the Escape-35.'),
    display: shows(1, 0),
    summary: 'Heat & Glo’s 35-inch gas insert — a direct-vent firebox that slides into an existing masonry fireplace.',
  },
  {
    id: 'HG-TWILIGHT',
    slug: 'heat-glo-twilight-modern',
    brand: 'heat-glo',
    model: 'Twilight Modern',
    type: 'See-through indoor/outdoor gas fireplace',
    category: 'outdoor-fireplaces',
    alsoIn: ['gas-fireplaces'],
    fuel: 'gas',
    status: 'current',
    url: 'https://www.heatnglo.com/fireplaces/gas/see-through/twilight-modern-gas-fireplace',
    fingerprint: ['Twilight Modern'],
    specs: [
      { label: 'Heat input', value: '38,000 BTU/hr (natural gas)' },
      { label: 'Viewing area', value: '35-5/8″ × 21-1/2″' },
      { label: 'Installation', value: 'Indoor/outdoor, see-through' },
      { label: 'Venting', value: 'Direct vent' },
      { label: 'Framing', value: '44″ W × 47-5/8″ H × 23″ D' },
    ],
    verified: on('https://www.heatnglo.com/fireplaces/gas/see-through/twilight-modern-gas-fireplace'),
    display: shows(0, 0),
    summary: 'A see-through gas fireplace that sits in an outside wall, so the same fire warms the living room and the porch.',
  },
  {
    id: 'HG-6000C',
    slug: 'heat-glo-6000c',
    brand: 'heat-glo',
    model: '6000C',
    type: 'Direct-vent gas fireplace',
    category: 'gas-fireplaces',
    fuel: 'gas',
    status: 'discontinued',
    url: 'https://downloads.hearthnhome.com/installManuals/2502_981-6000CIFT_8000CIFT-owner.pdf',
    linkLabel: 'Owner’s manual (PDF)',
    fingerprint: ['6000C'],
    specs: [
      { label: 'Heat input', value: '30,000 BTU/hr natural gas, 29,000 BTU/hr propane (up to 2,000 ft)' },
      { label: 'Venting', value: 'Direct vent' },
    ],
    verified: on('https://downloads.hearthnhome.com/installManuals/2502_981-6000CIFT_8000CIFT-owner.pdf', 'No longer on heatnglo.com; documented in Heat & Glo’s owner’s manual (6000C-IFT). Heat & Glo doesn’t name a replacement.'),
    display: shows(0, 0),
    summary: 'Heat & Glo’s 6000C is no longer made. HMI still services 6000C fireplaces and can track down parts.',
  },
  {
    id: 'HG-SL750',
    slug: 'heat-glo-sl-750trs',
    brand: 'heat-glo',
    model: 'SL-750TRS-IPI',
    type: 'Direct-vent gas fireplace',
    category: 'gas-fireplaces',
    fuel: 'gas',
    status: 'discontinued',
    url: 'https://downloads.hearthnhome.com/installManuals/2120_901.pdf',
    linkLabel: 'Owner’s manual (PDF)',
    fingerprint: ['SL-750'],
    specs: [
      { label: 'Heat input', value: '30,800 BTU/hr natural gas, 30,700 BTU/hr propane (up to 2,000 ft)' },
      { label: 'Venting', value: 'Direct vent' },
      { label: 'Glass', value: '5 mm ceramic' },
    ],
    verified: on('https://downloads.hearthnhome.com/installManuals/2120_901.pdf', 'No longer on heatnglo.com (the SlimLine series now lists other models); documented in the SL-750TRS-IPI-E owner’s manual.'),
    display: shows(0, 0),
    summary: 'The SlimLine SL-750TRS is no longer made. HMI still services it and can find parts.',
  },

  {
    id: 'HG-HERITAGE-OAK',
    slug: 'heat-glo-heritage-oak',
    brand: 'heat-glo',
    model: 'Heritage Oak',
    type: 'Vented gas log set',
    category: 'gas-logs',
    fuel: 'gas',
    status: 'current',
    url: 'https://www.heatnglo.com/fireplaces/gas/gas-log-set-collections/indoor/heritage-oak-gas-log-set',
    fingerprint: ['Heritage Oak'],
    specs: [
      { label: 'Sizes', value: '18″, 24″ and 30″' },
      { label: 'Venting', value: 'Vented' },
      { label: 'Burner', value: 'Two- or three-tier stadium burner' },
      { label: 'Ignition', value: 'Battery-powered electronic, by remote' },
      { label: 'Logs', value: 'Hand-painted oak' },
    ],
    verified: on('https://www.heatnglo.com/fireplaces/gas/gas-log-set-collections/indoor/heritage-oak-gas-log-set', 'The page has no spec table; these come from its overview, features and options.', ADDED),
    display: shows(1, 1),
    summary: 'Hand-painted oak logs on a tiered burner, started from a remote: the look of a wood fire without hauling logs or ashes.',
  },

  {
    id: 'HG-PIONEER3',
    slug: 'heat-glo-pioneer-iii',
    brand: 'heat-glo',
    model: 'Pioneer III',
    type: 'Wood-burning fireplace',
    category: 'wood-fireplaces',
    fuel: 'wood',
    status: 'current',
    url: 'https://www.heatnglo.com/fireplaces/wood/indoor/pioneer-iii',
    fingerprint: ['Pioneer III'],
    specs: [
      { label: 'Heating area', value: '1,200–3,000 sq ft' },
      { label: 'Firebox', value: '4.1 cu ft' },
      { label: 'Log length', value: 'Up to 24″' },
      { label: 'Viewing area', value: '341 sq in' },
      { label: 'Certification', value: 'EPA 2020' },
      { label: 'Heat zones', value: 'Up to two optional ducts to other rooms' },
    ],
    verified: on('https://www.heatnglo.com/fireplaces/wood/indoor/pioneer-iii', 'From the page’s Specs tab (28″ model) and features. Heatilator sells the same unit as its Pioneer III.', ADDED),
    display: shows(1, 0),
    summary: 'A big EPA-certified wood fireplace built to heat, with room for 24-inch logs and optional ducts that carry warmth to other rooms.',
  },

  /* ----- Heatilator ----- */
  {
    id: 'HTL-ICON100',
    slug: 'heatilator-icon-50',
    brand: 'heatilator',
    model: 'Icon 50',
    type: 'Open wood-burning fireplace',
    category: 'wood-fireplaces',
    fuel: 'wood',
    status: 'current',
    url: 'https://www.heatilator.com/fireplaces/wood/icon-series-open-wood-fireplace',
    fingerprint: ['Icon Series', 'Icon'],
    specs: [
      { label: 'Opening', value: '50″ × 33″' },
      { label: 'Unit size', value: '60-5/8″ W × 70-1/2″ H × 29-1/2″ D' },
      { label: 'Framing', value: '61-5/8″ W × 71″ H × 30-1/2″ D' },
      { label: 'Burns', value: 'Real wood, or a gas log set' },
      { label: 'Interior', value: 'Traditional or herringbone brick' },
    ],
    verified: on('https://www.heatilator.com/fireplaces/wood/icon-series-open-wood-fireplace', 'HMI’s catalog listed the Icon 100; Heatilator now lists Icon 36, 42 and 50, and its Icon I100 and Icon 50 architect guides show the same unit (to confirm).'),
    display: shows(0, 0),
    summary: 'A big open-hearth wood fireplace with a 50-inch opening — the traditional fire, crackle and all.',
  },
  {
    id: 'HTL-CNXT36',
    slug: 'heatilator-caliber-nxt-36',
    brand: 'heatilator',
    model: 'Caliber nXt 36',
    type: 'Direct-vent gas fireplace',
    category: 'gas-fireplaces',
    fuel: 'gas',
    status: 'discontinued',
    url: 'https://downloads.hearthnhome.com/installManuals/2515_981-CNXT4236IFT_CNXT4842IFT-owner.pdf',
    linkLabel: 'Owner’s manual (PDF)',
    fingerprint: ['Caliber nXt'],
    specs: [
      { label: 'Heat input', value: '40,000 BTU/hr natural gas, 34,500 BTU/hr propane (up to 2,000 ft)' },
      { label: 'Venting', value: 'Direct vent' },
      { label: 'Glass', value: '5 mm ceramic' },
    ],
    verified: on('https://downloads.hearthnhome.com/installManuals/2515_981-CNXT4236IFT_CNXT4842IFT-owner.pdf', 'No longer on heatilator.com; documented in the Caliber nXt 36 (CNXT4236IFT) owner’s manual. Heatilator doesn’t name a replacement — its manuals list the current Caliber as a separate model.'),
    display: shows(0, 0),
    summary: 'Heatilator’s Caliber nXt 36 is no longer made. HMI still services Caliber nXt fireplaces and can find parts.',
  },

  {
    id: 'HTL-NOVUS36',
    slug: 'heatilator-novus-nxt-36',
    brand: 'heatilator',
    model: 'Novus nXt 36',
    type: 'Direct-vent gas fireplace',
    category: 'gas-fireplaces',
    fuel: 'gas',
    status: 'current',
    url: 'https://www.heatilator.com/fireplaces/gas/novus-nxt-gas-fireplace',
    fingerprint: ['Novus nXt'],
    specs: [
      { label: 'Heat input', value: '31,000 BTU/hr' },
      { label: 'Viewing area', value: '36″ × 22-5/8″' },
      { label: 'Venting', value: 'Direct vent' },
      { label: 'Glass', value: 'Ceramic' },
      { label: 'Controls', value: 'IntelliFire Touch remote or wireless wall switch' },
      { label: 'Sizes', value: '33″ and 36″' },
    ],
    verified: on('https://www.heatilator.com/fireplaces/gas/novus-nxt-gas-fireplace', 'Specs from the Novus nXt 36 column of the page’s Specs tab.', ADDED),
    display: shows(1, 0),
    summary: 'A 36-inch direct-vent gas fireplace with a taller, traditional opening and a touchscreen remote.',
  },

  /* ----- Monessen ----- */
  {
    id: 'MON-ART42',
    slug: 'monessen-artisan-42',
    brand: 'monessen',
    model: 'Artisan 42',
    type: 'Vent-free gas fireplace',
    category: 'vent-free-gas',
    alsoIn: ['gas-fireplaces'],
    fuel: 'gas',
    status: 'current',
    url: 'https://www.monessenhearth.com/fireplaces/vent-free-gas-fireplaces/artisan',
    fingerprint: ['Artisan'],
    specs: [
      { label: 'Heat input', value: 'Up to 34,000 BTU/hr natural gas, 33,000 BTU/hr propane' },
      { label: 'Viewing area', value: '42″ × 17″' },
      { label: 'Venting', value: 'Vent-free' },
      { label: 'Efficiency', value: '99.9%' },
      { label: 'Framing', value: '46-5/8″ W × 39-3/4″ H × 13-1/8″ D' },
      { label: 'Sizes', value: '42″, 48″, 60″ and 72″' },
    ],
    verified: on('https://www.monessenhearth.com/fireplaces/vent-free-gas-fireplaces/artisan', 'Series page; specs are from the “Artisan 42 IFT 2.0” column.'),
    display: shows(1, 0),
    summary: 'A vent-free gas fireplace that needs no chimney or vent pipe, so nearly all of its heat stays in the room.',
  },

  {
    id: 'MON-BEACH24',
    slug: 'monessen-beachcomber-24',
    brand: 'monessen',
    model: 'Beachcomber 24',
    type: 'Vent-free gas log set',
    category: 'gas-logs',
    alsoIn: ['vent-free-gas'],
    fuel: 'gas',
    status: 'current',
    url: 'https://www.monessenhearth.com/fireplaces/vent-free-gas-log-sets/beachcomber',
    fingerprint: ['Beachcomber'],
    specs: [
      { label: 'Heat input', value: '37,000 BTU/hr natural gas, 36,000 BTU/hr propane' },
      { label: 'Heating area', value: 'Up to 1,850 sq ft' },
      { label: 'Venting', value: 'Vent-free' },
      { label: 'Ignition', value: 'Millivolt or IPI' },
      { label: 'Burner', value: 'Natural Blaze' },
      { label: 'Sizes', value: '18″, 24″ and 30″' },
    ],
    verified: on('https://www.monessenhearth.com/fireplaces/vent-free-gas-log-sets/beachcomber', 'Specs from the 24″ column of the page’s Specs tab.', ADDED),
    display: shows(1, 0),
    summary: 'A vent-free log set that needs no chimney or vent pipe. The 24-inch size heats rooms up to about 1,850 square feet.',
  },
  {
    id: 'MON-COTTAGE36',
    slug: 'monessen-cottagewood-36',
    brand: 'monessen',
    model: 'Cottagewood 36',
    type: 'Outdoor wood-burning fireplace',
    category: 'outdoor-fireplaces',
    fuel: 'wood',
    status: 'current',
    url: 'https://www.monessenhearth.com/fireplaces/outdoor-fireplaces/cottagewood',
    fingerprint: ['Cottagewood'],
    specs: [
      { label: 'Viewing area', value: '36″ × 28-1/2″' },
      { label: 'Framing', value: '45-1/2″ W × 59-3/4″ H × 28″ D' },
      { label: 'Interior', value: 'Traditional or herringbone brick panels' },
      { label: 'Sizes', value: '36″, 42″ and 50″' },
    ],
    verified: on('https://www.monessenhearth.com/fireplaces/outdoor-fireplaces/cottagewood', 'Specs from the 36″ column of the page’s Specs tab.', ADDED),
    display: shows(0, 1),
    summary: 'An open-hearth outdoor fireplace for real log fires on a patio or porch, with a brick-pattern firebox in three widths.',
  },

  {
    id: 'MON-ARIA36',
    slug: 'monessen-aria-36',
    brand: 'monessen',
    model: 'Aria 36',
    type: 'Vent-free gas fireplace',
    category: 'vent-free-gas',
    fuel: 'gas',
    status: 'current',
    url: 'https://www.monessenhearth.com/fireplaces/vent-free-gas-fireplaces/aria',
    fingerprint: ['Aria'],
    specs: [
      { label: 'Heat input', value: '37,000 BTU/hr natural gas, 36,000 BTU/hr propane' },
      { label: 'Viewing area', value: '36″ × 21-3/4″ (783 sq in)' },
      { label: 'Framing', value: '41-1/4″ W × 35″ H × 17-1/2″ D' },
      { label: 'Venting', value: 'Vent-free' },
      { label: 'Ignition', value: 'Millivolt or IPI' },
      { label: 'Sizes', value: '32″ and 36″' },
    ],
    verified: on('https://www.monessenhearth.com/fireplaces/vent-free-gas-fireplaces/aria', 'Specs from the Aria 36 column of the page’s Specs tab.', ADDED),
    display: shows(0, 1),
    summary: 'A clean-lined vent-free fireplace with a wide 36-inch window, for a room with no chimney or vent run.',
  },

  /* ----- Fireplace Xtrordinair ----- */
  {
    id: 'FPX-PB42',
    slug: 'fireplace-x-probuilder-42-linear',
    brand: 'fireplace-x',
    model: 'ProBuilder 42 Linear Deluxe',
    type: 'Linear gas fireplace',
    category: 'gas-fireplaces',
    fuel: 'gas',
    status: 'current',
    url: 'https://www.fireplacex.com/product/probuilder-42-linear-deluxe/',
    fingerprint: ['ProBuilder 42 Linear'],
    specs: [
      { label: 'Heat input', value: '13,000–25,000 BTU/hr, natural gas or propane' },
      { label: 'Heating area', value: 'Up to 1,250 sq ft' },
      { label: 'Efficiency', value: 'Up to 76.11% steady-state (natural gas), 77.31% (propane)' },
      { label: 'Viewing area', value: '40-3/8″ × 13-5/8″ tempered glass (548 sq in)' },
      { label: 'Weight', value: '165 lb' },
    ],
    verified: on('https://www.fireplacex.com/product/probuilder-42-linear-deluxe/', 'HMI’s catalog called it the “ProBuilder 42 Linear GSR2”; Fireplace Xtrordinair lists the remote-control version as the Deluxe.'),
    display: shows(0, 0),
    summary: 'A 42-inch linear gas fireplace from Fireplace Xtrordinair’s ProBuilder line, sized for rooms up to about 1,250 square feet.',
  },
  {
    id: 'FPX-42APEX',
    slug: 'fireplace-x-42-apex',
    brand: 'fireplace-x',
    model: '42 Apex NexGen-Hybrid',
    type: 'Wood-burning fireplace',
    category: 'wood-fireplaces',
    fuel: 'wood',
    status: 'current',
    url: 'https://www.fireplacex.com/product/42-apex/',
    fingerprint: ['42 Apex'],
    specs: [
      { label: 'Heating area', value: 'Up to 2,500 sq ft' },
      { label: 'Burn time', value: 'Up to 12 hours' },
      { label: 'Firebox', value: '3.5 cu ft' },
      { label: 'Log length', value: '24″' },
      { label: 'Efficiency', value: 'Up to 77.2%' },
      { label: 'Emissions', value: '1.2 g/hr (crib wood)' },
      { label: 'Viewing area', value: '25-5/8″ × 12-7/8″ ceramic glass' },
    ],
    verified: on('https://www.fireplacex.com/product/42-apex/', 'Catalog listed the “42 Apex Clean-Face”; the current 42 Apex is the NexGen-Hybrid (the 2017–2021 Clean Face is in Fireplace Xtrordinair’s discontinued manuals).'),
    display: shows(1, 0),
    summary: 'A large, closed-door wood fireplace built for real heating — a 3.5 cubic foot firebox that takes 24-inch logs.',
  },
  {
    id: 'FPX-616GSR2',
    slug: 'fireplace-x-616-deluxe',
    brand: 'fireplace-x',
    model: '616 Deluxe Ember-Glo',
    type: 'Gas fireplace insert',
    category: 'fireplace-inserts',
    fuel: 'gas',
    status: 'current',
    url: 'https://www.fireplacex.com/product/616-gsr/',
    fingerprint: ['616 Deluxe'],
    specs: [
      { label: 'Heat input', value: 'Up to 39,000 BTU/hr, natural gas or propane' },
      { label: 'Heating area', value: 'Up to 2,000 sq ft' },
      { label: 'Efficiency', value: 'Up to 84.94% steady-state (natural gas), 86.75% (propane)' },
      { label: 'Viewing area', value: '27-1/2″ × 19-3/4″ ceramic glass (542 sq in)' },
    ],
    verified: on('https://www.fireplacex.com/product/616-gsr/', 'Catalog listed the “616 GSR2 Grand Deluxe”; no Grand version is listed — the current model is the 616 Deluxe Ember-Glo.'),
    display: shows(1, 0),
    summary: 'A big-view gas insert for large masonry fireplaces, rated to heat up to 2,000 square feet.',
  },

  /* ----- Lopi ----- */
  {
    id: 'LOPI-DVL',
    slug: 'lopi-34-dvl',
    brand: 'lopi',
    model: '34 DVL Deluxe Ember-Glo',
    type: 'Gas fireplace insert',
    category: 'fireplace-inserts',
    fuel: 'gas',
    status: 'current',
    url: 'https://www.lopistoves.com/product/34-dvl-deluxe-ember-glo/',
    fingerprint: ['34 DVL'],
    specs: [
      { label: 'Heat input', value: 'Up to 40,000 BTU/hr, natural gas or propane' },
      { label: 'Heating area', value: 'Up to 2,000 sq ft' },
      { label: 'Efficiency', value: 'Up to 82.17% steady-state (natural gas), 83.81% (propane)' },
      { label: 'Viewing area', value: '27″ × 16-1/8″ ceramic glass (437 sq in)' },
    ],
    verified: on('https://www.lopistoves.com/product/34-dvl-deluxe-ember-glo/', 'Catalog listed the “DVL GS2”; Lopi’s current DVL insert is the 34 DVL Deluxe Ember-Glo.'),
    display: shows(0, 1),
    summary: 'Lopi’s large gas insert for turning an existing fireplace into a steady heat source — up to 40,000 BTU/hr.',
  },
  {
    id: 'LOPI-ANSWER',
    slug: 'lopi-answer',
    brand: 'lopi',
    model: 'Answer NexGen-Hybrid',
    type: 'Wood stove',
    category: 'wood-stoves',
    fuel: 'wood',
    status: 'current',
    url: 'https://www.lopistoves.com/product/answer-nexgen-hybrid/',
    fingerprint: ['Answer NexGen-Hybrid'],
    specs: [
      { label: 'Heat output', value: '12,500–60,000 BTU (cord wood)' },
      { label: 'Heating area', value: 'Up to 1,400 sq ft' },
      { label: 'Firebox', value: '1.4 cu ft' },
      { label: 'Log length', value: 'Up to 18″' },
      { label: 'Burn time', value: 'Up to 8 hours' },
      { label: 'Efficiency', value: 'Up to 80% (HHV)' },
      { label: 'Emissions', value: '1.4 g/hr (cord wood)' },
    ],
    verified: on('https://www.lopistoves.com/product/answer-nexgen-hybrid/', 'Catalog listed the Answer NexGen-Fyre stove (Lopi: 2019–2024); the current Answer stove is the NexGen-Hybrid.'),
    display: shows(0, 1),
    summary: 'A compact steel wood stove for cabins, basements and smaller homes, rated for up to 1,400 square feet.',
  },
  {
    id: 'LOPI-NORTHFIELD',
    slug: 'lopi-northfield',
    brand: 'lopi',
    model: 'Northfield GSR2',
    type: 'Cast iron gas stove',
    category: 'gas-stoves',
    fuel: 'gas',
    status: 'current',
    url: 'https://www.lopistoves.com/product/northfield/',
    fingerprint: ['Northfield'],
    specs: [
      { label: 'Heat input', value: 'Up to 22,000 BTU/hr, natural gas or propane' },
      { label: 'Heating area', value: 'Up to 850 sq ft' },
      { label: 'Efficiency', value: 'Up to 79.96% steady-state (natural gas), 81.37% (propane)' },
      { label: 'Viewing area', value: '282 sq in ceramic glass (front and sides)' },
      { label: 'Venting', value: '6-5/8″ co-axial' },
      { label: 'Weight', value: '130 lb' },
    ],
    verified: on('https://www.lopistoves.com/product/northfield/', 'Catalog listed the “Northfield GS2” (Lopi: 2012–2015); the current model is the Northfield GSR2.'),
    display: shows(0, 1),
    summary: 'A classic cast iron gas stove with glass on three sides — sized for a single room or small home.',
  },

  {
    id: 'LOPI-AGP',
    slug: 'lopi-agp',
    brand: 'lopi',
    model: 'AGP',
    type: 'Pellet stove',
    category: 'pellet-stoves',
    fuel: 'pellet',
    status: 'current',
    url: 'https://www.lopistoves.com/product/agp-pellet-stove/',
    fingerprint: ['AGP'],
    specs: [
      { label: 'Hopper', value: '80 lb' },
      { label: 'Burn time', value: 'Up to 57 hours' },
      { label: 'Viewing area', value: '14-3/8″ × 9-1/4″ (127 sq in)' },
      { label: 'Venting', value: '3″' },
      { label: 'Emissions', value: '1.8 g/hr' },
    ],
    verified: on(
      'https://www.lopistoves.com/product/agp-pellet-stove/',
      'Lopi’s current manuals list the AGP (2021 – current). Its heating area and efficiency are marked “not tested … for similar pellet heaters”, so they’re left out.',
      ADDED,
    ),
    display: shows(0, 1),
    summary: 'A steel pellet stove with an 80-pound hopper and burn times of up to 57 hours between fills.',
  },

  /* ----- Harman, Quadra-Fire and Vermont Castings (Forge & Flame) ----- */
  {
    id: 'HAR-ACC52I',
    slug: 'harman-accentra52i-tc',
    brand: 'harman',
    model: 'Accentra52i-TC',
    type: 'Pellet fireplace insert',
    category: 'fireplace-inserts',
    alsoIn: ['pellet-stoves'],
    fuel: 'pellet',
    status: 'current',
    url: 'https://forgenflame.com/products/harman-accentra-52i-tc-pellet-fireplace-insert',
    fingerprint: ['Accentra52i'],
    specs: [
      { label: 'Heat output', value: '50,300 BTU/hr' },
      { label: 'Heating area', value: 'Up to 2,600 sq ft' },
      { label: 'Hopper', value: 'Up to 64.5 lb of pellets' },
    ],
    verified: on('https://forgenflame.com/products/harman-accentra-52i-tc-pellet-fireplace-insert', 'Harman’s current version is the Accentra52i-TC; the earlier Accentra52i is listed as inactive.'),
    display: shows(0, 1),
    summary: 'A pellet insert that fits an existing fireplace and holds up to 64.5 pounds of pellets for long, even heat.',
  },
  {
    id: 'HAR-P43',
    slug: 'harman-pathfinder-p43',
    brand: 'harman',
    model: 'Pathfinder P43',
    type: 'Pellet stove',
    category: 'pellet-stoves',
    fuel: 'pellet',
    status: 'current',
    url: 'https://forgenflame.com/products/harman-p43-pellet-stove',
    fingerprint: ['P43'],
    specs: [
      { label: 'Heat output', value: 'Up to 45,200 BTU/hr' },
      { label: 'Heating area', value: 'Up to 2,400 sq ft' },
      { label: 'Hopper', value: '50 lb' },
      { label: 'Efficiency', value: 'LHV 82.7%, HHV 76.7%' },
      { label: 'Emissions', value: '1.82 g/hr' },
      { label: 'Dimensions', value: '22″ W × 33-1/2″ H × 28-5/16″ D' },
    ],
    verified: on('https://forgenflame.com/products/harman-p43-pellet-stove'),
    display: shows(1, 1),
    summary: 'A freestanding pellet stove with a 50-pound hopper, rated to heat up to 2,400 square feet.',
  },
  {
    id: 'QF-3100M',
    slug: 'quadra-fire-3100-millennium',
    brand: 'quadra-fire',
    model: '3100 Millennium',
    type: 'Wood stove',
    category: 'wood-stoves',
    fuel: 'wood',
    status: 'current',
    url: 'https://forgenflame.com/products/quadra-fire-3100-millennium-wood-stove',
    fingerprint: ['3100 Millennium'],
    specs: [
      { label: 'Heat output', value: '51,000 BTU/hr' },
      { label: 'Heating area', value: 'Up to 2,600 sq ft' },
      { label: 'Firebox', value: '1.9 cu ft' },
      { label: 'Log length', value: '16″ recommended' },
      { label: 'Burn time', value: 'Up to 10 hours per load' },
      { label: 'Efficiency', value: 'LHV 78%, HHV 73%' },
      { label: 'Emissions', value: '1.9 g/hr' },
    ],
    verified: on('https://forgenflame.com/products/quadra-fire-3100-millennium-wood-stove'),
    display: shows(0, 0),
    summary: 'The middle size of Quadra-Fire’s Millennium wood stoves, with up to ten hours of burn time from a load.',
  },
  {
    id: 'QF-CASTILE',
    slug: 'quadra-fire-castile-pellet-insert',
    brand: 'quadra-fire',
    model: 'Castile Pellet Insert',
    type: 'Pellet fireplace insert',
    category: 'fireplace-inserts',
    alsoIn: ['pellet-stoves'],
    fuel: 'pellet',
    status: 'discontinued',
    // No longer sold — this is Forge & Flame's use-and-care page for it, which owners still need
    url: 'https://forgenflame.com/pages/quadra-fire-use-and-care-videos-castile-pellet-insert',
    fingerprint: ['Castile'],
    specs: [],
    verified: on('https://forgenflame.com/pages/product-manuals', 'Forge & Flame lists the Castile Pellet Insert’s manuals under Inactive Products and no longer sells it. No replacement is named.'),
    display: shows(0, 0),
    summary: 'Quadra-Fire’s Castile pellet insert is no longer made. HMI still services Castile inserts and can find parts.',
  },
  {
    id: 'VC-DEFIANT',
    slug: 'vermont-castings-defiant',
    brand: 'vermont-castings',
    model: 'Defiant',
    type: 'Cast iron wood stove',
    category: 'wood-stoves',
    fuel: 'wood',
    status: 'current',
    url: 'https://forgenflame.com/products/vermont-castings-defiant-wood-stove',
    fingerprint: ['Defiant'],
    specs: [
      { label: 'Heat output', value: '56,000 BTU/hr' },
      { label: 'Heating area', value: 'Up to 2,600 sq ft' },
      { label: 'Efficiency', value: 'LHV 84%, HHV 78%' },
      { label: 'Emissions', value: '1.3 g/hr' },
      { label: 'Dimensions', value: '32-3/8″ W × 28-7/8″ H × 23-3/4″ D' },
    ],
    verified: on('https://forgenflame.com/products/vermont-castings-defiant-wood-stove'),
    display: shows(1, 1),
    summary: 'Vermont Castings’ big cast iron wood stove — up to 56,000 BTU/hr for homes up to 2,600 square feet.',
  },
  {
    id: 'VC-RADIANCE',
    slug: 'vermont-castings-radiance',
    brand: 'vermont-castings',
    model: 'Radiance Direct Vent',
    type: 'Cast iron gas stove',
    category: 'gas-stoves',
    fuel: 'gas',
    status: 'current',
    url: 'https://forgenflame.com/products/vermont-castings-radiance-direct-vent-gas-stove',
    fingerprint: ['Radiance'],
    specs: [
      { label: 'Heat input', value: '25,000–38,000 BTU/hr' },
      { label: 'Heating area', value: 'Up to 1,700 sq ft' },
      { label: 'Venting', value: 'Direct vent' },
      { label: 'Dimensions', value: '31″ W × 28″ H × 18-1/4″ D' },
    ],
    verified: on('https://forgenflame.com/products/vermont-castings-radiance-direct-vent-gas-stove'),
    display: shows(1, 0),
    summary: 'An all-cast-iron gas stove that vents straight through a wall, so it can go where there’s no chimney.',
  },

  {
    id: 'VC-ENCORE',
    slug: 'vermont-castings-encore',
    brand: 'vermont-castings',
    model: 'Encore',
    type: 'Cast iron wood stove',
    category: 'wood-stoves',
    fuel: 'wood',
    status: 'current',
    url: 'https://forgenflame.com/products/vermont-castings-encore-flexburn-wood-stove',
    fingerprint: ['Encore'],
    specs: [
      { label: 'Heat output', value: '48,000 BTU/hr' },
      { label: 'Heating area', value: 'Up to 2,200 sq ft' },
      { label: 'Efficiency', value: 'LHV 83%, HHV 77%' },
      { label: 'Emissions', value: '1.1 g/hr' },
    ],
    verified: on('https://forgenflame.com/products/vermont-castings-encore-flexburn-wood-stove', 'Sold as the “Encore Wood-Burning Stove”; the address still says FlexBurn, an earlier version listed with the inactive products’ manuals.', ADDED),
    display: shows(1, 1),
    summary: 'Vermont Castings’ classic cast iron wood stove, rated to heat homes up to about 2,200 square feet.',
  },
  {
    id: 'VC-RESOLUTE',
    slug: 'vermont-castings-resolute-acclaim',
    brand: 'vermont-castings',
    model: 'Resolute Acclaim',
    type: 'Cast iron wood stove',
    category: 'wood-stoves',
    fuel: 'wood',
    status: 'discontinued',
    url: 'https://downloads.hearthnhome.com/installmanuals/2000893_Res_Acclaim_31.pdf',
    linkLabel: 'Owner’s manual (PDF)',
    fingerprint: ['Resolute Acclaim'],
    specs: [
      { label: 'Heating area', value: 'Up to 1,600 sq ft' },
      { label: 'Firebox', value: '1.6 cu ft' },
      { label: 'Log length', value: 'Up to 18″' },
      { label: 'Loading', value: 'Front and top' },
      { label: 'Efficiency', value: '72.1% (tested)' },
      { label: 'Emissions', value: '3.4 g/hr (EPA certified)' },
    ],
    verified: on(
      'https://downloads.hearthnhome.com/installmanuals/2000893_Res_Acclaim_31.pdf',
      'No longer in Vermont Castings’ range; Forge & Flame’s manuals page lists it under inactive products and links this owner’s manual (model 2490, rev. R33, 05/17). Vermont Castings doesn’t name a replacement.',
      ADDED,
    ),
    display: shows(0, 0),
    summary: 'Vermont Castings no longer makes the Resolute Acclaim. HMI still services Resolute Acclaim stoves and can track down parts.',
  },
  {
    id: 'QF-OUTFITTER2',
    slug: 'quadra-fire-outfitter-ii',
    brand: 'quadra-fire',
    model: 'Outfitter II',
    type: 'Pellet stove',
    category: 'pellet-stoves',
    fuel: 'pellet',
    status: 'current',
    url: 'https://forgenflame.com/products/quadra-fire-outfitter-ii-pellet-stove',
    fingerprint: ['Outfitter II'],
    specs: [
      { label: 'Heat output', value: '49,200 BTU/hr' },
      { label: 'Heating area', value: 'Up to 2,300 sq ft' },
      { label: 'Hopper', value: '130 lb' },
      { label: 'Efficiency', value: 'LHV 88%, HHV 82%' },
      { label: 'Emissions', value: '0.53 g/hr' },
    ],
    verified: on('https://forgenflame.com/products/quadra-fire-outfitter-ii-pellet-stove', undefined, ADDED),
    display: shows(1, 1),
    summary: 'A pellet stove with an extra-large 130-pound hopper, so it needs filling less often. Sized for homes up to about 2,300 square feet.',
  },
  {
    id: 'HAR-ABS43',
    slug: 'harman-absolute43',
    brand: 'harman',
    model: 'Absolute43',
    type: 'Pellet stove',
    category: 'pellet-stoves',
    fuel: 'pellet',
    status: 'current',
    url: 'https://forgenflame.com/products/harman-absolute-43-pellet-stove',
    fingerprint: ['Absolute43'],
    specs: [
      { label: 'Heat output', value: '44,200 BTU/hr' },
      { label: 'Heating area', value: 'Up to 2,400 sq ft' },
      { label: 'Hopper', value: '52 lb' },
      { label: 'Viewing area', value: '106-11/16 sq in' },
      { label: 'Efficiency', value: 'LHV 82%, HHV 77%' },
      { label: 'Emissions', value: '0.99 g/hr' },
    ],
    verified: on('https://forgenflame.com/products/harman-absolute-43-pellet-stove', undefined, ADDED),
    display: shows(1, 0),
    summary: 'A compact Harman pellet stove that heats homes up to about 2,400 square feet from a 52-pound hopper.',
  },
  {
    id: 'QF-EXP2',
    slug: 'quadra-fire-expedition-ii',
    brand: 'quadra-fire',
    model: 'Expedition II',
    type: 'Wood fireplace insert',
    category: 'fireplace-inserts',
    fuel: 'wood',
    status: 'current',
    url: 'https://forgenflame.com/products/quadra-fire-expedition-ii-wood-fireplace-insert',
    fingerprint: ['Expedition II'],
    specs: [
      { label: 'Heat output', value: '56,000 BTU/hr' },
      { label: 'Heating area', value: 'Up to 2,400 sq ft' },
      { label: 'Viewing area', value: '275 sq in' },
      { label: 'Efficiency', value: 'LHV 77%, HHV 71%' },
      { label: 'Emissions', value: '1.9 g/hr' },
    ],
    verified: on('https://forgenflame.com/products/quadra-fire-expedition-ii-wood-fireplace-insert', 'Named “Expedition II Wood Insert” on the page.', ADDED),
    display: shows(1, 0),
    summary: 'A wood-burning insert that turns an open fireplace into a real heat source, with a large glass door. Rated for up to 2,400 square feet.',
  },

  /* ----- HearthStone ----- */
  {
    id: 'HS-CLYDESDALE',
    slug: 'hearthstone-clydesdale',
    brand: 'hearthstone',
    model: 'Clydesdale',
    type: 'Wood fireplace insert',
    category: 'fireplace-inserts',
    fuel: 'wood',
    status: 'current',
    url: 'https://www.hearthstonestoves.com/product/clydesdale/',
    fingerprint: ['Clydesdale'],
    specs: [
      { label: 'Heat (BTU)', value: 'Up to 60,000 BTU' },
      { label: 'Heating area', value: 'Up to 2,000 sq ft' },
      { label: 'Firebox', value: '2.4 cu ft, soapstone lined' },
      { label: 'Log length', value: 'Up to 22″' },
      { label: 'Heat life', value: '24 hours of heat' },
      { label: 'Efficiency', value: '79%' },
      { label: 'Fits openings', value: 'At least 32-1/2″ W × 23-1/4″ H × 13″ D' },
    ],
    verified: on('https://www.hearthstonestoves.com/product/clydesdale/', 'HearthStone model 8492. The page’s feature list mentions 24-inch logs; its spec list says 22″ — the spec list is used.'),
    display: shows(0, 0),
    summary: 'A cast iron wood insert with a soapstone-lined firebox, made to turn an open fireplace into a real heater.',
  },
  {
    id: 'HS-CASTLETON',
    slug: 'hearthstone-castleton',
    brand: 'hearthstone',
    model: 'Castleton',
    type: 'Soapstone wood stove',
    category: 'wood-stoves',
    fuel: 'wood',
    status: 'current',
    url: 'https://www.hearthstonestoves.com/product/castleton/',
    fingerprint: ['Castleton'],
    specs: [
      { label: 'Model number', value: '8031' },
      { label: 'Heat (BTU)', value: 'Up to 45,000 BTU' },
      { label: 'Firebox', value: '1.9 cu ft (19″ wide × 17″ deep)' },
      { label: 'Log length', value: 'Up to 18″' },
      { label: 'Heat life', value: '20 hours of heat' },
      { label: 'Efficiency', value: '77.3%' },
    ],
    verified: on('https://www.hearthstonestoves.com/product/castleton/', 'HMI’s catalog listed it as the Castleton 8030; HearthStone’s current model number is 8031.'),
    display: shows(1, 0),
    summary: 'A soapstone wood stove that stores the fire’s heat in stone and gives it back slowly, long after the flames die down.',
  },

  {
    id: 'HS-BARI-GAS',
    slug: 'hearthstone-bari-gas',
    brand: 'hearthstone',
    model: 'Bari Gas',
    type: 'Direct-vent gas stove',
    category: 'gas-stoves',
    fuel: 'gas',
    status: 'current',
    url: 'https://www.hearthstonestoves.com/product/bari-gas/',
    fingerprint: ['Bari Gas'],
    specs: [
      { label: 'Heat input', value: '13,500–23,000 BTU/hr (natural gas), 13,000–23,000 BTU/hr (propane)' },
      { label: 'Heating area', value: 'Up to 1,200 sq ft' },
      { label: 'Venting', value: 'Direct vent, 4″ × 6-5/8″, top exit' },
      { label: 'Efficiency', value: '74.4% natural gas, 78.3% propane (steady state)' },
      { label: 'Remote', value: '7-day programmable, included' },
    ],
    verified: on('https://www.hearthstonestoves.com/product/bari-gas/', 'HearthStone model 8181; the page calls the gas input “Burn Rate”.', ADDED),
    display: shows(1, 0),
    summary: 'A modern round gas stove with a programmable remote, sized for a smaller home or one main living area.',
  },

  {
    id: 'HS-WFP100',
    slug: 'hearthstone-wfp-100',
    brand: 'hearthstone',
    model: 'WFP-100',
    type: 'Wood-burning fireplace',
    category: 'wood-fireplaces',
    fuel: 'wood',
    status: 'current',
    url: 'https://www.hearthstonestoves.com/product/wfp-100/',
    fingerprint: ['WFP-100', 'WFP 100'],
    specs: [
      { label: 'Heat output', value: 'Up to 95,000 BTU' },
      { label: 'Heating area', value: 'Up to 2,800 sq ft' },
      { label: 'Firebox', value: '4.28 cu ft' },
      { label: 'Log length', value: 'Up to 25″' },
      { label: 'Efficiency', value: '64% (HHV)' },
      { label: 'Emissions', value: '1.6 g/hr (EPA certified)' },
      { label: 'Blower', value: 'Included' },
    ],
    verified: on('https://www.hearthstonestoves.com/product/wfp-100/', undefined, ADDED),
    display: shows(0, 1),
    summary: 'A large zero-clearance wood fireplace that takes 25-inch logs and heats up to about 2,800 square feet, blower included.',
  },

  /* ----- Kuma ----- */
  {
    id: 'KUMA-ASPEN',
    slug: 'kuma-aspen-le',
    brand: 'kuma',
    model: 'Aspen LE-1',
    type: 'Wood stove',
    category: 'wood-stoves',
    fuel: 'wood',
    status: 'current',
    url: 'https://www.kumastoves.com/Store/ProductDetails/aspen-le',
    fingerprint: ['Aspen LE'],
    specs: [
      { label: 'Heat output', value: '63,000 BTU cordwood (29,153 BTU EPA estimate)' },
      { label: 'Heating area', value: '1,800 sq ft' },
      { label: 'Firebox', value: '1.8 cu ft' },
      { label: 'Log length', value: '16″' },
      { label: 'Burn time', value: '9 hours' },
      { label: 'Efficiency', value: '78% HHV, 84% LHV' },
      { label: 'Emissions', value: '1.08 g/hr' },
    ],
    verified: on('https://www.kumastoves.com/Store/ProductDetails/aspen-le', 'Catalog listed the “Aspen LE”; Kuma now sells the Aspen LE-1 and lists the 2020 Aspen LE as out of production.'),
    display: shows(0, 1),
    summary: 'A hand-built steel wood stove from Kuma, rated for about 1,800 square feet with a nine-hour burn.',
  },

  /* ----- Kozy Heat ----- */
  {
    id: 'KH-CHASKA34',
    slug: 'kozy-heat-chaska-34',
    brand: 'kozy-heat',
    model: 'Chaska 34',
    type: 'Gas fireplace insert',
    category: 'fireplace-inserts',
    fuel: 'gas',
    status: 'current',
    url: 'https://www.kozyheat.com/product/chaska34-gas-fireplace-inserts/',
    fingerprint: ['Chaska 34'],
    specs: [
      { label: 'Heat input', value: '34,000 BTU/hr, natural gas or propane' },
      { label: 'Efficiency', value: '75% AFUE (natural gas), 77% (propane)' },
      { label: 'Viewing area', value: '29-7/8″ × 17-1/2″' },
      { label: 'Venting', value: 'Co-linear, 3″ combustion air / 3″ exhaust' },
      { label: 'Ignition', value: 'Electronic (intermittent pilot)' },
      { label: 'Media', value: 'Logs or glass' },
    ],
    verified: on('https://www.kozyheat.com/product/chaska34-gas-fireplace-inserts/', 'HMI’s catalog filed the Chaska 34 as a gas fireplace; Kozy Heat sells it as a gas insert.'),
    display: shows(0, 1),
    summary: 'A gas insert from Minnesota’s Kozy Heat that turns a drafty fireplace into a 34,000 BTU/hr heater, with logs or glass.',
  },
  {
    id: 'KH-CALLAWAY50',
    slug: 'kozy-heat-callaway-50',
    brand: 'kozy-heat',
    model: 'Callaway 50',
    type: 'Linear gas fireplace',
    category: 'gas-fireplaces',
    fuel: 'gas',
    status: 'current',
    url: 'https://www.kozyheat.com/product/callaway-50/',
    fingerprint: ['Callaway 50'],
    specs: [
      { label: 'Heat input', value: '18,000–35,500 BTU/hr, natural gas or propane' },
      { label: 'Efficiency', value: '66.50% AFUE (natural gas), 63.97% (propane)' },
      { label: 'Viewing area', value: '49-7/8″ × 13-3/8″' },
      { label: 'Ignition', value: 'IPI or millivolt' },
    ],
    verified: on('https://www.kozyheat.com/product/callaway-50/'),
    display: shows(0, 1),
    summary: 'A 50-inch linear gas fireplace with a long, low flame and plenty of styling options.',
  },

  /* ----- Empire (Empire Hearth) ----- */
  {
    id: 'EMP-TAHOE36',
    slug: 'empire-tahoe-premium-36',
    brand: 'empire',
    model: 'Tahoe Premium 36',
    type: 'Direct-vent gas fireplace',
    category: 'gas-fireplaces',
    fuel: 'gas',
    status: 'current',
    url: 'https://empirehearth.com/product/tahoe-premium/',
    fingerprint: ['Tahoe Premium'],
    specs: [
      { label: 'Heat', value: 'Up to 27,000 BTU' },
      { label: 'Viewing area', value: '36″ × 25-1/16″' },
      { label: 'Venting', value: 'Direct vent, 4″ × 6-5/8″' },
      { label: 'Ignition', value: 'Standing pilot or electronic' },
      { label: 'Sizes', value: '36″, 42″ and 48″' },
    ],
    verified: on('https://empirehearth.com/product/tahoe-premium/', 'Empire’s hearth products moved from empirecomfort.com to empirehearth.com. Specs are from the 36″ column.'),
    display: shows(0, 0),
    summary: 'A traditional direct-vent gas fireplace in three widths; the 36-inch is a good fit for most living rooms.',
  },
  {
    id: 'EMP-BLVD48',
    slug: 'empire-boulevard-linear-48',
    brand: 'empire',
    model: 'Boulevard Linear 48',
    type: 'Linear direct-vent gas fireplace',
    category: 'gas-fireplaces',
    fuel: 'gas',
    status: 'current',
    url: 'https://empirehearth.com/product/boulevard-linear-direct-vent/',
    fingerprint: ['Boulevard Linear'],
    specs: [
      { label: 'Heat', value: 'Up to 34,000 BTU' },
      { label: 'Viewing area', value: '48″ × 13″' },
      { label: 'Venting', value: 'Direct vent, 4″ × 6-5/8″' },
      { label: 'Ignition', value: 'Electronic' },
      { label: 'Sizes', value: '36″, 48″, 60″ and 72″' },
    ],
    verified: on('https://empirehearth.com/product/boulevard-linear-direct-vent/', 'Specs are from the 48″ column of the direct-vent page; Empire also makes a vent-free Boulevard (to confirm which HMI carries).'),
    display: shows(1, 0),
    summary: 'A contemporary linear gas fireplace in four widths; the 48-inch suits a wall-mounted TV above.',
  },
  {
    id: 'EMP-CRO42',
    slug: 'empire-carol-rose-premium-42',
    brand: 'empire',
    model: 'Carol Rose Premium 42',
    type: 'Outdoor gas fireplace',
    category: 'outdoor-fireplaces',
    fuel: 'gas',
    status: 'current',
    url: 'https://empirehearth.com/product/carol-rose-premium/',
    fingerprint: ['Carol Rose Premium'],
    specs: [
      { label: 'Heat', value: 'Up to 50,000 BTU' },
      { label: 'Viewing area', value: '40″ × 24-1/4″' },
      { label: 'Style', value: 'Traditional, square opening' },
      { label: 'Ignition', value: 'Standing pilot or electronic' },
      { label: 'Logs', value: 'Outdoor Wildwood log set (required)' },
      { label: 'Liner', value: 'Refractory liner included' },
    ],
    verified: on('https://empirehearth.com/product/carol-rose-premium/', 'Specs are from the 42″ column; the page also lists a 36″ model.'),
    display: shows(1, 0),
    summary: 'A traditional outdoor gas fireplace for covered porches and patios, with a refractory liner and outdoor log set.',
  },

  {
    id: 'EMP-SPIRIT-CI',
    slug: 'empire-spirit-cast-iron-dv',
    brand: 'empire',
    model: 'Spirit Cast Iron DV',
    type: 'Cast iron direct-vent gas stove',
    category: 'gas-stoves',
    fuel: 'gas',
    status: 'current',
    url: 'https://empirehearth.com/product/spirit-cast-iron-dv/',
    fingerprint: ['Spirit Cast Iron DV'],
    specs: [
      { label: 'Sizes', value: 'Small and medium' },
      { label: 'Heat output', value: 'Up to 19,500 BTU (small), 26,500 BTU (medium)' },
      { label: 'Venting', value: 'Direct vent, 4″ × 6-5/8″' },
      { label: 'Ignition', value: 'Standing pilot or electronic' },
    ],
    verified: on('https://empirehearth.com/product/spirit-cast-iron-dv/', 'One table for both sizes; Empire gives no heating area.', ADDED),
    display: shows(0, 1),
    summary: 'A traditional cast iron gas stove in two sizes that vents straight outside — a cozy fit for a den, bedroom or cabin.',
  },

  {
    id: 'EMP-FLINT24',
    slug: 'empire-flint-hill-24',
    brand: 'empire',
    model: 'Flint Hill 24',
    type: 'Vent-free gas log set',
    category: 'gas-logs',
    alsoIn: ['vent-free-gas'],
    fuel: 'gas',
    status: 'current',
    url: 'https://empirehearth.com/product/flint-hill/',
    fingerprint: ['Flint Hill'],
    specs: [
      { label: 'Heat', value: '34,000 BTU max' },
      { label: 'Venting', value: 'Vent-free' },
      { label: 'Sizes', value: '18″, 24″ and 30″' },
      { label: 'Logs', value: 'Hand-painted ceramic, included' },
      { label: 'Style', value: 'Traditional' },
    ],
    verified: on('https://empirehearth.com/product/flint-hill/', 'Specs from the 24″ column. Empire’s log-set list also tags it vented, but its spec table says vent-free for every size.', ADDED),
    display: shows(0, 1),
    summary: 'A traditional vent-free log set with hand-painted ceramic logs, in 18, 24 and 30-inch widths.',
  },

  {
    id: 'EMP-VAIL36',
    slug: 'empire-vail-premium-36',
    brand: 'empire',
    model: 'Vail Premium 36',
    type: 'Vent-free gas fireplace',
    category: 'vent-free-gas',
    fuel: 'gas',
    status: 'current',
    url: 'https://empirehearth.com/product/vail-premium/',
    fingerprint: ['Vail Premium'],
    specs: [
      { label: 'Heat output', value: 'Up to 36,000 BTU' },
      { label: 'Viewing area', value: '36″ × 24-1/4″' },
      { label: 'Venting', value: 'Vent-free' },
      { label: 'Ignition', value: 'Standing pilot or electronic' },
      { label: 'Sizes', value: '24″, 32″ and 36″' },
    ],
    verified: on('https://empirehearth.com/product/vail-premium/', 'Specs from the 36″ column; Empire prints the viewing area height first.', ADDED),
    display: shows(1, 0),
    summary: 'A traditional vent-free fireplace with a tall, square opening; the 36-inch is the largest of its three sizes.',
  },
  {
    id: 'EMP-SLIM30',
    slug: 'empire-boulevard-linear-slim-line-30',
    brand: 'empire',
    model: 'Boulevard Linear Slim Line 30',
    type: 'Linear vent-free gas fireplace',
    category: 'vent-free-gas',
    fuel: 'gas',
    status: 'current',
    url: 'https://empirehearth.com/product/boulevard-linear-slim-line/',
    fingerprint: ['Boulevard Linear Slim Line'],
    specs: [
      { label: 'Heat output', value: 'Up to 14,000 BTU' },
      { label: 'Viewing area', value: '28-3/8″ × 11-3/4″' },
      { label: 'Venting', value: 'Vent-free' },
      { label: 'Ignition', value: 'Electronic' },
      { label: 'Sizes', value: '30″ only' },
    ],
    verified: on('https://empirehearth.com/product/boulevard-linear-slim-line/', 'The vent-free Slim Line, not the direct-vent Boulevard Linear 48.', ADDED),
    display: shows(1, 1),
    summary: 'A slim, modern 30-inch linear fireplace that needs no vent, sized for a bedroom, office or den.',
  },

  /* ----- Dimplex ----- */
  {
    id: 'DIM-RBF42',
    slug: 'dimplex-revillusion-42-firebox',
    brand: 'dimplex',
    model: 'Revillusion 42″ Built-In Firebox',
    type: 'Built-in electric firebox',
    category: 'electric-fireplaces',
    fuel: 'electric',
    status: 'current',
    url: 'https://www.dimplex.com/en-us/flame/built-in-fireboxes/revillusion-42in-built-in-firebox-black',
    fingerprint: ['Revillusion 42'],
    specs: [
      { label: 'Size', value: '42″ wide, 31″ high' },
      { label: 'Heating area', value: 'Up to 1,000 sq ft (fan-forced heat)' },
      { label: 'Heater', value: '1,300–2,575 W (4,436–8,786 BTU)' },
      { label: 'Power', value: 'Plug-in or hardwired; 120, 208 or 240 V' },
    ],
    verified: on('https://www.dimplex.com/en-us/flame/built-in-fireboxes/revillusion-42in-built-in-firebox-black', 'Specs are from the Black finish (REV42-BL); the 42″ also comes in Herringbone, Weathered Concrete and Neutral Brick.'),
    display: shows(1, 1),
    summary: 'A 42-inch built-in electric firebox for framing into a wall or mantel — flame with or without heat, no venting.',
  },
  {
    id: 'DIM-XLF60',
    slug: 'dimplex-ignite-xl-60',
    brand: 'dimplex',
    model: 'Ignite XL 60″',
    type: 'Linear electric fireplace',
    category: 'electric-fireplaces',
    fuel: 'electric',
    status: 'current',
    url: 'https://www.dimplex.com/en-us/ignite-xl-60in-linear-electric-fireplace',
    fingerprint: ['Ignite XL 60'],
    specs: [
      { label: 'Size', value: '61.27″ W × 16.5″ H × 5.75″ D' },
      { label: 'Heating area', value: 'Up to 1,000 sq ft (Ignite XL series)' },
      { label: 'Heater', value: '1,500–2,500 W (5,118–8,530 BTU)' },
      { label: 'Power', value: 'Plug-in or hardwired; 120 or 240 V' },
    ],
    verified: on('https://www.dimplex.com/en-us/ignite-xl-60in-linear-electric-fireplace', 'Heating area is stated on the Ignite XL series page, not the 60″ page.'),
    display: shows(0, 1),
    summary: 'A 60-inch linear electric fireplace that recesses into a wall — no chimney, gas line or venting required.',
  },
  {
    id: 'DIM-OMC1000',
    slug: 'dimplex-optimyst-pro-1000-cassette',
    brand: 'dimplex',
    model: 'Opti-myst Pro 1000 Cassette',
    type: 'Water-vapor electric fireplace cassette',
    category: 'electric-fireplaces',
    fuel: 'electric',
    // Not confirmed: Dimplex's site only mentions the 40″ cassette (CDFI1000-PRO) in passing and lists the 20″ as the
    // current cassette. Kept off the public site until HMI confirms it can still be ordered.
    status: 'hidden',
    url: 'https://www.dimplex.com/en-us/optimyst-cassette-vapor-fireplace-0',
    fingerprint: ['Optimyst Cassette'],
    specs: [{ label: 'Length', value: '40″' }],
    verified: on('https://www.dimplex.com/en-us/optimyst-cassette-vapor-fireplace-0', 'Only mentioned on the 20″ Optimyst Cassette page; no product page of its own. Confirm with Dimplex.'),
    display: shows(0, 0),
    summary: 'Dimplex’s 40-inch Optimyst water-vapor cassette.',
  },

  {
    id: 'DIM-PRISM50',
    slug: 'dimplex-prism-50',
    brand: 'dimplex',
    model: 'Prism 50″',
    type: 'Linear electric fireplace',
    category: 'electric-fireplaces',
    fuel: 'electric',
    status: 'current',
    url: 'https://www.dimplex.com/en-us/prism-50-linear-electric-fireplace',
    fingerprint: ['Prism 50'],
    specs: [
      { label: 'Dimensions', value: '50.38″ W × 19.5″ H × 7.13″ D' },
      { label: 'Heater', value: '1,230 W (4,197 BTU)' },
      { label: 'Heating area', value: 'Up to 1,000 sq ft (supplemental)' },
      { label: 'Power', value: '120 V, plug-in or hard-wired' },
      { label: 'Installation', value: 'Recessed, partly recessed or wall-mounted' },
      { label: 'Sizes', value: '34″, 50″ and 74″' },
    ],
    verified: on('https://www.dimplex.com/en-us/prism-50-linear-electric-fireplace', 'Specs for the 50″ (BLF5051); Dimplex draws its spec table in the browser, and the figures match the linked sell sheet.', ADDED),
    display: shows(1, 1),
    summary: 'A mid-size linear electric fireplace with color themes and a fan heater: recess it in a wall or hang it on one.',
  },
  {
    id: 'DIM-NOVA33',
    slug: 'dimplex-nova-33',
    brand: 'dimplex',
    model: 'Nova 33″ Plug-In Firebox',
    type: 'Plug-in electric firebox',
    category: 'electric-fireplaces',
    fuel: 'electric',
    status: 'current',
    url: 'https://www.dimplex.com/en-us/nova-33-plug-in-electric-firebox',
    fingerprint: ['Nova 33'],
    specs: [
      { label: 'Dimensions', value: '33″ W × 23.18″ H × 7.5″ D' },
      { label: 'Heater', value: '1,465 W (5,000 BTU)' },
      { label: 'Heating area', value: 'Up to 1,000 sq ft (supplemental)' },
      { label: 'Power', value: '120 V plug-in' },
      { label: 'Media', value: 'Acrylic crystal ember bed' },
      { label: 'Sizes', value: '23″, 26″, 28″ and 33″' },
    ],
    verified: on('https://www.dimplex.com/en-us/nova-33-plug-in-electric-firebox', 'Specs for the 33″ crystal model (XHD33G); Dimplex draws its spec table in the browser, and the figures match the linked spec sheet.', ADDED),
    display: shows(1, 0),
    summary: 'A plug-in firebox that slides into an existing fireplace opening or a mantel and only needs an outlet.',
  },

  /* ----- Hargrove ----- */
  {
    id: 'HRG-OAK24',
    slug: 'hargrove-classic-oak',
    brand: 'hargrove',
    model: 'Classic Oak',
    type: 'Vented gas log set',
    category: 'gas-logs',
    fuel: 'gas',
    status: 'current',
    url: 'https://www.hargrovegaslogs.com/classic-oak-1',
    fingerprint: ['Classic Oak'],
    specs: [
      { label: 'Sizes', value: '15″, 18″, 24″ and 30″' },
      { label: 'Venting', value: 'Vented (Fresh Cut Series)' },
      { label: 'Styles', value: 'Single-sided and see-through sets' },
      { label: 'Burners', value: 'E-Burner, H-Burner, Hidden Controls and System 4 kits' },
    ],
    verified: on('https://www.hargrovegaslogs.com/classic-oak-1', 'Hargrove has two Classic Oak pages: /classic-oak-1 is the vented set, /classic-oak the vent-free one.'),
    display: shows(1, 1),
    summary: 'A hand-painted oak log set for an existing wood-burning fireplace, in four widths for single-sided or see-through fireplaces.',
  },

  /* ----- HPC Fire ----- */
  {
    id: 'HPC-FP30',
    slug: 'hpc-round-flat-fire-pit-insert',
    brand: 'hpc',
    model: 'Round Flat Fire Pit Insert',
    type: 'Gas fire pit insert',
    category: 'outdoor-fireplaces',
    fuel: 'gas',
    status: 'current',
    url: 'https://hpcfire.com/product/round-flat-inserts/',
    fingerprint: ['Round Flat Inserts', 'Round Flat Insert'],
    specs: [
      { label: 'Sizes', value: '8″ to 54″, including 30″' },
      { label: 'Ignition', value: 'Match lit (small-tank option available)' },
      { label: 'Certification', value: 'CSA certified' },
      { label: 'Burner', value: 'Standard or torpedo' },
    ],
    verified: on('https://hpcfire.com/product/round-flat-inserts/', 'HMI’s catalog says “30 in. fire pit insert, match-lit” without a shape; HPC offers 30″ match-lit inserts as round flat, square flat and square bowl. Round flat is used here — to confirm.'),
    display: shows(1, 0),
    summary: 'A drop-in gas burner insert for building a fire pit into a patio or outdoor kitchen, from 8 to 54 inches across.',
  },

  /* ----- Mason-Lite ----- */
  {
    id: 'MASON-MFP44',
    slug: 'mason-lite-mfp44',
    brand: 'mason-lite',
    model: 'MFP44',
    type: 'Masonry fireplace kit',
    category: 'wood-fireplaces',
    fuel: 'wood',
    status: 'current',
    url: 'https://www.mason-lite.com/products/traditional/',
    fingerprint: ['Traditional'],
    specs: [
      { label: 'Opening', value: '41″ W × 30-1/2″ H × 21-1/2″ D' },
      { label: 'Footprint', value: '48″ × 28″, 62-1/4″ tall' },
      { label: 'Flue', value: '12″ ID Class A chimney' },
      { label: 'Clearance', value: '2″ to combustibles at the sides and back' },
      { label: 'Sizes', value: '33″, 39″, 44″, 49″, 63″ and 75″, plus a 43″ see-through' },
      { label: 'Testing', value: 'UL 127 (PFS TECO)' },
    ],
    verified: on('https://www.mason-lite.com/products/traditional/', 'Mason-Lite has one page for its Traditional kits; the MFP44 figures are from the product catalog it links (v10, January 2026, page 22).', ADDED),
    display: shows(0, 0),
    summary: 'A precast masonry fireplace kit that goes up on site in sections, then gets your choice of brick, stone and mantel.',
  },

  /* ----- Montigo ----- */
  {
    id: 'MTG-P42DF',
    slug: 'montigo-phenom-p42df',
    brand: 'montigo',
    model: 'Phenom P42DF',
    type: 'Direct-vent gas fireplace',
    category: 'gas-fireplaces',
    fuel: 'gas',
    status: 'current',
    url: 'https://www.montigo.com/product/p42df/',
    fingerprint: ['P42DF', 'Phenom'],
    specs: [
      { label: 'Heat input', value: '32,000 BTU/hr (natural gas)' },
      { label: 'Glass opening', value: '39-1/2″ × 20-1/4″' },
      { label: 'Venting', value: 'Direct vent' },
      { label: 'Framing', value: '42″ W × 42″ H × 21-7/8″ D' },
      { label: 'Liner', value: 'Black porcelain' },
    ],
    verified: on('https://www.montigo.com/product/p42df/', 'The full-featured Phenom; “direct vent” is from the page’s description.', ADDED),
    display: shows(0, 1),
    summary: 'A modern single-sided gas fireplace with a wide glass front and a black porcelain liner; the remote, fans and battery backup are standard.',
  },
  {
    id: 'MTG-PL42VO',
    slug: 'montigo-mahana-42',
    brand: 'montigo',
    model: 'Mahana 42',
    type: 'Ventless outdoor gas fireplace',
    category: 'outdoor-fireplaces',
    fuel: 'gas',
    status: 'current',
    url: 'https://www.montigo.com/product/pl42vo/',
    fingerprint: ['PL42VO', 'Mahana'],
    specs: [
      { label: 'Heat input', value: '28,000 BTU/hr (natural gas)' },
      { label: 'Glass opening', value: '37-1/4″ × 14-1/8″' },
      { label: 'Venting', value: 'Ventless' },
      { label: 'Framing', value: '42″ W × 27-1/4″ H × 11-5/8″ D' },
      { label: 'Construction', value: '304 stainless steel' },
    ],
    verified: on('https://www.montigo.com/product/pl42vo/', 'Model PL42VO.', ADDED),
    display: shows(1, 0),
    summary: 'A shallow ventless gas fireplace for a covered patio or porch wall: stainless steel, about 11-5/8 inches deep.',
  },

  /* ----- Mantels, doors, stone and accessories ----- */
  {
    id: 'MAG-MANTEL60',
    slug: 'magrahearth-chiseled-stone',
    brand: 'magrahearth',
    model: 'Chiseled Stone',
    type: 'Mantel shelf',
    category: 'mantels-surrounds',
    status: 'current',
    url: 'https://magrahearth.com/products/chiseled-stone-chi',
    fingerprint: ['Chiseled Stone'],
    specs: [
      { label: 'Sizes', value: '60″ or 72″ W × 5-1/4″ H × 9″ D' },
      { label: 'Colors', value: 'Buff, grey, graphite or ebony' },
      { label: 'Weight', value: '85–100 lb' },
      { label: 'Finish', value: 'Hand-finished, so each piece is unique' },
      { label: 'Accessories', value: 'Matching corbels' },
    ],
    verified: on('https://magrahearth.com/products/chiseled-stone-chi', 'MagraHearth’s product page (CHI); the same-named gallery page has no sizes.', ADDED),
    display: shows(1, 0),
    summary: 'A stone-look mantel shelf in 5- and 6-foot lengths and four muted colors, with matching corbels.',
  },
  {
    id: 'MAG-NAT',
    slug: 'magrahearth-natural-wood',
    brand: 'magrahearth',
    model: 'Natural Wood',
    type: 'Mantel shelf',
    category: 'mantels-surrounds',
    status: 'current',
    url: 'https://magrahearth.com/products/natural-wood-nat',
    fingerprint: ['Natural Wood'],
    specs: [
      { label: 'Sizes', value: '48″, 60″ or 72″ W × 5-1/4″ H × 8″ D' },
      { label: 'Colors', value: 'Brown, silver, graphite, whitewash, ebony, espresso or wheat' },
      { label: 'Weight', value: '60–90 lb' },
      { label: 'Custom lengths', value: 'Longer spans with decorative straps' },
    ],
    verified: on('https://magrahearth.com/products/natural-wood-nat', 'MagraHearth’s product page (NAT).', ADDED),
    display: shows(0, 1),
    summary: 'A wood-look mantel shelf in three lengths and seven finishes, with corbels and decorative straps to match.',
  },
  {
    id: 'MAG-PBS',
    slug: 'magrahearth-post-beam-surround',
    brand: 'magrahearth',
    model: 'Post & Beam Surround',
    type: 'Fireplace surround',
    category: 'mantels-surrounds',
    status: 'current',
    url: 'https://magrahearth.com/products/post-beam-surround-pbs',
    fingerprint: ['Post & Beam Surround'],
    specs: [
      { label: 'Includes', value: 'A beam and two posts (filler kit and hearth boards sold separately)' },
      { label: 'Sizes', value: 'Beam 78″ × 8″ × 9″; posts 54″ × 8″ × 8″' },
      { label: 'Colors', value: 'Brown, silver, graphite, whitewash, ebony, espresso or wheat' },
    ],
    verified: on('https://magrahearth.com/products/post-beam-surround-pbs', 'MagraHearth’s product page (PBS).', ADDED),
    display: shows(1, 0),
    summary: 'A three-piece beam-and-post surround that frames the whole fireplace in a timber look.',
  },
  {
    id: 'STOLL-BF36',
    slug: 'stoll-original',
    brand: 'stoll',
    model: 'Original',
    type: 'Glass fireplace doors',
    category: 'fireplace-doors',
    status: 'current',
    url: 'https://www.stollindustries.com/fireplace-products/fireplace-doors/original/',
    fingerprint: ['Original Collection'],
    specs: [
      { label: 'Material', value: '14-gauge steel' },
      { label: 'Doors', value: 'Bi-fold or cabinet' },
      { label: 'Frame', value: '3/4″ deep × 2″ wide (customizable)' },
      { label: 'Glass', value: 'Grey, clear, bronze or pyroceramic' },
      { label: 'Finish', value: 'Powder coat, including matte black' },
    ],
    verified: on('https://www.stollindustries.com/fireplace-products/fireplace-doors/original/', 'A collection page: Stoll makes its doors to order and lists no fixed sizes.', ADDED),
    display: shows(1, 0),
    summary: 'Stoll’s classic framed steel doors, made to order as bi-fold or cabinet doors with a choice of glass and finishes.',
  },
  {
    id: 'DS-CAROLINA',
    slug: 'design-specialties-carolina',
    brand: 'design-specialties',
    model: 'Carolina',
    type: 'Glass fireplace doors',
    category: 'fireplace-doors',
    status: 'current',
    url: 'https://www.designspecialties.com/carolina',
    fingerprint: ['Carolina'],
    specs: [
      { label: 'Build', value: 'One piece of laser-cut steel, made to your opening' },
      { label: 'Fits', value: 'Masonry and zero-clearance fireplaces' },
      { label: 'Doors', value: 'Bi-fold or cabinet' },
      { label: 'Finishes', value: 'More than 25' },
      { label: 'Style', value: 'Transitional' },
    ],
    verified: on('https://www.designspecialties.com/carolina', 'Made to order, so no fixed sizes are listed.', ADDED),
    display: shows(0, 1),
    summary: 'A clean-lined steel door cut from a single piece and made to fit your opening, for masonry or zero-clearance fireplaces.',
  },
  {
    id: 'TR-HERITAGE',
    slug: 'thermo-rite-heritage',
    brand: 'thermo-rite',
    model: 'Heritage',
    type: 'Masonry fireplace doors',
    category: 'fireplace-doors',
    status: 'current',
    url: 'https://tkfireside.com/doors/heritage',
    fingerprint: ['Heritage'],
    specs: [
      { label: 'Frame', value: 'Laser-cut steel, self-aligning hinges' },
      { label: 'Fit', value: 'Inside or overlapping the opening' },
      { label: 'Sizes', value: 'Up to 44″ × 31″ or 50″ × 39″' },
      { label: 'Glass', value: 'Clear, grey or bronze' },
      { label: 'Finishes', value: 'Textured black or natural iron; premium finishes too' },
    ],
    verified: on('https://tkfireside.com/doors/heritage', 'Thermo-Rite is now TK Fireside. The sizes, glass and finishes are the same on its Reserve and Cameo pages.', ADDED),
    display: shows(0, 1),
    summary: 'A laser-cut steel door for brick and stone fireplaces that fits inside the opening or overlaps its face.',
  },
  {
    id: 'CS-SLEDGE',
    slug: 'cultured-stone-southern-ledgestone',
    brand: 'cultured-stone',
    model: 'Southern Ledgestone',
    type: 'Manufactured stone veneer',
    category: 'cultured-stone',
    status: 'current',
    url: 'https://www.westlakeroyalbuildingproducts.com/stone/cultured-stone/southern-ledgestone-veneer',
    fingerprint: ['Southern Ledgestone'],
    specs: [
      { label: 'Pieces', value: '1/2″–6″ high, 4″–20″ long, 1″–2-5/8″ thick' },
      { label: 'Corners', value: '4″–12″ returns' },
      { label: 'Installation', value: 'Tight-fitted or mortared' },
      { label: 'Material', value: 'Lightweight concrete' },
      { label: 'Look', value: 'Rough, irregular ledge' },
    ],
    verified: on('https://www.westlakeroyalbuildingproducts.com/stone/cultured-stone/southern-ledgestone-veneer', 'Colors are chosen on the page with a picker that the page builds in the browser, so they aren’t listed here.', ADDED),
    display: shows(1, 1),
    summary: 'A rugged, irregular stacked-ledge stone for fireplace walls, set tight or with mortar joints.',
  },
  {
    id: 'CS-ALPINE',
    slug: 'cultured-stone-pro-fit-alpine-ledgestone',
    brand: 'cultured-stone',
    model: 'Pro-Fit Alpine Ledgestone',
    type: 'Manufactured stone veneer',
    category: 'cultured-stone',
    status: 'current',
    url: 'https://www.westlakeroyalbuildingproducts.com/stone/cultured-stone/pro-fit-alpine-ledgestone',
    fingerprint: ['Pro-Fit Alpine Ledgestone'],
    specs: [
      { label: 'Pieces', value: '4″ high; 8″, 12″ or 20″ long; 3/4″–2-1/4″ thick' },
      { label: 'Corners', value: '4″, 8″ or 12″ returns' },
      { label: 'Use', value: 'Outdoors or in' },
      { label: 'Material', value: 'Lightweight concrete' },
    ],
    verified: on('https://www.westlakeroyalbuildingproducts.com/stone/cultured-stone/pro-fit-alpine-ledgestone', 'Colors are chosen on the page with a picker that the page builds in the browser, so they aren’t listed here.', ADDED),
    display: shows(0, 1),
    summary: 'A slim, even-height ledgestone with a clean, modern texture, for walls inside or out.',
  },
  {
    id: 'RS-SHADOW',
    slug: 'realstone-galaxy-black-shadowstone',
    brand: 'realstone',
    model: 'Galaxy Black Shadowstone',
    type: 'Natural stone panel',
    category: 'cultured-stone',
    status: 'current',
    url: 'https://www.realstonesystems.com/product/galaxy-black-shadowstone-panel/',
    fingerprint: ['Galaxy Black Shadowstone'],
    specs: [
      { label: 'Stone', value: 'Charcoal marble with a subtle sparkle' },
      { label: 'Panel', value: '6″ × 24″ (1 sq ft)' },
      { label: 'Thickness', value: '0.4″–1″' },
      { label: 'Weight', value: '8.5–10.4 lb per panel' },
      { label: 'Coverage', value: '6 sq ft per box' },
      { label: 'Installation', value: 'Dry-stacked, no grout joints' },
    ],
    verified: on('https://www.realstonesystems.com/product/galaxy-black-shadowstone-panel/', 'Shadowstone comes in several colors, each with its own page; this is Galaxy Black.', ADDED),
    display: shows(1, 0),
    summary: 'Real charcoal marble in tight-fitting panels with no grout lines, for a bold, dark fireplace wall.',
  },
  {
    id: 'ACC-HEARTHPAD',
    slug: 'imperial-stove-board-type-2',
    brand: 'imperial',
    model: 'Stove Board – Type 2',
    type: 'Stove board',
    category: 'accessories-care',
    status: 'current',
    url: 'https://www.imperialgroup.ca/product/stove-fireplace/stove-boards-heat-shields/stove-board-type-2',
    fingerprint: ['Stove Board - Type 2', 'Stove Board'],
    specs: [
      { label: 'Certification', value: 'UL 1618 Type 2 floor protector, R-value 1.5' },
      { label: 'Construction', value: '1/2″ steel-covered Class A mineral board' },
      { label: 'Sizes', value: 'Six, from 18″ × 48″ to 46″ × 48″' },
      { label: 'Finishes', value: 'Black pebble, slate or wood grain' },
      { label: 'Use', value: 'Indoors, under wood, pellet, gas, electric or kerosene heaters' },
    ],
    verified: on('https://www.imperialgroup.ca/product/stove-fireplace/stove-boards-heat-shields/stove-board-type-2', 'Not every size comes in every finish.', ADDED),
    display: shows(1, 1),
    summary: 'A heat- and ember-rated floor protector to set a freestanding stove on.',
  },
  {
    id: 'ACC-LOGRACK',
    slug: 'hy-c-shelter-log-racks',
    brand: 'hy-c',
    model: 'Shelter Log Racks',
    type: 'Firewood rack',
    category: 'accessories-care',
    status: 'current',
    url: 'https://www.hy-c.com/shelter-product/firewood-rack',
    fingerprint: ['Log Racks'],
    specs: [
      { label: 'Sizes', value: 'Five, from 28″ × 12″ × 33″ to 96″ × 13″ × 60″' },
      { label: 'Capacity', value: '1,000–4,000 lb, up to 1-1/4 face cord' },
      { label: 'Material', value: '1-1/4″ tubular steel' },
      { label: 'Finish', value: 'Black powder coat' },
      { label: 'Made in', value: 'St. Louis, Missouri' },
    ],
    verified: on('https://www.hy-c.com/shelter-product/firewood-rack', undefined, ADDED),
    display: shows(1, 1),
    summary: 'Sturdy steel racks that keep firewood off the ground, in five sizes up to more than a face cord.',
  },
  {
    id: 'UNI-W1246',
    slug: 'uniflame-log-holder-kindling-rack',
    brand: 'uniflame',
    model: 'Log Holder with Kindling Rack and Tools',
    type: 'Log holder with fire tools',
    category: 'accessories-care',
    status: 'current',
    url: 'https://uniflame.com/product/black-wrought-iron-log-holder-with-kindling-rack-and-fire-tools-with-crook-handles/',
    fingerprint: ['Log Holder with Kindling Rack'],
    specs: [
      { label: 'Includes', value: 'Log holder, kindling rack and fire tools' },
      { label: 'Dimensions', value: '16″ W × 31″ H' },
      { label: 'Weight', value: '24 lb' },
      { label: 'Finish', value: 'Black wrought iron' },
      { label: 'Item no.', value: 'W-1246' },
    ],
    verified: on('https://uniflame.com/product/black-wrought-iron-log-holder-with-kindling-rack-and-fire-tools-with-crook-handles/', 'The page doesn’t say how many tools come with it.', ADDED),
    display: shows(1, 1),
    summary: 'Wood, kindling and fire tools together in one black wrought-iron stand beside the fireplace.',
  },
  {
    id: 'IMP-KK0315',
    slug: 'imperial-glass-cleaner',
    brand: 'imperial',
    model: 'Glass Cleaner & Conditioner',
    type: 'Stove glass cleaner',
    category: 'accessories-care',
    status: 'current',
    url: 'https://www.imperialgroup.ca/product/stove-fireplace/maintenance-products/glass-masonry-cleaners/glass-cleaner-conditioner',
    fingerprint: ['Glass Cleaner'],
    specs: [
      { label: 'For', value: 'Wood and other solid-fuel stove and fireplace glass (not gas fireplaces)' },
      { label: 'Removes', value: 'Baked-on soot, smoke, carbon and creosote' },
      { label: 'Form', value: 'Non-abrasive cream' },
      { label: 'Size', value: '8 fl oz (KK0315)' },
    ],
    verified: on('https://www.imperialgroup.ca/product/stove-fireplace/maintenance-products/glass-masonry-cleaners/glass-cleaner-conditioner', undefined, ADDED),
    display: shows(1, 1),
    summary: 'A non-abrasive cream that takes baked-on soot and creosote off wood-stove glass. Not for gas fireplaces.',
  },
];

/* ------------------------------------------------------------------------------------------------ */
/* Helpers                                                                                           */
/* ------------------------------------------------------------------------------------------------ */

/** Site path of a model page (before the base path is added) */
export const productPath = (p: Pick<Product, 'category' | 'slug'>) => `/products/${p.category}/${p.slug}/`;

export const productById = (id: string) => products.find((p) => p.id === id);

/** Models shown on a category page: its own, then ones that list it in `alsoIn` */
export const productsIn = (category: ProductCategory) =>
  products.filter((p) => p.status !== 'hidden' && (p.category === category || p.alsoIn?.includes(category)));

export const publicProducts = () => products.filter((p) => p.status !== 'hidden');

