import { z } from 'zod';

export const feedbackCategorySchema = z.enum(['BUG', 'FEATURE_REQUEST', 'FEEDBACK']);
export type FeedbackCategory = z.infer<typeof feedbackCategorySchema>;

export const feedbackUrgencySchema = z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']);
export type FeedbackUrgency = z.infer<typeof feedbackUrgencySchema>;

export const feedbackStatusSchema = z.enum(['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED']);
export type FeedbackStatus = z.infer<typeof feedbackStatusSchema>;

export const createFeedbackSchema = z.object({
  category: feedbackCategorySchema.default('BUG'),
  urgency: feedbackUrgencySchema.default('MEDIUM'),
  title: z.string().max(255).optional(),
  description: z.string().min(3, 'Deskripsi wajib diisi minimal 3 karakter'),
  pageUrl: z.string().min(1, 'URL halaman wajib diisi'),
  activeRole: z.string().min(1, 'Peran aktif wajib diisi'),
  screenshotData: z.string().optional().nullable(),
  systemInfo: z.record(z.unknown()).optional().nullable(),
});
export type CreateFeedbackInput = z.infer<typeof createFeedbackSchema>;

export const updateFeedbackStatusSchema = z.object({
  status: feedbackStatusSchema,
  adminNotes: z.string().optional().nullable(),
});
export type UpdateFeedbackStatusInput = z.infer<typeof updateFeedbackStatusSchema>;

export interface SystemFeedbackRecord {
  id: string;
  userId: string | null;
  userFullName?: string | null;
  userEmail?: string | null;
  category: FeedbackCategory;
  urgency: FeedbackUrgency;
  title: string | null;
  description: string;
  pageUrl: string;
  activeRole: string;
  screenshotData: string | null;
  systemInfo: Record<string, unknown> | null;
  status: FeedbackStatus;
  adminNotes: string | null;
  createdAt: string;
  updatedAt: string;
}
