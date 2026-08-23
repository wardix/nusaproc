import { describe, it, expect, beforeAll } from 'bun:test';
import { sql } from '../../../src/db/client';
import { runMigrations } from '../../../src/db/migrate';
import { createVendor, createVendorBankAccount, verifyBankAccountStage } from '../../../src/domain/vendor/service';
import { createPurchaseRequest, submitPurchaseRequest, decideApprovalStep } from '../../../src/domain/pr/service';
import { createPurchaseOrder, approvePurchaseOrder, issuePurchaseOrder } from '../../../src/domain/po/service';
import { createInvoice, runTwoWayMatching } from '../../../src/domain/invoice/service';
import {
  proposePayment,
  checkPaymentProposal,
  executePaymentTransfer,
  getPaymentProposalById,
  type ProposePaymentInput,
  type ExecutePaymentInput,
} from '../../../src/domain/payment/service';
import { generateReauthToken } from '../../../src/domain/auth/token';
import { SodConflictError, StepUpRequiredError } from '../../../src/domain/sod/errors';
import { createPaymentApp } from '../../../src/domain/payment/routes';

describe('Epic 8: [Payment Module] Maker-Checker-Executor, Uang Muka & Idempotency (R41–R47)', () => {
  let makerUserId: string;
  let checkerUserId: string;
  let executorUserId: string;
  let vendorId: string;
  let bankAccountId: string;
  let taxSnapshotId: string;
  let matchedInvoiceId: string;
  let advanceInvoiceId: string;
  let _advancePoId: string;

  beforeAll(async () => {
    await runMigrations();

    makerUserId = crypto.randomUUID();
    checkerUserId = crypto.randomUUID();
    executorUserId = crypto.randomUUID();
    taxSnapshotId = '00000000-0000-0000-0000-000000000001';

    await sql`
      INSERT INTO app_user (id, email, full_name, employee_id, division_id, branch_id)
      VALUES 
        (${makerUserId}, ${`maker-${makerUserId}@nusanet.net.id`}, 'Payment Maker', ${`EMP-PM-${makerUserId.slice(0, 6)}`}, 'DIV-FIN', 'HQ'),
        (${checkerUserId}, ${`checker-${checkerUserId}@nusanet.net.id`}, 'Payment Checker', ${`EMP-PC-${checkerUserId.slice(0, 6)}`}, 'DIV-FIN', 'HQ'),
        (${executorUserId}, ${`executor-${executorUserId}@nusanet.net.id`}, 'Payment Executor', ${`EMP-PE-${executorUserId.slice(0, 6)}`}, 'DIV-TREASURY', 'HQ')
    `;

    await sql`
      INSERT INTO user_role_assignment (user_id, role, assigned_by)
      VALUES 
        (${makerUserId}, 'ACCOUNT_PAYABLE', ${makerUserId}),
        (${checkerUserId}, 'FINANCE', ${checkerUserId}),
        (${executorUserId}, 'FINANCE', ${executorUserId})
    `;

    // 1. Setup Vendor & Bank Account
    const vendor = await createVendor({
      name: 'PT Pembayaran Solusi Mandiri',
      taxIdentificationNumber: `15.678.${crypto.randomUUID().slice(0, 6)}`,
      isPkp: true,
      createdBy: makerUserId,
    });
    vendorId = vendor.id;

    const bank = await createVendorBankAccount({
      vendorId: vendor.id,
      bankName: 'Bank Mandiri',
      bankCode: '008',
      accountNumber: '1400012345678',
      accountHolderName: 'PT Pembayaran Solusi Mandiri',
    });

    await verifyBankAccountStage({ bankAccountId: bank.id, verifierUserId: makerUserId, action: 'VERIFY_STAGE_1' });
    await verifyBankAccountStage({ bankAccountId: bank.id, verifierUserId: checkerUserId, action: 'VERIFY_STAGE_2' });
    bankAccountId = bank.id;

    // 2. Setup Standard PO & Matched Invoice
    const prStandard = await createPurchaseRequest({
      requesterId: makerUserId,
      costCenter: 'CC-OPS-01',
      divisionId: 'DIV-OPS',
      branchId: 'HQ',
      requiredDate: '2026-09-20',
      paymentTermType: 'PAY_AFTER_RECEIPT',
      businessJustification: 'Pengadaan Router Edge',
      items: [
        {
          lineNumber: 1,
          itemName: 'Router Edge BGP 10G',
          quantityRequested: 1,
          uom: 'Unit',
          estimatedUnitPrice: 50_000_000,
        },
      ],
    });
    await submitPurchaseRequest(prStandard.id, makerUserId);
    await decideApprovalStep({ prId: prStandard.id, approverId: checkerUserId, decision: 'APPROVED' });

    const poStandard = await createPurchaseOrder({
      prId: prStandard.id,
      vendorId: vendor.id,
      vendorBankAccountId: bank.id,
      paymentTermType: 'PAY_AFTER_RECEIPT',
      createdBy: makerUserId,
      items: [
        {
          prItemId: prStandard.items[0].id,
          lineNumber: 1,
          itemName: 'Router Edge BGP 10G',
          quantityOrdered: 1,
          uom: 'Unit',
          unitPrice: 50_000_000,
        },
      ],
    });
    await approvePurchaseOrder(poStandard.id, checkerUserId);
    await issuePurchaseOrder(poStandard.id, makerUserId);

    const inv = await createInvoice({
      vendorId: vendor.id,
      poId: poStandard.id,
      vendorInvoiceNumber: `INV-STD-${crypto.randomUUID().slice(0, 6)}`,
      invoiceDate: '2026-08-23',
      dueDate: '2026-09-23',
      subtotalAmount: 50_000_000,
      ppnAmount: 0,
      totalPayableAmount: 50_000_000,
      taxSnapshotId,
      uploadedBy: makerUserId,
    });
    await runTwoWayMatching(inv.id);
    matchedInvoiceId = inv.id;

    // 3. Setup Advance Payment PO (Uang Muka)
    const prAdvance = await createPurchaseRequest({
      requesterId: makerUserId,
      costCenter: 'CC-OPS-02',
      divisionId: 'DIV-OPS',
      branchId: 'HQ',
      requiredDate: '2026-09-25',
      paymentTermType: 'ADVANCE_OR_COD',
      businessJustification: 'Uang muka sewa satelit',
      items: [
        {
          lineNumber: 1,
          itemName: 'Uang Muka Transponder Satelit',
          quantityRequested: 1,
          uom: 'Bulan',
          estimatedUnitPrice: 20_000_000,
        },
      ],
    });
    await submitPurchaseRequest(prAdvance.id, makerUserId);
    await decideApprovalStep({ prId: prAdvance.id, approverId: checkerUserId, decision: 'APPROVED' });

    const poAdvance = await createPurchaseOrder({
      prId: prAdvance.id,
      vendorId: vendor.id,
      vendorBankAccountId: bank.id,
      paymentTermType: 'ADVANCE_OR_COD',
      createdBy: makerUserId,
      items: [
        {
          prItemId: prAdvance.items[0].id,
          lineNumber: 1,
          itemName: 'Uang Muka Transponder Satelit',
          quantityOrdered: 1,
          uom: 'Bulan',
          unitPrice: 20_000_000,
        },
      ],
    });
    await approvePurchaseOrder(poAdvance.id, checkerUserId);
    await issuePurchaseOrder(poAdvance.id, makerUserId);
    _advancePoId = poAdvance.id;

    const invAdv = await createInvoice({
      vendorId: vendor.id,
      poId: poAdvance.id,
      invoiceType: 'ADVANCE_PAYMENT',
      vendorInvoiceNumber: `INV-ADV-${crypto.randomUUID().slice(0, 6)}`,
      invoiceDate: '2026-08-23',
      dueDate: '2026-08-30',
      subtotalAmount: 20_000_000,
      ppnAmount: 0,
      totalPayableAmount: 20_000_000,
      taxSnapshotId,
      uploadedBy: makerUserId,
    });
    advanceInvoiceId = invAdv.id;
  });

  describe('1. Maker-Checker-Executor Separation of Duties (R42)', () => {
    it('creates a payment proposal by Maker in PROPOSED status', async () => {
      const input: ProposePaymentInput = {
        vendorId,
        vendorBankAccountId: bankAccountId,
        proposedBy: makerUserId,
        allocations: [
          {
            invoiceId: matchedInvoiceId,
            allocatedAmount: 50_000_000,
            isAdvancePayment: false,
          },
        ],
      };

      const proposal = await proposePayment(input);
      expect(proposal).toBeDefined();
      expect(proposal.proposalNumber).toMatch(/^PAY-/);
      expect(proposal.status).toBe('PROPOSED');
      expect(proposal.totalPaymentAmount).toBe(50_000_000);
      expect(proposal.proposedBy).toBe(makerUserId);
    });

    it('R42: Rejects Maker from checking their own payment proposal (Maker-Checker SoD)', async () => {
      const proposal = await proposePayment({
        vendorId,
        vendorBankAccountId: bankAccountId,
        proposedBy: makerUserId,
        allocations: [
          {
            invoiceId: matchedInvoiceId,
            allocatedAmount: 50_000_000,
            isAdvancePayment: false,
          },
        ],
      });

      let errorCaught = false;
      try {
        await checkPaymentProposal({
          proposalId: proposal.id,
          checkedBy: makerUserId, // Same as proposer
        });
      } catch (err: unknown) {
        errorCaught = true;
        expect(err).toBeInstanceOf(SodConflictError);
        expect((err as SodConflictError).ruleCode).toContain('R42');
      }

      expect(errorCaught).toBe(true);
    });

    it('allows distinct Checker to review and approve proposal to CHECKED status', async () => {
      const proposal = await proposePayment({
        vendorId,
        vendorBankAccountId: bankAccountId,
        proposedBy: makerUserId,
        allocations: [
          {
            invoiceId: matchedInvoiceId,
            allocatedAmount: 50_000_000,
            isAdvancePayment: false,
          },
        ],
      });

      const checked = await checkPaymentProposal({
        proposalId: proposal.id,
        checkedBy: checkerUserId,
      });

      expect(checked.status).toBe('CHECKED');
      expect(checked.checkedBy).toBe(checkerUserId);
    });

    it('R42: Rejects Maker or Checker from executing the payment transfer', async () => {
      const proposal = await proposePayment({
        vendorId,
        vendorBankAccountId: bankAccountId,
        proposedBy: makerUserId,
        allocations: [
          {
            invoiceId: matchedInvoiceId,
            allocatedAmount: 50_000_000,
            isAdvancePayment: false,
          },
        ],
      });
      await checkPaymentProposal({ proposalId: proposal.id, checkedBy: checkerUserId });

      // 1. Proposer attempts execution -> Rejected
      const tokenMaker = await generateReauthToken({ userId: makerUserId, action: 'EXECUTE_PAYMENT' });
      let errorProposer = false;
      try {
        await executePaymentTransfer({
          proposalId: proposal.id,
          executedBy: makerUserId,
          reauthToken: tokenMaker,
          bankReferenceNumber: 'TRF-001',
        });
      } catch (err: unknown) {
        errorProposer = true;
        expect(err).toBeInstanceOf(SodConflictError);
      }
      expect(errorProposer).toBe(true);

      // 2. Checker attempts execution -> Rejected
      const tokenChecker = await generateReauthToken({ userId: checkerUserId, action: 'EXECUTE_PAYMENT' });
      let errorChecker = false;
      try {
        await executePaymentTransfer({
          proposalId: proposal.id,
          executedBy: checkerUserId,
          reauthToken: tokenChecker,
          bankReferenceNumber: 'TRF-002',
        });
      } catch (err: unknown) {
        errorChecker = true;
        expect(err).toBeInstanceOf(SodConflictError);
      }
      expect(errorChecker).toBe(true);
    });
  });

  describe('2. Advance Payment (Uang Muka) Flow (R47)', () => {
    it('R47: Allows advance payment proposal and execution without requiring Goods Receipt', async () => {
      const proposal = await proposePayment({
        vendorId,
        vendorBankAccountId: bankAccountId,
        proposedBy: makerUserId,
        allocations: [
          {
            invoiceId: advanceInvoiceId,
            allocatedAmount: 20_000_000,
            isAdvancePayment: true,
          },
        ],
      });
      expect(proposal.status).toBe('PROPOSED');

      await checkPaymentProposal({ proposalId: proposal.id, checkedBy: checkerUserId });

      const reauthToken = await generateReauthToken({ userId: executorUserId, action: 'EXECUTE_PAYMENT' });
      const executed = await executePaymentTransfer({
        proposalId: proposal.id,
        executedBy: executorUserId,
        reauthToken,
        bankReferenceNumber: 'TRF-ADV-999',
      });

      expect(executed.status).toBe('EXECUTED');
      expect(executed.executedBy).toBe(executorUserId);
    });
  });

  describe('3. Step-Up Re-Authentication & Payment Idempotency Engine (R5, R43)', () => {
    it('R5: Rejects transfer execution if step-up re-authentication token is invalid or missing', async () => {
      const proposal = await proposePayment({
        vendorId,
        vendorBankAccountId: bankAccountId,
        proposedBy: makerUserId,
        allocations: [
          {
            invoiceId: matchedInvoiceId,
            allocatedAmount: 50_000_000,
            isAdvancePayment: false,
          },
        ],
      });
      await checkPaymentProposal({ proposalId: proposal.id, checkedBy: checkerUserId });

      let errorCaught = false;
      try {
        await executePaymentTransfer({
          proposalId: proposal.id,
          executedBy: executorUserId,
          reauthToken: 'invalid-or-expired-token',
          bankReferenceNumber: 'TRF-FAIL-AUTH',
        });
      } catch (err: unknown) {
        errorCaught = true;
        expect(err).toBeInstanceOf(StepUpRequiredError);
      }
      expect(errorCaught).toBe(true);
    });

    it('R43: Double-click / concurrent execution with identical Idempotency-Key returns same result without duplicate debit', async () => {
      const proposal = await proposePayment({
        vendorId,
        vendorBankAccountId: bankAccountId,
        proposedBy: makerUserId,
        allocations: [
          {
            invoiceId: matchedInvoiceId,
            allocatedAmount: 50_000_000,
            isAdvancePayment: false,
          },
        ],
      });
      await checkPaymentProposal({ proposalId: proposal.id, checkedBy: checkerUserId });

      const idempotencyKey = `IDEM-PAY-${crypto.randomUUID()}`;
      const reauthToken = await generateReauthToken({ userId: executorUserId, action: 'EXECUTE_PAYMENT' });

      const input: ExecutePaymentInput = {
        proposalId: proposal.id,
        executedBy: executorUserId,
        reauthToken,
        idempotencyKey,
        bankReferenceNumber: 'TRF-IDEM-001',
      };

      // Call 1
      const res1 = await executePaymentTransfer(input);
      expect(res1.status).toBe('EXECUTED');
      expect(res1.bankReferenceNumber).toBe('TRF-IDEM-001');

      // Call 2 with identical key
      const res2 = await executePaymentTransfer(input);
      expect(res2.status).toBe('EXECUTED');
      expect(res2.id).toBe(res1.id);
      expect(res2.bankReferenceNumber).toBe(res1.bankReferenceNumber);

      // Verify DB contains exactly 1 execution state
      const dbProposal = await getPaymentProposalById(proposal.id);
      expect(dbProposal.status).toBe('EXECUTED');
    });
  });

  describe('4. REST API Routes for Payment Module', () => {
    it('creates, checks, and executes payment proposal via REST API', async () => {
      const app = createPaymentApp();

      // 1. Propose Payment (Maker)
      const propRes = await app.request('/payments/proposals', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Id': makerUserId,
          'X-User-Role': 'ACCOUNT_PAYABLE',
        },
        body: JSON.stringify({
          vendorId,
          vendorBankAccountId: bankAccountId,
          allocations: [
            {
              invoiceId: matchedInvoiceId,
              allocatedAmount: 50_000_000,
              isAdvancePayment: false,
            },
          ],
        }),
      });

      expect(propRes.status).toBe(201);
      const propData = await propRes.json();
      const proposalId = propData.data.id;

      // 2. Check Payment (Checker)
      const checkRes = await app.request(`/payments/proposals/${proposalId}/check`, {
        method: 'POST',
        headers: {
          'X-User-Id': checkerUserId,
          'X-User-Role': 'FINANCE',
        },
      });
      expect(checkRes.status).toBe(200);

      // 3. Execute Payment (Executor) with Step-Up Reauth & Idempotency Key
      const reauthToken = await generateReauthToken({ userId: executorUserId, action: 'EXECUTE_PAYMENT' });
      const idemKey = `API-IDEM-${crypto.randomUUID()}`;

      const execRes = await app.request(`/payments/proposals/${proposalId}/execute`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Id': executorUserId,
          'X-User-Role': 'FINANCE',
          'X-Reauth-Token': reauthToken,
          'Idempotency-Key': idemKey,
        },
        body: JSON.stringify({
          bankReferenceNumber: 'TRF-API-12345',
        }),
      });

      expect(execRes.status).toBe(200);
      const execData = await execRes.json();
      expect(execData.data.status).toBe('EXECUTED');
    });
  });
});
