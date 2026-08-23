export interface PurchaseRequestItem {
  id: string;
  prId: string;
  lineNumber: number;
  itemName: string;
  quantityRequested: number;
  uom: string;
  estimatedUnitPrice: number;
}

export interface PurchaseRequest {
  id: string;
  prNumber: string;
  requesterId: string;
  divisionId: string;
  branchId: string;
  paymentTermType: 'ADVANCE_OR_COD' | 'PAY_AFTER_RECEIPT';
  requiredDate: string;
  status: string;
  totalEstimatedAmount: number;
}
