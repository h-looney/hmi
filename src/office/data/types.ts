/**
 * HMI mode data model.
 *
 * Everything lives in the browser (localStorage) — this is a front-end concept. The shapes
 * are written the way a real backend would expose them, so wiring one up later is mostly
 * a matter of swapping the store for API calls.
 */

export type StoreId = 'osage-beach' | 'nixa';
export type StoreFilter = StoreId | 'all';

export type Role = 'owner' | 'manager' | 'coordinator' | 'office' | 'sales' | 'tech';
export type Section =
  | 'dashboard'
  | 'my-day'
  | 'inbox'
  | 'jobs'
  | 'customers'
  | 'warranty'
  | 'inventory'
  | 'accounting'
  | 'analytics'
  | 'website'
  | 'settings';

export interface Staff {
  id: string;
  name: string;
  role: Role;
  title: string;
  store: StoreId | 'both';
  /** Key into the avatar images passed in from Astro */
  photo?: string;
  color: string;
  /** Can be put on a job crew */
  tech?: boolean;
  phone?: string;
  active: boolean;
}

export interface Address {
  street: string;
  city: string;
  state: string;
  zip: string;
}

export interface Customer {
  id: string;
  /** Person or company name */
  name: string;
  /** Contact person for builders and businesses */
  contact?: string;
  kind: 'homeowner' | 'builder' | 'business';
  phone: string;
  email: string;
  address: Address;
  store: StoreId;
  since: string;
  tags: string[];
  notes?: string;
  contactPref: 'phone' | 'email' | 'text';
  /** Enrolled in the annual maintenance plan */
  servicePlan?: boolean;
  /** Calls, notes and messages logged against the customer */
  activity?: Activity[];
}

export type Fuel = 'Natural gas' | 'Propane' | 'Wood' | 'Pellet' | 'Electric';

export type ItemCategory =
  | 'Gas fireplaces'
  | 'Wood fireplaces'
  | 'Electric fireplaces'
  | 'Inserts'
  | 'Stoves'
  | 'Gas logs'
  | 'Outdoor'
  | 'Doors & screens'
  | 'Mantels & stone'
  | 'Venting'
  | 'Service parts'
  | 'Accessories';

/** An appliance in a customer's home — the basis for warranty and service history. */
export interface Unit {
  id: string;
  customerId: string;
  /** Catalog model, when HMI sold it */
  itemId?: string;
  /** For units HMI didn't sell, e.g. "Builder-grade gas fireplace" */
  legacyGroup?: string;
  model: string;
  brand: string;
  category: ItemCategory;
  fuel: Fuel;
  serial: string;
  room?: string;
  installedOn: string;
  installedBy: 'HMI' | 'Other';
  warranty: {
    terms: string;
    partsUntil?: string;
    laborUntil?: string;
    fireboxLifetime: boolean;
    registered: boolean;
    registrationNo?: string;
  };
  lastServiceOn?: string;
}

export type ClaimStatus = 'draft' | 'submitted' | 'approved' | 'parts-shipped' | 'credited' | 'denied';

export interface WarrantyClaim {
  id: string;
  unitId: string;
  customerId: string;
  jobId?: string;
  store: StoreId;
  openedOn: string;
  issue: string;
  part: string;
  manufacturer: string;
  claimNo?: string;
  status: ClaimStatus;
  /** Parts + labor credit expected (or received) from the manufacturer */
  credit: number;
  updatedOn: string;
  notes?: string;
}

export type LeadKind = 'quote' | 'service' | 'question';
export type LeadStage = 'new' | 'contacted' | 'scheduled' | 'quoted' | 'won' | 'lost' | 'closed';
export type LeadSource = 'web-quote' | 'web-service' | 'phone' | 'walk-in' | 'facebook' | 'referral' | 'builder';

export interface Activity {
  id: string;
  at: string;
  /** Staff id, or 'customer' / 'system' */
  by: string;
  kind: 'received' | 'note' | 'email' | 'call' | 'text' | 'status' | 'assign' | 'job' | 'estimate' | 'system';
  text: string;
}

