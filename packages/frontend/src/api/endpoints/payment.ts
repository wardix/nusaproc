import { apiClient } from '../client';

export interface ProposePaymentPayload {
  vendorId: string;
  vendorBankAccountId: string;
  paymentMethod?: string;
  allocations: Array<{
    invoiceId: string;
    allocatedAmount: number;
    isAdvancePayment?: boolean;
  }>;
}

export interface ExecutePaymentPayload {
  bankReferenceNumber?: string;
  executionReceiptFileId?: string;
}

export const paymentApi = {
  list: (params?: { vendorId?: string; status?: string }) =>
    apiClient.get('/payments/proposals', { params }).then((res) => res.data),

  getById: (id: string) =>
    apiClient.get(`/payments/proposals/${id}`).then((res) => res.data),

  propose: (data: ProposePaymentPayload) =>
    apiClient.post('/payments/proposals', data).then((res) => res.data),

  check: (id: string) =>
    apiClient.post(`/payments/proposals/${id}/check`).then((res) => res.data),

  execute: (id: string, data: ExecutePaymentPayload, reauthToken: string, idempotencyKey?: string) =>
    apiClient
      .post(`/payments/proposals/${id}/execute`, data, {
        headers: {
          'X-Reauth-Token': reauthToken,
          ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}),
        },
      })
      .then((res) => res.data),
};
