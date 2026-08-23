export interface ApprovalInstance {
  id: string;
  entityType: 'PURCHASE_REQUEST' | 'PURCHASE_ORDER' | 'PAYMENT_PROPOSAL';
  entityId: string;
  stepNumber: number;
  assignedRoleId: string;
  assignedUserId?: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  actionTimestamp?: string;
  notes?: string;
}
