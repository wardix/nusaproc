import { sql } from '../../src/db/client';

export async function cleanupTestUsers(userIds: (string | undefined | null)[]): Promise<void> {
  const validIds = userIds.filter((id): id is string => Boolean(id));
  if (validIds.length === 0) return;
  try {
    // 1. Clean idempotency records
    await sql`
      DELETE FROM idempotency_key_record 
      WHERE user_id IN ${sql(validIds)};
    `;

    // 2. Clean allocations & proposals
    await sql`
      DELETE FROM payment_invoice_allocation 
      WHERE payment_proposal_id IN (
        SELECT id FROM payment_proposal 
        WHERE proposed_by IN ${sql(validIds)} 
           OR checked_by IN ${sql(validIds)} 
           OR executed_by IN ${sql(validIds)}
      );
    `;
    await sql`
      DELETE FROM payment_proposal 
      WHERE proposed_by IN ${sql(validIds)} 
         OR checked_by IN ${sql(validIds)} 
         OR executed_by IN ${sql(validIds)};
    `;

    // 3. Clean invoices, exceptions, NCRs, and receipts
    await sql`
      DELETE FROM invoice_matching_exception 
      WHERE invoice_id IN (
        SELECT id FROM invoice 
        WHERE po_id IN (
          SELECT id FROM purchase_order 
          WHERE created_by IN ${sql(validIds)} OR approved_by IN ${sql(validIds)}
        )
      );
    `;
    await sql`
      DELETE FROM invoice 
      WHERE po_id IN (
        SELECT id FROM purchase_order 
        WHERE created_by IN ${sql(validIds)} OR approved_by IN ${sql(validIds)}
      );
    `;
    await sql`
      DELETE FROM non_conformance_report 
      WHERE gr_id IN (
        SELECT id FROM goods_receipt WHERE received_by IN ${sql(validIds)}
      ) OR resolved_by IN ${sql(validIds)};
    `;
    await sql`
      DELETE FROM goods_receipt_item 
      WHERE gr_id IN (
        SELECT id FROM goods_receipt WHERE received_by IN ${sql(validIds)}
      );
    `;
    await sql`
      DELETE FROM goods_receipt 
      WHERE received_by IN ${sql(validIds)};
    `;

    // 4. Clean POs
    await sql`
      DELETE FROM po_amendment_history 
      WHERE po_id IN (
        SELECT id FROM purchase_order 
        WHERE created_by IN ${sql(validIds)} OR approved_by IN ${sql(validIds)}
      ) OR requested_by IN ${sql(validIds)} OR approved_by IN ${sql(validIds)};
    `;
    await sql`
      DELETE FROM purchase_order_item 
      WHERE po_id IN (
        SELECT id FROM purchase_order 
        WHERE created_by IN ${sql(validIds)} OR approved_by IN ${sql(validIds)}
      );
    `;
    await sql`
      DELETE FROM purchase_order 
      WHERE created_by IN ${sql(validIds)} OR approved_by IN ${sql(validIds)};
    `;

    // 5. Clean PRs and Approvals
    await sql`
      DELETE FROM emergency_post_review 
      WHERE pr_id IN (
        SELECT id FROM purchase_request WHERE requester_id IN ${sql(validIds)}
      ) OR reviewed_by IN ${sql(validIds)};
    `;
    await sql`
      DELETE FROM approval_instance 
      WHERE pr_id IN (
        SELECT id FROM purchase_request WHERE requester_id IN ${sql(validIds)}
      ) OR assigned_user_id IN ${sql(validIds)} OR decision_by IN ${sql(validIds)} OR delegated_from_user_id IN ${sql(validIds)};
    `;
    await sql`
      DELETE FROM purchase_request_item 
      WHERE pr_id IN (
        SELECT id FROM purchase_request 
        WHERE requester_id IN ${sql(validIds)}
      );
    `;
    await sql`
      DELETE FROM purchase_request 
      WHERE requester_id IN ${sql(validIds)};
    `;

    // 6. Clean Vendors & Bank Accounts
    await sql`
      DELETE FROM vendor_bank_account 
      WHERE verified_by_1 IN ${sql(validIds)} 
         OR verified_by_2 IN ${sql(validIds)} 
         OR vendor_id IN (
           SELECT id FROM vendor 
           WHERE created_by IN ${sql(validIds)} 
              OR approved_by_1 IN ${sql(validIds)} 
              OR approved_by_2 IN ${sql(validIds)}
         );
    `;
    await sql`
      DELETE FROM vendor 
      WHERE created_by IN ${sql(validIds)} 
         OR approved_by_1 IN ${sql(validIds)} 
         OR approved_by_2 IN ${sql(validIds)};
    `;

    // 7. Clean delegations, file attachments, and role assignments
    await sql`
      DELETE FROM approval_delegation 
      WHERE delegator_id IN ${sql(validIds)} OR delegatee_id IN ${sql(validIds)};
    `;
    await sql`
      DELETE FROM file_attachment 
      WHERE uploaded_by IN ${sql(validIds)};
    `;
    await sql`
      DELETE FROM user_role_assignment 
      WHERE user_id IN ${sql(validIds)} OR assigned_by IN ${sql(validIds)};
    `;

    // 8. Finally delete from app_user
    await sql`
      DELETE FROM app_user 
      WHERE id IN ${sql(validIds)};
    `;
  } catch (err) {
    console.error('[TestCleanup] Error cleaning test users:', err);
  }
}