/** A request from the website, phone, a walk-in or social media. */
export interface Lead {
  id: string;
  kind: LeadKind;
  source: LeadSource;
  receivedAt: string;
  name: string;
  email?: string;
  phone?: string;
  city?: string;
  zip?: string;
  address?: string;
  store: StoreId;
  summary: string;
  message?: string;
  /** Label/value pairs exactly as submitted */
  fields: [string, string][];
  photos?: number;
  stage: LeadStage;
  assignee?: string;
  customerId?: string;
  jobId?: string;
  estimateId?: string;
  firstResponseAt?: string;
  closedAt?: string;
  /** Estimated or won value */
  value?: number;
  lostReason?: string;
  unread: boolean;
  starred?: boolean;
  activity: Activity[];
  /** Submitted through the public site in this browser */
  demo?: boolean;
  /** Reference shown on the public site's confirmation, for linking straight here */
  ref?: string;
}

export type JobType = 'estimate' | 'install' | 'maintenance' | 'repair' | 'warranty' | 'delivery';
export type JobStatus = 'requested' | 'scheduled' | 'in-progress' | 'on-hold' | 'completed' | 'closed' | 'cancelled';

export interface ChecklistItem {
  id: string;
  label: string;
  done: boolean;
}

export interface JobPart {
  itemId: string;
  qty: number;
  store: StoreId;
  status: 'reserved' | 'used';
}

export interface Job {
  id: string;
  type: JobType;
  title: string;
  customerId: string;
  unitId?: string;
  /** Model being installed (install jobs) */
  itemId?: string;
  leadId?: string;
  store: StoreId;
  status: JobStatus;
  priority: 'normal' | 'high';
  /** Scheduled start */
  start?: string;
  /** Estimated hours on site */
  hours: number;
  crew: string[];
  description: string;
  checklist: ChecklistItem[];
  parts: JobPart[];
  notes: Activity[];
  createdAt: string;
  /** Actual arrival / finish, for time reports */
  startedAt?: string;
  completedAt?: string;
  issue?: string;
  /** The job this one is a return visit for */
  callbackOf?: string;
  claimId?: string;
  invoiceId?: string;
  estimateId?: string;
  value?: number;
  holdReason?: string;
  signature?: { name: string; at: string; image?: string };
  /** Photos attached from the field (count, in this demo) */
  photos?: number;
}

export interface StockLevel {
  onHand: number;
  reserved: number;
  /** Units set up as showroom displays (counted in on hand) */
  display: number;
}

export interface Item {
  /** SKU */
  id: string;
  name: string;
  brand: string;
  category: ItemCategory;
  kind: 'unit' | 'part' | 'accessory';
  fuel?: Fuel | 'Gas';
  uom: 'ea' | 'ft' | 'bag' | 'box';
  cost: number;
  price: number;
  reorderPoint: number;
  reorderQty: number;
  vendorId: string;
  stock: Record<StoreId, StockLevel>;
  warranty?: { partsYears: number; laborYears: number; fireboxLifetime: boolean };
  /** Key into the thumbnail images passed in from Astro */
  photo?: string;
  specialOrder?: boolean;
  /** Appliance models: the model name on the product list (src/data/products.ts), e.g. "Mezzo 48" */
  model?: string;
  /** Appliance models: current, discontinued (no longer made) or hidden from the public site */
  productStatus?: 'current' | 'discontinued' | 'hidden';
}

export interface StockMove {
  id: string;
  at: string;
  itemId: string;
  store: StoreId;
  /** + into stock, − out of stock */
  qty: number;
  kind: 'received' | 'sold' | 'job' | 'transfer' | 'adjustment';
  ref?: string;
  by: string;
  note?: string;
}

export type POStatus = 'draft' | 'ordered' | 'partial' | 'received' | 'cancelled';

export interface PurchaseOrder {
  id: string;
  vendorId: string;
  store: StoreId;
  status: POStatus;
  createdAt: string;
  orderedOn?: string;
  expectedOn?: string;
  receivedOn?: string;
  lines: { itemId: string; qty: number; received: number; cost: number }[];
  notes?: string;
  createdBy: string;
}

export type RevenueCategory = 'Equipment' | 'Installation' | 'Service' | 'Parts' | 'Retail';
export type ExpenseCategory =
  | 'Inventory purchases'
  | 'Payroll'
  | 'Rent & utilities'
  | 'Vehicles & fuel'
  | 'Insurance'
  | 'Marketing'
  | 'Supplies & tools'
  | 'Professional services'
  | 'Software & fees';

export interface Vendor {
  id: string;
  name: string;
  kind: 'manufacturer' | 'distributor' | 'services' | 'utilities' | 'property';
  terms: 'Due on receipt' | 'Net 15' | 'Net 30';
  phone?: string;
  account?: string;
  category: ExpenseCategory;
}

