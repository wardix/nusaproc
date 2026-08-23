import { apiClient } from '../client';

export interface CreateInvoicePayload {
  vendorId: string;
  poId: string;
  grId?: string;
  invoiceType?: 'STANDARD' | 'ADVANCE_PAYMENT' | 'PROGRESS_TERMIN' | 'FINAL_SETTLEMENT';
  vendorInvoiceNumber: string;
  invoiceDate: string;
  dueDate: string;
  subtotalAmount: number;
  ppnAmount?: number;
  pphAmount?: number;
  totalPayableAmount: number;
  nsfpOriginal?: string;
  taxSnapshotId: string;
}

export const invoiceApi = {
  list: (params?: { vendorId?: string; poId?: string; matchStatus?: string }) =>
    apiClient.get('/invoices', { params }).then((res) => res.data),

  getById: (id: string) =>
    apiClient.get(`/invoices/${id}`).then((res) => res.data),

  create: (data: CreateInvoicePayload) =>
    apiClient.post('/invoices', data).then((res) => res.data),

  runMatch: (id: string) =>
    apiClient.post(`/invoices/${id}/match`).then((res) => res.data),

  overrideException: (id: string, overrideReason: string) =>
    apiClient.post(`/invoices/${id}/override`, { overrideReason }).then((res) => res.data),

  getExceptions: (id: string) =>
    apiClient.get(`/invoices/${id}/exceptions`).then((res) => res.data),
};
