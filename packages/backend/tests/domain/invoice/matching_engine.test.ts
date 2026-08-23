import { describe, it, expect, beforeAll } from 'bun:test';
import { sql } from '../../../src/db/client';
import { runMigrations } from '../../../src/db/migrate';
import { createVendor, createVendorBankAccount, verifyBankAccountStage } from '../../../src/domain/vendor/service';
import { createPurchaseRequest, submitPurchaseRequest, decideApprovalStep } from '../../../src/domain/pr/service';
import { createPurchaseOrder, approvePurchaseOrder, issuePurchaseOrder } from '../../../src/domain/po/service';
import {
  validateNsfp,
  createInvoice,
  runTwoWayMatching,
  overrideMatchingException,
  getInvoiceById,
  type CreateInvoiceInput,
} from '../../../src/domain/invoice/service';
import { createInvoiceApp } from '../../../src/domain/invoice/routes';
import { ForbiddenError } from '../../../src/domain/sod/errors';

describe('Epic 7: [Invoice & Tax] Dual-NSFP, Tax Snapshot & 2-Way Matching Engine (R33–R40)', () => {
  let apUserId: string;
  let headOfApUserId: string;
  let regularUserId: string;
  let vendorId: string;
  let taxSnapshotId: string;
  let testPoId: string;
  let testPoGrandTotal: number;

  beforeAll(async () => {
    await runMigrations();

    apUserId = crypto.randomUUID();
    headOfApUserId = crypto.randomUUID();
    regularUserId = crypto.randomUUID();
    taxSnapshotId = '00000000-0000-0000-0000-000000000001';

    await sql`
      INSERT INTO app_user (id, email, full_name, employee_id, division_id, branch_id)
      VALUES 
        (${apUserId}, ${`ap-user-${apUserId}@nusanet.net.id`}, 'AP Staff', ${`EMP-AP-${apUserId.slice(0, 6)}`}, 'DIV-FIN', 'HQ'),
        (${headOfApUserId}, ${`head-ap-${headOfApUserId}@nusanet.net.id`}, 'Head of AP', ${`EMP-HAP-${headOfApUserId.slice(0, 6)}`}, 'DIV-FIN', 'HQ'),
        (${regularUserId}, ${`reg-user-${regularUserId}@nusanet.net.id`}, 'Regular Staff', ${`EMP-REG-${regularUserId.slice(0, 6)}`}, 'DIV-IT', 'HQ')
    `;

    await sql`
      INSERT INTO user_role_assignment (user_id, role, assigned_by)
      VALUES 
        (${apUserId}, 'ACCOUNT_PAYABLE', ${apUserId}),
        (${headOfApUserId}, 'FINANCE', ${headOfApUserId}),
        (${regularUserId}, 'REQUESTER', ${regularUserId})
    `;

    // 1. Setup Vendor
    const vendor = await createVendor({
      name: 'PT Jaringan Solusi Pajak',
      taxIdentificationNumber: '12.345.678.9-012.000',
      isPkp: true,
      createdBy: apUserId,
    });
    vendorId = vendor.id;

    const bank = await createVendorBankAccount({
      vendorId: vendor.id,
      bankName: 'BCA',
      bankCode: '014',
      accountNumber: '8877665544',
      accountHolderName: 'PT Jaringan Solusi Pajak',
    });

    await verifyBankAccountStage({ bankAccountId: bank.id, verifierUserId: apUserId, action: 'VERIFY_STAGE_1' });
    await verifyBankAccountStage({ bankAccountId: bank.id, verifierUserId: headOfApUserId, action: 'VERIFY_STAGE_2' });

    // 2. Setup PR & PO
    const pr = await createPurchaseRequest({
      requesterId: regularUserId,
      costCenter: 'CC-IT-02',
      divisionId: 'DIV-IT',
      branchId: 'HQ',
      requiredDate: '2026-09-15',
      paymentTermType: 'PAY_AFTER_RECEIPT',
      businessJustification: 'Pengadaan Switch Core 10G',
      items: [
        {
          lineNumber: 1,
          itemName: 'Switch Core 10G Multi-Port',
          quantityRequested: 1,
          uom: 'Unit',
          estimatedUnitPrice: 100_000_000,
        },
      ],
    });

    await submitPurchaseRequest(pr.id, regularUserId);
    await decideApprovalStep({ prId: pr.id, approverId: headOfApUserId, decision: 'APPROVED' });

    const po = await createPurchaseOrder({
      prId: pr.id,
      vendorId: vendor.id,
      vendorBankAccountId: bank.id,
      paymentTermType: 'PAY_AFTER_RECEIPT',
      taxAmount: 12_000_000, // 12% PPN
      createdBy: apUserId,
      items: [
        {
          prItemId: pr.items[0].id,
          lineNumber: 1,
          itemName: 'Switch Core 10G Multi-Port',
          quantityOrdered: 1,
          uom: 'Unit',
          unitPrice: 100_000_000,
        },
      ],
    });

    await approvePurchaseOrder(po.id, headOfApUserId);
    await issuePurchaseOrder(po.id, apUserId);

    testPoId = po.id;
    testPoGrandTotal = po.grandTotalAmount; // 112,000,000
  });

  describe('1. Dual-NSFP Validation (R35)', () => {
    it('validates 16-digit legacy NSFP format', () => {
      const formatted = '010.000-24.12345678';
      const result = validateNsfp(formatted);
      expect(result.isValid).toBe(true);
      expect(result.formatType).toBe('LEGACY_16');
      expect(result.normalized).toBe('0100002412345678');
    });

    it('validates 17-digit Coretax NSFP format', () => {
      const formatted = '010.000-24.123456789';
      const result = validateNsfp(formatted);
      expect(result.isValid).toBe(true);
      expect(result.formatType).toBe('CORETAX_17');
      expect(result.normalized).toBe('01000024123456789');
    });

    it('rejects invalid NSFP length or characters', () => {
      expect(validateNsfp('12345').isValid).toBe(false);
      expect(validateNsfp('010.000-24.ABCDEFGH').isValid).toBe(false);
      expect(validateNsfp('').isValid).toBe(false);
    });
  });

  describe('2. Anti-Duplicate Invoice Detection (R34)', () => {
    it('rejects duplicate invoice entry with identical vendor, number, date and amount', async () => {
      const invNumber = `INV-DUP-${Date.now().toString(36)}-${crypto.randomUUID().slice(0, 8)}`;
      const input: CreateInvoiceInput = {
        vendorId,
        poId: testPoId,
        vendorInvoiceNumber: invNumber,
        invoiceDate: '2026-08-23',
        dueDate: '2026-09-23',
        subtotalAmount: 100_000_000,
        ppnAmount: 12_000_000,
        totalPayableAmount: 112_000_000,
        nsfpOriginal: '010.000-24.12345678',
        taxSnapshotId,
        uploadedBy: apUserId,
      };

      const firstInvoice = await createInvoice(input);
      expect(firstInvoice).toBeDefined();

      let duplicateCaught = false;
      try {
        await createInvoice(input); // Duplicate attempt
      } catch (err: unknown) {
        duplicateCaught = true;
        const msg = err instanceof Error ? err.message : String(err);
        expect(msg.toLowerCase()).toContain('duplikat');
      }

      expect(duplicateCaught).toBe(true);
    });
  });

  describe('3. Tax Rule Snapshot Immutability (R36)', () => {
    it('preserves historical invoice tax amounts even when new tax snapshots are introduced', async () => {
      // 1. Create invoice with current snapshot (PPN 12%)
      const invNumber = `INV-TAX-${Date.now().toString(36)}-${crypto.randomUUID().slice(0, 8)}`;
      const invoice = await createInvoice({
        vendorId,
        poId: testPoId,
        vendorInvoiceNumber: invNumber,
        invoiceDate: '2026-08-23',
        dueDate: '2026-09-23',
        subtotalAmount: 100_000_000,
        ppnAmount: 12_000_000,
        totalPayableAmount: 112_000_000,
        nsfpOriginal: '010.000-24.12345678',
        taxSnapshotId,
        uploadedBy: apUserId,
      });

      // 2. Introduce a new future tax snapshot (e.g. PPN 15%)
      const futureSnapshotId = crypto.randomUUID();
      await sql`
        INSERT INTO tax_rule_snapshot (id, ppn_rate, dpp_factor, tax_regulation_ref)
        VALUES (${futureSnapshotId}, 0.1500, 1.0000, 'UU Harmonisasi Peraturan Perpajakan 2028')
      `;

      // 3. Query the previously saved invoice; verify its tax amounts remain unaltered
      const fetched = await getInvoiceById(invoice.id);
      expect(fetched.taxSnapshotId).toBe(taxSnapshotId);
      expect(fetched.ppnAmount).toBe(12_000_000);
      expect(fetched.totalPayableAmount).toBe(112_000_000);
    });
  });

  describe('4. 2-Way Matching Engine & Tolerance Thresholds (R37, R38)', () => {
    it('R38: Evaluates exact match and tolerance within Rp 100.000 as MATCHED_OK', async () => {
      // Invoice with Rp 50,000 minor variance (within Rp 100,000 tolerance)
      const invNumber = `INV-OK-${Date.now().toString(36)}-${crypto.randomUUID().slice(0, 8)}`;
      const invoice = await createInvoice({
        vendorId,
        poId: testPoId,
        vendorInvoiceNumber: invNumber,
        invoiceDate: '2026-08-23',
        dueDate: '2026-09-23',
        subtotalAmount: 100_050_000,
        ppnAmount: 12_000_000,
        totalPayableAmount: testPoGrandTotal + 50_000, // 112,050,000 (diff: 50,000 <= 100,000)
        nsfpOriginal: '010.000-24.12345678',
        taxSnapshotId,
        uploadedBy: apUserId,
      });

      const matchResult = await runTwoWayMatching(invoice.id);
      expect(matchResult.matchStatus).toBe('MATCHED_OK');
      expect(matchResult.isHeldForTax).toBe(false);

      const dbInvoice = await getInvoiceById(invoice.id);
      expect(dbInvoice.matchStatus).toBe('MATCHED_OK');
      expect(dbInvoice.isHeldForTax).toBe(false);
    });

    it('R38: Flags invoice with 5% variance as MATCHED_WITH_EXCEPTION and holds for payment', async () => {
      // Invoice with 5% variance (Rp 5,600,000 > Rp 100,000 and 5% > 1%)
      const invNumber = `INV-EXC-${Date.now().toString(36)}-${crypto.randomUUID().slice(0, 8)}`;
      const excessAmount = testPoGrandTotal * 1.05; // 117,600,000
      const invoice = await createInvoice({
        vendorId,
        poId: testPoId,
        vendorInvoiceNumber: invNumber,
        invoiceDate: '2026-08-23',
        dueDate: '2026-09-23',
        subtotalAmount: 105_000_000,
        ppnAmount: 12_600_000,
        totalPayableAmount: excessAmount,
        nsfpOriginal: '010.000-24.12345678',
        taxSnapshotId,
        uploadedBy: apUserId,
      });

      const matchResult = await runTwoWayMatching(invoice.id);
      expect(matchResult.matchStatus).toBe('MATCHED_WITH_EXCEPTION');
      expect(matchResult.isHeldForTax).toBe(true);
      expect(matchResult.exceptions.length).toBeGreaterThan(0);
      expect(matchResult.exceptions[0].varianceAmount).toBeGreaterThan(100_000);

      const dbInvoice = await getInvoiceById(invoice.id);
      expect(dbInvoice.matchStatus).toBe('MATCHED_WITH_EXCEPTION');
      expect(dbInvoice.isHeldForTax).toBe(true);
    });
  });

  describe('5. Matching Exception Override by Head of AP (R39)', () => {
    it('R39: Rejects exception override attempted by unauthorized user', async () => {
      const invNumber = `INV-OVR-FAIL-${Date.now().toString(36)}-${crypto.randomUUID().slice(0, 8)}`;
      const invoice = await createInvoice({
        vendorId,
        poId: testPoId,
        vendorInvoiceNumber: invNumber,
        invoiceDate: '2026-08-23',
        dueDate: '2026-09-23',
        subtotalAmount: 105_000_000,
        ppnAmount: 12_600_000,
        totalPayableAmount: 117_600_000,
        taxSnapshotId,
        uploadedBy: apUserId,
      });

      await runTwoWayMatching(invoice.id);

      let errorCaught = false;
      try {
        await overrideMatchingException({
          invoiceId: invoice.id,
          userId: regularUserId, // Requester / non-Head of AP
          overrideReason: 'Toleransi harga disetujui',
        });
      } catch (err: unknown) {
        errorCaught = true;
        expect(err).toBeInstanceOf(ForbiddenError);
      }

      expect(errorCaught).toBe(true);
    });

    it('R39: Allows authorized Head of AP to override exception with mandatory written reason', async () => {
      const invNumber = `INV-OVR-OK-${Date.now().toString(36)}-${crypto.randomUUID().slice(0, 8)}`;
      const invoice = await createInvoice({
        vendorId,
        poId: testPoId,
        vendorInvoiceNumber: invNumber,
        invoiceDate: '2026-08-23',
        dueDate: '2026-09-23',
        subtotalAmount: 105_000_000,
        ppnAmount: 12_600_000,
        totalPayableAmount: 117_600_000,
        taxSnapshotId,
        uploadedBy: apUserId,
      });

      await runTwoWayMatching(invoice.id);

      const overridden = await overrideMatchingException({
        invoiceId: invoice.id,
        userId: headOfApUserId, // Head of AP / FINANCE
        overrideReason: 'Kenaikan tarif disetujui oleh Direksi melalui memo resmi M-2026-088',
      });

      expect(overridden.matchStatus).toBe('EXCEPTION_OVERRIDDEN');
      expect(overridden.isHeldForTax).toBe(false);

      const dbInvoice = await getInvoiceById(invoice.id);
      expect(dbInvoice.matchStatus).toBe('EXCEPTION_OVERRIDDEN');
      expect(dbInvoice.isHeldForTax).toBe(false);
    });
  });

  describe('6. REST API Routes for Invoice & 2-Way Matching', () => {
    it('creates invoice, triggers matching, and performs override via REST API', async () => {
      const app = createInvoiceApp();

      // 1. Create Invoice
      const invRes = await app.request('/invoices', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Id': apUserId,
          'X-User-Role': 'ACCOUNT_PAYABLE',
        },
        body: JSON.stringify({
          vendorId,
          poId: testPoId,
          vendorInvoiceNumber: `INV-API-${Date.now().toString(36)}-${crypto.randomUUID().slice(0, 8)}`,
          invoiceDate: '2026-08-23',
          dueDate: '2026-09-23',
          subtotalAmount: 104_000_000,
          ppnAmount: 12_480_000,
          totalPayableAmount: 116_480_000,
          nsfpOriginal: '010.000-24.12345678',
          taxSnapshotId,
        }),
      });

      expect(invRes.status).toBe(201);
      const invData = await invRes.json();
      const invoiceId = invData.data.id;

      // 2. Trigger 2-Way Match
      const matchRes = await app.request(`/invoices/${invoiceId}/match`, {
        method: 'POST',
        headers: {
          'X-User-Id': apUserId,
          'X-User-Role': 'ACCOUNT_PAYABLE',
        },
      });
      expect(matchRes.status).toBe(200);
      const matchData = await matchRes.json();
      expect(matchData.data.matchStatus).toBe('MATCHED_WITH_EXCEPTION');

      // 3. Override by Head of AP
      const overrideRes = await app.request(`/invoices/${invoiceId}/override`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Id': headOfApUserId,
          'X-User-Role': 'FINANCE',
        },
        body: JSON.stringify({
          overrideReason: 'Override disetujui sesuai memo persetujuan CFO',
        }),
      });
      expect(overrideRes.status).toBe(200);
      const overrideData = await overrideRes.json();
      expect(overrideData.data.matchStatus).toBe('EXCEPTION_OVERRIDDEN');
    });
  });
});
