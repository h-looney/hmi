/** Renders whichever app-wide dialog is open (see dialogs.ts). */
import { closeDialog, type DialogRequest } from '../dialogs';
import { InvoiceDialog, PaymentDialog } from '../pages/accounting/dialogs';
import { CustomerDialog } from '../pages/customers/CustomerDialog';
import { RequestDialog } from '../pages/inbox/RequestDialog';
import { AdjustDialog, PODialog, TransferDialog } from '../pages/inventory/dialogs';
import { JobDialog } from '../pages/jobs/JobDialog';
import { ClaimDialog } from '../pages/warranty/ClaimDialog';

export function DialogHost({ request }: { request: DialogRequest }) {
  const onClose = closeDialog;
  switch (request.kind) {
    case 'job':
      return <JobDialog jobId={request.jobId} preset={request.preset} onClose={onClose} />;
    case 'customer':
      return <CustomerDialog customerId={request.customerId} preset={request.preset} onCreated={request.onCreated} onClose={onClose} />;
    case 'invoice':
      return <InvoiceDialog invoiceId={request.invoiceId} preset={request.preset} onClose={onClose} />;
    case 'payment':
      return <PaymentDialog invoiceId={request.invoiceId} onClose={onClose} />;
    case 'request':
      return <RequestDialog onClose={onClose} />;
    case 'claim':
      return <ClaimDialog unitId={request.unitId} jobId={request.jobId} onClose={onClose} />;
    case 'transfer':
      return <TransferDialog itemId={request.itemId} from={request.from} onClose={onClose} />;
    case 'adjust':
      return <AdjustDialog itemId={request.itemId} store={request.store} onClose={onClose} />;
    case 'po':
      return <PODialog poId={request.poId} preset={request.preset} onClose={onClose} />;
  }
}
