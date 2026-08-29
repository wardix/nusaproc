import { apiClient } from '../client';
import type { AppRole } from '@nusaproc/shared';

export interface UserRoleItem {
  id?: string;
  role: AppRole;
  isTaxSpecialist?: boolean;
  validFrom?: string;
  validUntil?: string | null;
}

export interface UserItem {
  id: string;
  email: string;
  fullName: string;
  employeeId: string;
  divisionId: string;
  divisionName?: string;
  branchId: string;
  branchName?: string;
  isActive: boolean;
  isLocalFallback: boolean;
  totpEnabled: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
  roles: UserRoleItem[];
}

export interface UserFilterParams {
  search?: string;
  divisionId?: string;
  branchId?: string;
  role?: string;
  isActive?: boolean;
  limit?: number;
  offset?: number;
}

export interface CreateUserPayload {
  email: string;
  fullName: string;
  employeeId: string;
  divisionId: string;
  branchId: string;
  initialPassword?: string;
  isLocalFallback?: boolean;
  roles: Array<{
    role: AppRole;
    isTaxSpecialist?: boolean;
    validFrom?: string;
    validUntil?: string | null;
  }>;
}

export async function fetchUsers(params?: UserFilterParams): Promise<{ data: UserItem[]; total: number }> {
  const { data } = await apiClient.get<{ success: boolean; data: UserItem[]; total: number }>('/users', {
    params,
  });
  return { data: data.data, total: data.total };
}

export async function fetchUserById(id: string): Promise<UserItem> {
  const { data } = await apiClient.get<{ success: boolean; data: UserItem }>(`/users/${id}`);
  return data.data;
}

export async function createUser(payload: CreateUserPayload): Promise<UserItem> {
  const { data } = await apiClient.post<{ success: boolean; data: UserItem }>('/users', payload);
  return data.data;
}

export async function updateUserRoles(
  userId: string,
  roles: Array<{ role: AppRole; isTaxSpecialist?: boolean; validFrom?: string; validUntil?: string | null }>
): Promise<UserItem> {
  const { data } = await apiClient.patch<{ success: boolean; data: UserItem }>(`/users/${userId}/roles`, {
    roles,
  });
  return data.data;
}

export async function updateUserStatus(userId: string, isActive: boolean): Promise<{ success: boolean; isActive: boolean }> {
  const { data } = await apiClient.patch<{ success: boolean; data: { success: boolean; isActive: boolean } }>(
    `/users/${userId}/status`,
    { isActive }
  );
  return data.data;
}
