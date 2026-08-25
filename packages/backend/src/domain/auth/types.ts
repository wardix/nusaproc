import { z } from 'zod';
import type { AppRole } from '@nusaproc/shared';

export const APP_ROLES: [AppRole, ...AppRole[]] = [
  'REQUESTER',
  'APPROVER',
  'ACCOUNT_PAYABLE',
  'WAREHOUSE',
  'FINANCE',
  'AUDITOR',
  'ADMIN',
];

export const loginSchema = z.object({
  email: z.string().email('Format email tidak valid'),
  password: z.string().min(1, 'Password wajib diisi'),
  requestedRole: z.enum(APP_ROLES).optional(),
});

export type LoginInput = z.infer<typeof loginSchema>;

export const googleAuthSchema = z.object({
  credential: z.string().optional(),
  idToken: z.string().optional(),
  requestedRole: z.enum(APP_ROLES).optional(),
}).refine((data) => data.credential || data.idToken, {
  message: 'Credential atau idToken wajib disediakan',
});

export type GoogleAuthInput = z.infer<typeof googleAuthSchema>;

export const roleAssignmentItemSchema = z.object({
  role: z.enum(APP_ROLES),
  isTaxSpecialist: z.boolean().optional().default(false),
  validFrom: z.string().optional(),
  validUntil: z.string().nullable().optional(),
});

export const createUserSchema = z.object({
  email: z.string().email('Format email tidak valid'),
  fullName: z.string().min(2, 'Nama lengkap minimal 2 karakter'),
  employeeId: z.string().min(2, 'NIP/Employee ID minimal 2 karakter'),
  divisionId: z.string().min(1, 'Divisi wajib dipilih'),
  branchId: z.string().min(1, 'Cabang wajib dipilih'),
  initialPassword: z.string().min(6, 'Password minimal 6 karakter').optional(),
  isLocalFallback: z.boolean().optional().default(true),
  roles: z.array(roleAssignmentItemSchema).min(1, 'Setidaknya 1 peran wajib ditetapkan'),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;

export const updateUserRolesSchema = z.object({
  roles: z.array(roleAssignmentItemSchema).min(1, 'Setidaknya 1 peran wajib ditetapkan'),
});

export type UpdateUserRolesInput = z.infer<typeof updateUserRolesSchema>;

export const updateUserStatusSchema = z.object({
  isActive: z.boolean(),
});

export type UpdateUserStatusInput = z.infer<typeof updateUserStatusSchema>;

export interface UserRoleRecord {
  id: string;
  role: AppRole;
  isTaxSpecialist: boolean;
  validFrom: string;
  validUntil: string | null;
  assignedBy: string;
}

export interface UserDetail {
  id: string;
  email: string;
  fullName: string;
  employeeId: string;
  divisionId: string;
  branchId: string;
  isActive: boolean;
  isLocalFallback: boolean;
  totpEnabled: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
  roles: UserRoleRecord[];
}

export interface AuthSuccessResult {
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
