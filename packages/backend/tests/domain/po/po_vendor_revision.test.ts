import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { sql } from '../../../src/db/client';
import { runMigrations } from '../../../src/db/migrate';
import { cleanupTestUsers } from '../../helpers/test_cleaner';
import {
  createVendor,
  createVendorBankAccount,
  verifyBankAccountStage,
} from '../../../src/domain/vendor/service';
import {
  createPurchaseOrder,
  updatePurchaseOrder,
  approvePurchaseOrder,
  issuePurchaseOrder,
} from '../../../src/domain/po/service';
import { createPurchaseRequest, submitPurchaseRequest, decideApprovalStep } from '../../../src/domain/pr/service';
import { getAuditTrailForEntity } from '../../../src/domain/audit/service';
import { createPoAndVendorApp } from '../../../src/domain/po/routes';

describe('Epic 5: Pre-Approval PO Revision & Vendor Replacement (Option 2)', () => {
  let apMakerId: string;
  let apCheckerId: string;
  let poApproverId: string;
  let requesterId: string;
  let approvedPrId: string;
  let approvedPrItemId: string;

  let vendorAId: string;
  let vendorABankId: string;
  let vendorBId: string;
  let vendorBBankId: string;

  beforeAll(async () => {
    await runMigrations();

    apMakerId = crypto.randomUUID();
    apCheckerId = crypto.randomUUID();
    poApproverId = crypto.randomUUID();
    requesterId = crypto.randomUUID();

    await sql`
      INSERT INTO app_user (id, email, full_name, employee_id, division_id, branch_id)
      VALUES 
        (${apMakerId}, ${`ap-maker-${apMakerId}@nusanet.net.id`}, 'AP Maker User', ${`EMP-REV1-${apMakerId.slice(0, 6)}`}, 'DIV-FIN', 'HQ'),
        (${apCheckerId}, ${`ap-checker-${apCheckerId}@nusanet.net.id`}, 'AP Checker User', ${`EMP-REV2-${apCheckerId.slice(0, 6)}`}, 'DIV-FIN', 'HQ'),
        (${poApproverId}, ${`po-approver-${poApproverId}@nusanet.net.id`}, 'PO Approver User', ${`EMP-REV3-${poApproverId.slice(0, 6)}`}, 'DIV-FIN', 'HQ'),
        (${requesterId}, ${`requester-${requesterId}@nusanet.net.id`}, 'Requester PR User', ${`EMP-REV4-${requesterId.slice(0, 6)}`}, 'DIV-IT', 'HQ')
    `;

    await sql`
      INSERT INTO user_role_assignment (user_id, role, assigned_by)
      VALUES 
        (${apMakerId}, 'ACCOUNT_PAYABLE', ${apMakerId}),
        (${apCheckerId}, 'ACCOUNT_PAYABLE', ${apCheckerId}),
        (${poApproverId}, 'APPROVER', ${poApproverId}),
        (${requesterId}, 'REQUESTER', ${requesterId})
    `;

    // 1. Create Vendor A (Original)
    const vendorA = await createVendor({
      name: 'PT Vendor Asal A',
      taxIdentificationNumber: '11.222.333.4-555.000',
      createdBy: apMakerId,
    });
    vendorAId = vendorA.id;

    const bankA = await createVendorBankAccount({
      vendorId: vendorAId,
      bankName: 'BCA',
      bankCode: '014',
      accountNumber: '1112223334',
      accountHolderName: 'PT Vendor Asal A',
    });
    await verifyBankAccountStage({ bankAccountId: bankA.id, verifierUserId: apMakerId, action: 'VERIFY_STAGE_1' });
    await verifyBankAccountStage({ bankAccountId: bankA.id, verifierUserId: apCheckerId, action: 'VERIFY_STAGE_2' });
    vendorABankId = bankA.id;

    // 2. Create Vendor B (Replacement)
    const vendorB = await createVendor({
      name: 'PT Vendor Pengganti B',
      taxIdentificationNumber: '22.333.444.5-666.000',
      createdBy: apMakerId,
    });
    vendorBId = vendorB.id;

    const bankB = await createVendorBankAccount({
      vendorId: vendorBId,
      bankName: 'Mandiri',
      bankCode: '008',
      accountNumber: '5556667778',
      accountHolderName: 'PT Vendor Pengganti B',
    });
    await verifyBankAccountStage({ bankAccountId: bankB.id, verifierUserId: apMakerId, action: 'VERIFY_STAGE_1' });
    await verifyBankAccountStage({ bankAccountId: bankB.id, verifierUserId: apCheckerId, action: 'VERIFY_STAGE_2' });
    vendorBBankId = bankB.id;

    // 3. Create & Approve PR
    const pr = await createPurchaseRequest({
      requesterId,
      costCenter: 'CC-REV-01',
      divisionId: 'DIV-IT',
      branchId: 'HQ',
      requiredDate: '2026-09-01',
      paymentTermType: 'PAY_AFTER_RECEIPT',
      businessJustification: 'Pengadaan Server untuk Backup',
      items: [
        {
          lineNumber: 1,
          itemName: 'Dell PowerEdge R740',
          specification: 'Rackmount Server 2U, 64GB RAM',
          quantityRequested: 10,
          uom: 'Unit',
          estimatedUnitPrice: 50_000_000,
        },
      ],
    });

    await submitPurchaseRequest(pr.id, requesterId);
    await decideApprovalStep({ prId: pr.id, approverId: poApproverId, decision: 'APPROVED' });
    await decideApprovalStep({ prId: pr.id, approverId: poApproverId, decision: 'APPROVED' });

    approvedPrId = pr.id;
    approvedPrItemId = pr.items[0].id;
  });

  it('1. Successfully replaces vendor and bank account on a DRAFT PO', async () => {
    // Create PO with Vendor A
    const po = await createPurchaseOrder({
      prId: approvedPrId,
      vendorId: vendorAId,
      vendorBankAccountId: vendorABankId,
      paymentTermType: 'PAY_AFTER_RECEIPT',
      termsAndConditions: 'Syarat awal Vendor A',
      createdBy: apMakerId,
      items: [
        {
          prItemId: approvedPrItemId,
          lineNumber: 1,
          itemName: 'Dell PowerEdge R740',
          quantityOrdered: 2,
          uom: 'Unit',
          unitPrice: 48_000_000,
        },
      ],
    });

    expect(po.vendorId).toBe(vendorAId);
    expect(po.status).toBe('DRAFT');

    // Update PO to Vendor B with a reason
    const updatedPo = await updatePurchaseOrder({
      poId: po.id,
      vendorId: vendorBId,
      vendorBankAccountId: vendorBBankId,
      termsAndConditions: 'Syarat baru Vendor B: Garansi 3 Tahun',
      reason: 'Vendor A stok habis, dialihkan ke Vendor B yang ready stock',
      userId: apMakerId,
      userRole: 'ACCOUNT_PAYABLE',
    });

    expect(updatedPo.vendorId).toBe(vendorBId);
    expect(updatedPo.vendorBankAccountId).toBe(vendorBBankId);
    expect(updatedPo.termsAndConditions).toBe('Syarat baru Vendor B: Garansi 3 Tahun');
    expect(updatedPo.status).toBe('DRAFT');

    // Check Audit Trail recorded
    const auditLogs = await getAuditTrailForEntity('purchase_order', po.id);
    expect(auditLogs.length).toBeGreaterThanOrEqual(1);
    const lastAudit = auditLogs[0];
    expect(lastAudit.actionType).toBe('PO_UPDATED');
    expect(lastAudit.justification).toContain('dialihkan ke Vendor B');
  });

  it('2. Resets approval state if PO was approved before vendor change', async () => {
    // Create PO with Vendor A
    const po = await createPurchaseOrder({
      prId: approvedPrId,
      vendorId: vendorAId,
      vendorBankAccountId: vendorABankId,
      paymentTermType: 'PAY_AFTER_RECEIPT',
      createdBy: apMakerId,
      items: [
        {
          prItemId: approvedPrItemId,
          lineNumber: 1,
          itemName: 'Dell PowerEdge R740',
          quantityOrdered: 2,
          uom: 'Unit',
          unitPrice: 48_000_000,
        },
      ],
    });

    // PO is approved by manager
    const approvedPo = await approvePurchaseOrder(po.id, poApproverId);
    expect(approvedPo.approvedBy).toBe(poApproverId);
    expect(approvedPo.approvedAt).toBeDefined();

    // Now AP replaces vendor before issuing PO
    const revisedPo = await updatePurchaseOrder({
      poId: po.id,
      vendorId: vendorBId,
      vendorBankAccountId: vendorBBankId,
      reason: 'Revisi vendor ke Vendor B sebelum terbit',
      userId: apMakerId,
    });

    // Approval MUST be reset to ensure approver reviews the new vendor
    expect(revisedPo.approvedBy).toBeNull();
    expect(revisedPo.approvedAt).toBeNull();
    expect(revisedPo.status).toBe('DRAFT');
  });

  it('3. Rejects vendor change on ISSUED PO (enforces R26 amendment rule)', async () => {
    const po = await createPurchaseOrder({
      prId: approvedPrId,
      vendorId: vendorAId,
      vendorBankAccountId: vendorABankId,
      paymentTermType: 'PAY_AFTER_RECEIPT',
      createdBy: apMakerId,
      items: [
        {
          prItemId: approvedPrItemId,
          lineNumber: 1,
          itemName: 'Dell PowerEdge R740',
          quantityOrdered: 1,
          uom: 'Unit',
          unitPrice: 48_000_000,
        },
      ],
    });

    await approvePurchaseOrder(po.id, poApproverId);
    await issuePurchaseOrder(po.id, apMakerId);

    // Attempting direct edit on ISSUED PO must throw R26 error
    let errorCaught = false;
    try {
      await updatePurchaseOrder({
        poId: po.id,
        vendorId: vendorBId,
        vendorBankAccountId: vendorBBankId,
        userId: apMakerId,
      });
    } catch (err: unknown) {
      errorCaught = true;
      const msg = err instanceof Error ? err.message : String(err);
      expect(msg).toContain('R26');
    }

    expect(errorCaught).toBe(true);
  });

  it('4. Updates PO via REST API (PUT /purchase-orders/:id)', async () => {
    const app = createPoAndVendorApp();

    // Create PO
    const po = await createPurchaseOrder({
      prId: approvedPrId,
      vendorId: vendorAId,
      vendorBankAccountId: vendorABankId,
      paymentTermType: 'PAY_AFTER_RECEIPT',
      createdBy: apMakerId,
      items: [
        {
          prItemId: approvedPrItemId,
          lineNumber: 1,
          itemName: 'Dell PowerEdge R740',
          quantityOrdered: 1,
          uom: 'Unit',
          unitPrice: 48_000_000,
        },
      ],
    });

    // Update via API
    const res = await app.request(`/purchase-orders/${po.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-User-Id': apMakerId,
        'X-User-Role': 'ACCOUNT_PAYABLE',
      },
      body: JSON.stringify({
        vendorId: vendorBId,
        vendorBankAccountId: vendorBBankId,
        paymentTermType: 'ADVANCE_OR_COD',
        reason: 'Pergantian vendor dan syarat bayar via API',
      }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.vendorId).toBe(vendorBId);
    expect(body.data.paymentTermType).toBe('ADVANCE_OR_COD');
  });

  afterAll(async () => {
    // Clean up test records
    await sql`DELETE FROM purchase_order_item WHERE po_id IN (SELECT id FROM purchase_order WHERE created_by = ${apMakerId})`;
    await sql`DELETE FROM purchase_order WHERE created_by = ${apMakerId}`;
    await sql`DELETE FROM purchase_request_item WHERE pr_id = ${approvedPrId}`;
    await sql`DELETE FROM approval_instance WHERE pr_id = ${approvedPrId}`;
    await sql`DELETE FROM purchase_request WHERE id = ${approvedPrId}`;
    await sql`DELETE FROM vendor_bank_account WHERE vendor_id IN (${vendorAId}, ${vendorBId})`;
    await sql`DELETE FROM vendor WHERE id IN (${vendorAId}, ${vendorBId})`;
    await cleanupTestUsers([apMakerId, apCheckerId, poApproverId, requesterId]);
  });
});
