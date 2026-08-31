import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { AppRole } from '@nusaproc/shared';

export interface UserProfile {
  id: string;
  email: string;
  fullName: string;
  employeeId: string;
  divisionId: string;
  branchId: string;
  roles: AppRole[];
  activeRole: AppRole;
}

interface AuthState {
  user: UserProfile | null;
  token: string | null;
  isAuthenticated: boolean;
  setUser: (user: UserProfile | null) => void;
  setToken: (token: string | null) => void;
  setActiveRole: (role: AppRole) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      setUser: (user) => set({ user, isAuthenticated: !!user }),
      setToken: (token) => set({ token }),
      setActiveRole: (role) =>
        set((state) => ({
          user: state.user ? { ...state.user, activeRole: role } : null,
        })),
      logout: () => {
        set({ user: null, token: null, isAuthenticated: false });
        try {
          localStorage.removeItem('nusaproc-auth-storage');
        } catch {}
      },
    }),
    {
      name: 'nusaproc-auth-storage',
      storage: createJSONStorage(() => localStorage),
    }
  )
);
