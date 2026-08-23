import { describe, it, expect, beforeEach } from 'bun:test';
import { useAuthStore, type UserProfile } from '../../src/stores/useAuthStore';
import { getNavigationMenuItemsForRole } from '../../src/components/layout/navigation';

describe('Epic 10: [Frontend Core] Role Switcher & Navigation Filtering (US14, R56)', () => {
  const dummyUser: UserProfile = {
    id: '11111111-2222-3333-4444-555555555555',
    email: 'bimasakti@nusanet.net.id',
    fullName: 'Bima Sakti',
    employeeId: 'EMP-001',
    divisionId: 'DIV-TECH',
    branchId: 'HQ_MEDAN',
    roles: ['REQUESTER', 'APPROVER', 'ACCOUNT_PAYABLE', 'WAREHOUSE', 'FINANCE', 'AUDITOR', 'ADMIN'],
    activeRole: 'REQUESTER',
  };

  beforeEach(() => {
    useAuthStore.getState().setUser(dummyUser);
    useAuthStore.getState().setActiveRole('REQUESTER');
  });

  it('US14: Switches active role in Zustand store without altering user profile', () => {
    expect(useAuthStore.getState().user?.activeRole).toBe('REQUESTER');

    useAuthStore.getState().setActiveRole('FINANCE');
    expect(useAuthStore.getState().user?.activeRole).toBe('FINANCE');
    expect(useAuthStore.getState().user?.email).toBe('bimasakti@nusanet.net.id');
  });

  it('filters navigation menu items for REQUESTER role', () => {
    const items = getNavigationMenuItemsForRole('REQUESTER');
    const keys = items.map((i) => i?.key);
    expect(keys).toContain('/pr');
    expect(keys).not.toContain('/audit');
    expect(keys).not.toContain('/payments');
  });

  it('filters navigation menu items for WAREHOUSE role', () => {
    const items = getNavigationMenuItemsForRole('WAREHOUSE');
    const keys = items.map((i) => i?.key);
    expect(keys).toContain('/receipts');
    expect(keys).toContain('/ncr');
    expect(keys).not.toContain('/payments');
  });

  it('filters navigation menu items for ACCOUNT_PAYABLE role', () => {
    const items = getNavigationMenuItemsForRole('ACCOUNT_PAYABLE');
    const keys = items.map((i) => i?.key);
    expect(keys).toContain('/invoices');
    expect(keys).toContain('/payments');
  });

  it('filters navigation menu items for FINANCE role', () => {
    const items = getNavigationMenuItemsForRole('FINANCE');
    const keys = items.map((i) => i?.key);
    expect(keys).toContain('/invoices');
    expect(keys).toContain('/payments');
  });

  it('filters navigation menu items for AUDITOR role', () => {
    const items = getNavigationMenuItemsForRole('AUDITOR');
    const keys = items.map((i) => i?.key);
    expect(keys).toContain('/audit');
    expect(keys).not.toContain('/pr');
  });

  it('provides full administrative navigation menu items for ADMIN role', () => {
    const items = getNavigationMenuItemsForRole('ADMIN');
    const keys = items.map((i) => i?.key);
    expect(keys).toContain('/pr');
    expect(keys).toContain('/po');
    expect(keys).toContain('/receipts');
    expect(keys).toContain('/invoices');
    expect(keys).toContain('/payments');
    expect(keys).toContain('/audit');
  });
});
