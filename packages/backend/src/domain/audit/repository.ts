import { sql, type TransactionClient } from '../../db/client';
import type { AuditTrailEntryRecord } from './types';

function parseJsonField(val: unknown): Record<string, unknown> | null {
  if (!val) return null;
  if (typeof val === 'string') {
    try {
      return JSON.parse(val);
    } catch {
      return null;
    }
  }
  return val as Record<string, unknown>;
}

function normalizeIpAddress(ip?: string | null): string {
  if (!ip) return '';
  return ip.split('/')[0];
}

function mapRow(r: Record<string, unknown>): AuditTrailEntryRecord {
  return {
    id: Number(r.id),
    eventTimestamp: String(r.eventTimestamp),
    actorId: r.actorId ? String(r.actorId) : null,
    actorRole: r.actorRole ? String(r.actorRole) : null,
    actionType: String(r.actionType),
    entityName: String(r.entityName),
    entityId: String(r.entityId),
    oldState: parseJsonField(r.oldState),
    newState: parseJsonField(r.newState),
    justification: r.justification ? String(r.justification) : null,
    ipAddress: normalizeIpAddress(r.ipAddress as string),
    userAgent: r.userAgent ? String(r.userAgent) : null,
    previousEntryHash: r.previousEntryHash ? String(r.previousEntryHash) : null,
    currentEntryHash: String(r.currentEntryHash),
  };
}

export class AuditRepository {
  constructor(private db: TransactionClient = sql) {}

  async getLatestAuditEntry(): Promise<AuditTrailEntryRecord | null> {
    const rows = await this.db`
      SELECT
        id::bigint AS id,
        event_timestamp::text AS "eventTimestamp",
        actor_id AS "actorId",
        actor_role AS "actorRole",
        action_type AS "actionType",
        entity_name AS "entityName",
        entity_id AS "entityId",
        old_state AS "oldState",
        new_state AS "newState",
        justification,
        ip_address::text AS "ipAddress",
        user_agent AS "userAgent",
        previous_entry_hash AS "previousEntryHash",
        current_entry_hash AS "currentEntryHash"
      FROM audit_trail_entry
      ORDER BY id DESC
      LIMIT 1
    `;

    if (rows.length === 0) return null;
    return mapRow(rows[0] as unknown as Record<string, unknown>);
  }

  async insertAuditEntry(entry: {
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
    currentEntryHash: string;
  }): Promise<AuditTrailEntryRecord> {
    const rows = await this.db`
      INSERT INTO audit_trail_entry (
        actor_id, actor_role, action_type, entity_name, entity_id,
        old_state, new_state, justification, ip_address, user_agent,
        previous_entry_hash, current_entry_hash
      ) VALUES (
        ${entry.actorId ?? null}, ${entry.actorRole ?? null}, ${entry.actionType},
        ${entry.entityName}, ${entry.entityId},
        ${entry.oldState ? JSON.stringify(entry.oldState) : null}::jsonb,
        ${entry.newState ? JSON.stringify(entry.newState) : null}::jsonb,
        ${entry.justification ?? null},
        ${entry.ipAddress}::inet,
        ${entry.userAgent ?? null},
        ${entry.previousEntryHash},
        ${entry.currentEntryHash}
      )
      RETURNING
        id::bigint AS id,
        event_timestamp::text AS "eventTimestamp",
        actor_id AS "actorId",
        actor_role AS "actorRole",
        action_type AS "actionType",
        entity_name AS "entityName",
        entity_id AS "entityId",
        old_state AS "oldState",
        new_state AS "newState",
        justification,
        ip_address::text AS "ipAddress",
        user_agent AS "userAgent",
        previous_entry_hash AS "previousEntryHash",
        current_entry_hash AS "currentEntryHash"
    `;

    return mapRow(rows[0] as unknown as Record<string, unknown>);
  }

  async getAllAuditEntriesChronological(): Promise<AuditTrailEntryRecord[]> {
    const rows = await this.db`
      SELECT
        id::bigint AS id,
        event_timestamp::text AS "eventTimestamp",
        actor_id AS "actorId",
        actor_role AS "actorRole",
        action_type AS "actionType",
        entity_name AS "entityName",
        entity_id AS "entityId",
        old_state AS "oldState",
        new_state AS "newState",
        justification,
        ip_address::text AS "ipAddress",
        user_agent AS "userAgent",
        previous_entry_hash AS "previousEntryHash",
        current_entry_hash AS "currentEntryHash"
      FROM audit_trail_entry
      ORDER BY id ASC
    `;

    const typedRows = rows as unknown as Array<Record<string, unknown>>;
    return typedRows.map((r) => mapRow(r));
  }

  async findAuditEntriesByEntity(
    entityName: string,
    entityId: string
  ): Promise<AuditTrailEntryRecord[]> {
    const rows = await this.db`
      SELECT
        id::bigint AS id,
        event_timestamp::text AS "eventTimestamp",
        actor_id AS "actorId",
        actor_role AS "actorRole",
        action_type AS "actionType",
        entity_name AS "entityName",
        entity_id AS "entityId",
        old_state AS "oldState",
        new_state AS "newState",
        justification,
        ip_address::text AS "ipAddress",
        user_agent AS "userAgent",
        previous_entry_hash AS "previousEntryHash",
        current_entry_hash AS "currentEntryHash"
      FROM audit_trail_entry
      WHERE entity_name = ${entityName} AND entity_id = ${entityId}
      ORDER BY id ASC
    `;

    const typedRows = rows as unknown as Array<Record<string, unknown>>;
    return typedRows.map((r) => mapRow(r));
  }
}
