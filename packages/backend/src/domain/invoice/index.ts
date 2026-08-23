export interface Invoice {
  id: string;
  poId: string;
  vendorInvoiceNumber: string;
  nsfpNumber?: string;
  subtotalAmount: number;
  taxAmount: number;
  totalAmount: number;
  matchStatus: 'EXACT_MATCH' | 'TOLERANCE_ACCEPTED' | 'EXCEPTION_HELD' | 'EXCEPTION_OVERRIDDEN';
}
