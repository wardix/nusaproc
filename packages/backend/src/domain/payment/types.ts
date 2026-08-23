import { z } from 'zod';

export type PaymentProposalStatus =
  | 'PROPOSED'
  | 'CHECKED'
  | 'EXECUTED'
  | 'REJECTED'
  | 'CANCELLED';

export interface PaymentProposalRecord {
  id: string;
  proposalNumber: string;
  vendorId: string;
  vendorBankAccountId: string;
  totalPaymentAmount: number;
  paymentMethod: string;
  status: PaymentProposalStatus;
  proposedBy: string;
  proposedAt: string;
  checkedBy?: string | null;
  checkedAt?: string | null;
  executedBy?: string | null;
  executedAt?: string | null;
  bankReferenceNumber?: string | null;
  executionReceiptFileId?: string | null;
}

export interface PaymentInvoiceAllocationRecord {
  id: string;
  paymentProposalId: string;
  invoiceId: string;
  allocatedAmount: number;
  isAdvancePayment: boolean;
}

export interface PaymentProposalWithDetails extends PaymentProposalRecord {
  allocations: PaymentInvoiceAllocationRecord[];
}

export interface AllocationInput {
  invoiceId: string;
  allocatedAmount: number;
  isAdvancePayment?: boolean;
}

export interface ProposePaymentInput {
  vendorId: string;
  vendorBankAccountId: string;
  paymentMethod?: string;
  proposedBy: string;
  allocations: AllocationInput[];
}

export interface CheckPaymentProposalInput {
  proposalId: string;
  checkedBy: string;
}

export interface ExecutePaymentInput {
  proposalId: string;
  executedBy: string;
  reauthToken: string;
  idempotencyKey?: string;
  bankReferenceNumber?: string;
  executionReceiptFileId?: string;
}

export const proposePaymentSchema = z.object({
  vendorId: z.string().uuid('Vendor ID wajib valid UUID'),
  vendorBankAccountId: z.string().uuid('Vendor Bank Account ID wajib valid UUID'),
  paymentMethod: z.string().optional().default('BANK_TRANSFER'),
  proposedBy: z.string().uuid('Proposed by wajib valid UUID'),
  allocations: z
    .array(
      z.object({
        invoiceId: z.string().uuid('Invoice ID wajib valid UUID'),
        allocatedAmount: z.number().positive('Allocated amount harus > 0'),
        isAdvancePayment: z.boolean().optional().default(false),
      })
    )
    .min(1, 'Proposal pembayaran harus memiliki minimal 1 alokasi invoice'),
});

export const checkPaymentProposalSchema = z.object({
  proposalId: z.string().uuid('Proposal ID wajib valid UUID'),
  checkedBy: z.string().uuid('Checked by wajib valid UUID'),
});

export const executePaymentSchema = z.object({
  proposalId: z.string().uuid('Proposal ID wajib valid UUID'),
  executedBy: z.string().uuid('Executed by wajib valid UUID'),
  reauthToken: z.string().min(1, 'Step-Up Re-Authentication token wajib disertakan'),
  idempotencyKey: z.string().optional(),
  bankReferenceNumber: z.string().optional().default('TRF-MANUAL'),
  executionReceiptFileId: z.string().uuid().optional(),
});
