import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { sql } from '../../../src/db/client';
import { runMigrations } from '../../../src/db/migrate';
import { cleanupTestUsers } from '../../helpers/test_cleaner';
import { createVendor, createVendorBankAccount, verifyBankAccountStage } from '../../../src/domain/vendor/service';
import { createPurchaseRequest, submitPurchaseRequest, decideApprovalStep } from '../../../src/domain/pr/service';
import { createPurchaseOrder, approvePurchaseOrder, issuePurchaseOrder } from '../../../src/domain/po/service';
import {
  recordGoodsReceipt,
  getGoodsReceiptById,
  type RecordGoodsReceiptInput,
} from '../../../src/domain/receipt/service';
import { SodConflictError } from '../../../src/domain/sod/errors';
import { createReceiptApp } from '../../../src/domain/receipt/routes';

describe('Epic 6: Goods Receipt (BAST), Simultaneous Invoice Upload & SoD (R28–R32)', () => {
  let poAuthorId: string;
  let poApproverId: string;
  let warehouseUserId: string;
  let requesterId: string;
  let taxSnapshotId: string;
  let issuedPoId: string;
  let poItemId1: string;
  let poItemId2: string;
  let vendorId: string;

  beforeAll(async () => {
    await runMigrations();

    poAuthorId = crypto.randomUUID();
    poApproverId = crypto.randomUUID();
    warehouseUserId = crypto.randomUUID();
    requesterId = crypto.randomUUID();
    taxSnapshotId = '00000000-0000-0000-0000-000000000001'; // Default seeded tax snapshot

    await sql`
      INSERT INTO app_user (id, email, full_name, employee_id, division_id, branch_id)
      VALUES 
        (${poAuthorId}, ${`po-author-${poAuthorId}@nusanet.net.id`}, 'PO Creator', ${`EMP-PO1-${poAuthorId.slice(0, 6)}`}, 'DIV-PROC', 'HQ'),
        (${poApproverId}, ${`po-approver-${poApproverId}@nusanet.net.id`}, 'PO Approver', ${`EMP-PO2-${poApproverId.slice(0, 6)}`}, 'DIV-FIN', 'HQ'),
        (${warehouseUserId}, ${`wh-user-${warehouseUserId}@nusanet.net.id`}, 'Warehouse Staff', ${`EMP-WH-${warehouseUserId.slice(0, 6)}`}, 'DIV-LOG', 'HQ'),
        (${requesterId}, ${`req-user-${requesterId}@nusanet.net.id`}, 'Requester Staff', ${`EMP-REQ-${requesterId.slice(0, 6)}`}, 'DIV-IT', 'HQ')
    `;

    await sql`
      INSERT INTO user_role_assignment (user_id, role, assigned_by)
      VALUES 
        (${poAuthorId}, 'ACCOUNT_PAYABLE', ${poAuthorId}),
        (${poApproverId}, 'APPROVER', ${poApproverId}),
        (${warehouseUserId}, 'WAREHOUSE', ${warehouseUserId}),
        (${requesterId}, 'REQUESTER', ${requesterId})
    `;

    // 1. Setup Vendor & Verified Bank Account
    const vendor = await createVendor({
      name: 'PT BAST Mitra Hardware',
      taxIdentificationNumber: '11.234.567.8-901.000',
      createdBy: poAuthorId,
    });
    vendorId = vendor.id;

    const bank = await createVendorBankAccount({
      vendorId: vendor.id,
      bankName: 'BCA',
      bankCode: '014',
      accountNumber: '9988776655',
      accountHolderName: 'PT BAST Mitra Hardware',
    });

    await verifyBankAccountStage({ bankAccountId: bank.id, verifierUserId: poAuthorId, action: 'VERIFY_STAGE_1' });
    await verifyBankAccountStage({ bankAccountId: bank.id, verifierUserId: poApproverId, action: 'VERIFY_STAGE_2' });

    // 2. Setup PR
    const pr = await createPurchaseRequest({
      requesterId,
      costCenter: 'CC-IT-01',
      divisionId: 'DIV-IT',
      branchId: 'HQ',
      requiredDate: '2026-09-01',
      paymentTermType: 'PAY_AFTER_RECEIPT',
      businessJustification: 'Pengadaan Server dan Kabel Data',
      items: [
        {
          lineNumber: 1,
          itemName: 'Dell PowerEdge R750',
          quantityRequested: 2,
          uom: 'Unit',
          estimatedUnitPrice: 45_000_000,
        },
        {
          lineNumber: 2,
          itemName: 'Patch Cord Cat6A 2M',
          quantityRequested: 10,
          uom: 'Pcs',
          estimatedUnitPrice: 50_000,
        },
      ],
    });

    await submitPurchaseRequest(pr.id, requesterId);
    await decideApprovalStep({ prId: pr.id, approverId: poApproverId, decision: 'APPROVED' });

    // 3. Setup PO & Issue
    const po = await createPurchaseOrder({
      prId: pr.id,
      vendorId: vendor.id,
      vendorBankAccountId: bank.id,
      paymentTermType: 'PAY_AFTER_RECEIPT',
      createdBy: poAuthorId,
      items: [
        {
          prItemId: pr.items[0].id,
          lineNumber: 1,
          itemName: 'Dell PowerEdge R750',
          quantityOrdered: 2,
          uom: 'Unit',
          unitPrice: 45_000_000,
        },
        {
          prItemId: pr.items[1].id,
          lineNumber: 2,
          itemName: 'Patch Cord Cat6A 2M',
          quantityOrdered: 10,
          uom: 'Pcs',
          unitPrice: 50_000,
        },
      ],
    });

    await approvePurchaseOrder(po.id, poApproverId);
    await issuePurchaseOrder(po.id, poAuthorId);

    issuedPoId = po.id;
    const poItems = await sql`SELECT id, pr_item_id FROM purchase_order_item WHERE po_id = ${issuedPoId} ORDER BY line_number ASC`;
    poItemId1 = poItems[0].id;
    poItemId2 = poItems[1].id;
  });

  describe('1. SoD Enforcement on Goods Receipt (R31)', () => {
    it('R31: Prevents PO Author from recording Goods Receipt (BAST)', async () => {
      const input: RecordGoodsReceiptInput = {
        poId: issuedPoId,
        receiptType: 'WAREHOUSE',
        deliveryNoteNumber: 'SJ-001',
        receivedDate: '2026-08-23',
        receivedBy: poAuthorId, // PO Author
        notes: 'Penerimaan oleh pembuat PO',
        items: [
          {
            poItemId: poItemId1,
            quantityReceived: 1,
            quantityRejected: 0,
          },
        ],
      };

      let errorCaught = false;
      try {
        await recordGoodsReceipt(input);
      } catch (err: unknown) {
        errorCaught = true;
        expect(err).toBeInstanceOf(SodConflictError);
        expect((err as SodConflictError).ruleCode).toContain('R31');
      }

      expect(errorCaught).toBe(true);
    });

    it('R31: Prevents PO Approver from recording Goods Receipt (BAST)', async () => {
      const input: RecordGoodsReceiptInput = {
        poId: issuedPoId,
        receiptType: 'WAREHOUSE',
        deliveryNoteNumber: 'SJ-001',
        receivedDate: '2026-08-23',
        receivedBy: poApproverId, // PO Approver
        notes: 'Penerimaan oleh penyetuju PO',
        items: [
          {
            poItemId: poItemId1,
            quantityReceived: 1,
            quantityRejected: 0,
          },
        ],
      };

      let errorCaught = false;
      try {
        await recordGoodsReceipt(input);
      } catch (err: unknown) {
        errorCaught = true;
        expect(err).toBeInstanceOf(SodConflictError);
        expect((err as SodConflictError).ruleCode).toContain('R31');
      }

      expect(errorCaught).toBe(true);
    });
  });

  describe('2. BAST Recording, Partial Receipts & Quantity Validations (R28)', () => {
    it('successfully records partial goods receipt by authorized Warehouse staff', async () => {
      const input: RecordGoodsReceiptInput = {
        poId: issuedPoId,
        receiptType: 'WAREHOUSE',
        deliveryNoteNumber: 'SJ-2026-001',
        receivedDate: '2026-08-23',
        receivedBy: warehouseUserId,
        notes: 'Penerimaan bertahap batch 1',
        items: [
          {
            poItemId: poItemId1,
            quantityReceived: 1, // 1 of 2 servers
            quantityRejected: 0,
            conditionNotes: 'Kondisi segel baik',
          },
          {
            poItemId: poItemId2,
            quantityReceived: 5, // 5 of 10 cables
            quantityRejected: 0,
          },
        ],
      };

      const gr = await recordGoodsReceipt(input);
      expect(gr).toBeDefined();
      expect(gr.grNumber).toMatch(/^GR-/);
      expect(gr.items.length).toBe(2);

      const fetched = await getGoodsReceiptById(gr.id);
      expect(fetched.id).toBe(gr.id);
      expect(fetched.items.length).toBe(2);

      // Verify PO item quantity_received is updated in DB
      const poItem1 = await sql`SELECT quantity_ordered, quantity_received FROM purchase_order_item WHERE id = ${poItemId1}`;
      expect(Number(poItem1[0].quantity_received)).toBe(1);

      const poItem2 = await sql`SELECT quantity_ordered, quantity_received FROM purchase_order_item WHERE id = ${poItemId2}`;
      expect(Number(poItem2[0].quantity_received)).toBe(5);
    });

    it('rejects goods receipt when received quantity exceeds ordered remaining quantity', async () => {
      const input: RecordGoodsReceiptInput = {
        poId: issuedPoId,
        receiptType: 'WAREHOUSE',
        deliveryNoteNumber: 'SJ-2026-EXCESS',
        receivedDate: '2026-08-23',
        receivedBy: warehouseUserId,
        items: [
          {
            poItemId: poItemId1,
            quantityReceived: 5, // Sisa hanya 1 unit, mencoba terima 5 unit
            quantityRejected: 0,
          },
        ],
      };

      let errorCaught = false;
      try {
        await recordGoodsReceipt(input);
      } catch (err: unknown) {
        errorCaught = true;
        const msg = err instanceof Error ? err.message : String(err);
        expect(msg).toContain('melebihi');
      }

      expect(errorCaught).toBe(true);
    });
  });

  describe('3. Simultaneous Vendor Invoice Upload (R29)', () => {
    it('R29: Automatically creates and links vendor invoice when submitted with BAST', async () => {
      const invoiceNumber = `INV-${crypto.randomUUID().slice(0, 8)}`;
      const input: RecordGoodsReceiptInput = {
        poId: issuedPoId,
        receiptType: 'WAREHOUSE',
        deliveryNoteNumber: 'SJ-2026-002',
        receivedDate: '2026-08-23',
        receivedBy: warehouseUserId,
        notes: 'Penerimaan batch 2 dengan invoice terlampir',
        items: [
          {
            poItemId: poItemId1,
            quantityReceived: 1, // Sisa 1 server
            quantityRejected: 0,
          },
        ],
        invoice: {
          vendorInvoiceNumber: invoiceNumber,
          invoiceDate: '2026-08-23',
          dueDate: '2026-09-23',
          subtotalAmount: 45_000_000.00,
          ppnAmount: 5_400_000.00,
          pphAmount: 0.00,
          totalPayableAmount: 50_400_000.00,
          taxSnapshotId,
        },
      };

      const gr = await recordGoodsReceipt(input);
      expect(gr.linkedInvoiceId).toBeDefined();

      // Verify invoice record in database
      const invoices = await sql`
        SELECT * FROM invoice WHERE id = ${gr.linkedInvoiceId}
      `;
      expect(invoices.length).toBe(1);
      expect(invoices[0].po_id).toBe(issuedPoId);
      expect(invoices[0].gr_id).toBe(gr.id);
      expect(invoices[0].vendor_id).toBe(vendorId);
      expect(invoices[0].vendor_invoice_number).toBe(invoiceNumber);
      expect(Number(invoices[0].total_payable_amount)).toBe(50_400_000);
    });
  });

  describe('4. Automatic Non-Conformance Report (NCR) on Damaged/Rejected Goods (R30)', () => {
    it('R30: Automatically creates NCR record when quantity_rejected > 0', async () => {
      const input: RecordGoodsReceiptInput = {
        poId: issuedPoId,
        receiptType: 'WAREHOUSE',
        deliveryNoteNumber: 'SJ-2026-DAMAGED',
        receivedDate: '2026-08-23',
        receivedBy: warehouseUserId,
        notes: 'Penerimaan kabel dengan temuan barang cacat',
        items: [
          {
            poItemId: poItemId2,
            quantityReceived: 3, // 3 unit diterima baik
            quantityRejected: 2, // 2 unit rusak / ditolak
            conditionNotes: '2 pcs kabel putus pada konektor RJ45',
          },
        ],
      };

      const gr = await recordGoodsReceipt(input);
      expect(gr.ncrRecords.length).toBe(1);
      expect(gr.ncrRecords[0].ncrNumber).toMatch(/^NCR-/);

      // Verify NCR record in database
      const ncrs = await sql`
        SELECT * FROM non_conformance_report WHERE gr_id = ${gr.id}
      `;
      expect(ncrs.length).toBe(1);
      expect(ncrs[0].po_id).toBe(issuedPoId);
      expect(ncrs[0].is_resolved).toBe(false);
      expect(ncrs[0].description).toContain('kabel putus');
    });
  });

  describe('5. REST API Routes for Goods Receipt & NCR', () => {
    it('records goods receipt via REST API endpoint', async () => {
      const app = createReceiptApp();

      const res = await app.request('/receipts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Id': warehouseUserId,
          'X-User-Role': 'WAREHOUSE',
        },
        body: JSON.stringify({
          poId: issuedPoId,
          receiptType: 'WAREHOUSE',
          deliveryNoteNumber: 'SJ-API-001',
          receivedDate: '2026-08-23',
          items: [
            {
              poItemId: poItemId2,
              quantityReceived: 0,
              quantityRejected: 0,
              conditionNotes: 'Inspeksi awal',
            },
          ],
        }),
      });

      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.id).toBeDefined();

      // Retrieve via GET /receipts/:id
      const getRes = await app.request(`/receipts/${data.data.id}`);
      expect(getRes.status).toBe(200);
      const getData = await getRes.json();
      expect(getData.data.id).toBe(data.data.id);
    });
  });

  afterAll(async () => {
    await cleanupTestUsers([poAuthorId, poApproverId, warehouseUserId, requesterId]);
    if (vendorId) {
      await sql`DELETE FROM vendor_bank_account WHERE vendor_id = ${vendorId}`;
      await sql`DELETE FROM vendor WHERE id = ${vendorId}`;
    }
  });
});