export async function cleanupTestVendors(vendorIds: (string | undefined | null)[]): Promise<void> {
  const validIds = vendorIds.filter((id): id is string => Boolean(id));
  if (validIds.length === 0) return;
  try {
    await sql`DELETE FROM vendor_bank_account WHERE vendor_id IN ${sql(validIds)}`;
    await sql`DELETE FROM vendor WHERE id IN ${sql(validIds)}`;
  } catch (err) {
    console.error('[TestCleanup] Error cleaning test vendors:', err);
  }
}

export async function cleanupTestBranches(branchCodes: (string | undefined | null)[]): Promise<void> {
  const validCodes = branchCodes.filter((code): code is string => Boolean(code));
  if (validCodes.length === 0) return;
  try {
    await sql`DELETE FROM master_branch WHERE code IN ${sql(validCodes)}`;
  } catch (err) {
    console.error('[TestCleanup] Error cleaning test branches:', err);
  }
}

export async function cleanupTestDivisions(divisionCodes: (string | undefined | null)[]): Promise<void> {
  const validCodes = divisionCodes.filter((code): code is string => Boolean(code));
  if (validCodes.length === 0) return;
  try {
    await sql`DELETE FROM master_division WHERE code IN ${sql(validCodes)}`;
  } catch (err) {
    console.error('[TestCleanup] Error cleaning test divisions:', err);
  }
}

export async function cleanupDemoSeedData(): Promise<void> {
  try {
    // 1. Delete transactions created during seeding / demo
    await sql`DELETE FROM idempotency_key_record`;
    await sql`DELETE FROM payment_invoice_allocation`;
    await sql`DELETE FROM payment_proposal`;
    await sql`DELETE FROM invoice_matching_exception`;
    await sql`DELETE FROM invoice`;
    await sql`DELETE FROM non_conformance_report`;
    await sql`DELETE FROM goods_receipt_item`;
    await sql`DELETE FROM goods_receipt`;
    await sql`DELETE FROM po_amendment_history`;
    await sql`DELETE FROM purchase_order_item`;
    await sql`DELETE FROM purchase_order`;
    await sql`DELETE FROM emergency_post_review`;
    await sql`DELETE FROM approval_instance`;
    await sql`DELETE FROM purchase_request_item`;
    await sql`DELETE FROM purchase_request`;
    await sql`DELETE FROM vendor_bank_account WHERE vendor_id::text LIKE '20000000-%'`;
    await sql`DELETE FROM vendor WHERE id::text LIKE '20000000-%'`;

    // 2. Clean all test users (any user with employee_id starting with EMP- or test emails)
    const testUsers = await sql`
      SELECT id FROM app_user 
      WHERE employee_id LIKE 'EMP-%' 
         OR email LIKE '%@test.local'
         OR email IN (
           'budi.santoso@nusanet.net.id',
           'siti.aminah@nusanet.net.id',
           'admin@nusanet.net.id',
           'requester@nusanet.net.id',
           'approver@nusanet.net.id',
           'ap-maker@nusanet.net.id',
           'ap-checker@nusanet.net.id',
           'warehouse@nusanet.net.id',
           'finance-executor@nusanet.net.id',
           'auditor@nusanet.net.id'
         )
    `;
    if (testUsers.length > 0) {
      await cleanupTestUsers(testUsers.map(u => u.id));
    }
  } catch (err) {
    console.error('[TestCleanup] Error in cleanupDemoSeedData:', err);
  }
}
