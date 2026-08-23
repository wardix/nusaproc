import { apiClient } from '../client';

export const poApi = {
  create: (data: unknown) => apiClient.post('/po', data),
  getById: (id: string) => apiClient.get(`/po/${id}`),
  list: (params?: Record<string, unknown>) => apiClient.get('/po', { params }),
  approve: (id: string, reauthToken: string) =>
    apiClient.post(`/po/${id}/approve`, {}, { headers: { 'X-Reauth-Token': reauthToken } }),
};
