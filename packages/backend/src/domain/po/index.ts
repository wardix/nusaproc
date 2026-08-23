export interface PurchaseOrder {
  id: string;
  poNumber: string;
  vendorId: string;
  vendorBankAccountId: string;
  paymentTermType: 'ADVANCE_OR_COD' | 'PAY_AFTER_RECEIPT';
  versionNumber: number;
  status: 'DRAFT' | 'ISSUED' | 'AMENDED' | 'COMPLETED' | 'CANCELLED';
  subtotalAmount: number;
  taxAmount: number;
  grandTotalAmount: number;
  termsAndConditions: string;
  createdBy: string;
  approvedBy?: string;
  approvedAt?: string;
  issuedAt?: string;
}
