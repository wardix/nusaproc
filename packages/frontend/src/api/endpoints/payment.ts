import { apiClient } from '../client';

export const paymentApi = {
  propose: (data: unknown) => apiClient.post('/payments/propose', data),
  check: (id: string) => apiClient.post(`/payments/${id}/check`),
  execute: (id: string, idempotencyKey: string, reauthToken: string) =>
    apiClient.post(
      `/payments/${id}/execute`,
      {},
      {
        headers: {
          'Idempotency-Key': idempotencyKey,
          'X-Reauth-Token': reauthToken,
        },
      }
    ),
};
