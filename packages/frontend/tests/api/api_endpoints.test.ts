import { describe, it, expect, beforeEach } from 'bun:test';
import { useAuthStore } from '../../src/stores/useAuthStore';
import { DEMO_PERSONAS } from '@nusaproc/shared';
import { prApi, poApi, vendorApi, receiptApi, invoiceApi, paymentApi, auditApi } from '../../src/api';

describe('Epic 15: Frontend TanStack Query API Client & Live Data Wiring', () => {
  beforeEach(() => {
    useAuthStore.getState().logout();
  });

  describe('1. Fast Persona Switching in Zustand Store', () => {
    it('switches active persona, user id, and activeRole accurately', () => {
      const requester = DEMO_PERSONAS.find((p) => p.role === 'REQUESTER')!;
      useAuthStore.getState().setUser({
        id: requester.id,
        email: requester.email,
        fullName: requester.fullName,
        employeeId: requester.employeeId,
        divisionId: requester.divisionId,
        branchId: requester.branchId,
        roles: [requester.role],
        activeRole: requester.role,
      });

      const state = useAuthStore.getState();
      expect(state.isAuthenticated).toBe(true);
      expect(state.user?.email).toBe('budi.santoso@nusanet.net.id');
      expect(state.user?.activeRole).toBe('REQUESTER');

      // Switch to Auditor
      const auditor = DEMO_PERSONAS.find((p) => p.role === 'AUDITOR')!;
      useAuthStore.getState().setUser({
        id: auditor.id,
        email: auditor.email,
        fullName: auditor.fullName,
        employeeId: auditor.employeeId,
        divisionId: auditor.divisionId,
        branchId: auditor.branchId,
        roles: [auditor.role],
        activeRole: auditor.role,
      });

      const updatedState = useAuthStore.getState();
      expect(updatedState.user?.email).toBe('agus.setiawan@nusanet.net.id');
      expect(updatedState.user?.activeRole).toBe('AUDITOR');
    });
  });

  describe('2. API Client Endpoint Methods Definition', () => {
    it('defines all required PR API methods', () => {
      expect(typeof prApi.list).toBe('function');
      expect(typeof prApi.getById).toBe('function');
      expect(typeof prApi.create).toBe('function');
      expect(typeof prApi.submit).toBe('function');
      expect(typeof prApi.decide).toBe('function');
    });

    it('defines all required PO & Vendor API methods', () => {
      expect(typeof poApi.getById).toBe('function');
      expect(typeof poApi.create).toBe('function');
      expect(typeof poApi.issue).toBe('function');
      expect(typeof poApi.downloadPdf).toBe('function');
      expect(typeof vendorApi.create).toBe('function');
      expect(typeof vendorApi.verifyBankAccount).toBe('function');
    });

    it('defines all required Receipt, Invoice & Payment API methods', () => {
      expect(typeof receiptApi.list).toBe('function');
      expect(typeof receiptApi.create).toBe('function');
      expect(typeof invoiceApi.list).toBe('function');
      expect(typeof invoiceApi.runMatch).toBe('function');
      expect(typeof invoiceApi.overrideException).toBe('function');
      expect(typeof paymentApi.list).toBe('function');
      expect(typeof paymentApi.check).toBe('function');
      expect(typeof paymentApi.execute).toBe('function');
    });

    it('defines all required Audit API methods', () => {
      expect(typeof auditApi.verifyChain).toBe('function');
      expect(typeof auditApi.getTrail).toBe('function');
      expect(typeof auditApi.downloadEvidenceBundle).toBe('function');
    });
  });
});
