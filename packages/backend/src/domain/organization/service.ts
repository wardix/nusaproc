import { sql } from '../../db/client';
import { ConflictError, NotFoundError } from '../sod/errors';
import { recordAuditTrailEntry } from '../audit/service';
import type {
  BranchRecord,
  DivisionRecord,
  CreateBranchInput,
  UpdateBranchInput,
  CreateDivisionInput,
  UpdateDivisionInput,
} from './types';

// ============================================================================
// 1. Master Branch Services
// ============================================================================

export async function listBranches(params?: {
  isActive?: boolean;
  search?: string;
}): Promise<BranchRecord[]> {
  const whereClauses = [];

  if (params?.isActive !== undefined) {
    whereClauses.push(sql`is_active = ${params.isActive}`);
  }

  if (params?.search && params.search.trim()) {
    const searchPattern = `%${params.search.trim().toLowerCase()}%`;
    whereClauses.push(sql`(LOWER(code) LIKE ${searchPattern} OR LOWER(name) LIKE ${searchPattern} OR LOWER(city) LIKE ${searchPattern})`);
  }

  const query = whereClauses.length > 0
    ? sql`SELECT id, code, name, city, address, is_active AS "isActive", created_at AS "createdAt", updated_at AS "updatedAt" FROM master_branch WHERE ${whereClauses.reduce((acc, curr) => sql`${acc} AND ${curr}`)} ORDER BY code ASC`
    : sql`SELECT id, code, name, city, address, is_active AS "isActive", created_at AS "createdAt", updated_at AS "updatedAt" FROM master_branch ORDER BY code ASC`;

  const rows = await query;
  return rows as unknown as BranchRecord[];
}

export async function getBranchById(id: string): Promise<BranchRecord> {
  const rows = await sql`
    SELECT
      id, code, name, city, address,
      is_active AS "isActive", created_at AS "createdAt", updated_at AS "updatedAt"
    FROM master_branch
    WHERE id = ${id}
  `;

  if (rows.length === 0) {
    throw new NotFoundError(`Kantor cabang dengan ID ${id} tidak ditemukan.`);
  }

  return rows[0] as unknown as BranchRecord;
}

export async function createBranch(input: CreateBranchInput, adminId: string): Promise<BranchRecord> {
  const existing = await sql`SELECT id FROM master_branch WHERE code = ${input.code.trim()}`;
  if (existing.length > 0) {
    throw new ConflictError(`Kantor cabang dengan kode '${input.code.trim()}' sudah terdaftar.`);
  }

  const id = crypto.randomUUID();
  const rows = await sql`
    INSERT INTO master_branch (
      id, code, name, city, address, is_active
    ) VALUES (
      ${id}, ${input.code.trim()}, ${input.name.trim()}, ${input.city.trim()},
      ${input.address || null}, ${input.isActive !== undefined ? input.isActive : true}
    )
    RETURNING
      id, code, name, city, address,
      is_active AS "isActive", created_at AS "createdAt", updated_at AS "updatedAt"
  `;

  await recordAuditTrailEntry({
    actorId: adminId,
    actorRole: 'ADMIN',
    actionType: 'CREATE_BRANCH',
    entityName: 'master_branch',
    entityId: id,
    ipAddress: '127.0.0.1',
    justification: `Pembuatan kantor cabang baru: ${input.name.trim()} (${input.code.trim()})`,
  });

  return rows[0] as unknown as BranchRecord;
}

export async function updateBranch(
  id: string,
  input: UpdateBranchInput,
  adminId: string
): Promise<BranchRecord> {
  await getBranchById(id);

  if (input.code) {
    const existing = await sql`
      SELECT id FROM master_branch WHERE code = ${input.code.trim()} AND id != ${id}
    `;
    if (existing.length > 0) {
      throw new ConflictError(`Kantor cabang dengan kode '${input.code.trim()}' sudah digunakan cabang lain.`);
    }
  }

  const rows = await sql`
    UPDATE master_branch
    SET
      code = COALESCE(${input.code ? input.code.trim() : null}, code),
      name = COALESCE(${input.name ? input.name.trim() : null}, name),
      city = COALESCE(${input.city ? input.city.trim() : null}, city),
      address = CASE WHEN ${input.address !== undefined} THEN ${input.address} ELSE address END,
      is_active = COALESCE(${input.isActive !== undefined ? input.isActive : null}, is_active),
      updated_at = clock_timestamp()
    WHERE id = ${id}
    RETURNING
      id, code, name, city, address,
      is_active AS "isActive", created_at AS "createdAt", updated_at AS "updatedAt"
  `;

  await recordAuditTrailEntry({
    actorId: adminId,
    actorRole: 'ADMIN',
    actionType: 'UPDATE_BRANCH',
    entityName: 'master_branch',
    entityId: id,
    ipAddress: '127.0.0.1',
    justification: `Pembaruan data kantor cabang: ${rows[0].name} (${rows[0].code})`,
  });

  return rows[0] as unknown as BranchRecord;
}

export async function toggleBranchStatus(
  id: string,
  isActive: boolean,
  adminId: string
): Promise<BranchRecord> {
  await getBranchById(id);

  const rows = await sql`
    UPDATE master_branch
    SET
      is_active = ${isActive},
      updated_at = clock_timestamp()
    WHERE id = ${id}
    RETURNING
      id, code, name, city, address,
      is_active AS "isActive", created_at AS "createdAt", updated_at AS "updatedAt"
  `;

  await recordAuditTrailEntry({
    actorId: adminId,
    actorRole: 'ADMIN',
    actionType: isActive ? 'ACTIVATE_BRANCH' : 'DEACTIVATE_BRANCH',
    entityName: 'master_branch',
    entityId: id,
    ipAddress: '127.0.0.1',
    justification: `Pengubahan status kantor cabang ${rows[0].code} menjadi ${isActive ? 'AKTIF' : 'NONAKTIF'}`,
  });

  return rows[0] as unknown as BranchRecord;
}

