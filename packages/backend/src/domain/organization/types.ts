import { z } from 'zod';

export interface BranchRecord {
  id: string;
  code: string;
  name: string;
  city: string;
  address?: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface DivisionRecord {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export const createBranchSchema = z.object({
  code: z
    .string()
    .min(2, 'Kode cabang minimal 2 karakter')
    .max(64, 'Kode cabang maksimal 64 karakter')
    .regex(/^[A-Z0-9_-]+$/i, 'Kode cabang hanya boleh huruf, angka, strip, dan underscore'),
  name: z.string().min(2, 'Nama cabang minimal 2 karakter').max(255),
  city: z.string().min(2, 'Nama kota minimal 2 karakter').max(100),
  address: z.string().optional().nullable(),
  isActive: z.boolean().optional().default(true),
});

export const updateBranchSchema = z.object({
  code: z
    .string()
    .min(2, 'Kode cabang minimal 2 karakter')
    .max(64, 'Kode cabang maksimal 64 karakter')
    .regex(/^[A-Z0-9_-]+$/i, 'Kode cabang hanya boleh huruf, angka, strip, dan underscore')
    .optional(),
  name: z.string().min(2, 'Nama cabang minimal 2 karakter').max(255).optional(),
  city: z.string().min(2, 'Nama kota minimal 2 karakter').max(100).optional(),
  address: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
});

export const createDivisionSchema = z.object({
  code: z
    .string()
    .min(2, 'Kode divisi minimal 2 karakter')
    .max(64, 'Kode divisi maksimal 64 karakter')
    .regex(/^[A-Z0-9_-]+$/i, 'Kode divisi hanya boleh huruf, angka, strip, dan underscore'),
  name: z.string().min(2, 'Nama divisi minimal 2 karakter').max(255),
  description: z.string().optional().nullable(),
  isActive: z.boolean().optional().default(true),
});

export const updateDivisionSchema = z.object({
  code: z
    .string()
    .min(2, 'Kode divisi minimal 2 karakter')
    .max(64, 'Kode divisi maksimal 64 karakter')
    .regex(/^[A-Z0-9_-]+$/i, 'Kode divisi hanya boleh huruf, angka, strip, dan underscore')
    .optional(),
  name: z.string().min(2, 'Nama divisi minimal 2 karakter').max(255).optional(),
  description: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
});

export const toggleStatusSchema = z.object({
  isActive: z.boolean(),
});

export type CreateBranchInput = z.infer<typeof createBranchSchema>;
export type UpdateBranchInput = z.infer<typeof updateBranchSchema>;
export type CreateDivisionInput = z.infer<typeof createDivisionSchema>;
export type UpdateDivisionInput = z.infer<typeof updateDivisionSchema>;
export type ToggleStatusInput = z.infer<typeof toggleStatusSchema>;
