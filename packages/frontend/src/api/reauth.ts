import type { AxiosError, AxiosInstance } from 'axios';
import { useReauthStore } from '../stores/useReauthStore';

export interface ReauthErrorResponseData {
  reauth_required?: boolean;
  ruleCode?: string;
  action?: string;
  title?: string;
  detail?: string;
}

export function handleReauthResponseError(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false;

  const axiosErr = error as AxiosError<ReauthErrorResponseData>;
  if (!axiosErr.response) return false;

  const data = axiosErr.response.data;
  const isReauthRequired =
    data?.reauth_required === true ||
    data?.ruleCode === 'R5_STEP_UP_REAUTH_REQUIRED' ||
    (axiosErr.response.status === 403 && data?.title?.includes('Step-Up Re-Authentication'));

  if (isReauthRequired) {
    useReauthStore.getState().openModal({
      targetAction: data?.action || 'CONFIRM_HIGH_RISK_ACTION',
      errorDetail: data?.detail || 'Tindakan berisiko tinggi ini memerlukan konfirmasi PIN / password.',
    });
    return true;
  }

  return false;
}

export function setupReauthInterceptor(client: AxiosInstance): void {
  client.interceptors.response.use(
    (response) => response,
    async (error) => {
      handleReauthResponseError(error);
      return Promise.reject(error);
    }
  );
}
