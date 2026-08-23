import { ScopeLimitExceededError } from './errors';

export interface DelegationRecord {
  delegatorId: string;
  delegateeId: string;
  startDate: string;
  endDate: string;
  maxAmountLimit?: number | null;
  scopeDivisionId?: string | null;
  reason?: string;
  isActive: boolean;
}

export interface ScopeValidationParams {
  userId: string;
  userMaxLimit: number;
  userDivisionId?: string;
  requestAmount: number;
  requestDivisionId?: string;
  delegations?: DelegationRecord[];
}

export interface ScopeValidationResult {
  allowed: boolean;
  delegatedFrom?: string;
}

/**
 * Validates whether an approver has legitimate authority to approve a request
 * based on nominal limits, division hierarchy, and active delegations (R4, R13).
 */
export function validateApprovalScope(params: ScopeValidationParams): ScopeValidationResult {
  const {
    userMaxLimit,
    userDivisionId,
    requestAmount,
    requestDivisionId,
    delegations = [],
  } = params;

  // 1. Direct approval authority check
  const isWithinUserLimit = requestAmount <= userMaxLimit;
  const isDivisionMatched = !userDivisionId || !requestDivisionId || userDivisionId === requestDivisionId;

  if (isWithinUserLimit && isDivisionMatched) {
    return { allowed: true };
  }

  // 2. Check active delegations (R4)
  const now = new Date();
  for (const del of delegations) {
    if (!del.isActive) continue;

    const start = new Date(del.startDate);
    const end = new Date(del.endDate);
    if (now < start || now > end) continue;

    const hasDivisionScope = !del.scopeDivisionId || !requestDivisionId || del.scopeDivisionId === requestDivisionId;
    const hasAmountScope = del.maxAmountLimit == null || requestAmount <= del.maxAmountLimit;

    if (hasDivisionScope && hasAmountScope) {
      return {
        allowed: true,
        delegatedFrom: del.delegatorId,
      };
    }
  }

  // 3. Authority limit exceeded
  throw new ScopeLimitExceededError(
    `Nilai pengajuan (${requestAmount}) melebihi batas kewenangan persetujuan (${userMaxLimit}) atau berada di luar divisi yang didelegasikan.`,
    'R13_OUT_OF_SCOPE'
  );
}
