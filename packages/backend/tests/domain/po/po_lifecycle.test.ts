import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { sql } from '../../../src/db/client';
import { runMigrations } from '../../../src/db/migrate';
import { cleanupTestUsers } from '../../helpers/test_cleaner';
import {
  createVendor,
  createVendorBankAccount,
  verifyBankAccountStage,
  type CreateVendorInput,
  type CreateBankAccountInput,
} from '../../../src/domain/vendor/service';
import {
  createPurchaseOrder,
  approvePurchaseOrder,
  issuePurchaseOrder,
  amendPurchaseOrder,
  updatePurchaseOrderDirect,
  generatePoPdf,
  type CreatePoInput,
} from '../../../src/domain/po/service';
import { createPurchaseRequest, submitPurchaseRequest, decideApprovalStep } from '../../../src/domain/pr/service';
import { SodConflictError } from '../../../src/domain/sod/errors';
import { createPoAndVendorApp } from '../../../src/domain/po/routes';

describe('Epic 5: PO & Vendor 4-Eyes Bank Account Verification & PO Generation (R17–R27)', () => {
  let apMakerId: string;
  let apCheckerId: string;
  let poApproverId: string;
  let requesterId: string;
  let approvedPrId: string;
  let approvedPrItemId: string;

  beforeAll(async () => {
    await runMigrations();

    apMakerId = crypto.randomUUID();
    apCheckerId = crypto.randomUUID();
    poApproverId = crypto.randomUUID();
    requesterId = crypto.randomUUID();

    await sql`
      INSERT INTO app_user (id, email, full_name, employee_id, division_id, branch_id)
      VALUES 
        (${apMakerId}, ${`ap-maker-${apMakerId}@nusanet.net.id`}, 'AP Maker', ${`EMP-AP1-${apMakerId.slice(0, 6)}`}, 'DIV-FIN', 'HQ'),
        (${apCheckerId}, ${`ap-checker-${apCheckerId}@nusanet.net.id`}, 'AP Checker', ${`EMP-AP2-${apCheckerId.slice(0, 6)}`}, 'DIV-FIN', 'HQ'),
        (${poApproverId}, ${`po-approver-${poApproverId}@nusanet.net.id`}, 'PO Approver Head', ${`EMP-PO-${poApproverId.slice(0, 6)}`}, 'DIV-FIN', 'HQ'),
        (${requesterId}, ${`requester-${requesterId}@nusanet.net.id`}, 'Requester PR', ${`EMP-REQ-${requesterId.slice(0, 6)}`}, 'DIV-IT', 'HQ')
    `;

    await sql`
      INSERT INTO user_role_assignment (user_id, role, assigned_by)
      VALUES 
        (${apMakerId}, 'ACCOUNT_PAYABLE', ${apMakerId}),
        (${apCheckerId}, 'ACCOUNT_PAYABLE', ${apCheckerId}),
        (${poApproverId}, 'APPROVER', ${poApproverId}),
        (${requesterId}, 'REQUESTER', ${requesterId})
    `;

    // Create and approve a PR for PO sourcing
    const pr = await createPurchaseRequest({
      requesterId,
      costCenter: 'CC-IT-01',
      divisionId: 'DIV-IT',
      branchId: 'HQ',
      requiredDate: '2026-09-01',
      paymentTermType: 'PAY_AFTER_RECEIPT',
      businessJustification: 'Pengadaan Switch 24-Port',
      items: [
        {
          lineNumber: 1,
          itemName: 'Cisco Catalyst 2960-X',
          specification: '24-port Gigabit Ethernet',
          quantityRequested: 2,
          uom: 'Unit',
          estimatedUnitPrice: 15_000_000,
        },
      ],
    });

    await submitPurchaseRequest(pr.id, requesterId);
    await decideApprovalStep({
      prId: pr.id,
      approverId: poApproverId,
      decision: 'APPROVED',
    });

    approvedPrId = pr.id;
    approvedPrItemId = pr.items[0].id;
  });

  describe('1. Vendor Registration & 4-Eyes Bank Account Verification (R17, R18, R19)', () => {
    it('registers a vendor in PROSPECTIVE status', async () => {
      const vendorInput: CreateVendorInput = {
        name: 'PT Jaringan Solusi Nusantara',
        taxIdentificationNumber: '01.345.678.9-012.000',
        isPkp: true,
        createdBy: apMakerId,
      };

      const vendor = await createVendor(vendorInput);
      expect(vendor).toBeDefined();
      expect(vendor.status).toBe('PROSPECTIVE');
      expect(vendor.vendorCode).toMatch(/^VEND-/);
    });

    it('creates bank account with encryption and masking in PENDING_VERIFICATION status', async () => {
      const vendor = await createVendor({
        name: 'PT Mitra Teknologi Mandiri',
        taxIdentificationNumber: '02.456.789.0-123.000',
        createdBy: apMakerId,
      });

      const bankInput: CreateBankAccountInput = {
        vendorId: vendor.id,
        bankName: 'Bank Central Asia (BCA)',
        bankCode: '014',
        accountNumber: '8830192837',
        accountHolderName: 'PT Mitra Teknologi Mandiri',
      };

      const bankAccount = await createVendorBankAccount(bankInput);
      expect(bankAccount.status).toBe('PENDING_VERIFICATION');
      expect(bankAccount.accountNumberMasked).toBe('******2837');
      expect(bankAccount.accountNumberEncrypted).toBeDefined();
    });

    it('R18: Enforces 4-Eyes principle: same user cannot verify both Stage 1 and Stage 2', async () => {
      const vendor = await createVendor({
        name: 'PT Citra Data Prima',
        taxIdentificationNumber: '03.567.890.1-234.000',
        createdBy: apMakerId,
      });

      const bankAccount = await createVendorBankAccount({
        vendorId: vendor.id,
        bankName: 'Bank Mandiri',
        bankCode: '008',
        accountNumber: '1370019283741',
        accountHolderName: 'PT Citra Data Prima',
      });

      // Stage 1 Verification by AP Maker
      const stage1 = await verifyBankAccountStage({
        bankAccountId: bankAccount.id,
        verifierUserId: apMakerId,
        action: 'VERIFY_STAGE_1',
      });
      expect(stage1.status).toBe('PENDING_VERIFICATION');
      expect(stage1.verifiedBy1).toBe(apMakerId);

      // Stage 2 Verification by SAME AP Maker -> Must be rejected (4-eyes rule)
      let errorCaught = false;
      try {
        await verifyBankAccountStage({
          bankAccountId: bankAccount.id,
          verifierUserId: apMakerId, // Same user
          action: 'VERIFY_STAGE_2',
        });
      } catch (err: unknown) {
        errorCaught = true;
        const msg = err instanceof Error ? err.message : String(err);
        expect(msg).toContain('R18');
      }

      expect(errorCaught).toBe(true);

      // Stage 2 Verification by DISTINCT AP Checker -> Succeeds & vendor becomes APPROVED / VERIFIED
      const stage2 = await verifyBankAccountStage({
        bankAccountId: bankAccount.id,
        verifierUserId: apCheckerId, // Distinct user
        action: 'VERIFY_STAGE_2',
      });
      expect(stage2.status).toBe('VERIFIED');
      expect(stage2.verifiedBy2).toBe(apCheckerId);
    });

    it('R19: Temporal bank account pattern archives old bank account without deleting', async () => {
      const vendor = await createVendor({
        name: 'PT Solusi Fiber Optik',
        taxIdentificationNumber: '04.678.901.2-345.000',
        createdBy: apMakerId,
      });

      // Account 1
      const bank1 = await createVendorBankAccount({
        vendorId: vendor.id,
        bankName: 'BCA',
        bankCode: '014',
        accountNumber: '1111222233',
        accountHolderName: 'PT Solusi Fiber Optik',
      });
      await verifyBankAccountStage({ bankAccountId: bank1.id, verifierUserId: apMakerId, action: 'VERIFY_STAGE_1' });
      await verifyBankAccountStage({ bankAccountId: bank1.id, verifierUserId: apCheckerId, action: 'VERIFY_STAGE_2' });

      // Account 2 added later
      const bank2 = await createVendorBankAccount({
        vendorId: vendor.id,
        bankName: 'Bank BNI',
        bankCode: '009',
        accountNumber: '9999888877',
        accountHolderName: 'PT Solusi Fiber Optik',
      });
      await verifyBankAccountStage({ bankAccountId: bank2.id, verifierUserId: apMakerId, action: 'VERIFY_STAGE_1' });
      await verifyBankAccountStage({ bankAccountId: bank2.id, verifierUserId: apCheckerId, action: 'VERIFY_STAGE_2' });

      // Check both records exist in DB; bank1 is archived/non-primary, bank2 is primary
      const accounts = await sql`
        SELECT id, is_primary, status FROM vendor_bank_account WHERE vendor_id = ${vendor.id} ORDER BY created_at ASC
      `;
      expect(accounts.length).toBe(2);
      expect(accounts[0].is_primary).toBe(false);
      expect(accounts[1].is_primary).toBe(true);
    });
  });

  describe('2. PO Creation & Issuance Guard on Unverified Vendor / Bank (R20, R24)', () => {
    it('R24: Rejects PO issuance when vendor or bank account is not verified', async () => {
      // Create CANDIDATE vendor with unverified bank account
      const unverifiedVendor = await createVendor({
        name: 'PT Vendor Belum Terverifikasi',
        taxIdentificationNumber: '05.789.012.3-456.000',
        createdBy: apMakerId,
      });

      const unverifiedBank = await createVendorBankAccount({
        vendorId: unverifiedVendor.id,
        bankName: 'BCA',
        bankCode: '014',
        accountNumber: '5554443322',
        accountHolderName: 'PT Vendor Belum Terverifikasi',
      });

      const poInput: CreatePoInput = {
        prId: approvedPrId,
        vendorId: unverifiedVendor.id,
        vendorBankAccountId: unverifiedBank.id,
        paymentTermType: 'PAY_AFTER_RECEIPT',
        termsAndConditions: 'Standard warranty 1 year',
        createdBy: apMakerId,
        items: [
          {
            prItemId: approvedPrItemId,
            lineNumber: 1,
            itemName: 'Cisco Catalyst 2960-X',
            quantityOrdered: 2,
            uom: 'Unit',
            unitPrice: 14_500_000,
          },
        ],
      };

      const po = await createPurchaseOrder(poInput);
      expect(po.status).toBe('DRAFT');

      // Attempt to issue PO -> Must fail due to unverified vendor/bank (R24)
      let errorCaught = false;
      try {
        await issuePurchaseOrder(po.id, apMakerId);
      } catch (err: unknown) {
        errorCaught = true;
        const msg = err instanceof Error ? err.message : String(err);
        expect(msg).toContain('R24');
      }

      expect(errorCaught).toBe(true);
    });

    it('allows PO issuance when vendor and bank account are both VERIFIED (R24)', async () => {
      const verifiedVendor = await createVendor({
        name: 'PT Vendor Terpercaya',
        taxIdentificationNumber: '06.890.123.4-567.000',
        createdBy: apMakerId,
      });

      const verifiedBank = await createVendorBankAccount({
        vendorId: verifiedVendor.id,
        bankName: 'BCA',
        bankCode: '014',
        accountNumber: '7778889990',
        accountHolderName: 'PT Vendor Terpercaya',
      });

      await verifyBankAccountStage({ bankAccountId: verifiedBank.id, verifierUserId: apMakerId, action: 'VERIFY_STAGE_1' });
      await verifyBankAccountStage({ bankAccountId: verifiedBank.id, verifierUserId: apCheckerId, action: 'VERIFY_STAGE_2' });

      const po = await createPurchaseOrder({
        prId: approvedPrId,
        vendorId: verifiedVendor.id,
        vendorBankAccountId: verifiedBank.id,
        paymentTermType: 'PAY_AFTER_RECEIPT',
        termsAndConditions: 'Standard terms',
        createdBy: apMakerId,
        items: [
          {
            prItemId: approvedPrItemId,
            lineNumber: 1,
            itemName: 'Cisco Catalyst 2960-X',
            quantityOrdered: 2,
            uom: 'Unit',
            unitPrice: 14_500_000,
          },
        ],
      });

      // Approve PO with distinct approver
      await approvePurchaseOrder(po.id, poApproverId);

      // Issue PO
      const issuedPo = await issuePurchaseOrder(po.id, apMakerId);
      expect(issuedPo.status).toBe('ISSUED');
      expect(issuedPo.issuedAt).toBeDefined();
    });
  });

  describe('3. SoD Enforcement on Purchase Order (R25)', () => {
    it('R25: Rejects PO approval when approver is the PO author (Self-Approval)', async () => {
      const vendor = await createVendor({
        name: 'PT SoD Check Vendor',
        taxIdentificationNumber: '07.901.234.5-678.000',
        createdBy: apMakerId,
      });

      const bank = await createVendorBankAccount({
        vendorId: vendor.id,
        bankName: 'BCA',
        bankCode: '014',
        accountNumber: '1234567890',
        accountHolderName: 'PT SoD Check Vendor',
      });
      await verifyBankAccountStage({ bankAccountId: bank.id, verifierUserId: apMakerId, action: 'VERIFY_STAGE_1' });
      await verifyBankAccountStage({ bankAccountId: bank.id, verifierUserId: apCheckerId, action: 'VERIFY_STAGE_2' });

      const po = await createPurchaseOrder({
        prId: approvedPrId,
        vendorId: vendor.id,
        vendorBankAccountId: bank.id,
        paymentTermType: 'PAY_AFTER_RECEIPT',
        createdBy: apMakerId, // PO Author
        items: [
          {
            prItemId: approvedPrItemId,
            lineNumber: 1,
            itemName: 'Cisco Catalyst 2960-X',
            quantityOrdered: 2,
            uom: 'Unit',
            unitPrice: 14_500_000,
          },
        ],
      });

      // PO Author attempts to approve -> Must throw SodConflictError
      let errorCaught = false;
      try {
        await approvePurchaseOrder(po.id, apMakerId);
      } catch (err: unknown) {
        errorCaught = true;
        expect(err).toBeInstanceOf(SodConflictError);
      }

      expect(errorCaught).toBe(true);
    });
  });

  describe('4. Official PO Amendment History vs Direct Edit (R26)', () => {
    it('R26: Rejects direct edit on ISSUED PO and enforces official numbered amendment', async () => {
      const vendor = await createVendor({
        name: 'PT Amendemen Vendor',
        taxIdentificationNumber: '08.012.345.6-789.000',
        createdBy: apMakerId,
      });

      const bank = await createVendorBankAccount({
        vendorId: vendor.id,
        bankName: 'BCA',
        bankCode: '014',
        accountNumber: '9876543210',
        accountHolderName: 'PT Amendemen Vendor',
      });
      await verifyBankAccountStage({ bankAccountId: bank.id, verifierUserId: apMakerId, action: 'VERIFY_STAGE_1' });
      await verifyBankAccountStage({ bankAccountId: bank.id, verifierUserId: apCheckerId, action: 'VERIFY_STAGE_2' });

      const po = await createPurchaseOrder({
        prId: approvedPrId,
        vendorId: vendor.id,
        vendorBankAccountId: bank.id,
        paymentTermType: 'PAY_AFTER_RECEIPT',
        createdBy: apMakerId,
        items: [
          {
            prItemId: approvedPrItemId,
            lineNumber: 1,
            itemName: 'Cisco Catalyst 2960-X',
            quantityOrdered: 2,
            uom: 'Unit',
            unitPrice: 14_500_000,
          },
        ],
      });

      await approvePurchaseOrder(po.id, poApproverId);
      await issuePurchaseOrder(po.id, apMakerId);

      // Attempt direct edit on issued PO -> Must fail (R26)
      let directEditBlocked = false;
      try {
        await updatePurchaseOrderDirect(po.id, {
          termsAndConditions: 'Direct modification without amendment',
        });
      } catch (err: unknown) {
        directEditBlocked = true;
        const msg = err instanceof Error ? err.message : String(err);
        expect(msg).toContain('R26');
      }
      expect(directEditBlocked).toBe(true);

      // Create official amendment
      const amendment = await amendPurchaseOrder({
        poId: po.id,
        authorizedById: poApproverId,
        reason: 'Perpanjangan masa garansi menjadi 2 tahun dan penyesuaian termin',
        updatedTermsAndConditions: 'Garansi resmi 2 tahun onsite',
      });

      expect(amendment.amendmentNumber).toBe(1);
      expect(amendment.changeSummary).toBe('Perpanjangan masa garansi menjadi 2 tahun dan penyesuaian termin');

      // Verify amendment history stored in DB
      const histories = await sql`
        SELECT * FROM po_amendment_history WHERE po_id = ${po.id}
      `;
      expect(histories.length).toBe(1);
      expect(histories[0].amendment_number).toBe(1);
    });
  });

  describe('5. Official PO PDF Generation (R27)', () => {
    it('generates a valid PDF document buffer for issued PO', async () => {
      const vendor = await createVendor({
        name: 'PT PDF Test Vendor',
        taxIdentificationNumber: '09.123.456.7-890.000',
        createdBy: apMakerId,
      });

      const bank = await createVendorBankAccount({
        vendorId: vendor.id,
        bankName: 'BCA',
        bankCode: '014',
        accountNumber: '1122334455',
        accountHolderName: 'PT PDF Test Vendor',
      });
      await verifyBankAccountStage({ bankAccountId: bank.id, verifierUserId: apMakerId, action: 'VERIFY_STAGE_1' });
      await verifyBankAccountStage({ bankAccountId: bank.id, verifierUserId: apCheckerId, action: 'VERIFY_STAGE_2' });

      const po = await createPurchaseOrder({
        prId: approvedPrId,
        vendorId: vendor.id,
        vendorBankAccountId: bank.id,
        paymentTermType: 'PAY_AFTER_RECEIPT',
        termsAndConditions: 'Franco Jakarta, Garansi 1 Tahun',
        createdBy: apMakerId,
        items: [
          {
            prItemId: approvedPrItemId,
            lineNumber: 1,
            itemName: 'Cisco Catalyst 2960-X',
            quantityOrdered: 2,
            uom: 'Unit',
            unitPrice: 14_500_000,
          },
        ],
      });

      await approvePurchaseOrder(po.id, poApproverId);
      await issuePurchaseOrder(po.id, apMakerId);

      const pdfBuffer = await generatePoPdf(po.id);
      expect(pdfBuffer).toBeInstanceOf(Uint8Array);
      expect(pdfBuffer.length).toBeGreaterThan(100);

      // Verify PDF header magic bytes %PDF
      const header = Buffer.from(pdfBuffer.slice(0, 4)).toString('ascii');
      expect(header).toBe('%PDF');
    });
  });

  describe('6. REST API Routes for Vendor & Purchase Order', () => {
    it('creates vendor, verifies bank account, and generates PO via API', async () => {
      const app = createPoAndVendorApp();

      // 1. Create Vendor via API
      const vendorRes = await app.request('/vendors', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Id': apMakerId,
          'X-User-Role': 'ACCOUNT_PAYABLE',
        },
        body: JSON.stringify({
          name: 'PT API Integrasi Nusantara',
          taxIdentificationNumber: '10.234.567.8-901.000',
        }),
      });
      expect(vendorRes.status).toBe(201);
      const vendorData = await vendorRes.json();
      const vendorId = vendorData.data.id;

      // 2. Create Bank Account via API
      const bankRes = await app.request(`/vendors/${vendorId}/bank-accounts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Id': apMakerId,
          'X-User-Role': 'ACCOUNT_PAYABLE',
        },
        body: JSON.stringify({
          bankName: 'BCA',
          bankCode: '014',
          accountNumber: '3344556677',
          accountHolderName: 'PT API Integrasi Nusantara',
        }),
      });
      expect(bankRes.status).toBe(201);
      const bankData = await bankRes.json();
      const bankId = bankData.data.id;

      // 3. Verify Bank Stage 1 via API
      const v1Res = await app.request(`/vendors/${vendorId}/bank-accounts/${bankId}/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Id': apMakerId,
          'X-User-Role': 'ACCOUNT_PAYABLE',
        },
        body: JSON.stringify({ action: 'VERIFY_STAGE_1' }),
      });
      expect(v1Res.status).toBe(200);

      // 4. Verify Bank Stage 2 via API (Distinct User)
      const v2Res = await app.request(`/vendors/${vendorId}/bank-accounts/${bankId}/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Id': apCheckerId,
          'X-User-Role': 'ACCOUNT_PAYABLE',
        },
        body: JSON.stringify({ action: 'VERIFY_STAGE_2' }),
      });
      expect(v2Res.status).toBe(200);

      // 5. Create PO via API
      const poRes = await app.request('/purchase-orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Id': apMakerId,
          'X-User-Role': 'ACCOUNT_PAYABLE',
        },
        body: JSON.stringify({
          prId: approvedPrId,
          vendorId,
          vendorBankAccountId: bankId,
          paymentTermType: 'PAY_AFTER_RECEIPT',
          items: [
            {
              prItemId: approvedPrItemId,
              lineNumber: 1,
              itemName: 'Cisco Catalyst 2960-X',
              quantityOrdered: 2,
              uom: 'Unit',
              unitPrice: 14_500_000,
            },
          ],
        }),
      });
      expect(poRes.status).toBe(201);
    });
  });

  afterAll(async () => {
    await cleanupTestUsers([apMakerId, apCheckerId, poApproverId, requesterId]);
  });
});
