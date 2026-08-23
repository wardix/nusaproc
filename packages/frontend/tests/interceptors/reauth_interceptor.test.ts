import { describe, it, expect, beforeEach } from 'bun:test';
import { useReauthStore } from '../../src/stores/useReauthStore';
import { handleReauthResponseError } from '../../src/api/reauth';
import type { AxiosError } from 'axios';

describe('Epic 10: [Frontend Core] Global Step-Up Re-Authentication Interceptor (R5, R43)', () => {
  beforeEach(() => {
    useReauthStore.getState().closeModal();
  });

  it('R5: Opens reauth modal when API response indicates Step-Up Reauth is required', async () => {
    expect(useReauthStore.getState().isOpen).toBe(false);

    const mockAxiosError = {
      isAxiosError: true,
      response: {
        status: 403,
        data: {
          reauth_required: true,
          ruleCode: 'R5_STEP_UP_REAUTH_REQUIRED',
          action: 'EXECUTE_PAYMENT',
          title: 'Step-Up Re-Authentication Required',
          detail: 'Tindakan ini memerlukan konfirmasi PIN / password.',
        },
      },
      config: {
        url: '/payments/proposals/123/execute',
        method: 'post',
        headers: {},
      },
    } as unknown as AxiosError;

    // Trigger error handler
    const handled = handleReauthResponseError(mockAxiosError);
    expect(handled).toBe(true);

    // Verify modal state in Zustand store
    const state = useReauthStore.getState();
    expect(state.isOpen).toBe(true);
    expect(state.targetAction).toBe('EXECUTE_PAYMENT');
  });

  it('R5: Resolves pending reauth promise and passes generated token back to caller', async () => {
    const mockAxiosError = {
      isAxiosError: true,
      response: {
        status: 401,
        data: {
          reauth_required: true,
          ruleCode: 'R5_STEP_UP_REAUTH_REQUIRED',
          action: 'APPROVE_HIGH_VALUE_PO',
        },
      },
      config: {
        url: '/po/123/approve',
        headers: {},
      },
    } as unknown as AxiosError;

    handleReauthResponseError(mockAxiosError);
    expect(useReauthStore.getState().isOpen).toBe(true);

    // Simulate user entering valid PIN in Reauth modal
    useReauthStore.getState().confirmReauth('valid-reauth-jwt-token-123');

    expect(useReauthStore.getState().isOpen).toBe(false);
    expect(useReauthStore.getState().lastReauthToken).toBe('valid-reauth-jwt-token-123');
  });

  it('ignores standard HTTP 404/500 errors without triggering reauth modal', () => {
    const standardError = {
      isAxiosError: true,
      response: {
        status: 404,
        data: {
          title: 'Not Found',
          detail: 'Resource tidak ditemukan',
        },
      },
      config: {},
    } as unknown as AxiosError;

    const handled = handleReauthResponseError(standardError);
    expect(handled).toBe(false);
    expect(useReauthStore.getState().isOpen).toBe(false);
  });
});
