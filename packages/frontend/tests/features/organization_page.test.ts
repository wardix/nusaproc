import { describe, it, expect } from 'bun:test';
import { branchesApi, divisionsApi } from '../../src/api';
import { getNavigationMenuItemsForRole } from '../../src/components/layout/navigation';
import { routes } from '../../src/routes';

describe('Epic Master Data: Frontend Master Organization Integration (US12, R1, R2)', () => {
  describe('1. API Client Endpoints Definition', () => {
    it('defines all required branchesApi methods', () => {
      expect(typeof branchesApi.list).toBe('function');
      expect(typeof branchesApi.getById).toBe('function');
      expect(typeof branchesApi.create).toBe('function');
      expect(typeof branchesApi.update).toBe('function');
      expect(typeof branchesApi.toggleStatus).toBe('function');
    });

    it('defines all required divisionsApi methods', () => {
      expect(typeof divisionsApi.list).toBe('function');
      expect(typeof divisionsApi.getById).toBe('function');
      expect(typeof divisionsApi.create).toBe('function');
      expect(typeof divisionsApi.update).toBe('function');
      expect(typeof divisionsApi.toggleStatus).toBe('function');
    });
  });

  describe('2. Navigation Menu Integration', () => {
    it('provides Master Cabang & Divisi navigation menu item for ADMIN role', () => {
      const adminNavItems = getNavigationMenuItemsForRole('ADMIN');
      const hasOrgManagement = adminNavItems.some(
        (item) => item && 'key' in item && item.key === '/admin/organization'
      );
      expect(hasOrgManagement).toBe(true);
    });

    it('hides Master Cabang & Divisi navigation item from non-ADMIN roles', () => {
      const requesterNavItems = getNavigationMenuItemsForRole('REQUESTER');
      expect(
        requesterNavItems.some((item) => item && 'key' in item && item.key === '/admin/organization')
      ).toBe(false);

      const financeNavItems = getNavigationMenuItemsForRole('FINANCE');
      expect(
        financeNavItems.some((item) => item && 'key' in item && item.key === '/admin/organization')
      ).toBe(false);
    });
  });

  describe('3. Route Mapping Configuration', () => {
    it('maps /admin/organization route to AdminOrganizationPage component in routes definition', () => {
      const rootRoute = routes.find((r) => r.path === '/');
      expect(rootRoute).toBeDefined();

      const orgRoute = rootRoute?.children?.find((c) => c.path === 'admin/organization');
      expect(orgRoute).toBeDefined();
      expect(orgRoute?.element).toBeDefined();
    });
  });
});
