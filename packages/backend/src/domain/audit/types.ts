import { z } from 'zod';

export interface AuditTrailEntryRecord {
  id: number;
  eventTimestamp: string;
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
  previousEntryHash?: string | null;
  currentEntryHash: string;
}

export interface RecordAuditInput {
  actorId?: string;
  actorRole?: string;
  actionType: string;
  entityName: string;
  entityId: string;
  oldState?: Record<string, unknown> | null;
  newState?: Record<string, unknown> | null;
  justification?: string;
  ipAddress: string;
  userAgent?: string;
}

export interface AuditIntegrityResult {
  isValid: boolean;
  corruptedEntryId: number | null;
  totalEntriesChecked: number;
  details?: string;
}

export const recordAuditSchema = z.object({
  actorId: z.string().uuid().optional(),
  actorRole: z.string().optional(),
  actionType: z.string().min(1, 'Action type wajib diisi'),
  entityName: z.string().min(1, 'Entity name wajib diisi'),
  entityId: z.string().min(1, 'Entity ID wajib diisi'),
  oldState: z.record(z.unknown()).nullable().optional(),
  newState: z.record(z.unknown()).nullable().optional(),
  justification: z.string().optional(),
  ipAddress: z.string().min(1, 'IP address wajib diisi'),
  userAgent: z.string().optional(),
});
