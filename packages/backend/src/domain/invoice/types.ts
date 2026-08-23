import { z } from 'zod';

export type InvoiceType =
  | 'STANDARD'
  | 'ADVANCE_PAYMENT'
  | 'PROGRESS_TERMIN'
  | 'FINAL_SETTLEMENT'
  | 'CREDIT_NOTE'
  | 'DEBIT_NOTE';

export type MatchStatus =
  | 'UNMATCHED'
  | 'MATCHED_OK'
  | 'MATCHED_WITH_EXCEPTION'
  | 'EXCEPTION_OVERRIDDEN';

export interface TaxRuleSnapshotRecord {
  id: string;
  capturedAt: string;
  ppnRate: number;
  dppFactor: number;
  pphArticle?: string | null;
  pphRate: number;
  taxRegulationRef: string;
}

export interface InvoiceRecord {
  id: string;
  invoiceNumberInternal: string;
  vendorInvoiceNumber: string;
  vendorInvoiceNormalized: string;
  vendorId: string;
  poId: string;
  grId?: string | null;
  invoiceType: InvoiceType;
  invoiceDate: string;
  dueDate: string;
  subtotalAmount: number;
  ppnAmount: number;
  pphAmount: number;
  totalPayableAmount: number;
  nsfpOriginal?: string | null;
  nsfpNormalized?: string | null;
  isNsfpValid: boolean;
  taxSnapshotId: string;
  matchStatus: MatchStatus;
  isHeldForTax: boolean;
  uploadedBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface InvoiceMatchingExceptionRecord {
  id: string;
  invoiceId: string;
  exceptionCode: string;
  description: string;
  varianceAmount?: number | null;
  variancePercentage?: number | null;
  isOverridden: boolean;
  overrideReason?: string | null;
  overriddenBy?: string | null;
  overriddenAt?: string | null;
  createdAt: string;
}

export interface CreateInvoiceInput {
  vendorId: string;
  poId: string;
  grId?: string;
  invoiceType?: InvoiceType;
  vendorInvoiceNumber: string;
  invoiceDate: string;
  dueDate: string;
  subtotalAmount: number;
  ppnAmount?: number;
  pphAmount?: number;
  totalPayableAmount: number;
  nsfpOriginal?: string;
  taxSnapshotId: string;
  uploadedBy: string;
}

export interface OverrideMatchingExceptionInput {
  invoiceId: string;
  userId: string;
  overrideReason: string;
}

export interface TwoWayMatchResult {
  invoiceId: string;
  matchStatus: MatchStatus;
  isHeldForTax: boolean;
  varianceAmount: number;
  variancePercentage: number;
  exceptions: InvoiceMatchingExceptionRecord[];
}

export interface NsfpValidationResult {
  isValid: boolean;
  normalized: string | null;
  formatType: 'LEGACY_16' | 'CORETAX_17' | 'INVALID';
}

export function validateNsfp(nsfp?: string | null): NsfpValidationResult {
  if (!nsfp) {
    return { isValid: false, normalized: null, formatType: 'INVALID' };
  }

  // Strip common punctuation (dots, hyphens, spaces)
  const cleaned = nsfp.replace(/[^0-9]/g, '');

  if (cleaned.length === 16) {
    return {
      isValid: true,
      normalized: cleaned,
      formatType: 'LEGACY_16',
    };
  }

  if (cleaned.length === 17) {
    return {
      isValid: true,
      normalized: cleaned,
      formatType: 'CORETAX_17',
    };
  }

  return {
    isValid: false,
    normalized: cleaned.length > 0 ? cleaned : null,
    formatType: 'INVALID',
  };
}

export const createInvoiceSchema = z.object({
  vendorId: z.string().uuid('Vendor ID wajib valid UUID'),
  poId: z.string().uuid('PO ID wajib valid UUID'),
  grId: z.string().uuid('GR ID wajib valid UUID').optional(),
  invoiceType: z
    .enum(['STANDARD', 'ADVANCE_PAYMENT', 'PROGRESS_TERMIN', 'FINAL_SETTLEMENT', 'CREDIT_NOTE', 'DEBIT_NOTE'])
    .optional()
    .default('STANDARD'),
  vendorInvoiceNumber: z.string().min(1, 'Nomor invoice vendor wajib diisi'),
  invoiceDate: z.string().min(1, 'Tanggal invoice wajib diisi'),
  dueDate: z.string().min(1, 'Tanggal jatuh tempo wajib diisi'),
  subtotalAmount: z.number().positive('Subtotal amount harus > 0'),
  ppnAmount: z.number().nonnegative('PPN amount harus >= 0').optional().default(0),
  pphAmount: z.number().nonnegative('PPh amount harus >= 0').optional().default(0),
  totalPayableAmount: z.number().positive('Total payable amount harus > 0'),
  nsfpOriginal: z.string().optional(),
  taxSnapshotId: z.string().uuid('Tax snapshot ID wajib valid UUID'),
  uploadedBy: z.string().uuid('Uploaded by wajib valid UUID'),
});

export const overrideMatchingExceptionSchema = z.object({
  invoiceId: z.string().uuid('Invoice ID wajib valid UUID'),
  userId: z.string().uuid('User ID wajib valid UUID'),
  overrideReason: z.string().min(5, 'Alasan override wajib diisi minimal 5 karakter'),
});
