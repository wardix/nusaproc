import { describe, it, expect, afterAll } from 'bun:test';
import { createApp } from '../../../src/index';
import { sql } from '../../../src/db/client';

describe('Vendor Lifecycle: Status Management & Safe Delete (Option 1 & Option 2)', () => {
  const app = createApp();
  const adminUserId = 'c9059686-da98-4daa-aa13-120b0c76ba50'; // Wardi (ADMIN)
  const requesterUserId = '10000000-0000-0000-0000-000000000001'; // Budi Santoso (REQUESTER)

  let testVendorId: string;

  afterAll(async () => {
    if (testVendorId) {
      await sql`DELETE FROM vendor_bank_account WHERE vendor_id = ${testVendorId}`;
      await sql`DELETE FROM vendor WHERE id = ${testVendorId}`;
    }
  });

  it('creates a new vendor for lifecycle testing', async () => {
    const res = await app.request('/api/v1/vendors', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-User-Id': adminUserId,
        'X-User-Role': 'ADMIN',
      },
      body: JSON.stringify({
        name: 'PT Uji Coba Hapus Vendor',
        taxIdentificationNumber: '99.888.777.6-555.000',
        isPkp: true,
      }),
    });

    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.success).toBe(true);
    testVendorId = json.data.id;
    expect(testVendorId).toBeDefined();

    // Add a bank account to this vendor
    const bankRes = await app.request(`/api/v1/vendors/${testVendorId}/bank-accounts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-User-Id': adminUserId,
        'X-User-Role': 'ADMIN',
      },
      body: JSON.stringify({
        bankName: 'BCA',
        accountNumber: '1234567899',
        accountHolderName: 'PT Uji Coba Hapus Vendor',
      }),
    });
    expect(bankRes.status).toBe(201);
  });

  it('updates vendor status to SUSPENDED and BLACKLISTED (Option 2)', async () => {
    // 1. Suspend vendor
    const suspendRes = await app.request(`/api/v1/vendors/${testVendorId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'X-User-Id': adminUserId,
        'X-User-Role': 'ADMIN',
      },
      body: JSON.stringify({
        status: 'SUSPENDED',
        reason: 'Dalam evaluasi performa kuartalan',
      }),
    });

    expect(suspendRes.status).toBe(200);
    const suspendJson = await suspendRes.json();
    expect(suspendJson.success).toBe(true);
    expect(suspendJson.data.status).toBe('SUSPENDED');

    // 2. Blacklist vendor
    const blacklistRes = await app.request(`/api/v1/vendors/${testVendorId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'X-User-Id': adminUserId,
        'X-User-Role': 'ADMIN',
      },
      body: JSON.stringify({
        status: 'BLACKLISTED',
        reason: 'Wanprestasi kontrak pengadaan',
      }),
    });

    expect(blacklistRes.status).toBe(200);
    const blacklistJson = await blacklistRes.json();
    expect(blacklistJson.success).toBe(true);
    expect(blacklistJson.data.status).toBe('BLACKLISTED');
  });

  it('rejects unauthorized role from updating vendor status', async () => {
    const res = await app.request(`/api/v1/vendors/${testVendorId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'X-User-Id': requesterUserId,
        'X-User-Role': 'REQUESTER',
      },
      body: JSON.stringify({
        status: 'APPROVED',
      }),
    });

    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.status).toBe(403);
    expect(json.detail).toContain('Hanya pengguna dengan peran ADMIN atau ACCOUNT_PAYABLE');
  });

  it('rejects deleting a vendor that has active transactions with 409 Conflict', async () => {
    // Hermetic setup: Create vendor with active PO
    const activeVendorId = crypto.randomUUID();
    const activeBankId = crypto.randomUUID();
    const activePoId = crypto.randomUUID();

    try {
      await sql`
        INSERT INTO vendor (id, vendor_code, name, tax_identification_number, is_pkp, status, created_by)
        VALUES (${activeVendorId}, 'VEND-TEST-ACTIVE', 'PT Vendor Transaksi Aktif', '88.777.666.5-444.000', TRUE, 'APPROVED', ${adminUserId})
      `;
      await sql`
        INSERT INTO vendor_bank_account (id, vendor_id, bank_name, bank_code, account_number_encrypted, account_number_masked, account_holder_name, status, is_primary)
        VALUES (${activeBankId}, ${activeVendorId}, 'BCA', '014', 'enc', '******9999', 'PT Vendor Transaksi Aktif', 'VERIFIED', TRUE)
      `;
      await sql`
        INSERT INTO purchase_order (id, po_number, vendor_id, vendor_bank_account_id, payment_term_type, version_number, status, subtotal_amount, tax_amount, grand_total_amount, terms_and_conditions, created_by)
        VALUES (${activePoId}, 'PO-TEST-LIFECYCLE-001', ${activeVendorId}, ${activeBankId}, 'PAY_AFTER_RECEIPT', 1, 'ISSUED', 10000000, 1100000, 11100000, 'Terms', ${adminUserId})
      `;

      const res = await app.request(`/api/v1/vendors/${activeVendorId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Id': adminUserId,
          'X-User-Role': 'ADMIN',
        },
      });

      expect(res.status).toBe(409);
      const json = await res.json();
      expect(json.status).toBe(409);
      expect(json.ruleCode).toBe('VENDOR_HAS_ACTIVE_TRANSACTIONS');
      expect(json.detail).toContain('Purchase Order');
    } finally {
      await sql`DELETE FROM purchase_order WHERE id = ${activePoId}`;
      await sql`DELETE FROM vendor_bank_account WHERE vendor_id = ${activeVendorId}`;
      await sql`DELETE FROM vendor WHERE id = ${activeVendorId}`;
    }
  });

  it('safely deletes a vendor without transactions including its bank accounts (Option 1)', async () => {
    const res = await app.request(`/api/v1/vendors/${testVendorId}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'X-User-Id': adminUserId,
        'X-User-Role': 'ADMIN',
      },
    });

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data.id).toBe(testVendorId);

    // Verify vendor is deleted from DB
    const checkVendor = await sql`SELECT id FROM vendor WHERE id = ${testVendorId}`;
    expect(checkVendor.length).toBe(0);

    // Verify bank account is deleted from DB
    const checkBank = await sql`SELECT id FROM vendor_bank_account WHERE vendor_id = ${testVendorId}`;
    expect(checkBank.length).toBe(0);

    testVendorId = ''; // prevent cleanup in afterAll
  });
});
