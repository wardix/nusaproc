import { apiClient } from '../client';

export const invoiceApi = {
  create: (data: unknown) => apiClient.post('/invoices', data),
  getById: (id: string) => apiClient.get(`/invoices/${id}`),
  getMatchResult: (id: string) => apiClient.get(`/invoices/${id}/match-result`),
};
