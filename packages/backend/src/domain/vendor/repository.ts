import { sql, type TransactionClient } from '../../db/client';
import type {
  VendorRecord,
  VendorBankAccountRecord,
  VendorStatus,
  BankAccountStatus,
} from './types';

export function maskAccountNumber(acc: string): string {
  if (acc.length <= 4) return '****' + acc;
  return '******' + acc.slice(-4);
}

export class VendorRepository {
  constructor(private db: TransactionClient = sql) {}

  async createVendor(vendor: {
    id: string;
    vendorCode: string;
    name: string;
    taxIdentificationNumber: string;
    isPkp: boolean;
    status: VendorStatus;
    createdBy: string;
  }): Promise<VendorRecord> {
    const rows = await this.db`
      INSERT INTO vendor (
        id, vendor_code, name, tax_identification_number,
        is_pkp, status, created_by
      ) VALUES (
        ${vendor.id}, ${vendor.vendorCode}, ${vendor.name}, ${vendor.taxIdentificationNumber},
        ${vendor.isPkp}, ${vendor.status}, ${vendor.createdBy}
      )
      RETURNING 
        id, vendor_code AS "vendorCode", name,
        tax_identification_number AS "taxIdentificationNumber",
        is_pkp AS "isPkp", status,
        created_by AS "createdBy",
        approved_by_1 AS "approvedBy1", approved_at_1::text AS "approvedAt1",
        approved_by_2 AS "approvedBy2", approved_at_2::text AS "approvedAt2",
        created_at::text AS "createdAt", updated_at::text AS "updatedAt"
    `;

    return rows[0] as unknown as VendorRecord;
  }

  async findVendorById(id: string): Promise<VendorRecord | null> {
    const rows = await this.db`
      SELECT 
        id, vendor_code AS "vendorCode", name,
        tax_identification_number AS "taxIdentificationNumber",
        is_pkp AS "isPkp", status,
        created_by AS "createdBy",
        approved_by_1 AS "approvedBy1", approved_at_1::text AS "approvedAt1",
        approved_by_2 AS "approvedBy2", approved_at_2::text AS "approvedAt2",
        created_at::text AS "createdAt", updated_at::text AS "updatedAt"
      FROM vendor
      WHERE id = ${id}
    `;

    return rows.length > 0 ? (rows[0] as unknown as VendorRecord) : null;
  }

  async updateVendorStatus(
    id: string,
    status: VendorStatus,
    approvedBy1?: string | null,
    approvedBy2?: string | null
  ): Promise<VendorRecord> {
    const rows = await this.db`
      UPDATE vendor
      SET 
        status = ${status},
        approved_by_1 = COALESCE(${approvedBy1 ?? null}::uuid, approved_by_1),
        approved_at_1 = CASE WHEN ${approvedBy1 ?? null}::uuid IS NOT NULL THEN clock_timestamp() ELSE approved_at_1 END,
        approved_by_2 = COALESCE(${approvedBy2 ?? null}::uuid, approved_by_2),
        approved_at_2 = CASE WHEN ${approvedBy2 ?? null}::uuid IS NOT NULL THEN clock_timestamp() ELSE approved_at_2 END,
        updated_at = clock_timestamp()
      WHERE id = ${id}
      RETURNING 
        id, vendor_code AS "vendorCode", name,
        tax_identification_number AS "taxIdentificationNumber",
        is_pkp AS "isPkp", status,
        created_by AS "createdBy",
        approved_by_1 AS "approvedBy1", approved_at_1::text AS "approvedAt1",
        approved_by_2 AS "approvedBy2", approved_at_2::text AS "approvedAt2",
        created_at::text AS "createdAt", updated_at::text AS "updatedAt"
    `;

    return rows[0] as unknown as VendorRecord;
  }