export interface InvoiceLine {
  id: string;
  description: string;
  qty: number;
  rate: number;
  itemId?: string;
  category: RevenueCategory;
  taxable: boolean;
}

export type PaymentMethod = 'card' | 'check' | 'cash' | 'ach' | 'financing';

export interface Payment {
  id: string;
  date: string;
  amount: number;
  method: PaymentMethod;
  ref?: string;
}

/** Invoices and estimates share one shape (`kind`). */
export interface Invoice {
  id: string;
  kind: 'invoice' | 'estimate';
  customerId: string;
  jobId?: string;
  leadId?: string;
  store: StoreId;
  issuedOn: string;
  /** Invoices: due date. Estimates: valid until. */
  dueOn: string;
  /** Paid / partial / overdue / expired are derived — see selectors.ts */
  status: 'draft' | 'sent' | 'void' | 'accepted' | 'declined';
  lines: InvoiceLine[];
  taxRate: number;
  payments: Payment[];
  memo?: string;
  sentAt?: string;
  salesperson?: string;
  remindedAt?: string;
  /** Estimates: when the customer accepted */
  acceptedOn?: string;
  /** When it was last pushed to QuickBooks */
  syncedAt?: string;
}

export interface Bill {
  id: string;
  vendorId: string;
  number: string;
  issuedOn: string;
  dueOn: string;
  amount: number;
  category: ExpenseCategory;
  store?: StoreId;
  status: 'open' | 'scheduled' | 'paid';
  paidOn?: string;
  scheduledOn?: string;
  memo?: string;
  poId?: string;
  syncedAt?: string;
}

export interface BankAccount {
  id: string;
  name: string;
  kind: 'checking' | 'savings' | 'credit';
  mask: string;
  balance: number;
}

export interface BankTxn {
  id: string;
  accountId: string;
  date: string;
  description: string;
  amount: number;
  category?: string;
  match?: { kind: 'invoice' | 'bill' | 'payroll' | 'transfer' | 'deposit'; id?: string };
  reviewed: boolean;
}

export interface BooksState {
  /** Where the books are kept: here, or in QuickBooks with HMI mode syncing to it */
  mode: 'in-house' | 'quickbooks';
  connected: boolean;
  company?: string;
  connectedAt?: string;
  lastSyncAt?: string;
  autoSync: boolean;
  sync: Record<'customers' | 'items' | 'invoices' | 'payments' | 'bills', boolean>;
  mapping: { key: string; label: string; account: string }[];
  log: { id: string; at: string; level: 'ok' | 'warn' | 'error'; text: string }[];
}

export interface Notice {
  id: string;
  at: string;
  kind: 'lead' | 'job' | 'payment' | 'stock' | 'warranty' | 'sync' | 'system';
  text: string;
  href?: string;
  read: boolean;
}

export interface Settings {
  taxRates: Record<StoreId, number>;
  terms: 'Due on receipt' | 'Net 15' | 'Net 30';
  invoiceFooter: string;
  laborRate: number;
  tripCharge: number;
  annualService: Record<'gas' | 'wood' | 'pellet', number>;
  forms: {
    /** Who new website requests are assigned to, per store */
    routing: Record<'quote' | 'service', Record<StoreId, string>>;
    autoReply: boolean;
    autoReplyText: string;
  };
  notifications: Record<'newLead' | 'jobCompleted' | 'paymentReceived' | 'lowStock' | 'dailyDigest', boolean>;
  permissions: Record<Role, Section[]>;
  /** Editable business profile (defaults come from src/data/site.ts) */
  business?: { displayName: string; email: string; phone: string; website: string; licenseNo: string };
}

/* ---------- Website: the product list and its outbound links ---------- */

/** A change to a model on the product list, made in HMI mode. It goes live on the next publish (simulated). */
export interface ProductEdit {
  status?: 'current' | 'discontinued' | 'hidden';
  /** Product id of the replacement, for discontinued models */
  replacement?: string;
  by: string;
  at: string;
  publishedAt?: string;
}

/** A model added from the sitemap watcher's suggestions — a draft until it's published (simulated). */
export interface DraftProduct {
  id: string;
  brand: string;
  model: string;
  url: string;
  category?: string;
  suggestionId?: string;
  by: string;
  at: string;
  publishedAt?: string;
}

/** A new stored URL for an outbound link — typed in, or an accepted "moved" suggestion from the link check */
export interface LinkUrlEdit {
  url: string;
  by: string;
  at: string;
  publishedAt?: string;
}

/** Where a model photo was taken — it becomes the caption on the model page */
export type PhotoPlace = StoreId | 'install';

