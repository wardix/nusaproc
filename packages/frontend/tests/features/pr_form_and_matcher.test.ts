import { describe, it, expect } from 'bun:test';
import { calculatePrGrandTotal } from '../../src/features/pr/utils/calculator';
import {
  evaluateTwoWayMatchingStatus,
  type TwoWayMatchEvaluation,
} from '../../src/features/invoice/utils/matching';
import { getPaymentWorkflowCurrentStep } from '../../src/features/payment/utils/workflow';
import { formatRupiah } from '../../src/utils/currency';

describe('Epic 11: [Frontend Features] Form.List PR, Side-by-Side Matcher & Maker-Checker Steps', () => {
  describe('1. Form.List Multi-Item PR Grand Total Calculation (R6, R7)', () => {
    it('calculates grand total accurately for multiple item rows', () => {
      const items = [
        { itemName: 'MikroTik CCR2004', quantityRequested: 2, estimatedUnitPrice: 7500000 },
        { itemName: 'Patch Cord Cat6 3M', quantityRequested: 10, estimatedUnitPrice: 50000 },
        { itemName: 'SFP+ Transceiver 10G', quantityRequested: 4, estimatedUnitPrice: 750000 },
      ];

      const grandTotal = calculatePrGrandTotal(items);
      // (2 * 7,500,000) + (10 * 50,000) + (4 * 750,000) = 15,000,000 + 500,000 + 3,000,000 = 18,500,000
      expect(grandTotal).toBe(18500000);
      expect(formatRupiah(grandTotal)).toContain('18.500.000');
    });

    it('handles empty items and zero or undefined values safely', () => {
      expect(calculatePrGrandTotal([])).toBe(0);
      expect(calculatePrGrandTotal([{ itemName: 'Item A', quantityRequested: 0, estimatedUnitPrice: 100000 }])).toBe(0);
      expect(calculatePrGrandTotal([{ itemName: 'Item B', quantityRequested: undefined, estimatedUnitPrice: undefined }])).toBe(0);
    });
  });

  describe('2. Side-by-Side 2-Way Matcher Tolerance Evaluation (R37, R38, R39)', () => {
    it('returns exact match status (Green / success) when variance is 0', () => {
      const evaluation: TwoWayMatchEvaluation = evaluateTwoWayMatchingStatus(10000000, 10000000);
      expect(evaluation.status).toBe('MATCHED_OK');
      expect(evaluation.isExactMatch).toBe(true);
      expect(evaluation.isWithinTolerance).toBe(true);
      expect(evaluation.tagColor).toBe('success');
      expect(evaluation.alertType).toBe('success');
    });

    it('returns within tolerance status (Yellow / warning) when difference is <= Rp 100.000', () => {
      // Variance Rp 50.000 on Rp 10.000.000 (0.5% variance <= 1.0% and <= 100.000)
      const evaluation = evaluateTwoWayMatchingStatus(10000000, 10050000);
      expect(evaluation.status).toBe('MATCHED_OK');
      expect(evaluation.isExactMatch).toBe(false);
      expect(evaluation.isWithinTolerance).toBe(true);
      expect(evaluation.tagColor).toBe('warning');
      expect(evaluation.alertType).toBe('warning');
    });

    it('returns exception status (Red / error) when difference exceeds tolerance (R38)', () => {
      // Variance Rp 1.000.000 on Rp 10.000.000 (10% variance > 1.0% and > 100.000)
      const evaluation = evaluateTwoWayMatchingStatus(10000000, 11000000);
      expect(evaluation.status).toBe('MATCHED_WITH_EXCEPTION');
      expect(evaluation.isExactMatch).toBe(false);
      expect(evaluation.isWithinTolerance).toBe(false);
      expect(evaluation.tagColor).toBe('error');
      expect(evaluation.alertType).toBe('error');
      expect(evaluation.requiresOverride).toBe(true);
    });
  });

  describe('3. Payment Maker-Checker-Executor Steps (R42)', () => {
    it('maps payment proposal status to correct visual step index', () => {
      expect(getPaymentWorkflowCurrentStep('DRAFT')).toBe(0); // Maker
      expect(getPaymentWorkflowCurrentStep('PENDING_CHECK')).toBe(1); // Checker
      expect(getPaymentWorkflowCurrentStep('APPROVED_FOR_PAYMENT')).toBe(2); // Executor
      expect(getPaymentWorkflowCurrentStep('PAID')).toBe(3); // Finished
      expect(getPaymentWorkflowCurrentStep('REJECTED')).toBe(1); // Rejected at checker stage
    });
  });

  describe('4. Navigation and Route Mapping (Issue #47)', () => {
    it('maps Approver routes and VendorListPage in router config', async () => {
      const { routes } = await import('../../src/routes');
      const rootRoute = routes.find((r) => r.path === '/');
      const children = rootRoute?.children || [];
      const childPaths = children.map((c) => c.path);

      expect(childPaths).toContain('approvals/pr');
      expect(childPaths).toContain('approvals/po');
      expect(childPaths).toContain('vendors');
      expect(childPaths).toContain('invoices');
    });
  });
});

