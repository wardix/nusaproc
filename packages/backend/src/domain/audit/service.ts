import { withTransaction } from '../../db/client';
import { AuditRepository } from './repository';
import { computeAuditEntryHash, GENESIS_AUDIT_HASH } from './hasher';
import {
  recordAuditSchema,
  type RecordAuditInput,
  type AuditTrailEntryRecord,
  type AuditIntegrityResult,
} from './types';

export type { RecordAuditInput, AuditTrailEntryRecord, AuditIntegrityResult };

export async function recordAuditTrailEntry(
  input: RecordAuditInput
): Promise<AuditTrailEntryRecord> {
  const validated = recordAuditSchema.parse(input);

  return await withTransaction(async (tx) => {
    const repo = new AuditRepository(tx);

    const latest = await repo.getLatestAuditEntry();
    const previousEntryHash = latest && latest.currentEntryHash ? latest.currentEntryHash : GENESIS_AUDIT_HASH;

    const currentEntryHash = computeAuditEntryHash({
      actorId: validated.actorId,
      actorRole: validated.actorRole,
      actionType: validated.actionType,
      entityName: validated.entityName,
      entityId: validated.entityId,
      oldState: validated.oldState,
      newState: validated.newState,
      justification: validated.justification,
      ipAddress: validated.ipAddress,
      userAgent: validated.userAgent,
      previousEntryHash,
    });

    return await repo.insertAuditEntry({
      actorId: validated.actorId,
      actorRole: validated.actorRole,
      actionType: validated.actionType,
      entityName: validated.entityName,
      entityId: validated.entityId,
      oldState: validated.oldState,
      newState: validated.newState,
      justification: validated.justification,
      ipAddress: validated.ipAddress,
      userAgent: validated.userAgent,
      previousEntryHash,
      currentEntryHash,
    });
  });
}

export async function verifyAuditChainIntegrity(fromId?: number): Promise<AuditIntegrityResult> {
  const repo = new AuditRepository();
  const allEntries = await repo.getAllAuditEntriesChronological();

  const entries =
    fromId != null
      ? allEntries.filter((e) => e.id >= fromId)
      : allEntries.filter((e) => e.previousEntryHash !== null);

  if (entries.length === 0) {
    return {
      isValid: true,
      corruptedEntryId: null,
      totalEntriesChecked: 0,
      details: 'Audit trail kosong atau belum memiliki entri berantai.',
    };
  }

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];

    // 1. Verify previous hash link (for i > 0)
    if (i > 0) {
      const prevEntry = entries[i - 1];
      if (entry.previousEntryHash !== prevEntry.currentEntryHash) {
        return {
          isValid: false,
          corruptedEntryId: entry.id,
          totalEntriesChecked: i + 1,
          details: `Rantai hash terputus pada record ID ${entry.id}: previous_entry_hash (${entry.previousEntryHash}) tidak cocok dengan current_entry_hash record sebelumnya (${prevEntry.currentEntryHash}).`,
        };
      }
    }

    // 2. Recompute current hash
    const recomputedHash = computeAuditEntryHash({
      actorId: entry.actorId,
      actorRole: entry.actorRole,
      actionType: entry.actionType,
      entityName: entry.entityName,
      entityId: entry.entityId,
      oldState: entry.oldState,
      newState: entry.newState,
      justification: entry.justification,
      ipAddress: entry.ipAddress,
      userAgent: entry.userAgent,
      previousEntryHash: entry.previousEntryHash || GENESIS_AUDIT_HASH,
    });

    if (recomputedHash !== entry.currentEntryHash) {
      return {
        isValid: false,
        corruptedEntryId: entry.id,
        totalEntriesChecked: i + 1,
        details: `Manipulasi data terdeteksi pada record ID ${entry.id}: hash tersimpan (${entry.currentEntryHash}) berbeda dari hash hasil kalkulasi (${recomputedHash}).`,
      };
    }
  }

  return {
    isValid: true,
    corruptedEntryId: null,
    totalEntriesChecked: entries.length,
    details: `Seluruh ${entries.length} baris audit trail terverifikasi utuh dan valid.`,
  };
}

export async function getAuditTrailForEntity(
  entityName: string,
  entityId: string
): Promise<AuditTrailEntryRecord[]> {
  const repo = new AuditRepository();
  return await repo.findAuditEntriesByEntity(entityName, entityId);
}
