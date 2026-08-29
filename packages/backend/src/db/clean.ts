import { sql } from './client';

export async function cleanDatabase(): Promise<{ success: boolean; message: string }> {
  console.log('[Clean] Membersihkan seluruh data dari database NusaProc...');

  await sql`
    TRUNCATE TABLE
      payment_invoice_allocation,
      payment_proposal,
      invoice_matching_exception,
      invoice,
      non_conformance_report,
      goods_receipt_item,
      goods_receipt,
      purchase_order_item,
      purchase_order_amendment,
      purchase_order,
      approval_instance,
      purchase_request_item,
      purchase_request,
      vendor_bank_account,
      vendor,
      audit_event,
      outbox_event,
      authority_delegation,
      step_up_challenge,
      user_role_assignment,
      app_user,
      master_branch,
      master_division
    CASCADE;
  `;

  console.log('[Clean] Seluruh data transaksi, master, dan akun pengguna berhasil dibersihkan! ✨');
  return { success: true, message: 'Database cleaned successfully.' };
}

if (import.meta.main) {
  cleanDatabase()
    .then(() => {
      console.log('Selesai.');
      process.exit(0);
    })
    .catch((err) => {
      console.error('[Clean] Gagal membersihkan database:', err);
      process.exit(1);
    });
}
