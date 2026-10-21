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
  fuel: ProductFuel;
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
  /** Key of a photo HMI owns (src/data/productPhotos.ts). Without one the page shows a labelled placeholder. */
  photo?: string;
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
    hosts: ['forgenflame.com', 'vermontcastings.com'],
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
const on = (url: string, note?: string) => ({ url, on: CHECKED, ...(note ? { note } : {}) });

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

