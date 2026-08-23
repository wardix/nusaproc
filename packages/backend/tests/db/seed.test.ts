import { describe, it, expect } from 'bun:test';
import { sql } from '../../src/db/client';
import { runSeed } from '../../src/db/seed';
import { DEMO_PERSONAS } from '@nusaproc/shared';

describe('Epic 14: Realistic PT Nusanet Demo Seeder & Fast Role Switcher', () => {
  it('executes database seed idempotently and populates all 7 personas and transactions', async () => {
    // 1. Run seeder
    const result = await runSeed();
    expect(result.success).toBe(true);

    // 2. Verify all demo personas are present in app_user
    for (const persona of DEMO_PERSONAS) {
      const users = await sql`SELECT id, email, full_name FROM app_user WHERE id = ${persona.id}`;
      expect(users.length).toBe(1);
      expect(users[0].email).toBe(persona.email);

      const roles = await sql`SELECT role FROM user_role_assignment WHERE user_id = ${persona.id}`;
      expect(roles.length).toBeGreaterThanOrEqual(1);
    }

    // 3. Verify vendors & bank accounts
    const vendors = await sql`SELECT id, status FROM vendor`;
    expect(vendors.length).toBeGreaterThanOrEqual(3);

    const bankAccounts = await sql`SELECT id, status FROM vendor_bank_account WHERE status = 'VERIFIED'`;
    expect(bankAccounts.length).toBeGreaterThanOrEqual(3);

    // 4. Verify transactions across stages
    const prs = await sql`SELECT id, status FROM purchase_request`;
    expect(prs.length).toBeGreaterThanOrEqual(3);

    const pos = await sql`SELECT id, status FROM purchase_order WHERE status = 'ISSUED'`;
    expect(pos.length).toBeGreaterThanOrEqual(1);

    const receipts = await sql`SELECT id, receipt_type FROM goods_receipt WHERE receipt_type = 'WAREHOUSE'`;
    expect(receipts.length).toBeGreaterThanOrEqual(1);

    const invoices = await sql`SELECT id, match_status FROM invoice WHERE match_status = 'MATCHED_WITH_EXCEPTION'`;
    expect(invoices.length).toBeGreaterThanOrEqual(1);

    const proposals = await sql`SELECT id, status FROM payment_proposal WHERE status = 'CHECKED'`;
    expect(proposals.length).toBeGreaterThanOrEqual(1);

    // 5. Test idempotency (running seed a second time should succeed without conflict)
    const secondRun = await runSeed();
    expect(secondRun.success).toBe(true);
  });
});
