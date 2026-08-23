import { useAuthStore } from '../stores/useAuthStore';
import type { AppRole } from '@nusaproc/shared';

export function useActiveRole() {
  const user = useAuthStore((state) => state.user);
  return {
    activeRole: user?.activeRole,
    roles: user?.roles ?? [],
    hasRole: (role: AppRole) => user?.roles.includes(role) ?? false,
  };
}
