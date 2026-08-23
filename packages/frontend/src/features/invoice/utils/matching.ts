export interface TwoWayMatchEvaluation {
  poAmount: number;
  invoiceAmount: number;
  variance: number;
  variancePct: number;
  status: 'MATCHED_OK' | 'MATCHED_WITH_EXCEPTION';
  isExactMatch: boolean;
  isWithinTolerance: boolean;
  tagColor: 'success' | 'warning' | 'error';
  alertType: 'success' | 'warning' | 'error';
  requiresOverride: boolean;
}

export function evaluateTwoWayMatchingStatus(
  poAmount: number,
  invoiceAmount: number
): TwoWayMatchEvaluation {
  const variance = invoiceAmount - poAmount;
  const absVariance = Math.abs(variance);
  const variancePct = poAmount > 0 ? Number(((absVariance / poAmount) * 100).toFixed(2)) : 0;

  const isExactMatch = variance === 0;
  const isWithinTolerance = isExactMatch || absVariance <= 100000 || variancePct <= 1.0;

  if (isExactMatch) {
    return {
      poAmount,
      invoiceAmount,
      variance,
      variancePct,
      status: 'MATCHED_OK',
      isExactMatch: true,
      isWithinTolerance: true,
      tagColor: 'success',
      alertType: 'success',
      requiresOverride: false,
    };
  }

  if (isWithinTolerance) {
    return {
      poAmount,
      invoiceAmount,
      variance,
      variancePct,
      status: 'MATCHED_OK',
      isExactMatch: false,
      isWithinTolerance: true,
      tagColor: 'warning',
      alertType: 'warning',
      requiresOverride: false,
    };
  }

  return {
    poAmount,
    invoiceAmount,
    variance,
    variancePct,
    status: 'MATCHED_WITH_EXCEPTION',
    isExactMatch: false,
    isWithinTolerance: false,
    tagColor: 'error',
    alertType: 'error',
    requiresOverride: true,
  };
}
