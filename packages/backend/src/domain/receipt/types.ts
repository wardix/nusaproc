import { z } from 'zod';

export type ReceiptType = 'DIRECT_REQUESTER' | 'WAREHOUSE';

export interface GoodsReceiptRecord {
  id: string;
  grNumber: string;
  poId: string;
  receiptType: ReceiptType;
  deliveryNoteNumber?: string | null;
  receivedDate: string;
  receivedBy: string;
  notes?: string | null;
  createdAt: string;
}

export interface GoodsReceiptItemRecord {
  id: string;
  grId: string;
  poItemId: string;
  quantityReceived: number;
  quantityRejected: number;
  conditionNotes?: string | null;
}

export interface NonConformanceReportRecord {
  id: string;
  ncrNumber: string;
  grId: string;
  poId: string;
  description: string;
  actionRequired: string;
  isResolved: boolean;
  resolvedBy?: string | null;
  resolvedAt?: string | null;
  createdAt: string;
}

export interface GrItemInput {
  poItemId: string;
  quantityReceived: number;
  quantityRejected?: number;
  conditionNotes?: string;
}

export interface SimultaneousInvoiceInput {
  vendorInvoiceNumber: string;
  invoiceDate: string;
  dueDate: string;
  subtotalAmount: number;
  ppnAmount?: number;
  pphAmount?: number;
  totalPayableAmount: number;
  nsfpOriginal?: string;
  taxSnapshotId: string;
}

export interface RecordGoodsReceiptInput {
  poId: string;
  receiptType: ReceiptType;
  deliveryNoteNumber?: string;
  receivedDate: string;
  receivedBy: string;
  notes?: string;
  items: GrItemInput[];
  invoice?: SimultaneousInvoiceInput;
}

export interface ReceiptWithDetails extends GoodsReceiptRecord {
  items: GoodsReceiptItemRecord[];
  ncrRecords: NonConformanceReportRecord[];
  linkedInvoiceId?: string;
}

export const recordGoodsReceiptSchema = z.object({
  poId: z.string().uuid('PO ID wajib valid UUID'),
  receiptType: z.enum(['DIRECT_REQUESTER', 'WAREHOUSE']),
  deliveryNoteNumber: z.string().optional(),
  receivedDate: z.string().min(1, 'Tanggal penerimaan wajib diisi'),
  receivedBy: z.string().uuid('Received by wajib valid UUID'),
  notes: z.string().optional(),
  items: z
    .array(
      z.object({
        poItemId: z.string().uuid('PO Item ID wajib valid UUID'),
        quantityReceived: z.number().nonnegative('Kuantitas diterima harus >= 0'),
        quantityRejected: z.number().nonnegative('Kuantitas ditolak harus >= 0').optional().default(0),
        conditionNotes: z.string().optional(),
      })
    )
    .min(1, 'Penerimaan harus memiliki minimal 1 item'),
  invoice: z
    .object({
      vendorInvoiceNumber: z.string().min(1, 'Nomor invoice vendor wajib diisi'),
      invoiceDate: z.string().min(1, 'Tanggal invoice wajib diisi'),
      dueDate: z.string().min(1, 'Tanggal jatuh tempo wajib diisi'),
      subtotalAmount: z.number().positive('Subtotal amount harus > 0'),
      ppnAmount: z.number().nonnegative().optional().default(0),
      pphAmount: z.number().nonnegative().optional().default(0),
      totalPayableAmount: z.number().positive('Total payable amount harus > 0'),
      nsfpOriginal: z.string().optional(),
      taxSnapshotId: z.string().uuid('Tax snapshot ID wajib valid UUID'),
    })
    .optional(),
});
