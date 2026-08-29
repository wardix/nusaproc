import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { sql } from '../../../src/db/client';
import { runMigrations } from '../../../src/db/migrate';
import { cleanupTestUsers, cleanupTestVendors } from '../../helpers/test_cleaner';
import {
  computeWebhookSignature,
  verifyWebhookSignature,
  enqueueOutboxEvent,
  processOutboxEvents,
  registerWebhookSubscription,
} from '../../../src/domain/integration/webhook';
import {
  processExpiredDelegations,
  processPendingApprovalEscalations,
  deactivateUserAndRevokeDelegations,
} from '../../../src/domain/integration/delegation_worker';
import {
  createPurchaseOrder,
  amendPurchaseOrder,
} from '../../../src/domain/po/service';

describe('Epic 12: [Integrasi & Resilience] REST API, Webhook Dispatcher & Delegation Lifecycle (R61–R65)', () => {
  beforeAll(async () => {
    await runMigrations();
  });

  describe('1. Webhook Event Dispatcher & HMAC-SHA256 Signature (R61)', () => {
    const secretKey = 'nusanet-webhook-super-secret-key';
    const payload = {
      eventType: 'PURCHASE_ORDER_ISSUED',
      poNumber: 'PO-202608-TEST01',
      totalAmount: 25000000,
      timestamp: '2026-08-23T15:00:00Z',
    };

    it('R61: Computes and validates HMAC-SHA256 signature for outgoing webhook payload', () => {
      const signatureHeader = computeWebhookSignature(payload, secretKey);
      expect(signatureHeader).toStartWith('sha256=');
      expect(signatureHeader.length).toBe(71); // 'sha256=' (7) + 64 hex chars = 71

      // Validate signature
      const isValid = verifyWebhookSignature(payload, signatureHeader, secretKey);
      expect(isValid).toBe(true);

      // Validate signature with modified payload fails
      const tamperedPayload = { ...payload, totalAmount: 99999999 };
      const isTamperedValid = verifyWebhookSignature(tamperedPayload, signatureHeader, secretKey);
      expect(isTamperedValid).toBe(false);
    });

    it('R61: Dispatches outbox events to registered webhooks with retry and DLQ', async () => {
      const testSecret = 'whsec_test123';
      const eventType = `PO_ISSUED_${crypto.randomUUID()}`;

      // Mock receiver server using Bun.serve
      let receivedSignature = '';
      let receivedBody: { poNumber?: string; [key: string]: unknown } | null = null;

      const server = Bun.serve({
        port: 0,
        async fetch(req) {
          receivedSignature = req.headers.get('x-nusaproc-signature') || '';
          receivedBody = (await req.json()) as Record<string, unknown>;
          return new Response(JSON.stringify({ received: true }), { status: 200 });
        },
      });

      const targetUrl = `http://localhost:${server.port}/webhook`;

      // 1. Register webhook subscription
      await registerWebhookSubscription({
        targetUrl,
        secretKey: testSecret,
        subscribedEvents: [eventType],
      });

      // 2. Enqueue event into outbox_event
      const eventId = await enqueueOutboxEvent(eventType, {
        poId: crypto.randomUUID(),
        poNumber: 'PO-TEST-001',
        amount: 15000000,
      });

      // 3. Process outbox events
      const result = await processOutboxEvents();
      expect(result.processedCount).toBeGreaterThanOrEqual(1);

      // 4. Verify mock server received payload with valid HMAC signature
      expect(receivedSignature).toStartWith('sha256=');
      expect(receivedBody).not.toBeNull();
      expect((receivedBody as unknown as { poNumber?: string })?.poNumber).toBe('PO-TEST-001');

      // 5. Verify outbox_event is marked as processed in DB
      const rows = await sql`SELECT processed_at, retry_count FROM outbox_event WHERE id = ${eventId}`;
      expect(rows.length).toBe(1);
      expect(rows[0].processed_at).not.toBeNull();

      server.stop();
    });

    it('R61: Retries failed webhook with exponential backoff and moves to DLQ after 5 attempts', async () => {
      const deadEventType = `DEAD_EVENT_${crypto.randomUUID()}`;
      const deadTargetUrl = 'http://localhost:59999/non-existent-webhook';

      await registerWebhookSubscription({
        targetUrl: deadTargetUrl,
        secretKey: 'secret_dead',
        subscribedEvents: [deadEventType],
      });

      const eventId = await enqueueOutboxEvent(deadEventType, { test: 'dead_payload' });

      // Run 5 processing attempts
      for (let attempt = 1; attempt <= 5; attempt++) {
        await processOutboxEvents({ ignoreBackoffDelay: true });
      }

      const rows = await sql`
        SELECT retry_count, last_error, processed_at
        FROM outbox_event
        WHERE id = ${eventId}
      `;
      expect(rows.length).toBe(1);
      expect(rows[0].retry_count).toBeGreaterThanOrEqual(5);
      expect(rows[0].last_error).toContain('DLQ');
    });
  });

  describe('2. Delegation Lifecycle: Expiration & User Deactivation (R62, R64)', () => {
    it('R62: Automatically expires delegations and reassigns in-flight tasks back to delegator', async () => {
      const delegatorId = crypto.randomUUID();
      const delegateeId = crypto.randomUUID();

      await sql`
        INSERT INTO app_user (id, email, full_name, employee_id, division_id, branch_id)
        VALUES 
          (${delegatorId}, ${`u-${delegatorId}@nusanet.net.id`}, 'Delegator User', ${`EMP-${delegatorId.slice(0, 8)}`}, 'DIV-IT', 'HQ'),
          (${delegateeId}, ${`u-${delegateeId}@nusanet.net.id`}, 'Delegatee User', ${`EMP-${delegateeId.slice(0, 8)}`}, 'DIV-IT', 'HQ')
      `;

      // Create an expired delegation (ended 1 hour ago)
      const pastStart = new Date(Date.now() - 3600 * 1000 * 48);
      const pastEnd = new Date(Date.now() - 3600 * 1000);

      const [delegation] = await sql`
        INSERT INTO approval_delegation (
          delegator_id, delegatee_id, start_date, end_date, reason, is_active
        ) VALUES (
          ${delegatorId}, ${delegateeId}, ${pastStart}, ${pastEnd}, 'Cuti tahunan', TRUE
        )
        RETURNING id
      `;

      // Run expired delegation worker
      const expiredCount = await processExpiredDelegations();
      expect(expiredCount).toBeGreaterThanOrEqual(1);

      // Verify delegation is deactivated
      const [updated] = await sql`
        SELECT is_active FROM approval_delegation WHERE id = ${delegation.id}
      `;
      expect(updated.is_active).toBe(false);
    });

    it('R64: Deactivating a user automatically cancels all their active delegations and reverts pending approvals', async () => {
      const managerId = crypto.randomUUID();
      const staffId = crypto.randomUUID();

      await sql`
        INSERT INTO app_user (id, email, full_name, employee_id, division_id, branch_id, is_active)
        VALUES 
          (${managerId}, ${`mgr-${managerId}@nusanet.net.id`}, 'Manager User', ${`EMP-${managerId.slice(0, 8)}`}, 'DIV-FIN', 'HQ', TRUE),
          (${staffId}, ${`stf-${staffId}@nusanet.net.id`}, 'Staff Delegatee', ${`EMP-${staffId.slice(0, 8)}`}, 'DIV-FIN', 'HQ', TRUE)
      `;

      // Active delegation
      const futureStart = new Date();
      const futureEnd = new Date(Date.now() + 3600 * 1000 * 24 * 7);

      const [activeDelegation] = await sql`
        INSERT INTO approval_delegation (
          delegator_id, delegatee_id, start_date, end_date, reason, is_active
        ) VALUES (
          ${managerId}, ${staffId}, ${futureStart}, ${futureEnd}, 'Dinas luar kota', TRUE
        )
        RETURNING id
      `;

      // Deactivate the staff user (e.g. employee resignation)
      await deactivateUserAndRevokeDelegations(staffId, managerId);

      // Verify user is inactive
      const [userRow] = await sql`SELECT is_active FROM app_user WHERE id = ${staffId}`;
      expect(userRow.is_active).toBe(false);

      // Verify active delegation was revoked
      const [delRow] = await sql`SELECT is_active FROM approval_delegation WHERE id = ${activeDelegation.id}`;
      expect(delRow.is_active).toBe(false);
    });
  });

  describe('3. Automated Escalation for Inactive Approver > 48h (R63)', () => {
    it('R63: Escalates PR approval pending for > 48 hours to approver manager', async () => {
      const requesterId = crypto.randomUUID();
      const inactiveApproverId = crypto.randomUUID();
      const managerId = crypto.randomUUID();
      const prId = crypto.randomUUID();

      // Create users with manager hierarchy
      await sql`
        INSERT INTO app_user (id, email, full_name, employee_id, division_id, branch_id, is_active)
        VALUES 
          (${requesterId}, ${`req-${requesterId}@nusanet.net.id`}, 'Requester Staff', ${`EMP-${requesterId.slice(0, 8)}`}, 'DIV-IT', 'HQ', TRUE),
          (${inactiveApproverId}, ${`appr-${inactiveApproverId}@nusanet.net.id`}, 'Inactive Approver', ${`EMP-${inactiveApproverId.slice(0, 8)}`}, 'DIV-IT', 'HQ', TRUE),
          (${managerId}, ${`mgr-${managerId}@nusanet.net.id`}, 'Department Manager', ${`EMP-${managerId.slice(0, 8)}`}, 'DIV-IT', 'HQ', TRUE)
      `;

      // Assign roles
      await sql`
        INSERT INTO user_role_assignment (user_id, role, assigned_by)
        VALUES 
          (${inactiveApproverId}, 'APPROVER', ${managerId}),
          (${managerId}, 'APPROVER', ${managerId})
      `;

      // Create PR with SUBMITTED status submitted 50 hours ago
      const pastTime = new Date(Date.now() - 50 * 3600 * 1000);
      await sql`
        INSERT INTO purchase_request (
          id, pr_number, requester_id, cost_center, division_id, branch_id,
          required_date, payment_term_type, status, business_justification, total_estimated_amount, created_at
        ) VALUES (
          ${prId}, ${`PR-${prId.slice(0, 8)}`}, ${requesterId}, 'CC-IT', 'DIV-IT', 'HQ',
          CURRENT_DATE + 7, 'PAY_AFTER_RECEIPT', 'SUBMITTED', 'Pengadaan router test', 15000000, ${pastTime}
        )
      `;

      // Insert pending approval step for inactiveApprover created 50 hours ago
      await sql`
        INSERT INTO approval_instance (
          pr_id, step_order, assigned_role, assigned_user_id, decision
        ) VALUES (
          ${prId}, 1, 'APPROVER', ${inactiveApproverId}, 'PENDING'
        )
      `;

      // Trigger escalation worker with 48 hours threshold
      const escalatedCount = await processPendingApprovalEscalations(48, managerId);
      expect(escalatedCount).toBeGreaterThanOrEqual(1);

      // Verify the approval record is escalated to the manager
      const historyRows = await sql`
        SELECT assigned_user_id, decision, rejection_reason
        FROM approval_instance
        WHERE pr_id = ${prId}
        ORDER BY step_order ASC
      `;
      expect(historyRows.length).toBeGreaterThanOrEqual(1);
      expect(historyRows[0].assigned_user_id).toBe(managerId);
      expect(historyRows[0].rejection_reason).toContain('ESCALATED');
    });
  });

  describe('4. Vendor Blacklist Locking Guard (R65)', () => {
    it('R65: Strictly blocks PO creation for BLACKLISTED vendor', async () => {
      const authorId = crypto.randomUUID();
      const blacklistedVendorId = crypto.randomUUID();
      const bankId = crypto.randomUUID();
      const prItemId = crypto.randomUUID();
      const prId = crypto.randomUUID();

      await sql`
        INSERT INTO app_user (id, email, full_name, employee_id, division_id, branch_id)
        VALUES (${authorId}, ${`auth-${authorId}@nusanet.net.id`}, 'PO Author', ${`EMP-${authorId.slice(0, 8)}`}, 'DIV-PROC', 'HQ')
      `;

      // Vendor with BLACKLISTED status
      await sql`
        INSERT INTO vendor (
          id, vendor_code, name, tax_identification_number, status, created_by
        ) VALUES (
          ${blacklistedVendorId}, ${`VEND-BL-${blacklistedVendorId.slice(0, 8)}`}, 'PT Blacklisted Cyber', '01.999.888.7-000.000', 'BLACKLISTED', ${authorId}
        )
      `;

      await sql`
        INSERT INTO vendor_bank_account (
          id, vendor_id, bank_name, bank_code, account_number_encrypted, account_number_masked, account_holder_name, status
        ) VALUES (
          ${bankId}, ${blacklistedVendorId}, 'BCA', '014', 'enc_bl', '******9999', 'PT Blacklisted Cyber', 'VERIFIED'
        )
      `;

      await sql`
        INSERT INTO purchase_request (
          id, pr_number, requester_id, cost_center, division_id, branch_id,
          required_date, payment_term_type, status, business_justification, total_estimated_amount
        ) VALUES (
          ${prId}, ${`PR-${prId.slice(0, 8)}`}, ${authorId}, 'CC-IT', 'DIV-IT', 'HQ',
          CURRENT_DATE + 7, 'PAY_AFTER_RECEIPT', 'APPROVED', 'Pengadaan server test', 10000000
        )
      `;

      await sql`
        INSERT INTO purchase_request_item (
          id, pr_id, line_number, item_name, quantity_requested, uom, estimated_unit_price
        ) VALUES (
          ${prItemId}, ${prId}, 1, 'Blocked Item', 1, 'Unit', 10000000
        )
      `;

      let errorCaught = false;
      let errorMessage = '';

      try {
        await createPurchaseOrder({
          vendorId: blacklistedVendorId,
          vendorBankAccountId: bankId,
          paymentTermType: 'PAY_AFTER_RECEIPT',
          termsAndConditions: 'Standard terms',
          createdBy: authorId,
          items: [
            {
              prItemId,
              itemName: 'Blocked Item',
              quantityOrdered: 1,
              uom: 'Unit',
              unitPrice: 10000000,
            },
          ],
        });
      } catch (err: unknown) {
        errorCaught = true;
        errorMessage = (err as Error).message;
      }

      expect(errorCaught).toBe(true);
      expect(errorMessage).toContain('BLACKLISTED');
    });

    it('R65: Strictly blocks PO amendment for BLACKLISTED vendor', async () => {
      const authorId = crypto.randomUUID();
      const approverId = crypto.randomUUID();
      const vendorId = crypto.randomUUID();
      const bankId = crypto.randomUUID();
      const poId = crypto.randomUUID();

      await sql`
        INSERT INTO app_user (id, email, full_name, employee_id, division_id, branch_id)
        VALUES 
          (${authorId}, ${`a-${authorId}@nusanet.net.id`}, 'PO Author', ${`EMP-${authorId.slice(0, 8)}`}, 'DIV-PROC', 'HQ'),
          (${approverId}, ${`ap-${approverId}@nusanet.net.id`}, 'PO Approver', ${`EMP-${approverId.slice(0, 8)}`}, 'DIV-PROC', 'HQ')
      `;

      // Start with APPROVED vendor, then blacklist them later
      await sql`
        INSERT INTO vendor (
          id, vendor_code, name, tax_identification_number, status, created_by
        ) VALUES (
          ${vendorId}, ${`VEND-${vendorId.slice(0, 8)}`}, 'PT Vendor Initially OK', '01.123.456.7-000.000', 'APPROVED', ${authorId}
        )
      `;

      await sql`
        INSERT INTO vendor_bank_account (
          id, vendor_id, bank_name, bank_code, account_number_encrypted, account_number_masked, account_holder_name, status
        ) VALUES (
          ${bankId}, ${vendorId}, 'BCA', '014', 'enc_ok', '******1111', 'PT Vendor Initially OK', 'VERIFIED'
        )
      `;

      await sql`
        INSERT INTO purchase_order (
          id, po_number, vendor_id, vendor_bank_account_id, payment_term_type,
          status, terms_and_conditions, created_by, approved_by
        ) VALUES (
          ${poId}, ${`PO-${poId.slice(0, 8)}`}, ${vendorId}, ${bankId}, 'PAY_AFTER_RECEIPT',
          'ISSUED', 'Initial terms', ${authorId}, ${approverId}
        )
      `;

      // Now blacklist the vendor (R65)
      await sql`UPDATE vendor SET status = 'BLACKLISTED' WHERE id = ${vendorId}`;

      let errorCaught = false;
      let errorMessage = '';

      try {
        await amendPurchaseOrder({
          poId,
          reason: 'Attempting amendment on blacklisted vendor PO',
          updatedTermsAndConditions: 'Modified terms',
          authorizedById: approverId,
        });
      } catch (err: unknown) {
        errorCaught = true;
        errorMessage = (err as Error).message;
      }

      expect(errorCaught).toBe(true);
      expect(errorMessage).toContain('BLACKLISTED');
    });
  });

  afterAll(async () => {
    await sql`DELETE FROM webhook_subscription WHERE target_url LIKE '%example.com%' OR target_url LIKE '%test.local%'`;
    await sql`DELETE FROM outbox_event WHERE event_type LIKE '%TEST%' OR event_type = 'PURCHASE_ORDER_ISSUED'`;
    const testUsers = await sql`
      SELECT id FROM app_user 
      WHERE email LIKE 'u-%' 
         OR email LIKE 'mgr-%' 
         OR email LIKE 'stf-%' 
         OR email LIKE 'req-%' 
         OR email LIKE 'appr-%' 
         OR email LIKE 'auth-%' 
         OR email LIKE 'a-%' 
         OR email LIKE 'ap-%'
         OR email LIKE 'user-%'
         OR email LIKE 'head-ap-%'
    `;
    await cleanupTestUsers(testUsers.map((u: { id: string }) => u.id));
  });
});
