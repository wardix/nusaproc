import { apiClient } from '../client';

export interface CreatePrPayload {
  costCenter: string;
  divisionId: string;
  branchId: string;
  requiredDate?: string;
  paymentTermType: 'ADVANCE_OR_COD' | 'PAY_AFTER_RECEIPT';
  businessJustification: string;
  isEmergency?: boolean;
  emergencyJustification?: string;
  items: Array<{
    lineNumber?: number;
    itemName: string;
    specification?: string;
    quantityRequested: number;
    uom: string;
    estimatedUnitPrice: number;
  }>;
}

export interface DecidePrPayload {
  decision: 'APPROVED' | 'REJECTED';
  rejectionReason?: string;
  approverMaxLimit?: number;
  approverDivisionId?: string;
}

export const prApi = {
  list: (params?: { requesterId?: string; status?: string; hasRemainingPo?: boolean; limit?: number; offset?: number }) =>
    apiClient.get('/purchase-requests', { params }).then((res) => res.data),

  getById: (id: string) =>
    apiClient.get(`/purchase-requests/${id}`).then((res) => res.data),

  create: (data: CreatePrPayload) =>
    apiClient.post('/purchase-requests', data).then((res) => res.data),

  submit: (id: string) =>
    apiClient.post(`/purchase-requests/${id}/submit`).then((res) => res.data),

  decide: (id: string, data: DecidePrPayload) =>
    apiClient.post(`/purchase-requests/${id}/decide`, data).then((res) => res.data),

  closePartial: (id: string, reason: string) =>
    apiClient.post(`/purchase-requests/${id}/close-partial`, { reason }).then((res) => res.data),

  listUnfulfilledItems: () =>
    apiClient.get('/purchase-requests/unfulfilled-items').then((res) => res.data),

  getUoms: (params?: { search?: string; isActive?: boolean }) =>
    apiClient.get<{ success: boolean; data: Array<{ id: string; code: string; name: string; isActive: boolean }> }>('/uoms', { params }).then((res) => res.data),
};
