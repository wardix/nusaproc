import { apiClient } from '../client';

export interface CreatePrPayload {
  paymentTermType: 'ADVANCE_OR_COD' | 'PAY_AFTER_RECEIPT';
  requiredDate: string;
  items: Array<{
    itemName: string;
    quantityRequested: number;
    uom: string;
    estimatedUnitPrice: number;
  }>;
}

export const prApi = {
  create: (data: CreatePrPayload) => apiClient.post('/pr', data),
  getById: (id: string) => apiClient.get(`/pr/${id}`),
  list: (params?: Record<string, unknown>) => apiClient.get('/pr', { params }),
};
