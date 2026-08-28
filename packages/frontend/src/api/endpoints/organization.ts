import { apiClient } from '../client';

export interface BranchItem {
  id: string;
  code: string;
  name: string;
  city: string;
  address?: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface DivisionItem {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateBranchPayload {
  code: string;
  name: string;
  city: string;
  address?: string | null;
  isActive?: boolean;
}

export interface UpdateBranchPayload {
  code?: string;
  name?: string;
  city?: string;
  address?: string | null;
  isActive?: boolean;
}

export interface CreateDivisionPayload {
  code: string;
  name: string;
  description?: string | null;
  isActive?: boolean;
}

export interface UpdateDivisionPayload {
  code?: string;
  name?: string;
  description?: string | null;
  isActive?: boolean;
}

export const branchesApi = {
  list: (params?: { isActive?: boolean; search?: string }): Promise<{ success: boolean; data: BranchItem[] }> =>
    apiClient.get('/branches', { params }).then((res) => res.data),

  getById: (id: string): Promise<{ success: boolean; data: BranchItem }> =>
    apiClient.get(`/branches/${id}`).then((res) => res.data),

  create: (payload: CreateBranchPayload): Promise<{ success: boolean; data: BranchItem }> =>
    apiClient.post('/branches', payload).then((res) => res.data),

  update: (id: string, payload: UpdateBranchPayload): Promise<{ success: boolean; data: BranchItem }> =>
    apiClient.put(`/branches/${id}`, payload).then((res) => res.data),

  toggleStatus: (id: string, isActive: boolean): Promise<{ success: boolean; data: BranchItem }> =>
    apiClient.patch(`/branches/${id}/status`, { isActive }).then((res) => res.data),
};

export const divisionsApi = {
  list: (params?: { isActive?: boolean; search?: string }): Promise<{ success: boolean; data: DivisionItem[] }> =>
    apiClient.get('/divisions', { params }).then((res) => res.data),

  getById: (id: string): Promise<{ success: boolean; data: DivisionItem }> =>
    apiClient.get(`/divisions/${id}`).then((res) => res.data),

  create: (payload: CreateDivisionPayload): Promise<{ success: boolean; data: DivisionItem }> =>
    apiClient.post('/divisions', payload).then((res) => res.data),

  update: (id: string, payload: UpdateDivisionPayload): Promise<{ success: boolean; data: DivisionItem }> =>
    apiClient.put(`/divisions/${id}`, payload).then((res) => res.data),

  toggleStatus: (id: string, isActive: boolean): Promise<{ success: boolean; data: DivisionItem }> =>
    apiClient.patch(`/divisions/${id}/status`, { isActive }).then((res) => res.data),
};
