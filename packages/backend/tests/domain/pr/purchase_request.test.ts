import { describe, it, expect, beforeAll } from 'bun:test';
import { sql } from '../../../src/db/client';
import { runMigrations } from '../../../src/db/migrate';
import {
  createPurchaseRequest,
  submitPurchaseRequest,
  decideApprovalStep,
  updatePurchaseRequest,
  closePartialPurchaseRequest,
  getPurchaseRequestById,
  type CreatePrInput,
} from '../../../src/domain/pr/service';
import { createPrApp } from '../../../src/domain/pr/routes';
import { SodConflictError, ScopeLimitExceededError } from '../../../src/domain/sod/errors';

describe('Epic 4: Purchase Request (PR) Multi-Items, Cara Bayar & State Machine', () => {
  let requesterId: string;
  let approverLeadId: string;
  let approverManagerId: string;

  beforeAll(async () => {
    await runMigrations();

    requesterId = crypto.randomUUID();
    approverLeadId = crypto.randomUUID();
    approverManagerId = crypto.randomUUID();

    await sql`
      INSERT INTO app_user (id, email, full_name, employee_id, division_id, branch_id)
      VALUES 
        (${requesterId}, ${`req-${requesterId}@nusanet.net.id`}, 'Budi Requester', ${`EMP-REQ-${requesterId.slice(0, 6)}`}, 'DIV-IT', 'HQ'),
        (${approverLeadId}, ${`lead-${approverLeadId}@nusanet.net.id`}, 'Agus Team Lead', ${`EMP-LEAD-${approverLeadId.slice(0, 6)}`}, 'DIV-IT', 'HQ'),
        (${approverManagerId}, ${`mgr-${approverManagerId}@nusanet.net.id`}, 'Dewi Manager', ${`EMP-MGR-${approverManagerId.slice(0, 6)}`}, 'DIV-IT', 'HQ')
    `;

    await sql`
      INSERT INTO user_role_assignment (user_id, role, assigned_by)
      VALUES 
        (${requesterId}, 'REQUESTER', ${requesterId}),
        (${approverLeadId}, 'APPROVER', ${approverLeadId}),
        (${approverManagerId}, 'APPROVER', ${approverManagerId})
    `;
  });

  describe('1. PR Creation & Multi-Items Validation (R6, R7, R8)', () => {
    it('creates a valid multi-item PR and accurately calculates total estimated amount', async () => {
      const input: CreatePrInput = {
        requesterId,
        costCenter: 'CC-IT-01',
        divisionId: 'DIV-IT',
        branchId: 'HQ',
        requiredDate: '2026-09-01',
        paymentTermType: 'PAY_AFTER_RECEIPT',
        businessJustification: 'Pengadaan router dan kabel switch jaringan core',
        items: [
          {
            lineNumber: 1,
            itemName: 'MikroTik CCR2004',
            specification: '16-port 10G SFP+',
            quantityRequested: 2,
            uom: 'Unit',
            estimatedUnitPrice: 8_500_000,
          },
          {
            lineNumber: 2,
            itemName: 'Kabel UTP Cat6 Patch Cord',
            specification: 'Panjang 3 meter Belden',
            quantityRequested: 10,
            uom: 'Pcs',
            estimatedUnitPrice: 75_000,
          },
        ],
      };

      const pr = await createPurchaseRequest(input);

      expect(pr).toBeDefined();
      expect(pr.status).toBe('DRAFT');
      expect(pr.paymentTermType).toBe('PAY_AFTER_RECEIPT');
      // 2 * 8,500,000 + 10 * 75,000 = 17,000,000 + 750,000 = 17,750,000
      expect(Number(pr.totalEstimatedAmount)).toBe(17_750_000);
      expect(pr.items.length).toBe(2);
      expect(pr.items[0].subtotal).toBe(17_000_000);
    });

    it('rejects PR creation when payment_term_type is missing (R7)', async () => {
      const invalidInput = {
        requesterId,
        costCenter: 'CC-IT-01',
        divisionId: 'DIV-IT',
        branchId: 'HQ',
        requiredDate: '2026-09-01',
        // paymentTermType is missing
        businessJustification: 'Test without payment term',
        items: [
          {
            lineNumber: 1,
            itemName: 'Item Test',
            quantityRequested: 1,
            uom: 'Unit',
            estimatedUnitPrice: 100000,
          },
        ],
      } as unknown as CreatePrInput;

      let errorCaught = false;
      try {
        await createPurchaseRequest(invalidInput);
      } catch (err: unknown) {
        errorCaught = true;
        const msg = err instanceof Error ? err.message : String(err);
        expect(msg).toContain('paymentTermType');
      }

      expect(errorCaught).toBe(true);
    });

    it('rejects PR creation when items list is empty (R6)', async () => {
      const invalidInput: CreatePrInput = {
        requesterId,
        costCenter: 'CC-IT-01',
        divisionId: 'DIV-IT',
        branchId: 'HQ',
        requiredDate: '2026-09-01',
        paymentTermType: 'ADVANCE_OR_COD',
        businessJustification: 'Test without items',
        items: [],
      };

      let errorCaught = false;
      try {
        await createPurchaseRequest(invalidInput);
      } catch (err: unknown) {
        errorCaught = true;
        const msg = err instanceof Error ? err.message : String(err);
        expect(msg).toContain('items');
      }

      expect(errorCaught).toBe(true);
    });
  });

  describe('2. State Machine & No Revision on Rejection (R9, R11, R12)', () => {
    it('submits PR and locks approval policy version (R12)', async () => {
      const pr = await createPurchaseRequest({
        requesterId,
        costCenter: 'CC-IT-01',
        divisionId: 'DIV-IT',
        branchId: 'HQ',
        requiredDate: '2026-09-01',
        paymentTermType: 'PAY_AFTER_RECEIPT',
        businessJustification: 'Server Rack 42U',
        items: [
          {
            lineNumber: 1,
            itemName: 'Server Rack 42U',
            quantityRequested: 1,
            uom: 'Unit',
            estimatedUnitPrice: 12_000_000,
          },
        ],
      });

      const submitted = await submitPurchaseRequest(pr.id, requesterId);

      expect(submitted.status).toBe('SUBMITTED');
      expect(submitted.lockedApprovalPolicyVersion).toBe('v1.0');

      // Check approval instance was generated
      const details = await getPurchaseRequestById(pr.id);
      expect(details.approvalInstances.length).toBeGreaterThanOrEqual(1);
      expect(details.approvalInstances[0].decision).toBe('PENDING');
    });

    it('R9: Rejects updates on REJECTED PR and requires creating a new PR', async () => {
      const pr = await createPurchaseRequest({
        requesterId,
        costCenter: 'CC-IT-01',
        divisionId: 'DIV-IT',
        branchId: 'HQ',
        requiredDate: '2026-09-01',
        paymentTermType: 'PAY_AFTER_RECEIPT',
        businessJustification: 'Monitor 27 inch',
        items: [
          {
            lineNumber: 1,
            itemName: 'Monitor 4K',
            quantityRequested: 1,
            uom: 'Unit',
            estimatedUnitPrice: 6_000_000,
          },
        ],
      });

      await submitPurchaseRequest(pr.id, requesterId);

      // Approver rejects PR with mandatory reason (R14)
      await decideApprovalStep({
        prId: pr.id,
        approverId: approverManagerId,
        decision: 'REJECTED',
        rejectionReason: 'Anggaran divisi IT Q3 untuk monitor telah habis',
      });

      const rejectedPr = await getPurchaseRequestById(pr.id);
      expect(rejectedPr.status).toBe('REJECTED');

      // Attempt to update rejected PR -> Must throw error (R9: Tanpa jalur revisi)
      let updateBlocked = false;
      try {
        await updatePurchaseRequest(pr.id, {
          businessJustification: 'Mohon dipertimbangkan kembali',
        });
      } catch (err: unknown) {
        updateBlocked = true;
        const msg = err instanceof Error ? err.message : String(err);
        expect(msg).toContain('R9');
      }

      expect(updateBlocked).toBe(true);
    });

    it('R11: Supports partial closing (CLOSED_PARTIAL) when remainder is cancelled', async () => {
      const pr = await createPurchaseRequest({
        requesterId,
        costCenter: 'CC-IT-01',
        divisionId: 'DIV-IT',
        branchId: 'HQ',
        requiredDate: '2026-09-01',
        paymentTermType: 'PAY_AFTER_RECEIPT',
        businessJustification: 'Laptop Developer 5 unit',
        items: [
          {
            lineNumber: 1,
            itemName: 'ThinkPad T14',
            quantityRequested: 2,
            uom: 'Unit',
            estimatedUnitPrice: 20_000_000,
          },
        ],
      });

      await submitPurchaseRequest(pr.id, requesterId);
      await decideApprovalStep({
        prId: pr.id,
        approverId: approverManagerId,
        decision: 'APPROVED',
      });

      const closed = await closePartialPurchaseRequest(
        pr.id,
        requesterId,
        'Hanya 3 unit yang tersedia di vendor, sisa 2 unit ditutup'
      );

      expect(closed.status).toBe('CLOSED_PARTIAL');
    });
  });

  describe('3. Hierarchy & Scope Approval Verification (R13, R15)', () => {
    it('R15: Blocks Requester from approving their own PR (Self-Approval)', async () => {
      const pr = await createPurchaseRequest({
        requesterId,
        costCenter: 'CC-IT-01',
        divisionId: 'DIV-IT',
        branchId: 'HQ',
        requiredDate: '2026-09-01',
        paymentTermType: 'PAY_AFTER_RECEIPT',
        businessJustification: 'Access Point WiFi 6',
        items: [
          {
            lineNumber: 1,
            itemName: 'UniFi U6 Pro',
            quantityRequested: 3,
            uom: 'Unit',
            estimatedUnitPrice: 2_500_000,
          },
        ],
      });

      await submitPurchaseRequest(pr.id, requesterId);

      let errorCaught = false;
      try {
        await decideApprovalStep({
          prId: pr.id,
          approverId: requesterId, // Same as requester
          decision: 'APPROVED',
        });
      } catch (err: unknown) {
        errorCaught = true;
        expect(err).toBeInstanceOf(SodConflictError);
      }

      expect(errorCaught).toBe(true);
    });

    it('R13: Rejects lower-level approver from approving amounts above their threshold', async () => {
      const pr = await createPurchaseRequest({
        requesterId,
        costCenter: 'CC-IT-01',
        divisionId: 'DIV-IT',
        branchId: 'HQ',
        requiredDate: '2026-09-01',
        paymentTermType: 'PAY_AFTER_RECEIPT',
        businessJustification: 'Core SAN Storage Upgrade',
        items: [
          {
            lineNumber: 1,
            itemName: 'SAN Storage Array',
            quantityRequested: 1,
            uom: 'Unit',
            estimatedUnitPrice: 150_000_000, // Exceeds Team Lead threshold (<= 10jt)
          },
        ],
      });

      await submitPurchaseRequest(pr.id, requesterId);

      let errorCaught = false;
      try {
        await decideApprovalStep({
          prId: pr.id,
          approverId: approverLeadId,
          approverMaxLimit: 10_000_000, // Team lead limit 10jt
          decision: 'APPROVED',
        });
      } catch (err: unknown) {
        errorCaught = true;
        expect(err).toBeInstanceOf(ScopeLimitExceededError);
      }

      expect(errorCaught).toBe(true);
    });
  });

  describe('4. Emergency Procurement & Auto Post-Review (R48, R49)', () => {
    it('R48: Requires emergency justification for emergency PRs', async () => {
      const invalidEmergency: CreatePrInput = {
        requesterId,
        costCenter: 'CC-IT-01',
        divisionId: 'DIV-IT',
        branchId: 'HQ',
        requiredDate: '2026-08-24',
        paymentTermType: 'ADVANCE_OR_COD',
        isEmergency: true,
        // emergencyJustification is missing
        businessJustification: 'Link FO putus',
        items: [
          {
            lineNumber: 1,
            itemName: 'Splicing Kit FO',
            quantityRequested: 1,
            uom: 'Set',
            estimatedUnitPrice: 5_000_000,
          },
        ],
      };

      let errorCaught = false;
      try {
        await createPurchaseRequest(invalidEmergency);
      } catch (err: unknown) {
        errorCaught = true;
        const msg = err instanceof Error ? err.message : String(err);
        expect(msg).toContain('emergencyJustification');
      }

      expect(errorCaught).toBe(true);
    });

    it('R49: Automatically creates record in emergency_post_review when emergency PR is approved', async () => {
      const emergencyPr = await createPurchaseRequest({
        requesterId,
        costCenter: 'CC-IT-01',
        divisionId: 'DIV-IT',
        branchId: 'HQ',
        requiredDate: '2026-08-24',
        paymentTermType: 'ADVANCE_OR_COD',
        isEmergency: true,
        emergencyJustification: 'Kabel Fiber Optic Backbone Terputus akibat galian pipa PDAM',
        businessJustification: 'Perbaikan darurat kabel backbone Medan-Binjai',
        items: [
          {
            lineNumber: 1,
            itemName: 'Kabel FO 48 Core & Joint Closure',
            quantityRequested: 1,
            uom: 'Set',
            estimatedUnitPrice: 15_000_000,
          },
        ],
      });

      await submitPurchaseRequest(emergencyPr.id, requesterId);
      await decideApprovalStep({
        prId: emergencyPr.id,
        approverId: approverManagerId,
        decision: 'APPROVED',
      });

      // Verify record exists in emergency_post_review
      const postReviews = await sql`
        SELECT * FROM emergency_post_review WHERE pr_id = ${emergencyPr.id}
      `;

      expect(postReviews.length).toBe(1);
      expect(postReviews[0].is_reviewed).toBe(false);
      expect(postReviews[0].review_due_date).toBeDefined();
    });
  });

  describe('5. Hono REST API Routes for Purchase Request', () => {
    it('creates, retrieves, and submits PR via REST API', async () => {
      const app = createPrApp();

      // 1. Create PR via API
      const createRes = await app.request('/purchase-requests', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Id': requesterId,
          'X-User-Role': 'REQUESTER',
        },
        body: JSON.stringify({
          costCenter: 'CC-IT-01',
          divisionId: 'DIV-IT',
          branchId: 'HQ',
          requiredDate: '2026-09-01',
          paymentTermType: 'PAY_AFTER_RECEIPT',
          businessJustification: 'Mouse Wireless Logitech',
          items: [
            {
              lineNumber: 1,
              itemName: 'Logitech M331',
              quantityRequested: 5,
              uom: 'Pcs',
              estimatedUnitPrice: 200_000,
            },
          ],
        }),
      });

      expect(createRes.status).toBe(201);
      const createBody = await createRes.json();
      expect(createBody.success).toBe(true);
      const createdPrId = createBody.data.id;

      // 2. Get PR via API
      const getRes = await app.request(`/purchase-requests/${createdPrId}`);
      expect(getRes.status).toBe(200);
      const getBody = await getRes.json();
      expect(getBody.data.id).toBe(createdPrId);
      expect(getBody.data.items.length).toBe(1);

      // 3. Submit PR via API
      const submitRes = await app.request(`/purchase-requests/${createdPrId}/submit`, {
        method: 'POST',
        headers: {
          'X-User-Id': requesterId,
          'X-User-Role': 'REQUESTER',
        },
      });

      expect(submitRes.status).toBe(200);
      const submitBody = await submitRes.json();
      expect(submitBody.data.status).toBe('SUBMITTED');
    });
  });
});
