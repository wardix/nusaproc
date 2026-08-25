import { describe, it, expect, beforeEach } from 'bun:test';
import { useAuthStore } from '../../src/stores/useAuthStore';
import {
  loginWithPassword,
  loginWithGoogle,
  switchRole,
  fetchUsers,
  createUser,
  updateUserRoles,
  updateUserStatus,
} from '../../src/api';
import { getNavigationMenuItemsForRole } from '../../src/components/layout/navigation';

describe('Epic 19: Frontend Hybrid Authentication & Admin User Management', () => {
  beforeEach(() => {
    useAuthStore.getState().logout();
  });

  describe('1. Frontend Auth Store & Navigation', () => {
    it('manages authentication state in Zustand store', () => {
      expect(useAuthStore.getState().isAuthenticated).toBe(false);
      expect(useAuthStore.getState().user).toBeNull();

      useAuthStore.getState().setUser({
        id: 'user-123',
        email: 'hendra.wijaya@nusanet.net.id',
        fullName: 'Hendra Wijaya',
        employeeId: 'EMP-HD01',
        divisionId: 'DIV-FIN',
        branchId: 'HQ_MEDAN',
        roles: ['ACCOUNT_PAYABLE', 'ADMIN'],
        activeRole: 'ADMIN',
      });
      useAuthStore.getState().setToken('mock-jwt-token');

      const state = useAuthStore.getState();
      expect(state.isAuthenticated).toBe(true);
      expect(state.token).toBe('mock-jwt-token');
      expect(state.user?.activeRole).toBe('ADMIN');

      useAuthStore.getState().logout();
      expect(useAuthStore.getState().isAuthenticated).toBe(false);
      expect(useAuthStore.getState().token).toBeNull();
    });

    it('provides Admin User Management navigation item for ADMIN role', () => {
      const adminNavItems = getNavigationMenuItemsForRole('ADMIN');
      const hasUserManagement = adminNavItems.some(
        (item) => item && 'key' in item && item.key === '/admin/users'
      );
      expect(hasUserManagement).toBe(true);

      const requesterNavItems = getNavigationMenuItemsForRole('REQUESTER');
      const requesterHasUserManagement = requesterNavItems.some(
        (item) => item && 'key' in item && item.key === '/admin/users'
      );
      expect(requesterHasUserManagement).toBe(false);
    });
  });

  describe('2. Auth and User Management API Functions', () => {
    it('exports all required authentication and user management API functions', () => {
      expect(typeof loginWithPassword).toBe('function');
      expect(typeof loginWithGoogle).toBe('function');
      expect(typeof switchRole).toBe('function');
      expect(typeof fetchUsers).toBe('function');
      expect(typeof createUser).toBe('function');
      expect(typeof updateUserRoles).toBe('function');
      expect(typeof updateUserStatus).toBe('function');
    });
  });
});
