import { describe, it, expect, beforeAll } from 'bun:test';
import { sql } from '../../src/db/client';
import { runMigrations } from '../../src/db/migrate';

describe('Database Schema Integrity & DDL Constraints', () => {
  beforeAll(async () => {
    await runMigrations();
  });

  describe('1. SoD Database Constraint: chk_po_sod_ap', () => {
    it('allows PO creation when created_by and approved_by are distinct users', async () => {
      const userId1 = crypto.randomUUID();
      const userId2 = crypto.randomUUID();
      const vendorId = crypto.randomUUID();
      const bankId = crypto.randomUUID();
      const poId = crypto.randomUUID();

      // Setup required foreign keys
      await sql`
        INSERT INTO app_user (id, email, full_name, employee_id, division_id, branch_id)
        VALUES 
          (${userId1}, ${`creator-${userId1}@nusanet.net.id`}, 'PO Creator', ${`EMP-${userId1.slice(0, 8)}`}, 'DIV-IT', 'HQ'),
          (${userId2}, ${`approver-${userId2}@nusanet.net.id`}, 'PO Approver', ${`EMP-${userId2.slice(0, 8)}`}, 'DIV-FIN', 'HQ')
      `;

      await sql`
        INSERT INTO vendor (id, vendor_code, name, tax_identification_number, created_by)
        VALUES (${vendorId}, ${`VEND-${vendorId.slice(0, 8)}`}, 'PT Vendor Utama', '01.234.567.8-901.000', ${userId1})
      `;

      await sql`
        INSERT INTO vendor_bank_account (
          id, vendor_id, bank_name, bank_code, account_number_encrypted, account_number_masked, account_holder_name
        ) VALUES (
          ${bankId}, ${vendorId}, 'BCA', '014', 'enc_123', '******1234', 'PT Vendor Utama'
        )
      `;

      // Valid PO: created_by != approved_by
      await sql`
        INSERT INTO purchase_order (
          id, po_number, vendor_id, vendor_bank_account_id, payment_term_type,
          terms_and_conditions, created_by, approved_by
        ) VALUES (
          ${poId}, ${`PO-${poId.slice(0, 8)}`}, ${vendorId}, ${bankId}, 'PAY_AFTER_RECEIPT',
          'Standard terms', ${userId1}, ${userId2}
        )
      `;

      const inserted = await sql`SELECT id, created_by, approved_by FROM purchase_order WHERE id = ${poId}`;
      expect(inserted.length).toBe(1);
      expect(inserted[0].created_by).toBe(userId1);
      expect(inserted[0].approved_by).toBe(userId2);
    });

    it('rejects PO insertion when created_by is the same as approved_by', async () => {
      const userId1 = crypto.randomUUID();
      const vendorId = crypto.randomUUID();
      const bankId = crypto.randomUUID();
      const invalidPoId = crypto.randomUUID();

      await sql`
        INSERT INTO app_user (id, email, full_name, employee_id, division_id, branch_id)
        VALUES (${userId1}, ${`user-${userId1}@nusanet.net.id`}, 'Self Approver', ${`EMP-${userId1.slice(0, 8)}`}, 'DIV-IT', 'HQ')
      `;

      await sql`
        INSERT INTO vendor (id, vendor_code, name, tax_identification_number, created_by)
        VALUES (${vendorId}, ${`VEND-${vendorId.slice(0, 8)}`}, 'PT Vendor Dual', '01.234.567.8-901.000', ${userId1})
      `;

      await sql`
        INSERT INTO vendor_bank_account (
          id, vendor_id, bank_name, bank_code, account_number_encrypted, account_number_masked, account_holder_name
        ) VALUES (
          ${bankId}, ${vendorId}, 'BCA', '014', 'enc_123', '******1234', 'PT Vendor Dual'
        )
      `;

      let errorCaught = false;
      try {
        await sql`
          INSERT INTO purchase_order (
            id, po_number, vendor_id, vendor_bank_account_id, payment_term_type,
            terms_and_conditions, created_by, approved_by
          ) VALUES (
            ${invalidPoId}, ${`PO-${invalidPoId.slice(0, 8)}`}, ${vendorId}, ${bankId}, 'PAY_AFTER_RECEIPT',
            'Terms', ${userId1}, ${userId1}
          )
        `;
      } catch (err) {
        errorCaught = true;
      }

      expect(errorCaught).toBe(true);

      const check = await sql`SELECT id FROM purchase_order WHERE id = ${invalidPoId}`;
      expect(check.length).toBe(0);
    });

    it('rejects PO update when approved_by is updated to equal created_by', async () => {
      const userId1 = crypto.randomUUID();
      const userId2 = crypto.randomUUID();
      const vendorId = crypto.randomUUID();
      const bankId = crypto.randomUUID();
      const poId = crypto.randomUUID();

      await sql`
        INSERT INTO app_user (id, email, full_name, employee_id, division_id, branch_id)
        VALUES 
          (${userId1}, ${`u1-${userId1}@nusanet.net.id`}, 'User 1', ${`EMP-${userId1.slice(0, 8)}`}, 'DIV-IT', 'HQ'),
          (${userId2}, ${`u2-${userId2}@nusanet.net.id`}, 'User 2', ${`EMP-${userId2.slice(0, 8)}`}, 'DIV-IT', 'HQ')
      `;

      await sql`
        INSERT INTO vendor (id, vendor_code, name, tax_identification_number, created_by)
        VALUES (${vendorId}, ${`VEND-${vendorId.slice(0, 8)}`}, 'PT Vendor Upd', '01.234.567.8-901.000', ${userId1})
      `;

      await sql`
        INSERT INTO vendor_bank_account (
          id, vendor_id, bank_name, bank_code, account_number_encrypted, account_number_masked, account_holder_name
        ) VALUES (
          ${bankId}, ${vendorId}, 'BCA', '014', 'enc_123', '******1234', 'PT Vendor Upd'
        )
      `;

      await sql`
        INSERT INTO purchase_order (
          id, po_number, vendor_id, vendor_bank_account_id, payment_term_type,
          terms_and_conditions, created_by, approved_by
        ) VALUES (
          ${poId}, ${`PO-${poId.slice(0, 8)}`}, ${vendorId}, ${bankId}, 'PAY_AFTER_RECEIPT',
          'Standard terms', ${userId1}, ${userId2}
        )
      `;

      let errorCaught = false;
      try {
        await sql`
          UPDATE purchase_order
          SET approved_by = ${userId1}
          WHERE id = ${poId}
        `;
      } catch (err) {
        errorCaught = true;
      }

      expect(errorCaught).toBe(true);
    });
  });

  describe('2. Duplicate Invoice Constraint: uq_vendor_invoice_duplicate', () => {
    it('rejects duplicate invoices with identical vendor, invoice number, date, and payable amount', async () => {
      const userId = crypto.randomUUID();
      const vendorId = crypto.randomUUID();
      const bankId = crypto.randomUUID();
      const poId = crypto.randomUUID();
      const taxSnapshotId = crypto.randomUUID();

      await sql`
        INSERT INTO app_user (id, email, full_name, employee_id, division_id, branch_id)
        VALUES (${userId}, ${`inv-user-${userId}@nusanet.net.id`}, 'Invoice User', ${`EMP-${userId.slice(0, 8)}`}, 'DIV-FIN', 'HQ')
      `;

      await sql`
        INSERT INTO vendor (id, vendor_code, name, tax_identification_number, created_by)
        VALUES (${vendorId}, ${`VEND-${vendorId.slice(0, 8)}`}, 'PT Vendor Invoice', '01.234.567.8-901.000', ${userId})
      `;

      await sql`
        INSERT INTO vendor_bank_account (
          id, vendor_id, bank_name, bank_code, account_number_encrypted, account_number_masked, account_holder_name
        ) VALUES (
          ${bankId}, ${vendorId}, 'BCA', '014', 'enc_123', '******1234', 'PT Vendor Invoice'
        )
      `;

      await sql`
        INSERT INTO purchase_order (
          id, po_number, vendor_id, vendor_bank_account_id, payment_term_type,
          terms_and_conditions, created_by
        ) VALUES (
          ${poId}, ${`PO-${poId.slice(0, 8)}`}, ${vendorId}, ${bankId}, 'PAY_AFTER_RECEIPT',
          'Terms', ${userId}
        )
      `;

      await sql`
        INSERT INTO tax_rule_snapshot (id, ppn_rate, dpp_factor, tax_regulation_ref)
        VALUES (${taxSnapshotId}, 0.1200, 1.0000, 'UU HPP 2021')
      `;

      const invId1 = crypto.randomUUID();
      const invId2 = crypto.randomUUID();
      const normalizedInv = `INV-NORM-${crypto.randomUUID().slice(0, 8)}`;

      // Insert first invoice
      await sql`
        INSERT INTO invoice (
          id, invoice_number_internal, vendor_invoice_number, vendor_invoice_normalized,
          vendor_id, po_id, invoice_date, due_date, subtotal_amount, total_payable_amount,
          tax_snapshot_id, uploaded_by
        ) VALUES (
          ${invId1}, ${`INT-${invId1.slice(0, 8)}`}, 'INV/2026/08/001', ${normalizedInv},
          ${vendorId}, ${poId}, '2026-08-23', '2026-09-23', 10000000.00, 11200000.00,
          ${taxSnapshotId}, ${userId}
        )
      `;

      // Attempt duplicate invoice with identical vendor, normalized invoice no, date, and amount
      let errorCaught = false;
      try {
        await sql`
          INSERT INTO invoice (
            id, invoice_number_internal, vendor_invoice_number, vendor_invoice_normalized,
            vendor_id, po_id, invoice_date, due_date, subtotal_amount, total_payable_amount,
            tax_snapshot_id, uploaded_by
          ) VALUES (
            ${invId2}, ${`INT-${invId2.slice(0, 8)}`}, 'INV/2026/08/001', ${normalizedInv},
            ${vendorId}, ${poId}, '2026-08-23', '2026-09-23', 10000000.00, 11200000.00,
            ${taxSnapshotId}, ${userId}
          )
        `;
      } catch (err) {
        errorCaught = true;
      }

      expect(errorCaught).toBe(true);

      const check = await sql`SELECT id FROM invoice WHERE id = ${invId2}`;
      expect(check.length).toBe(0);
    });
  });

  describe('3. Audit Trail Anti-Tamper & Immutability Rules', () => {
    it('prevents modification (UPDATE) of audit trail records', async () => {
      const entityId = crypto.randomUUID();
      const uniqueHash = `hash_${crypto.randomUUID()}`;

      await sql`
        INSERT INTO audit_trail_entry (
          action_type, entity_name, entity_id,
          ip_address, current_entry_hash
        ) VALUES (
          'CREATE_PR', 'purchase_request', ${entityId},
          '192.168.1.100', ${uniqueHash}
        )
      `;

      const entriesBefore = await sql`SELECT * FROM audit_trail_entry WHERE current_entry_hash = ${uniqueHash}`;
      expect(entriesBefore.length).toBe(1);
      const originalEntry = entriesBefore[0];

      // Attempt UPDATE
      await sql`
        UPDATE audit_trail_entry
        SET action_type = 'TAMPERED_ACTION'
        WHERE current_entry_hash = ${uniqueHash}
      `;

      const entriesAfter = await sql`SELECT * FROM audit_trail_entry WHERE id = ${originalEntry.id}`;
      expect(entriesAfter.length).toBe(1);
      // Rule no_update_audit prevents any modification (value remains CREATE_PR)
      expect(entriesAfter[0].action_type).toBe('CREATE_PR');
    });

    it('prevents deletion (DELETE) of audit trail records', async () => {
      const entityId = crypto.randomUUID();
      const uniqueHash = `hash_${crypto.randomUUID()}`;

      await sql`
        INSERT INTO audit_trail_entry (
          action_type, entity_name, entity_id,
          ip_address, current_entry_hash
        ) VALUES (
          'CREATE_PO', 'purchase_order', ${entityId},
          '192.168.1.100', ${uniqueHash}
        )
      `;

      const entriesBefore = await sql`SELECT * FROM audit_trail_entry WHERE current_entry_hash = ${uniqueHash}`;
      expect(entriesBefore.length).toBe(1);
      const entryId = entriesBefore[0].id;

      // Attempt DELETE
      await sql`
        DELETE FROM audit_trail_entry
        WHERE current_entry_hash = ${uniqueHash}
      `;

      const entriesAfter = await sql`SELECT * FROM audit_trail_entry WHERE id = ${entryId}`;
      // Rule no_delete_audit prevents deletion (row remains intact)
      expect(entriesAfter.length).toBe(1);
    });
  });

  describe('4. Seed Data Verification', () => {
    it('seeds the default admin local fallback user and role assignment (R1)', async () => {
      const adminUsers = await sql`
        SELECT id, email, is_local_fallback, is_active
        FROM app_user
        WHERE is_local_fallback = TRUE
      `;
      expect(adminUsers.length).toBeGreaterThanOrEqual(1);
      expect(adminUsers[0].email).toBe('admin@nusanet.net.id');

      const adminRole = await sql`
        SELECT role FROM user_role_assignment WHERE user_id = ${adminUsers[0].id}
      `;
      expect(adminRole.length).toBeGreaterThanOrEqual(1);
      expect(adminRole[0].role).toBe('ADMIN');
    });

    it('seeds initial default tax rule snapshot', async () => {
      const defaultTax = await sql`
        SELECT ppn_rate, dpp_factor, tax_regulation_ref
        FROM tax_rule_snapshot
        WHERE tax_regulation_ref = 'UU HPP No 7 Tahun 2021'
      `;
      expect(defaultTax.length).toBeGreaterThanOrEqual(1);
      expect(Number(defaultTax[0].ppn_rate)).toBe(0.12);
    });
  });

  describe('5. Performance Indices Verification (p95 < 2s)', () => {
    it('verifies all critical performance indices exist in database', async () => {
      const indices = await sql`
        SELECT indexname
        FROM pg_indexes
        WHERE schemaname = 'public'
      `;
      const indexNames = indices.map((row: { indexname: string }) => row.indexname);

      expect(indexNames).toContain('idx_pr_requester');
      expect(indexNames).toContain('idx_po_vendor');
      expect(indexNames).toContain('idx_invoice_po');
      expect(indexNames).toContain('idx_invoice_search');
      expect(indexNames).toContain('idx_audit_entity');
      expect(indexNames).toContain('idx_file_attachment_entity');
    });
  });

  describe('6. Payment Maker-Checker-Executor Database Constraints', () => {
    it('rejects payment proposal where proposer is also the checker (chk_payment_sod_maker_checker)', async () => {
      const userId = crypto.randomUUID();
      const vendorId = crypto.randomUUID();
      const bankId = crypto.randomUUID();
      const proposalId = crypto.randomUUID();

      await sql`
        INSERT INTO app_user (id, email, full_name, employee_id, division_id, branch_id)
        VALUES (${userId}, ${`pay-user-${userId}@nusanet.net.id`}, 'Payment User', ${`EMP-${userId.slice(0, 8)}`}, 'DIV-FIN', 'HQ')
      `;

      await sql`
        INSERT INTO vendor (id, vendor_code, name, tax_identification_number, created_by)
        VALUES (${vendorId}, ${`VEND-${vendorId.slice(0, 8)}`}, 'PT Vendor Pay', '01.234.567.8-901.000', ${userId})
      `;

      await sql`
        INSERT INTO vendor_bank_account (
          id, vendor_id, bank_name, bank_code, account_number_encrypted, account_number_masked, account_holder_name
        ) VALUES (
          ${bankId}, ${vendorId}, 'BCA', '014', 'enc_123', '******1234', 'PT Vendor Pay'
        )
      `;

      let errorCaught = false;
      try {
        await sql`
          INSERT INTO payment_proposal (
            id, proposal_number, vendor_id, vendor_bank_account_id,
            total_payment_amount, proposed_by, checked_by
          ) VALUES (
            ${proposalId}, ${`PROP-${proposalId.slice(0, 8)}`}, ${vendorId}, ${bankId},
            5000000.00, ${userId}, ${userId}
          )
        `;
      } catch (err) {
        errorCaught = true;
      }

      expect(errorCaught).toBe(true);
    });
  });
});
