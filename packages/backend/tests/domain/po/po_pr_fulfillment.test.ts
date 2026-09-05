import { describe, it, expect, beforeAll } from 'bun:test';
import { sql } from '../../../src/db/client';
import { app } from '../../../src/index';
import { createPurchaseRequest, submitPurchaseRequest, decideApprovalStep } from '../../../src/domain/pr/service';
import { createVendor, createVendorBankAccount, verifyBankAccountStage } from '../../../src/domain/vendor/service';
import { createPurchaseOrder } from '../../../src/domain/po/service';

describe('Purchase Request Fulfillment & Double PO Prevention (R10, R11, R20, R24)', () => {
  let requesterId: string;
  let approverId: string;
  let apMakerId: string;
  let apCheckerId: string;
  let vendorId: string;
  let bankAccountId: string;

  beforeAll(async () => {
    requesterId = crypto.randomUUID();
    approverId = crypto.randomUUID();
    apMakerId = crypto.randomUUID();
    apCheckerId = crypto.randomUUID();

    await sql`
      INSERT INTO app_user (id, email, full_name, employee_id, division_id, branch_id)
      VALUES
        (${requesterId}, ${`req-${requesterId}@nusa.id`}, 'Requester PR', ${`EMP-R-${requesterId.slice(0, 6)}`}, 'DIV-IT', 'HQ'),
        (${approverId}, ${`appr-${approverId}@nusa.id`}, 'Approver PR', ${`EMP-A-${approverId.slice(0, 6)}`}, 'DIV-IT', 'HQ'),
        (${apMakerId}, ${`ap1-${apMakerId}@nusa.id`}, 'AP Maker', ${`EMP-AP1-${apMakerId.slice(0, 6)}`}, 'DIV-FIN', 'HQ'),
        (${apCheckerId}, ${`ap2-${apCheckerId}@nusa.id`}, 'AP Checker', ${`EMP-AP2-${apCheckerId.slice(0, 6)}`}, 'DIV-FIN', 'HQ')
      ON CONFLICT DO NOTHING
    `;

    await sql`
      INSERT INTO user_role_assignment (user_id, role, assigned_by)
      VALUES
        (${requesterId}, 'REQUESTER', ${requesterId}),
        (${approverId}, 'APPROVER', ${approverId}),
        (${apMakerId}, 'ACCOUNT_PAYABLE', ${apMakerId}),
        (${apCheckerId}, 'ACCOUNT_PAYABLE', ${apCheckerId})
      ON CONFLICT DO NOTHING
    `;

    const vendor = await createVendor({
      name: 'PT Mitra Jaringan Mandiri',
      taxIdentificationNumber: '09.876.543.2-109.000',
      isPkp: true,
      createdBy: apMakerId,
    });
    vendorId = vendor.id;

    const bank = await createVendorBankAccount({
      vendorId: vendor.id,
      bankName: 'BCA',
      bankCode: '014',
      accountNumber: '9988776655',
      accountHolderName: 'PT Mitra Jaringan Mandiri',
    });
    bankAccountId = bank.id;

    await verifyBankAccountStage({ bankAccountId: bank.id, verifierUserId: apMakerId, action: 'VERIFY_STAGE_1' });
    await verifyBankAccountStage({ bankAccountId: bank.id, verifierUserId: apCheckerId, action: 'VERIFY_STAGE_2' });
  });

  it('atomically increments PR item quantity_ordered when PO is created and strictly blocks duplicate ordering', async () => {
    // 1. Create and approve PR with 1 item of 2 units
    const pr = await createPurchaseRequest({
      requesterId,
      costCenter: 'CC-IT-01',
      divisionId: 'DIV-IT',
      branchId: 'HQ',
      requiredDate: '2026-09-30',
      paymentTermType: 'PAY_AFTER_RECEIPT',
      businessJustification: 'Pengadaan Access Point Kantor',
      items: [
        {
          lineNumber: 1,
          itemName: 'UniFi U6 Pro Access Point',
          quantityRequested: 2,
          uom: 'Unit',
          estimatedUnitPrice: 2_500_000,
        },
      ],
    });

    await submitPurchaseRequest(pr.id, requesterId);
    await decideApprovalStep({ prId: pr.id, approverId, decision: 'APPROVED' });

    const prItemId = pr.items[0].id;

    // 2. First PO issuance for 2 units -> Success
    const po = await createPurchaseOrder({
      prId: pr.id,
      vendorId,
      vendorBankAccountId: bankAccountId,
      paymentTermType: 'PAY_AFTER_RECEIPT',
      createdBy: apMakerId,
      items: [
        {
          prItemId,
          lineNumber: 1,
          itemName: 'UniFi U6 Pro Access Point',
          quantityOrdered: 2,
          uom: 'Unit',
          unitPrice: 2_500_000,
        },
      ],
    });

    expect(po).toBeDefined();
    expect(po.poNumber).toMatch(/^PO-/);

    // Verify in database that purchase_request_item.quantity_ordered is now 2
    const prItems = await sql`SELECT quantity_requested, quantity_ordered FROM purchase_request_item WHERE id = ${prItemId}`;
    expect(Number(prItems[0].quantity_ordered)).toBe(2);

    // 3. Second PO issuance for the same PR item -> Must be blocked!
    let secondPoError: string | null = null;
    try {
      await createPurchaseOrder({
        prId: pr.id,
        vendorId,
        vendorBankAccountId: bankAccountId,
        paymentTermType: 'PAY_AFTER_RECEIPT',
        createdBy: apMakerId,
        items: [
          {
            prItemId,
            lineNumber: 1,
            itemName: 'UniFi U6 Pro Access Point',
            quantityOrdered: 1,
            uom: 'Unit',
            unitPrice: 2_500_000,
          },
        ],
      });
    } catch (err: unknown) {
      secondPoError = err instanceof Error ? err.message : String(err);
    }

    expect(secondPoError).not.toBeNull();
    expect(secondPoError).toContain('melebihi sisa kuantitas PR yang belum dipesan');
  });

  it('supports partial PO ordering across multiple POs until remaining quantity is zero', async () => {
    // 1. Create PR with 10 units
    const pr = await createPurchaseRequest({
      requesterId,
      costCenter: 'CC-IT-02',
      divisionId: 'DIV-IT',
      branchId: 'HQ',
      requiredDate: '2026-09-30',
      paymentTermType: 'PAY_AFTER_RECEIPT',
      businessJustification: 'Kabel UTP Cat6 10 Roll',
      items: [
        {
          lineNumber: 1,
          itemName: 'Kabel UTP Cat6 305m',
          quantityRequested: 10,
          uom: 'Roll',
          estimatedUnitPrice: 1_200_000,
        },
      ],
    });

    await submitPurchaseRequest(pr.id, requesterId);
    await decideApprovalStep({ prId: pr.id, approverId, decision: 'APPROVED' });

    const prItemId = pr.items[0].id;

    // PO 1: Order 4 rolls
    const po1 = await createPurchaseOrder({
      prId: pr.id,
      vendorId,
      vendorBankAccountId: bankAccountId,
      paymentTermType: 'PAY_AFTER_RECEIPT',
      createdBy: apMakerId,
      items: [
        {
          prItemId,
          lineNumber: 1,
          itemName: 'Kabel UTP Cat6 305m',
          quantityOrdered: 4,
          uom: 'Roll',
          unitPrice: 1_200_000,
        },
      ],
    });
    expect(po1).toBeDefined();

    // PO 2: Order remaining 6 rolls
    const po2 = await createPurchaseOrder({
      prId: pr.id,
      vendorId,
      vendorBankAccountId: bankAccountId,
      paymentTermType: 'PAY_AFTER_RECEIPT',
      createdBy: apMakerId,
      items: [
        {
          prItemId,
          lineNumber: 1,
          itemName: 'Kabel UTP Cat6 305m',
          quantityOrdered: 6,
          uom: 'Roll',
          unitPrice: 1_200_000,
        },
      ],
    });
    expect(po2).toBeDefined();

    // PO 3: Attempt to order 1 more roll -> Fails
    expect(
      createPurchaseOrder({
        prId: pr.id,
        vendorId,
        vendorBankAccountId: bankAccountId,
        paymentTermType: 'PAY_AFTER_RECEIPT',
        createdBy: apMakerId,
        items: [
          {
            prItemId,
            lineNumber: 1,
            itemName: 'Kabel UTP Cat6 305m',
            quantityOrdered: 1,
            uom: 'Roll',
            unitPrice: 1_200_000,
          },
        ],
      })
    ).rejects.toThrow('melebihi sisa kuantitas PR yang belum dipesan (0 Roll)');
  });

  it('excludes fully ordered PRs from GET /api/v1/purchase-requests?status=APPROVED&hasRemainingPo=true', async () => {
    // Check list of PRs available for PO
    const res = await app.request('/api/v1/purchase-requests?status=APPROVED&hasRemainingPo=true', {
      headers: {
        'X-User-Id': apMakerId,
        'X-User-Role': 'ACCOUNT_PAYABLE',
      },
    });

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);

    // Each PR returned must have remainingQuantity > 0
    for (const pr of json.data) {
      expect(pr.remainingQuantity).toBeGreaterThan(0);
    }
  });

  it('rejects creating PO from unapproved PR (DRAFT / REJECTED)', async () => {
    const draftPr = await createPurchaseRequest({
      requesterId,
      costCenter: 'CC-IT-03',
      divisionId: 'DIV-IT',
      branchId: 'HQ',
      requiredDate: '2026-09-30',
      paymentTermType: 'PAY_AFTER_RECEIPT',
      businessJustification: 'Unapproved PR Test',
      items: [
        {
          lineNumber: 1,
          itemName: 'Testing Unapproved Hardware',
          quantityRequested: 1,
          uom: 'Unit',
          estimatedUnitPrice: 500_000,
        },
      ],
    });

    expect(
      createPurchaseOrder({
        prId: draftPr.id,
        vendorId,
        vendorBankAccountId: bankAccountId,
        paymentTermType: 'PAY_AFTER_RECEIPT',
        createdBy: apMakerId,
        items: [
          {
            prItemId: draftPr.items[0].id,
            lineNumber: 1,
            itemName: 'Testing Unapproved Hardware',
            quantityOrdered: 1,
            uom: 'Unit',
            unitPrice: 500_000,
          },
        ],
      })
    ).rejects.toThrow('belum berstatus APPROVED');
  });
});
