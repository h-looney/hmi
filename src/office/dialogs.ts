/**
 * App-wide dialogs (create/edit forms) can be opened from anywhere — the top bar's "New"
 * menu, a record page, the command palette. The shell's <DialogHost> renders the right one.
 */
import { signal } from '@preact/signals';
import type { Customer, JobType, StoreId } from './data/types';

export type DialogRequest =
  | { kind: 'job'; jobId?: string; preset?: { type?: JobType; customerId?: string; unitId?: string; leadId?: string; store?: StoreId; title?: string; description?: string; itemId?: string } }
  | { kind: 'customer'; customerId?: string; preset?: Partial<Customer>; onCreated?: (id: string) => void }
  | { kind: 'invoice'; invoiceId?: string; preset?: { kind?: 'invoice' | 'estimate'; customerId?: string; jobId?: string; leadId?: string } }
  | { kind: 'payment'; invoiceId: string }
  | { kind: 'request' }
  | { kind: 'claim'; unitId?: string; jobId?: string }
  | { kind: 'transfer'; itemId?: string; from?: StoreId }
  | { kind: 'adjust'; itemId: string; store?: StoreId }
  | { kind: 'po'; poId?: string; preset?: { vendorId?: string; store?: StoreId; itemIds?: string[] } };

export const activeDialog = signal<DialogRequest | null>(null);
export const openDialog = (d: DialogRequest) => {
  activeDialog.value = d;
};
export const closeDialog = () => {
  activeDialog.value = null;
};