  async createBankAccount(account: {
    id: string;
    vendorId: string;
    bankName: string;
    bankCode: string;
    accountNumber: string;
    accountHolderName: string;
    status: BankAccountStatus;
  }): Promise<VendorBankAccountRecord> {
    const masked = maskAccountNumber(account.accountNumber);
    const encrypted = Buffer.from(account.accountNumber).toString('base64');

    const rows = await this.db`
      INSERT INTO vendor_bank_account (
        id, vendor_id, bank_name, bank_code,
        account_number_encrypted, account_number_masked, account_holder_name,
        status, is_primary
      ) VALUES (
        ${account.id}, ${account.vendorId}, ${account.bankName}, ${account.bankCode},
        ${encrypted}, ${masked}, ${account.accountHolderName},
        ${account.status}, FALSE
      )
      RETURNING 
        id, vendor_id AS "vendorId", bank_name AS "bankName", bank_code AS "bankCode",
        account_number_encrypted AS "accountNumberEncrypted",
        account_number_masked AS "accountNumberMasked",
        account_holder_name AS "accountHolderName", status,
        verified_by_1 AS "verifiedBy1", verified_at_1::text AS "verifiedAt1",
        verified_by_2 AS "verifiedBy2", verified_at_2::text AS "verifiedAt2",
        rejection_reason AS "rejectionReason",
        is_primary AS "isPrimary",
        created_at::text AS "createdAt"
    `;

    return rows[0] as unknown as VendorBankAccountRecord;
  }

  async findBankAccountById(id: string): Promise<VendorBankAccountRecord | null> {
    const rows = await this.db`
      SELECT 
        id, vendor_id AS "vendorId", bank_name AS "bankName", bank_code AS "bankCode",
        account_number_encrypted AS "accountNumberEncrypted",
        account_number_masked AS "accountNumberMasked",
        account_holder_name AS "accountHolderName", status,
        verified_by_1 AS "verifiedBy1", verified_at_1::text AS "verifiedAt1",
        verified_by_2 AS "verifiedBy2", verified_at_2::text AS "verifiedAt2",
        rejection_reason AS "rejectionReason",
        is_primary AS "isPrimary",
        created_at::text AS "createdAt"
      FROM vendor_bank_account
      WHERE id = ${id}
    `;

    return rows.length > 0 ? (rows[0] as unknown as VendorBankAccountRecord) : null;
  }

  async updateBankAccountVerification(params: {
    id: string;
    status: BankAccountStatus;
    verifiedBy1?: string | null;
    verifiedBy2?: string | null;
    rejectionReason?: string | null;
    isPrimary?: boolean;
  }): Promise<VendorBankAccountRecord> {
    const rows = await this.db`
      UPDATE vendor_bank_account
      SET
        status = ${params.status},
        verified_by_1 = COALESCE(${params.verifiedBy1 ?? null}::uuid, verified_by_1),
        verified_at_1 = CASE WHEN ${params.verifiedBy1 ?? null}::uuid IS NOT NULL THEN clock_timestamp() ELSE verified_at_1 END,
        verified_by_2 = COALESCE(${params.verifiedBy2 ?? null}::uuid, verified_by_2),
        verified_at_2 = CASE WHEN ${params.verifiedBy2 ?? null}::uuid IS NOT NULL THEN clock_timestamp() ELSE verified_at_2 END,
        rejection_reason = COALESCE(${params.rejectionReason ?? null}::text, rejection_reason),
        is_primary = COALESCE(${params.isPrimary ?? null}::boolean, is_primary)
      WHERE id = ${params.id}
      RETURNING 
        id, vendor_id AS "vendorId", bank_name AS "bankName", bank_code AS "bankCode",
        account_number_encrypted AS "accountNumberEncrypted",
        account_number_masked AS "accountNumberMasked",
        account_holder_name AS "accountHolderName", status,
        verified_by_1 AS "verifiedBy1", verified_at_1::text AS "verifiedAt1",
        verified_by_2 AS "verifiedBy2", verified_at_2::text AS "verifiedAt2",
        rejection_reason AS "rejectionReason",
        is_primary AS "isPrimary",
        created_at::text AS "createdAt"
    `;

    return rows[0] as unknown as VendorBankAccountRecord;
  }

  async unsetPreviousPrimaryAccounts(vendorId: string, currentAccountId: string): Promise<void> {
    await this.db`
      UPDATE vendor_bank_account
      SET is_primary = FALSE
      WHERE vendor_id = ${vendorId} AND id != ${currentAccountId} AND is_primary = TRUE
    `;
  }

