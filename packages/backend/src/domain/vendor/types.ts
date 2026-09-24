import { z } from 'zod';

export type VendorStatus = 'PROSPECTIVE' | 'APPROVED' | 'SUSPENDED' | 'BLACKLISTED';
export type BankAccountStatus = 'PENDING_VERIFICATION' | 'VERIFIED' | 'INACTIVE';

export interface VendorRecord {
  id: string;
  vendorCode: string;
  name: string;
  taxIdentificationNumber: string;
  isPkp: boolean;
  status: VendorStatus;
  createdBy: string;
  approvedBy1?: string | null;
  approvedAt1?: string | null;
  approvedBy2?: string | null;
  approvedAt2?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface VendorBankAccountRecord {
  id: string;
  vendorId: string;
  bankName: string;
  bankCode: string;
  accountNumberEncrypted: string;
  accountNumberMasked: string;
  accountHolderName: string;
  status: BankAccountStatus;
  verifiedBy1?: string | null;
  verifiedAt1?: string | null;
  verifiedBy2?: string | null;
  verifiedAt2?: string | null;
  rejectionReason?: string | null;
  isPrimary: boolean;
  createdAt: string;
}

export interface CreateVendorInput {
  name: string;
  taxIdentificationNumber: string;
  isPkp?: boolean;
  createdBy: string;
}

export interface CreateBankAccountInput {
  vendorId: string;
  bankName: string;
  bankCode?: string;
  accountNumber: string;
  accountHolderName: string;
}

export interface VerifyBankAccountInput {
  bankAccountId: string;
  verifierUserId: string;
  action: 'VERIFY_STAGE_1' | 'VERIFY_STAGE_2' | 'REJECT';
  rejectionReason?: string;
}

export const createVendorSchema = z.object({
  name: z.string().min(2, 'Nama vendor minimal 2 karakter'),
  taxIdentificationNumber: z.string().min(5, 'NPWP / Tax ID wajib diisi'),
  isPkp: z.boolean().optional().default(false),
});

const DEFAULT_BANK_CODES: Record<string, string> = {
  BCA: '014',
  Mandiri: '008',
  BNI: '009',
  BRI: '002',
  CIMB: '022',
  Permata: '013',
  Danamon: '011',
  BSI: '451',
};

export const createBankAccountSchema = z
  .object({
    bankName: z.string().min(2, 'Nama bank wajib diisi'),
    bankCode: z.string().optional(),
    accountNumber: z.string().min(4, 'Nomor rekening minimal 4 digit'),
    accountHolderName: z.string().min(2, 'Nama pemilik rekening wajib diisi'),
  })
  .transform((data) => ({
    ...data,
    bankCode: data.bankCode?.trim() || DEFAULT_BANK_CODES[data.bankName] || '000',
  }));
