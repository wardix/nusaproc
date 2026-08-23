export interface AuditTrailEntry {
  id: string;
  entityName: string;
  entityId: string;
  action: string;
  actorId: string;
  payloadSnapshot: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  createdAt: string;
}