  async listVendors(params?: { status?: VendorStatus; search?: string }): Promise<Array<VendorRecord & { bankAccounts?: VendorBankAccountRecord[] }>> {
    let query = sql`
      SELECT 
        id, vendor_code AS "vendorCode", name,
        tax_identification_number AS "taxIdentificationNumber",
        is_pkp AS "isPkp", status,
        created_by AS "createdBy",
        approved_by_1 AS "approvedBy1", approved_at_1::text AS "approvedAt1",
        approved_by_2 AS "approvedBy2", approved_at_2::text AS "approvedAt2",
        created_at::text AS "createdAt", updated_at::text AS "updatedAt"
      FROM vendor
      WHERE 1=1
    `;

    if (params?.status) {
      query = sql`${query} AND status = ${params.status}`;
    }
    if (params?.search) {
      const s = `%${params.search}%`;
      query = sql`${query} AND (name ILIKE ${s} OR vendor_code ILIKE ${s})`;
    }

    query = sql`${query} ORDER BY created_at DESC`;
    const rows = await query;
    const vendors = rows as unknown as VendorRecord[];

    const result: Array<VendorRecord & { bankAccounts?: VendorBankAccountRecord[] }> = [];
    for (const v of vendors) {
      const bankAccounts = await this.listBankAccountsByVendorId(v.id);
      result.push({
        ...v,
        bankAccounts,
      });
    }

    return result;
  }

  async listBankAccountsByVendorId(vendorId: string): Promise<VendorBankAccountRecord[]> {
    const rows = await this.db`
      SELECT 
        id, vendor_id AS "vendorId", bank_name AS "bankName", bank_code AS "bankCode",
        account_number_encrypted AS "accountNumberEncrypted",
        account_number_masked AS "accountNumberMasked",
        account_holder_name AS "accountHolderName", status,
        verified_by_1 AS "verifiedBy1", verified_at_1::text AS "verifiedAt1",
        verified_by_2 AS "verifiedBy2", verified_at_2::text AS "verifiedAt2",
        rejection_reason AS "rejectionReason",
        is_primary AS "isPrimary",
        created_at::text AS "createdAt"
      FROM vendor_bank_account
      WHERE vendor_id = ${vendorId}
      ORDER BY is_primary DESC, created_at DESC
    `;
    return rows as unknown as VendorBankAccountRecord[];
  }
}

export async function ensureDefaultVendors(db: TransactionClient = sql): Promise<void> {
  const vendor1Id = '20000000-0000-0000-0000-000000000001';
  const vendor2Id = '20000000-0000-0000-0000-000000000002';
  const bank1Id = '30000000-0000-0000-0000-000000000001';
  const bank2Id = '30000000-0000-0000-0000-000000000002';

  const users = await db`SELECT id FROM app_user LIMIT 1`;
  if (users.length === 0) return;
  const defaultUserId = users[0].id;

  try {
    await db`
      INSERT INTO vendor (
        id, vendor_code, name, tax_identification_number, is_pkp, status,
        created_by
      ) VALUES 
        (
          ${vendor1Id}, 'VEND-FIBER-001', 'PT Fiber Optik Nusantara', '01.234.567.8-012.000', TRUE, 'APPROVED',
          ${defaultUserId}
        ),
        (
          ${vendor2Id}, 'VEND-MITRA-002', 'PT Mitra Solusi Jaringan', '02.345.678.9-013.000', TRUE, 'APPROVED',
          ${defaultUserId}
        )
      ON CONFLICT (id) DO NOTHING;
    `;

    await db`
      INSERT INTO vendor_bank_account (
        id, vendor_id, bank_name, bank_code, account_number_encrypted,
        account_number_masked, account_holder_name, status, is_primary
      ) VALUES
        (
          ${bank1Id}, ${vendor1Id}, 'BCA', '014', 'MTEyMzQ1Njc4OTA=',
          '******7890', 'PT Fiber Optik Nusantara', 'VERIFIED', TRUE
        ),
        (
          ${bank2Id}, ${vendor2Id}, 'Mandiri', '008', 'MTA5ODc2NTQzMjEw=',
          '******0040', 'PT Mitra Solusi Jaringan', 'VERIFIED', TRUE
        )
      ON CONFLICT (id) DO NOTHING;
    `;
  } catch {
    // Ignore seed conflict
  }
}
