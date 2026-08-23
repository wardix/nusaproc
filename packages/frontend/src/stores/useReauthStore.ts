import { create } from 'zustand';

interface ReauthState {
  isOpen: boolean;
  targetAction?: string;
  errorDetail?: string;
  lastReauthToken?: string | null;
  openModal: (params: { targetAction?: string; errorDetail?: string }) => void;
  closeModal: () => void;
  confirmReauth: (token: string) => void;
}

export const useReauthStore = create<ReauthState>((set) => ({
  isOpen: false,
  targetAction: undefined,
  errorDetail: undefined,
  lastReauthToken: null,
  openModal: ({ targetAction, errorDetail }) =>
    set({
      isOpen: true,
      targetAction,
      errorDetail,
    }),
  closeModal: () =>
    set({
      isOpen: false,
      targetAction: undefined,
      errorDetail: undefined,
    }),
  confirmReauth: (token: string) =>
    set({
      isOpen: false,
      lastReauthToken: token,
      targetAction: undefined,
      errorDetail: undefined,
    }),
}));
