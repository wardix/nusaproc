import { apiClient } from '../client';
import type { AppRole } from '@nusaproc/shared';

export interface LoginRequest {
  email: string;
  password: string;
  requestedRole?: AppRole;
}

export interface GoogleAuthRequest {
  credential?: string;
  idToken?: string;
  requestedRole?: AppRole;
}

export interface AuthResponse {
  token: string;
  user: {
    id: string;
    email: string;
    fullName: string;
    employeeId: string;
    divisionId: string;
    branchId: string;
    roles: AppRole[];
    activeRole: AppRole;
  };
}

export async function loginWithPassword(payload: LoginRequest): Promise<AuthResponse> {
  const { data } = await apiClient.post<{ success: boolean; data: AuthResponse }>('/auth/login', payload);
  return data.data;
}

export async function loginWithGoogle(payload: GoogleAuthRequest): Promise<AuthResponse> {
  const { data } = await apiClient.post<{ success: boolean; data: AuthResponse }>('/auth/google', payload);
  return data.data;
}

export async function switchRole(role: AppRole): Promise<{ token: string; activeRole: AppRole }> {
  const { data } = await apiClient.post<{ success: boolean; data: { token: string; activeRole: AppRole } }>(
    '/auth/switch-role',
    { role }
  );
  return data.data;
}
