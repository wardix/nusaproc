import { apiClient } from '../client';

export type FeedbackCategory = 'BUG' | 'FEATURE_REQUEST' | 'FEEDBACK';
export type FeedbackUrgency = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type FeedbackStatus = 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';

export interface CreateFeedbackPayload {
  category: FeedbackCategory;
  urgency?: FeedbackUrgency;
  title?: string;
  description: string;
  pageUrl: string;
  activeRole: string;
  screenshotData?: string | null;
  systemInfo?: Record<string, unknown>;
}

export interface FeedbackItem {
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

export const feedbackApi = {
  submit: (data: CreateFeedbackPayload) =>
    apiClient.post<{ success: boolean; data: FeedbackItem }>('/feedbacks', data).then((res) => res.data),

  list: (params?: { category?: string; status?: string; search?: string; limit?: number; offset?: number }) =>
    apiClient.get<{ success: boolean; data: FeedbackItem[]; total: number }>('/feedbacks', { params }).then((res) => res.data),

  getById: (id: string) =>
    apiClient.get<{ success: boolean; data: FeedbackItem }>(`/feedbacks/${id}`).then((res) => res.data),

  updateStatus: (id: string, data: { status: FeedbackStatus; adminNotes?: string }) =>
    apiClient.patch<{ success: boolean; data: FeedbackItem }>(`/feedbacks/${id}`, data).then((res) => res.data),
};
