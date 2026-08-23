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
}
