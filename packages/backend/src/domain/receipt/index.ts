export interface GoodsReceipt {
  id: string;
  grNumber: string;
  poId: string;
  receiptType: 'DIRECT_REQUESTER' | 'WAREHOUSE';
  deliveryNoteNumber?: string;
  receivedDate: string;
  receivedBy: string;
  notes?: string;
}
