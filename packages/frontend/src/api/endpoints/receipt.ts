import { apiClient } from '../client';

export interface CreateReceiptPayload {
  poId: string;
  receiptType: 'DIRECT_REQUESTER' | 'WAREHOUSE';
  deliveryNoteNumber?: string;
  receivedDate: string;
  notes?: string;
  items: Array<{
    poItemId: string;
    quantityReceived: number;
    quantityRejected?: number;
    conditionNotes?: string;
  }>;
}

export const receiptApi = {
  list: (params?: { poId?: string }) =>
    apiClient.get('/receipts', { params }).then((res) => res.data),

  getById: (id: string) =>
    apiClient.get(`/receipts/${id}`).then((res) => res.data),

  create: (data: CreateReceiptPayload) =>
    apiClient.post('/receipts', data).then((res) => res.data),

  listNcrs: (params?: { poId?: string; isResolved?: boolean }) =>
    apiClient.get('/ncrs', { params }).then((res) => res.data),
};
