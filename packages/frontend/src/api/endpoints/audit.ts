import { apiClient } from '../client';

export const auditApi = {
  verifyChain: () =>
    apiClient.get('/audit/verify-chain').then((res) => res.data),

  getTrail: (entityName: string, entityId: string) =>
    apiClient.get('/audit/trail', { params: { entityName, entityId } }).then((res) => res.data),

  downloadEvidenceBundle: (entityName: string, entityId: string) =>
    apiClient
      .get('/audit/evidence-bundle', {
        params: { entityName, entityId },
        responseType: 'blob',
      })
      .then((res) => res.data),
};
