import { z } from 'zod';
import type { PaymentTermType } from '../pr/types';

export type PoStatus = 'DRAFT' | 'ISSUED' | 'AMENDED' | 'COMPLETED' | 'CANCELLED';

export interface PurchaseOrderItemRecord {
  id: string;
  poId: string;
  prItemId: string;
  lineNumber: number;
  itemName: string;
  quantityOrdered: number;
  quantityReceived: number;
  quantityInvoiced: number;
  uom: string;
  unitPrice: number;
  subtotal: number;
}

export interface PurchaseOrderRecord {
  id: string;
  poNumber: string;
  vendorId: string;
  vendorName?: string;
  vendorBankAccountId: string;
  bankName?: string;
  accountNumber?: string;
  accountHolderName?: string;
  paymentTermType: PaymentTermType;
  versionNumber: number;
  status: PoStatus;
  subtotalAmount: number;
  taxAmount: number;
  grandTotalAmount: number;
  termsAndConditions: string;
  createdBy: string;
  requesterName?: string;
  requesterEmail?: string;
  approvedBy?: string | null;
  approvedAt?: string | null;
  issuedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PoAmendmentHistoryRecord {
  id: string;
  poId: string;
  amendmentNumber: number;
  changeSummary: string;
  previousSnapshot: Record<string, unknown>;
  requestedBy: string;
  approvedBy: string;
  approvedAt: string;
}

export interface PoItemInput {
  prItemId: string;
  lineNumber?: number;
  itemName: string;
  quantityOrdered: number;
  uom: string;
  unitPrice: number;
}

export interface CreatePoInput {
  prId?: string;
  vendorId: string;
  vendorBankAccountId: string;
  paymentTermType: PaymentTermType;
  termsAndConditions?: string;
  taxAmount?: number;
  createdBy: string;
  items: PoItemInput[];
}

export interface AmendPoInput {
  poId: string;
  requestedById?: string;
  authorizedById: string;
  reason: string;
  updatedTermsAndConditions?: string;
  updatedItems?: PoItemInput[];
}

export interface PoWithDetails extends PurchaseOrderRecord {
  items: PurchaseOrderItemRecord[];
  amendments: PoAmendmentHistoryRecord[];
}

export const createPoSchema = z.object({
  prId: z.string().uuid().optional(),
  vendorId: z.string().uuid('Vendor ID wajib valid UUID'),
  vendorBankAccountId: z.string().uuid('Vendor Bank Account ID wajib valid UUID'),
  paymentTermType: z.enum(['ADVANCE_OR_COD', 'PAY_AFTER_RECEIPT']),
  termsAndConditions: z.string().optional().default('Standar syarat dan ketentuan PT Nusanet'),
  taxAmount: z.number().nonnegative().optional().default(0),
  items: z
    .array(
      z.object({
        prItemId: z.string().uuid('PR Item ID wajib valid UUID'),
        lineNumber: z.number().int().positive().optional(),
        itemName: z.string().min(1, 'Nama item wajib diisi'),
        quantityOrdered: z.number().positive('Jumlah pesanan harus > 0'),
        uom: z.string().min(1, 'Satuan unit wajib diisi'),
        unitPrice: z.number().nonnegative('Harga satuan harus >= 0'),
      })
    )
    .min(1, 'PO harus memiliki minimal 1 item'),
});