// ============================================================================
// 2. Master Division Services
// ============================================================================

export async function listDivisions(params?: {
  isActive?: boolean;
  search?: string;
}): Promise<DivisionRecord[]> {
  const whereClauses = [];

  if (params?.isActive !== undefined) {
    whereClauses.push(sql`is_active = ${params.isActive}`);
  }

  if (params?.search && params.search.trim()) {
    const searchPattern = `%${params.search.trim().toLowerCase()}%`;
    whereClauses.push(sql`(LOWER(code) LIKE ${searchPattern} OR LOWER(name) LIKE ${searchPattern} OR LOWER(description) LIKE ${searchPattern})`);
  }

  const query = whereClauses.length > 0
    ? sql`SELECT id, code, name, description, is_active AS "isActive", created_at AS "createdAt", updated_at AS "updatedAt" FROM master_division WHERE ${whereClauses.reduce((acc, curr) => sql`${acc} AND ${curr}`)} ORDER BY code ASC`
    : sql`SELECT id, code, name, description, is_active AS "isActive", created_at AS "createdAt", updated_at AS "updatedAt" FROM master_division ORDER BY code ASC`;

  const rows = await query;
  return rows as unknown as DivisionRecord[];
}

export async function getDivisionById(id: string): Promise<DivisionRecord> {
  const rows = await sql`
    SELECT
      id, code, name, description,
      is_active AS "isActive", created_at AS "createdAt", updated_at AS "updatedAt"
    FROM master_division
    WHERE id = ${id}
  `;

  if (rows.length === 0) {
    throw new NotFoundError(`Divisi dengan ID ${id} tidak ditemukan.`);
  }

  return rows[0] as unknown as DivisionRecord;
}

export async function createDivision(input: CreateDivisionInput, adminId: string): Promise<DivisionRecord> {
  const existing = await sql`SELECT id FROM master_division WHERE code = ${input.code.trim()}`;
  if (existing.length > 0) {
    throw new ConflictError(`Divisi dengan kode '${input.code.trim()}' sudah terdaftar.`);
  }

  const id = crypto.randomUUID();
  const rows = await sql`
    INSERT INTO master_division (
      id, code, name, description, is_active
    ) VALUES (
      ${id}, ${input.code.trim()}, ${input.name.trim()},
      ${input.description || null}, ${input.isActive !== undefined ? input.isActive : true}
    )
    RETURNING
      id, code, name, description,
      is_active AS "isActive", created_at AS "createdAt", updated_at AS "updatedAt"
  `;

  await recordAuditTrailEntry({
    actorId: adminId,
    actorRole: 'ADMIN',
    actionType: 'CREATE_DIVISION',
    entityName: 'master_division',
    entityId: id,
    ipAddress: '127.0.0.1',
    justification: `Pembuatan divisi baru: ${input.name.trim()} (${input.code.trim()})`,
  });

  return rows[0] as unknown as DivisionRecord;
}

export async function updateDivision(
  id: string,
  input: UpdateDivisionInput,
  adminId: string
): Promise<DivisionRecord> {
  await getDivisionById(id);

  if (input.code) {
    const existing = await sql`
      SELECT id FROM master_division WHERE code = ${input.code.trim()} AND id != ${id}
    `;
    if (existing.length > 0) {
      throw new ConflictError(`Divisi dengan kode '${input.code.trim()}' sudah digunakan divisi lain.`);
    }
  }

  const rows = await sql`
    UPDATE master_division
    SET
      code = COALESCE(${input.code ? input.code.trim() : null}, code),
      name = COALESCE(${input.name ? input.name.trim() : null}, name),
      description = CASE WHEN ${input.description !== undefined} THEN ${input.description} ELSE description END,
      is_active = COALESCE(${input.isActive !== undefined ? input.isActive : null}, is_active),
      updated_at = clock_timestamp()
    WHERE id = ${id}
    RETURNING
      id, code, name, description,
      is_active AS "isActive", created_at AS "createdAt", updated_at AS "updatedAt"
  `;

  await recordAuditTrailEntry({
    actorId: adminId,
    actorRole: 'ADMIN',
    actionType: 'UPDATE_DIVISION',
    entityName: 'master_division',
    entityId: id,
    ipAddress: '127.0.0.1',
    justification: `Pembaruan data divisi: ${rows[0].name} (${rows[0].code})`,
  });

  return rows[0] as unknown as DivisionRecord;
}

export async function toggleDivisionStatus(
  id: string,
  isActive: boolean,
  adminId: string
): Promise<DivisionRecord> {
  await getDivisionById(id);

  const rows = await sql`
    UPDATE master_division
    SET
      is_active = ${isActive},
      updated_at = clock_timestamp()
    WHERE id = ${id}
    RETURNING
      id, code, name, description,
      is_active AS "isActive", created_at AS "createdAt", updated_at AS "updatedAt"
  `;

  await recordAuditTrailEntry({
    actorId: adminId,
    actorRole: 'ADMIN',
    actionType: isActive ? 'ACTIVATE_DIVISION' : 'DEACTIVATE_DIVISION',
    entityName: 'master_division',
    entityId: id,
    ipAddress: '127.0.0.1',
    justification: `Pengubahan status divisi ${rows[0].code} menjadi ${isActive ? 'AKTIF' : 'NONAKTIF'}`,
  });

  return rows[0] as unknown as DivisionRecord;
}
