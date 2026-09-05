import { apiClient } from '../client';

export interface CreatePoPayload {
  vendorId: string;
  vendorBankAccountId: string;
  paymentTermType: 'ADVANCE_OR_COD' | 'PAY_AFTER_RECEIPT';
  taxAmount?: number;
  termsAndConditions: string;
  items: Array<{
    prItemId: string;
    lineNumber?: number;
    itemName: string;
    quantityOrdered: number;
    uom: string;
    unitPrice: number;
  }>;
}

export interface UpdatePoPayload {
  vendorId?: string;
  vendorBankAccountId?: string;
  paymentTermType?: 'ADVANCE_OR_COD' | 'PAY_AFTER_RECEIPT';
  taxAmount?: number;
  termsAndConditions?: string;
  reason?: string;
  items?: Array<{
    prItemId: string;
    lineNumber?: number;
    itemName: string;
    quantityOrdered: number;
    uom: string;
    unitPrice: number;
  }>;
}

export interface AmendPoPayload {
  reason: string;
  updatedTermsAndConditions?: string;
}

export const poApi = {
  list: (params?: { status?: string }) =>
    apiClient.get('/purchase-orders', { params }).then((res) => res.data),

  getById: (id: string) =>
    apiClient.get(`/purchase-orders/${id}`).then((res) => res.data),

  create: (data: CreatePoPayload) =>
    apiClient.post('/purchase-orders', data).then((res) => res.data),

  update: (id: string, data: UpdatePoPayload) =>
    apiClient.put(`/purchase-orders/${id}`, data).then((res) => res.data),

  approve: (id: string) =>
    apiClient.post(`/purchase-orders/${id}/approve`).then((res) => res.data),

  issue: (id: string) =>
    apiClient.post(`/purchase-orders/${id}/issue`).then((res) => res.data),

  amend: (id: string, data: AmendPoPayload) =>
    apiClient.post(`/purchase-orders/${id}/amend`, data).then((res) => res.data),

  downloadPdf: (id: string) =>
    apiClient.get(`/purchase-orders/${id}/pdf`, { responseType: 'blob' }).then((res) => res.data),
};
