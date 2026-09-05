import { z } from 'zod';

export type PaymentTermType = 'ADVANCE_OR_COD' | 'PAY_AFTER_RECEIPT';
export type PrStatus = 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED' | 'CANCELLED' | 'CLOSED_PARTIAL';
export type ApprovalDecision = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface PurchaseRequestItemRecord {
  id: string;
  prId: string;
  lineNumber: number;
  itemName: string;
  specification?: string | null;
  quantityRequested: number;
  quantityOrdered: number;
  uom: string;
  estimatedUnitPrice: number;
  subtotal: number;
}

export interface PurchaseRequestRecord {
  id: string;
  prNumber: string;
  requesterId: string;
  requesterName?: string | null;
  requesterEmail?: string | null;
  costCenter: string;
  divisionId: string;
  divisionName?: string | null;
  branchId: string;
  branchName?: string | null;
  requiredDate: string;
  paymentTermType: PaymentTermType;
  isEmergency: boolean;
  emergencyJustification?: string | null;
  businessJustification: string;
  status: PrStatus;
  totalEstimatedAmount: number;
  lockedApprovalPolicyVersion?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ApprovalInstanceRecord {
  id: string;
  prId: string;
  stepOrder: number;
  assignedRole: string;
  assignedUserId?: string | null;
  requiredMinAmount: number;
  decision: ApprovalDecision;
  decisionBy?: string | null;
  decisionAt?: string | null;
  rejectionReason?: string | null;
  delegatedFromUserId?: string | null;
}

export interface EmergencyPostReviewRecord {
  id: string;
  prId: string;
  poId?: string | null;
  reviewDueDate: string;
  isReviewed: boolean;
  reviewedBy?: string | null;
  reviewedAt?: string | null;
  auditNotes?: string | null;
  createdAt: string;
}

export interface PrItemInput {
  lineNumber?: number;
  itemName: string;
  specification?: string;
  quantityRequested: number;
  uom: string;
  estimatedUnitPrice: number;
}

export interface CreatePrInput {
  requesterId: string;
  costCenter: string;
  divisionId: string;
  branchId: string;
  requiredDate?: string;
  paymentTermType: PaymentTermType;
  businessJustification: string;
  isEmergency?: boolean;
  emergencyJustification?: string;
  items: PrItemInput[];
}

export interface UpdatePrInput {
  costCenter?: string;
  divisionId?: string;
  branchId?: string;
  requiredDate?: string;
  paymentTermType?: PaymentTermType;
  businessJustification?: string;
  isEmergency?: boolean;
  emergencyJustification?: string;
  items?: PrItemInput[];
}

export interface DecideApprovalInput {
  prId: string;
  approverId: string;
  decision: 'APPROVED' | 'REJECTED';
  rejectionReason?: string;
  approverMaxLimit?: number;
  approverDivisionId?: string;
}

export interface PrWithDetails extends PurchaseRequestRecord {
  items: PurchaseRequestItemRecord[];
  approvalInstances: ApprovalInstanceRecord[];
}

// Zod Validation Schemas
export const createPrSchema = z.object({
  costCenter: z.string().min(1, 'Cost center wajib diisi'),
  divisionId: z.string().min(1, 'Division ID wajib diisi'),
  branchId: z.string().min(1, 'Branch ID wajib diisi'),
  requiredDate: z.string().optional(),
  paymentTermType: z.enum(['ADVANCE_OR_COD', 'PAY_AFTER_RECEIPT'], {
    errorMap: () => ({ message: 'paymentTermType wajib dipilih (ADVANCE_OR_COD atau PAY_AFTER_RECEIPT)' }),
  }),
  businessJustification: z.string().min(1, 'Justifikasi bisnis wajib diisi'),
  isEmergency: z.boolean().optional().default(false),
  emergencyJustification: z.string().optional(),
  items: z
    .array(
      z.object({
        lineNumber: z.number().int().positive().optional(),
        itemName: z.string().min(1, 'Nama item wajib diisi'),
        specification: z.string().optional(),
        quantityRequested: z.number().positive('Jumlah kuantitas harus lebih besar dari 0'),
        uom: z.string().min(1, 'Satuan unit (UoM) wajib diisi'),
        estimatedUnitPrice: z.number().nonnegative('Estimasi harga satuan harus >= 0'),
      })
    )
    .min(1, 'items wajib memiliki minimal 1 item barang/jasa'),
}).refine(
  (data) => {
    if (data.isEmergency && (!data.emergencyJustification || data.emergencyJustification.trim() === '')) {
      return false;
    }
    return true;
  },
  {
    message: 'emergencyJustification wajib diisi jika pengadaan bersifat darurat (R48)',
    path: ['emergencyJustification'],
  }
);
