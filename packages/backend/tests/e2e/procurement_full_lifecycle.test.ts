import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { sql } from '../../src/db/client';
import { runMigrations } from '../../src/db/migrate';
import { createApp } from '../../src/index';
import { generateReauthToken } from '../../src/domain/auth/token';
import { cleanupTestUsers } from '../helpers/test_cleaner';

describe('Epic 13: [E2E] Full Lifecycle Simulation Test Suite (PR -> PO -> BAST -> Matcher -> Payment -> Audit)', () => {
  const app = createApp();

  // Test Actors for the 7 roles
  const requesterId = crypto.randomUUID();
  const approverId = crypto.randomUUID();
  const apMakerId = crypto.randomUUID();
  const apCheckerId = crypto.randomUUID();
  const headOfApId = crypto.randomUUID();
  const warehouseId = crypto.randomUUID();
  const financeExecutorId = crypto.randomUUID();
  const auditorId = crypto.randomUUID();

  // State shared across the lifecycle stages
  let prId: string;
  let prItemId: string;
  let vendorId: string;
  let bankAccountId: string;
  let poId: string;
  let poItemId: string;
  let grId: string;
  let invoiceId: string;
  let paymentProposalId: string;

  beforeAll(async () => {
    await runMigrations();

    // Seed 7 distinct test users
    await sql`
      INSERT INTO app_user (id, email, full_name, employee_id, division_id, branch_id)
      VALUES 
        (${requesterId}, ${`req-${requesterId}@nusanet.net.id`}, 'Requester Staff', ${`EMP-REQ-${requesterId.slice(0, 6)}`}, 'DIV-IT', 'HQ'),
        (${approverId}, ${`appr-${approverId}@nusanet.net.id`}, 'Division Manager Approver', ${`EMP-APP-${approverId.slice(0, 6)}`}, 'DIV-IT', 'HQ'),
        (${apMakerId}, ${`apmaker-${apMakerId}@nusanet.net.id`}, 'AP Maker Officer', ${`EMP-APM-${apMakerId.slice(0, 6)}`}, 'DIV-FIN', 'HQ'),
        (${apCheckerId}, ${`apchecker-${apCheckerId}@nusanet.net.id`}, 'AP Checker Officer', ${`EMP-APC-${apCheckerId.slice(0, 6)}`}, 'DIV-FIN', 'HQ'),
        (${headOfApId}, ${`headap-${headOfApId}@nusanet.net.id`}, 'Head of AP', ${`EMP-HAP-${headOfApId.slice(0, 6)}`}, 'DIV-FIN', 'HQ'),
        (${warehouseId}, ${`wh-${warehouseId}@nusanet.net.id`}, 'Warehouse Inspector', ${`EMP-WH-${warehouseId.slice(0, 6)}`}, 'DIV-OPS', 'HQ'),
        (${financeExecutorId}, ${`finex-${financeExecutorId}@nusanet.net.id`}, 'Finance Payment Executor', ${`EMP-FIN-${financeExecutorId.slice(0, 6)}`}, 'DIV-FIN', 'HQ'),
        (${auditorId}, ${`audit-${auditorId}@nusanet.net.id`}, 'Internal Auditor', ${`EMP-AUD-${auditorId.slice(0, 6)}`}, 'DIV-AUDIT', 'HQ')
    `;

    // Assign roles to users
    await sql`
      INSERT INTO user_role_assignment (user_id, role, assigned_by)
      VALUES 
        (${requesterId}, 'REQUESTER', ${requesterId}),
        (${approverId}, 'APPROVER', ${approverId}),
        (${apMakerId}, 'ACCOUNT_PAYABLE', ${apMakerId}),
        (${apCheckerId}, 'ACCOUNT_PAYABLE', ${apCheckerId}),
        (${headOfApId}, 'FINANCE', ${headOfApId}),
        (${warehouseId}, 'WAREHOUSE', ${warehouseId}),
        (${financeExecutorId}, 'FINANCE', ${financeExecutorId}),
        (${auditorId}, 'AUDITOR', ${auditorId})
    `;
  });

  it('Stage 1: Requester creates and submits multi-item PR (R6, R7, R8, R9, R12)', async () => {
    const createPrPayload = {
      costCenter: 'CC-IT-INFRA',
      divisionId: 'DIV-IT',
      branchId: 'HQ_MEDAN',
      requiredDate: '2026-09-01',
      paymentTermType: 'PAY_AFTER_RECEIPT',
      businessJustification: 'Pengadaan 10 unit Core Edge Router untuk upgrade backbone POP Nusanet',
      items: [
        {
          lineNumber: 1,
          itemName: 'Core Edge Router 10G',
          specification: 'Dual Power Supply, 10Gbps SFP+ Ports',
          quantityRequested: 10,
          uom: 'Unit',
          estimatedUnitPrice: 5000000,
        },
      ],
    };

    // 1. Create PR
    const createRes = await app.request('/api/v1/purchase-requests', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-User-Id': requesterId,
        'X-User-Role': 'REQUESTER',
      },
      body: JSON.stringify(createPrPayload),
    });

    expect(createRes.status).toBe(201);
    const createJson = (await createPrPayloadWrapper(createRes)) as {
      success: boolean;
      data: { id: string; status: string; totalEstimatedAmount: number; items?: Array<{ id: string }> };
    };
    expect(createJson.success).toBe(true);
    expect(createJson.data.status).toBe('DRAFT');
    expect(Number(createJson.data.totalEstimatedAmount)).toBe(50000000);

    prId = createJson.data.id;

    // Fetch PR to get item ID
    const getRes = await app.request(`/api/v1/purchase-requests/${prId}`, {
      headers: { 'X-User-Id': requesterId },
    });
    const getJson = await getRes.json();
    expect(getJson.data.items.length).toBe(1);
    prItemId = getJson.data.items[0].id;

    // 2. Submit PR
    const submitRes = await app.request(`/api/v1/purchase-requests/${prId}/submit`, {
      method: 'POST',
      headers: {
        'X-User-Id': requesterId,
        'X-User-Role': 'REQUESTER',
      },
    });

    expect(submitRes.status).toBe(200);
    const submitJson = await submitRes.json();
    expect(submitJson.data.status).toBe('SUBMITTED');
  });

  it('Stage 2: Approver reviews and approves PR within threshold (R13, R15)', async () => {
    const decideRes = await app.request(`/api/v1/purchase-requests/${prId}/decide`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-User-Id': approverId,
        'X-User-Role': 'APPROVER',
      },
      body: JSON.stringify({
        decision: 'APPROVED',
        approverMaxLimit: 100000000,
        approverDivisionId: 'DIV-IT',
      }),
    });

    expect(decideRes.status).toBe(200);
    const decideJson = await decideRes.json();
    expect(decideJson.data.status).toBe('APPROVED');
  });

  it('Stage 3: Account Payable registers Vendor and completes 4-Eyes Bank Account Verification (R17, R18, R19)', async () => {
    // 1. Create Vendor
    const vendorCode = `VEND-E2E-${crypto.randomUUID().slice(0, 6)}`;
    const createVendorRes = await app.request('/api/v1/vendors', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-User-Id': apMakerId,
        'X-User-Role': 'ACCOUNT_PAYABLE',
      },
      body: JSON.stringify({
        vendorCode,
        name: 'PT Nusa Solusi Routerindo',
        taxIdentificationNumber: '01.888.777.6-012.000',
        isPkp: true,
      }),
    });

    expect(createVendorRes.status).toBe(201);
    const vendorJson = await createVendorRes.json();
    vendorId = vendorJson.data.id;
    expect(vendorJson.data.status).toBe('PROSPECTIVE');

    // Dual approval to approve vendor
    await sql`
      UPDATE vendor 
      SET status = 'APPROVED', approved_by_1 = ${apMakerId}, approved_by_2 = ${apCheckerId}
      WHERE id = ${vendorId}
    `;

    // 2. Create Bank Account
    const createBankRes = await app.request(`/api/v1/vendors/${vendorId}/bank-accounts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-User-Id': apMakerId,
        'X-User-Role': 'ACCOUNT_PAYABLE',
      },
      body: JSON.stringify({
        bankName: 'BCA',
        bankCode: '014',
        accountNumber: '7788990011',
        accountHolderName: 'PT Nusa Solusi Routerindo',
      }),
    });

    expect(createBankRes.status).toBe(201);
    const bankJson = await createBankRes.json();
    bankAccountId = bankJson.data.id;
    expect(bankJson.data.status).toBe('PENDING_VERIFICATION');

    // 3. Stage 1 Verification (by AP Maker)
    const verify1Res = await app.request(`/api/v1/vendors/${vendorId}/bank-accounts/${bankAccountId}/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-User-Id': apMakerId,
        'X-User-Role': 'ACCOUNT_PAYABLE',
      },
      body: JSON.stringify({ action: 'VERIFY_STAGE_1' }),
    });
    expect(verify1Res.status).toBe(200);

    // 4. Stage 2 Verification (by AP Checker - 4-Eyes Principle)
    const verify2Res = await app.request(`/api/v1/vendors/${vendorId}/bank-accounts/${bankAccountId}/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-User-Id': apCheckerId,
        'X-User-Role': 'ACCOUNT_PAYABLE',
      },
      body: JSON.stringify({ action: 'VERIFY_STAGE_2' }),
    });
    expect(verify2Res.status).toBe(200);
    const bankVerifiedJson = await verify2Res.json();
    expect(bankVerifiedJson.data.status).toBe('VERIFIED');
  });

  it('Stage 4: AP creates PO, approves, issues PO, and generates official PDF (R20, R24, R25, R27)', async () => {
    // 1. Create PO
    const createPoRes = await app.request('/api/v1/purchase-orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-User-Id': apMakerId,
        'X-User-Role': 'ACCOUNT_PAYABLE',
      },
      body: JSON.stringify({
        vendorId,
        vendorBankAccountId: bankAccountId,
        paymentTermType: 'PAY_AFTER_RECEIPT',
        taxAmount: 6000000,
        termsAndConditions: 'Standard payment term Net 30 days upon goods receipt.',
        items: [
          {
            prItemId,
            lineNumber: 1,
            itemName: 'Core Edge Router 10G',
            quantityOrdered: 10,
            uom: 'Unit',
            unitPrice: 5000000,
          },
        ],
      }),
    });

    expect(createPoRes.status).toBe(201);
    const poJson = await createPoRes.json();
    poId = poJson.data.id;
    expect(poJson.data.status).toBe('DRAFT');

    // Fetch PO to get item ID
    const getPoRes = await app.request(`/api/v1/purchase-orders/${poId}`, {
      headers: { 'X-User-Id': apMakerId },
    });
    const getPoJson = await getPoRes.json();
    expect(getPoJson.data.items.length).toBe(1);
    poItemId = getPoJson.data.items[0].id;

    // 2. Approve PO (by AP Checker - SoD guard against self-approval)
    const approvePoRes = await app.request(`/api/v1/purchase-orders/${poId}/approve`, {
      method: 'POST',
      headers: {
        'X-User-Id': apCheckerId,
        'X-User-Role': 'ACCOUNT_PAYABLE',
      },
    });
    expect(approvePoRes.status).toBe(200);

    // 3. Issue PO
    const issuePoRes = await app.request(`/api/v1/purchase-orders/${poId}/issue`, {
      method: 'POST',
      headers: {
        'X-User-Id': apCheckerId,
        'X-User-Role': 'ACCOUNT_PAYABLE',
      },
    });
    expect(issuePoRes.status).toBe(200);
    const issuedJson = await issuePoRes.json();
    expect(issuedJson.data.status).toBe('ISSUED');

    // 4. Download official PDF
    const pdfRes = await app.request(`/api/v1/purchase-orders/${poId}/pdf`, {
      headers: { 'X-User-Id': apMakerId },
    });
    expect(pdfRes.status).toBe(200);
    expect(pdfRes.headers.get('Content-Type')).toBe('application/pdf');
    const pdfArrayBuffer = await pdfRes.arrayBuffer();
    expect(pdfArrayBuffer.byteLength).toBeGreaterThan(500);
  });

  it('Stage 5: Warehouse records Goods Receipt (BAST) inspection (R28, R29, R31)', async () => {
    const grRes = await app.request('/api/v1/receipts', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-User-Id': warehouseId,
        'X-User-Role': 'WAREHOUSE',
      },
      body: JSON.stringify({
        poId,
        receiptType: 'WAREHOUSE',
        deliveryNoteNumber: 'SJ-NUSA-20260824',
        receivedDate: '2026-08-24',
        notes: '10 unit Core Edge Router diterima dalam kondisi tersegel baik.',
        items: [
          {
            poItemId,
            quantityReceived: 10,
            quantityRejected: 0,
            conditionNotes: 'Kondisi mulus, lolos uji powering',
          },
        ],
      }),
    });

    expect(grRes.status).toBe(201);
    const grJson = await grRes.json();
    grId = grJson.data.id;
    expect(grJson.data.grNumber).toBeDefined();
  });

  it('Stage 6: AP creates Invoice & triggers automated 2-Way Matching (R33, R34, R35, R37, R38)', async () => {
    const invoiceRes = await app.request('/api/v1/invoices', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-User-Id': apMakerId,
        'X-User-Role': 'ACCOUNT_PAYABLE',
      },
      body: JSON.stringify({
        poId,
        vendorId,
        grId,
        vendorInvoiceNumber: `INV-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
        nsfpOriginal: '010.001-26.98765432',
        invoiceDate: '2026-08-24',
        dueDate: '2026-09-24',
        subtotalAmount: 50000000,
        ppnAmount: 6000000,
        totalPayableAmount: 56000000,
        taxSnapshotId: '00000000-0000-0000-0000-000000000001',
      }),
    });

    expect(invoiceRes.status).toBe(201);
    const invJson = await invoiceRes.json();
    invoiceId = invJson.data.id;

    // Trigger 2-Way Matching
    const matchRes = await app.request(`/api/v1/invoices/${invoiceId}/match`, {
      method: 'POST',
      headers: {
        'X-User-Id': apMakerId,
        'X-User-Role': 'ACCOUNT_PAYABLE',
      },
    });

    expect(matchRes.status).toBe(200);
    const matchJson = await matchRes.json();
    expect(matchJson.data.matchStatus).toBe('MATCHED_OK');
  });

  it('Stage 7: Head of AP performs Matching Exception Override for tolerance variances (R39)', async () => {
    // Create an invoice with variance to test exception override
    const invWithVarianceRes = await app.request('/api/v1/invoices', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-User-Id': apMakerId,
        'X-User-Role': 'ACCOUNT_PAYABLE',
      },
      body: JSON.stringify({
        poId,
        vendorId,
        grId,
        vendorInvoiceNumber: `INV-VAR-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
        nsfpOriginal: '010.001-26.11223344',
        invoiceDate: '2026-08-24',
        dueDate: '2026-09-24',
        subtotalAmount: 52000000, // Rp 2.000.000 variance (> Rp 100.000 tolerance)
        ppnAmount: 6240000,
        totalPayableAmount: 58240000,
        taxSnapshotId: '00000000-0000-0000-0000-000000000001',
      }),
    });

    expect(invWithVarianceRes.status).toBe(201);
    const varInvJson = await invWithVarianceRes.json();
    const varInvoiceId = varInvJson.data.id;

    // Match -> Expect MATCHED_WITH_EXCEPTION
    const matchVarRes = await app.request(`/api/v1/invoices/${varInvoiceId}/match`, {
      method: 'POST',
      headers: { 'X-User-Id': apMakerId },
    });
    const matchVarJson = await matchVarRes.json();
    expect(matchVarJson.data.matchStatus).toBe('MATCHED_WITH_EXCEPTION');

    // Head of AP overrides exception
    const overrideRes = await app.request(`/api/v1/invoices/${varInvoiceId}/override`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-User-Id': headOfApId,
        'X-User-Role': 'FINANCE',
      },
      body: JSON.stringify({
        overrideReason: 'Disetujui perbedaan biaya ongkos kirim dan asuransi transit oleh Head of AP (R39)',
      }),
    });

    expect(overrideRes.status).toBe(200);
    const overrideJson = await overrideRes.json();
    expect(overrideJson.data.matchStatus).toBe('EXCEPTION_OVERRIDDEN');
  });

  it('Stage 8: Finance Maker proposes payment allocation (R41, R42)', async () => {
    const proposalRes = await app.request('/api/v1/payments/proposals', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-User-Id': apMakerId,
        'X-User-Role': 'ACCOUNT_PAYABLE',
      },
      body: JSON.stringify({
        vendorId,
        vendorBankAccountId: bankAccountId,
        paymentMethod: 'BANK_TRANSFER',
        allocations: [
          {
            invoiceId,
            allocatedAmount: 56000000,
          },
        ],
      }),
    });

    expect(proposalRes.status).toBe(201);
    const proposalJson = await proposalRes.json();
    paymentProposalId = proposalJson.data.id;
    expect(proposalJson.data.status).toBe('PROPOSED');
  });

  it('Stage 9: Finance Checker reviews and checks payment proposal (R42)', async () => {
    const checkRes = await app.request(`/api/v1/payments/proposals/${paymentProposalId}/check`, {
      method: 'POST',
      headers: {
        'X-User-Id': apCheckerId,
        'X-User-Role': 'ACCOUNT_PAYABLE',
      },
    });

    expect(checkRes.status).toBe(200);
    const checkJson = await checkRes.json();
    expect(checkJson.data.status).toBe('CHECKED');
  });

  it('Stage 10: Finance Executor performs Step-Up Re-Auth & executes idempotent payment transfer (R5, R43)', async () => {
    // 1. Missing Re-Auth token is blocked (403)
    const blockedRes = await app.request(`/api/v1/payments/proposals/${paymentProposalId}/execute`, {
      method: 'POST',
      headers: {
        'X-User-Id': financeExecutorId,
        'X-User-Role': 'FINANCE',
      },
    });
    expect(blockedRes.status).toBe(403);

    // 2. Generate valid Step-Up Re-Auth token
    const stepUpToken = await generateReauthToken({
      userId: financeExecutorId,
      action: 'EXECUTE_PAYMENT',
    });

    const idempotencyKey = `IDEMP-E2E-${crypto.randomUUID()}`;

    // 3. Execute transfer
    const execRes = await app.request(`/api/v1/payments/proposals/${paymentProposalId}/execute`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-User-Id': financeExecutorId,
        'X-User-Role': 'FINANCE',
        'X-Reauth-Token': stepUpToken,
        'Idempotency-Key': idempotencyKey,
      },
      body: JSON.stringify({
        bankReferenceNumber: 'TRX-BCA-NUSA-889900',
      }),
    });

    expect(execRes.status).toBe(200);
    const execJson = await execRes.json();
    expect(execJson.data.status).toBe('EXECUTED');
    expect(execJson.data.bankReferenceNumber).toBe('TRX-BCA-NUSA-889900');

    // 4. Duplicate call with same Idempotency-Key returns cached result
    const dupRes = await app.request(`/api/v1/payments/proposals/${paymentProposalId}/execute`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-User-Id': financeExecutorId,
        'X-User-Role': 'FINANCE',
        'X-Reauth-Token': stepUpToken,
        'Idempotency-Key': idempotencyKey,
      },
      body: JSON.stringify({
        bankReferenceNumber: 'TRX-BCA-NUSA-889900',
      }),
    });
    expect(dupRes.status).toBe(200);
    const dupJson = await dupRes.json();
    expect(dupJson.data.status).toBe('EXECUTED');
  });

  it('Stage 11: Auditor accesses Read-Only Sandbox, verifies SHA-256 hash chaining & downloads evidence (R53, R54)', async () => {
    // 1. Auditor cannot mutate data (R54: 405 Method Not Allowed)
    const mutateAttempt = await app.request('/api/v1/purchase-orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-User-Id': auditorId,
        'X-User-Role': 'AUDITOR',
      },
      body: JSON.stringify({}),
    });
    expect(mutateAttempt.status).toBe(405);

    // 2. Auditor verifies cryptographic hash chain integrity (R53)
    const verifyChainRes = await app.request('/api/v1/audit/verify-chain', {
      headers: {
        'X-User-Id': auditorId,
        'X-User-Role': 'AUDITOR',
      },
    });

    expect(verifyChainRes.status).toBe(200);
    const chainJson = await verifyChainRes.json();
    expect(chainJson.data.isValid).toBe(true);
    expect(chainJson.data.totalEntriesChecked).toBeGreaterThan(0);

    // 3. Auditor downloads ZIP Evidence Bundle
    const bundleRes = await app.request(`/api/v1/audit/evidence-bundle?entityName=purchase_order&entityId=${poId}`, {
      headers: {
        'X-User-Id': auditorId,
        'X-User-Role': 'AUDITOR',
      },
    });

    expect(bundleRes.status).toBe(200);
    expect(bundleRes.headers.get('Content-Type')).toBe('application/zip');
    const zipArrayBuffer = await bundleRes.arrayBuffer();
    expect(zipArrayBuffer.byteLength).toBeGreaterThan(100);
  });

  afterAll(async () => {
    // Clean up all transactions created in this test
    if (paymentProposalId) {
      await sql`DELETE FROM payment_invoice_allocation WHERE payment_proposal_id = ${paymentProposalId}`;
      await sql`DELETE FROM payment_proposal WHERE id = ${paymentProposalId}`;
    }
    if (poId) {
      await sql`DELETE FROM payment_invoice_allocation WHERE invoice_id IN (SELECT id FROM invoice WHERE po_id = ${poId})`;
      await sql`DELETE FROM invoice_matching_exception WHERE invoice_id IN (SELECT id FROM invoice WHERE po_id = ${poId})`;
      await sql`DELETE FROM invoice WHERE po_id = ${poId}`;
    }
    if (grId) {
      await sql`DELETE FROM non_conformance_report WHERE gr_id = ${grId}`;
      await sql`DELETE FROM goods_receipt_item WHERE gr_id = ${grId}`;
      await sql`DELETE FROM goods_receipt WHERE id = ${grId}`;
    }
    if (poId) {
      await sql`DELETE FROM po_amendment_history WHERE po_id = ${poId}`;
      await sql`DELETE FROM purchase_order_item WHERE po_id = ${poId}`;
      await sql`DELETE FROM purchase_order WHERE id = ${poId}`;
    }
    if (prId) {
      await sql`DELETE FROM emergency_post_review WHERE pr_id = ${prId}`;
      await sql`DELETE FROM approval_instance WHERE pr_id = ${prId}`;
      await sql`DELETE FROM purchase_request_item WHERE pr_id = ${prId}`;
      await sql`DELETE FROM purchase_request WHERE id = ${prId}`;
    }
    if (bankAccountId) {
      await sql`DELETE FROM vendor_bank_account WHERE id = ${bankAccountId}`;
    }
    if (vendorId) {
      await sql`DELETE FROM vendor WHERE id = ${vendorId}`;
    }

    // Clean up the 8 test actors
    await cleanupTestUsers([
      requesterId,
      approverId,
      apMakerId,
      apCheckerId,
      headOfApId,
      warehouseId,
      financeExecutorId,
      auditorId,
    ]);
  });
});

async function createPrPayloadWrapper(res: Response): Promise<unknown> {
  return await res.json();
}
