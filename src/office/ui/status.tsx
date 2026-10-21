/** Labels, colors and icons for every status in HMI mode — color never carries meaning alone. */
import type { ClaimStatus, JobStatus, JobType, LeadKind, LeadSource, LeadStage } from '../data/types';
import type { InvoiceStatus, StockStatus, WarrantyState } from '../selectors';
import { Badge, type Tone } from './core';
import type { IconName } from './Icon';

type Meta = { label: string; tone: Tone; icon: IconName };

export const jobStatusMeta: Record<JobStatus, Meta> = {
  requested: { label: 'Needs scheduling', tone: 'amber', icon: 'clock' },
  scheduled: { label: 'Scheduled', tone: 'blue', icon: 'calendar' },
  'in-progress': { label: 'In progress', tone: 'ember', icon: 'wrench' },
  'on-hold': { label: 'On hold', tone: 'red', icon: 'alert' },
  completed: { label: 'Ready to invoice', tone: 'teal', icon: 'check' },
  closed: { label: 'Closed', tone: 'neutral', icon: 'check-circle' },
  cancelled: { label: 'Cancelled', tone: 'neutral', icon: 'x-circle' },
};

export const jobTypeMeta: Record<JobType, Meta> = {
  estimate: { label: 'Estimate', tone: 'blue', icon: 'ruler' },
  install: { label: 'Installation', tone: 'ember', icon: 'hardhat' },
  maintenance: { label: 'Maintenance', tone: 'green', icon: 'calendar' },
  repair: { label: 'Repair', tone: 'amber', icon: 'wrench' },
  warranty: { label: 'Warranty', tone: 'violet', icon: 'shield' },
  delivery: { label: 'Delivery', tone: 'neutral', icon: 'truck' },
};

export const leadStageMeta: Record<LeadStage, Meta> = {
  new: { label: 'New', tone: 'ember', icon: 'sparkle' },
  contacted: { label: 'Contacted', tone: 'blue', icon: 'phone' },
  scheduled: { label: 'Scheduled', tone: 'teal', icon: 'calendar' },
  quoted: { label: 'Quote sent', tone: 'violet', icon: 'file' },
  won: { label: 'Won', tone: 'green', icon: 'check-circle' },
  lost: { label: 'Lost', tone: 'neutral', icon: 'x-circle' },
  closed: { label: 'Closed', tone: 'neutral', icon: 'archive' },
};

export const leadKindMeta: Record<LeadKind, Meta> = {
  quote: { label: 'Quote request', tone: 'ember', icon: 'chat' },
  service: { label: 'Service request', tone: 'blue', icon: 'wrench' },
  question: { label: 'Question', tone: 'neutral', icon: 'message' },
};

export const sourceLabels: Record<LeadSource, string> = {
  'web-quote': 'Website quote form',
  'web-service': 'Website service form',
  phone: 'Phone call',
  'walk-in': 'Showroom walk-in',
  facebook: 'Facebook',
  referral: 'Referral',
  builder: 'Builder',
};

export const invoiceStatusMeta: Record<InvoiceStatus, Meta> = {
  draft: { label: 'Draft', tone: 'neutral', icon: 'edit' },
  open: { label: 'Open', tone: 'blue', icon: 'clock' },
  partial: { label: 'Partially paid', tone: 'teal', icon: 'dollar' },
  overdue: { label: 'Overdue', tone: 'red', icon: 'alert' },
  paid: { label: 'Paid', tone: 'green', icon: 'check-circle' },
  void: { label: 'Void', tone: 'neutral', icon: 'x-circle' },
  sent: { label: 'Sent', tone: 'blue', icon: 'send' },
  accepted: { label: 'Accepted', tone: 'green', icon: 'check-circle' },
  declined: { label: 'Declined', tone: 'neutral', icon: 'x-circle' },
  expired: { label: 'Expired', tone: 'amber', icon: 'clock' },
};

export const claimStatusMeta: Record<ClaimStatus, Meta> = {
  draft: { label: 'Draft', tone: 'neutral', icon: 'edit' },
  submitted: { label: 'Submitted', tone: 'blue', icon: 'send' },
  approved: { label: 'Approved', tone: 'teal', icon: 'check' },
  'parts-shipped': { label: 'Parts shipped', tone: 'violet', icon: 'truck' },
  credited: { label: 'Credited', tone: 'green', icon: 'check-circle' },
  denied: { label: 'Denied', tone: 'red', icon: 'x-circle' },
};

export const stockMeta: Record<StockStatus, Meta> = {
  ok: { label: 'In stock', tone: 'green', icon: 'check' },
  low: { label: 'Low', tone: 'amber', icon: 'alert' },
  out: { label: 'Out of stock', tone: 'red', icon: 'x-circle' },
  special: { label: 'Special order', tone: 'neutral', icon: 'truck' },
};

export const warrantyMeta: Record<WarrantyState, Meta> = {
  active: { label: 'Active', tone: 'green', icon: 'shield' },
  expiring: { label: 'Expiring soon', tone: 'amber', icon: 'clock' },
  'labor-ended': { label: 'Parts only', tone: 'blue', icon: 'shield' },
  expired: { label: 'Expired', tone: 'neutral', icon: 'x-circle' },
  none: { label: 'Not covered', tone: 'neutral', icon: 'minus' },
};

export function StatusBadge({ meta }: { meta: Meta }) {
  return (
    <Badge tone={meta.tone} icon={meta.icon}>
      {meta.label}
    </Badge>
  );
}
