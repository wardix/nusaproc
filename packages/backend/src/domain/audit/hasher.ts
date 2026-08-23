import crypto from 'node:crypto';

export const GENESIS_AUDIT_HASH = '0'.repeat(64);

export function canonicalize(val: unknown): unknown {
  if (val === null || val === undefined || typeof val !== 'object') {
    return val;
  }
  if (Array.isArray(val)) {
    return val.map(canonicalize);
  }
  const sortedObj: Record<string, unknown> = {};
  for (const key of Object.keys(val).sort()) {
    sortedObj[key] = canonicalize((val as Record<string, unknown>)[key]);
  }
  return sortedObj;
}

export function computeAuditEntryHash(params: {
  actorId?: string | null;
  actorRole?: string | null;
  actionType: string;
  entityName: string;
  entityId: string;
  oldState?: Record<string, unknown> | null;
  newState?: Record<string, unknown> | null;
  justification?: string | null;
  ipAddress: string;
  userAgent?: string | null;
  previousEntryHash: string;
}): string {
  const normalizedIp = params.ipAddress ? params.ipAddress.split('/')[0] : '';
  const payload = {
    actionType: params.actionType,
    actorId: params.actorId || null,
    actorRole: params.actorRole || null,
    entityId: params.entityId,
    entityName: params.entityName,
    ipAddress: normalizedIp,
    justification: params.justification || null,
    newState: params.newState ? canonicalize(params.newState) : null,
    oldState: params.oldState ? canonicalize(params.oldState) : null,
    previousEntryHash: params.previousEntryHash,
    userAgent: params.userAgent || null,
  };

  const serialized = JSON.stringify(canonicalize(payload));
  return crypto.createHash('sha256').update(serialized).digest('hex');
}