/** A photo of a model added in HMI mode. The image itself is kept in this browser's IndexedDB (`photo:<id>`). */
export interface ProductPhotoMeta {
  id: string;
  /** What it shows, for people who can't see it */
  alt: string;
  where?: PhotoPlace;
  width: number;
  height: number;
  by: string;
  at: string;
}

export interface WebsiteState {
  /** Pending and published edits, by product id */
  edits: Record<string, ProductEdit>;
  /** New stored URLs, by /go/ slug (models, brand sites, support pages and tools) */
  linkUrls: Record<string, LinkUrlEdit>;
  drafts: DraftProduct[];
  /** Sitemap suggestions someone dismissed */
  dismissed: string[];
  /** Who gets the Monday summary (staff id) */
  digestTo: string;
  digestSentAt?: string;
  /** Simulated publishes */
  publishes: { id: string; at: string; by: string; changes: number }[];
  /** Model photos added in HMI mode, by product id, in order (the first one leads) */
  photos: Record<string, ProductPhotoMeta[]>;
  /** The photos as last published (simulated), by product id */
  photosLive: Record<string, ProductPhotoMeta[]>;
}

/** Everything HMI mode keeps — saved to localStorage as one document. */
export interface DB {
  version: number;
  /** Day the data was generated for. Dates shift forward when the demo is reopened later. */
  seededOn: string;
  /** Detailed records start here; older activity lives in the analytics history. */
  windowStart: string;
  counters: Record<string, number>;
  staff: Staff[];
  customers: Customer[];
  units: Unit[];
  claims: WarrantyClaim[];
  leads: Lead[];
  jobs: Job[];
  items: Item[];
  moves: StockMove[];
  pos: PurchaseOrder[];
  vendors: Vendor[];
  invoices: Invoice[];
  bills: Bill[];
  accounts: BankAccount[];
  txns: BankTxn[];
  books: BooksState;
  notices: Notice[];
  settings: Settings;
  /** Annual-service reminders sent */
  reminders: { unitId: string; at: string; by: string }[];
  /** The Website section: product list edits, suggestions handled, the weekly summary */
  website: WebsiteState;
}

/* ---------- Analytics history ----------
 * Compact facts for the ~15 months before `windowStart`. Generated with the demo data and
 * never edited. Reports combine these with facts derived from the live records above.
 */

export interface JobFact {
  id: string;
  day: string;
  store: StoreId;
  type: JobType;
  /** Lead tech first */
  crew: string[];
  /** Actual hours on site */
  hours: number;
  estHours: number;
  onTime: boolean;
  unitId?: string;
  customerId?: string;
  /** Model or legacy group, for reliability reports */
  group?: string;
  issue?: string;
  part?: string;
  /** This visit was a return trip for an earlier job */
  callback: boolean;
  /** The earlier visit this one went back for */
  callbackOf?: string;
  revenue: number;
}

export interface SaleFact {
  id: string;
  day: string;
  store: StoreId;
  itemId: string;
  qty: number;
  revenue: number;
  cost: number;
  channel: 'install' | 'counter';
}

export interface LeadFact {
  id: string;
  day: string;
  store: StoreId;
  source: LeadSource;
  kind: LeadKind;
  outcome: 'won' | 'lost' | 'closed' | 'open';
  /** Minutes from received to first contact (undefined for walk-ins and live calls) */
  responseMins?: number;
  value: number;
}

export interface MonthFact {
  month: string;
  store: StoreId;
  /** Operating expenses (cost of goods is derived from sales) */
  opex: Partial<Record<ExpenseCategory, number>>;
}

export interface History {
  from: string;
  to: string;
  jobs: JobFact[];
  sales: SaleFact[];
  leads: LeadFact[];
  months: MonthFact[];
  /** Units in service at `from` that aren't in the customer registry, per model/legacy group */
  base: Record<string, number>;
}

/** Per-browser preferences (separate from the shared data). */
export interface UIState {
  signedIn: boolean;
  userId: string;
  /** Who signed out last in this browser: marked "Last used" on the sign-in screen */
  lastUserId?: string;
  store: StoreFilter;
  jobsView: 'board' | 'list' | 'schedule';
  range: RangeKey;
  rangeFrom?: string;
  rangeTo?: string;
  welcomeDismissed: boolean;
  /** "Things to try" checklist progress */
  tried: string[];
}

export type RangeKey = '30d' | '90d' | 'season' | 'ytd' | '12m' | 'custom';
