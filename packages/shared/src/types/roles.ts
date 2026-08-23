export type AppRole =
  | 'REQUESTER'
  | 'APPROVER'
  | 'ACCOUNT_PAYABLE'
  | 'WAREHOUSE'
  | 'FINANCE'
  | 'AUDITOR'
  | 'ADMIN';

export const APP_ROLES: readonly AppRole[] = [
  'REQUESTER',
  'APPROVER',
  'ACCOUNT_PAYABLE',
  'WAREHOUSE',
  'FINANCE',
  'AUDITOR',
  'ADMIN',
] as const;

export type PrStatus =
  | 'DRAFT'
  | 'PENDING_APPROVAL'
  | 'APPROVED'
  | 'REJECTED'
  | 'CANCELLED';

export type PoStatus =
  | 'DRAFT'
  | 'ISSUED'
  | 'AMENDED'
  | 'COMPLETED'
  | 'CANCELLED';

export type PaymentTermType =
  | 'ADVANCE_OR_COD'
  | 'PAY_AFTER_RECEIPT';
