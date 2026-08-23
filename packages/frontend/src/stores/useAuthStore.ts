import { create } from 'zustand';
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

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  isAuthenticated: false,
  setUser: (user) => set({ user, isAuthenticated: !!user }),
  setToken: (token) => set({ token }),
  setActiveRole: (role) =>
    set((state) => ({
      user: state.user ? { ...state.user, activeRole: role } : null,
    })),
  logout: () => set({ user: null, token: null, isAuthenticated: false }),
}));
