import { sql, withTransaction } from '../../db/client';
import { UnauthorizedError, ForbiddenError, ConflictError, NotFoundError } from '../sod/errors';
import { generateAuthToken } from './token';
import { deactivateUserAndRevokeDelegations } from '../integration/delegation_worker';
import type { AppRole } from '@nusaproc/shared';
import type {
  LoginInput,
  GoogleAuthInput,
  CreateUserInput,
  UpdateUserRolesInput,
  UserDetail,
  AuthSuccessResult,
  UserRoleRecord,
} from './types';

function parseGoogleJwtPayload(token: string): { email: string; name?: string; hd?: string; sub?: string } {
  try {
    if (token.startsWith('{') && token.endsWith('}')) {
      return JSON.parse(token);
    }
    const parts = token.split('.');
    if (parts.length === 3) {
      let base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
      while (base64.length % 4) base64 += '=';
      const jsonStr = Buffer.from(base64, 'base64').toString('utf-8');
      return JSON.parse(jsonStr);
    }
  } catch {
    // Fallthrough to throw error
  }
  throw new UnauthorizedError('Token Google OAuth / OIDC tidak valid');
}

export async function loginWithLocalPassword(input: LoginInput): Promise<AuthSuccessResult> {
  const users = await sql`
    SELECT
      id, email, full_name AS "fullName", employee_id AS "employeeId",
      division_id AS "divisionId", branch_id AS "branchId",
      is_active AS "isActive", is_local_fallback AS "isLocalFallback",
      local_password_hash AS "localPasswordHash"
    FROM app_user
    WHERE email = ${input.email}
  `;

  if (users.length === 0) {
    throw new UnauthorizedError('Email atau kata sandi tidak valid.');
  }

  const user = users[0];

  if (!user.localPasswordHash) {
    throw new UnauthorizedError('Akun ini tidak memiliki akses login lokal. Silakan gunakan Google SSO.');
  }

  const isMatch = await Bun.password.verify(input.password, user.localPasswordHash);
  if (!isMatch) {
    throw new UnauthorizedError('Email atau kata sandi tidak valid.');
  }

  if (!user.isActive) {
    throw new ForbiddenError('Akun pengguna telah dinonaktifkan. Silakan hubungi Administrator Sistem.');
  }

  const roleRows = await sql`
    SELECT
      id, role, is_tax_specialist AS "isTaxSpecialist",
      valid_from AS "validFrom", valid_until AS "validUntil",
      assigned_by AS "assignedBy"
    FROM user_role_assignment
    WHERE user_id = ${user.id}
      AND (valid_until IS NULL OR valid_until >= CURRENT_DATE)
      AND valid_from <= CURRENT_DATE
  `;

  if (roleRows.length === 0) {
    throw new ForbiddenError('Pengguna tidak memiliki peran aktif yang sah.');
  }

  const roles: AppRole[] = roleRows.map((r: { role: AppRole }) => r.role);
  const activeRole: AppRole =
    input.requestedRole && roles.includes(input.requestedRole)
      ? input.requestedRole
      : roles[0];

  // Update last_login_at
  await sql`
    UPDATE app_user
    SET last_login_at = clock_timestamp()
    WHERE id = ${user.id}
  `;

  const token = await generateAuthToken({
    userId: user.id,
    email: user.email,
    activeRole,
    divisionId: user.divisionId,
    branchId: user.branchId,
  });

  return {
    token,
    user: {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      employeeId: user.employeeId,
      divisionId: user.divisionId,
      branchId: user.branchId,
      roles,
      activeRole,
    },
  };
}

export async function loginWithGoogleSso(input: GoogleAuthInput): Promise<AuthSuccessResult> {
  const tokenString = input.credential || input.idToken!;
  const payload = parseGoogleJwtPayload(tokenString);

  const email = payload.email?.toLowerCase();
  if (!email) {
    throw new UnauthorizedError('Email tidak ditemukan dalam token Google');
  }

  const isNusanetDomain = email.endsWith('@nusanet.net.id') || payload.hd === 'nusanet.net.id';
  if (!isNusanetDomain) {
    throw new ForbiddenError('Akses hanya diizinkan untuk akun Google Workspace PT Nusanet (@nusanet.net.id)');
  }

  let user = (
    await sql`
      SELECT
        id, email, full_name AS "fullName", employee_id AS "employeeId",
        division_id AS "divisionId", branch_id AS "branchId",
        is_active AS "isActive", is_local_fallback AS "isLocalFallback"
      FROM app_user
      WHERE email = ${email}
    `
  )[0];

  if (!user) {
    // Just-In-Time (JIT) Provisioning
    const newUserId = crypto.randomUUID();
    const employeeId = `EMP-G-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
    const fullName = payload.name || email.split('@')[0].replace(/\./g, ' ').toUpperCase();

    user = await withTransaction(async (tx) => {
      const [created] = await tx`
        INSERT INTO app_user (
          id, email, full_name, employee_id, division_id, branch_id,
          is_active, is_local_fallback
        ) VALUES (
          ${newUserId}, ${email}, ${fullName}, ${employeeId},
          'DIV-GEN', 'HQ_MEDAN', TRUE, FALSE
        )
        RETURNING
          id, email, full_name AS "fullName", employee_id AS "employeeId",
          division_id AS "divisionId", branch_id AS "branchId",
          is_active AS "isActive", is_local_fallback AS "isLocalFallback"
      `;

      await tx`
        INSERT INTO user_role_assignment (
          user_id, role, assigned_by, valid_from
        ) VALUES (
          ${newUserId}, 'REQUESTER', ${newUserId}, CURRENT_DATE
        )
      `;

      return created;
    });
  }

  if (!user.isActive) {
    throw new ForbiddenError('Akun pengguna telah dinonaktifkan. Silakan hubungi Administrator Sistem.');
  }

  const roleRows = await sql`
    SELECT
      id, role, is_tax_specialist AS "isTaxSpecialist",
      valid_from AS "validFrom", valid_until AS "validUntil",
      assigned_by AS "assignedBy"
    FROM user_role_assignment
    WHERE user_id = ${user.id}
      AND (valid_until IS NULL OR valid_until >= CURRENT_DATE)
      AND valid_from <= CURRENT_DATE
  `;

  const roles: AppRole[] =
    roleRows.length > 0
      ? roleRows.map((r: { role: AppRole }) => r.role)
      : ['REQUESTER'];

  const activeRole: AppRole =
    input.requestedRole && roles.includes(input.requestedRole)
      ? input.requestedRole
      : roles[0];

  await sql`
    UPDATE app_user
    SET last_login_at = clock_timestamp()
    WHERE id = ${user.id}
  `;

  const token = await generateAuthToken({
    userId: user.id,
    email: user.email,
    activeRole,
    divisionId: user.divisionId,
    branchId: user.branchId,
  });

  return {
    token,
    user: {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      employeeId: user.employeeId,
      divisionId: user.divisionId,
      branchId: user.branchId,
      roles,
      activeRole,
    },
  };
}

export async function listUsers(params?: {
  search?: string;
  divisionId?: string;
  branchId?: string;
  role?: string;
  isActive?: boolean;
  limit?: number;
  offset?: number;
}): Promise<{ data: UserDetail[]; total: number }> {
  const limit = params?.limit || 50;
  const offset = params?.offset || 0;

  const users = await sql`
    SELECT
      u.id, u.email, u.full_name AS "fullName", u.employee_id AS "employeeId",
      u.division_id AS "divisionId", u.branch_id AS "branchId",
      u.is_active AS "isActive", u.is_local_fallback AS "isLocalFallback",
      u.totp_enabled AS "totpEnabled", u.last_login_at AS "lastLoginAt",
      u.created_at AS "createdAt", u.updated_at AS "updatedAt"
    FROM app_user u
    WHERE (${params?.divisionId ? sql`u.division_id = ${params.divisionId}` : sql`TRUE`})
      AND (${params?.branchId ? sql`u.branch_id = ${params.branchId}` : sql`TRUE`})
      AND (${params?.isActive !== undefined ? sql`u.is_active = ${params.isActive}` : sql`TRUE`})
      AND (${
        params?.search
          ? sql`(u.full_name ILIKE ${`%${params.search}%`} OR u.email ILIKE ${`%${params.search}%`} OR u.employee_id ILIKE ${`%${params.search}%`})`
          : sql`TRUE`
      })
      AND (${
        params?.role
          ? sql`EXISTS (SELECT 1 FROM user_role_assignment ura WHERE ura.user_id = u.id AND ura.role = ${params.role})`
          : sql`TRUE`
      })
    ORDER BY u.created_at DESC
    LIMIT ${limit} OFFSET ${offset}
  `;

  const totalRes = await sql`
    SELECT COUNT(*)::int AS count
    FROM app_user u
    WHERE (${params?.divisionId ? sql`u.division_id = ${params.divisionId}` : sql`TRUE`})
      AND (${params?.branchId ? sql`u.branch_id = ${params.branchId}` : sql`TRUE`})
      AND (${params?.isActive !== undefined ? sql`u.is_active = ${params.isActive}` : sql`TRUE`})
      AND (${
        params?.search
          ? sql`(u.full_name ILIKE ${`%${params.search}%`} OR u.email ILIKE ${`%${params.search}%`} OR u.employee_id ILIKE ${`%${params.search}%`})`
          : sql`TRUE`
      })
      AND (${
        params?.role
          ? sql`EXISTS (SELECT 1 FROM user_role_assignment ura WHERE ura.user_id = u.id AND ura.role = ${params.role})`
          : sql`TRUE`
      })
  `;

  // Fetch roles for all returned users
  const userIds = users.map((u: { id: string }) => u.id);
  const rolesByUser: Record<string, UserRoleRecord[]> = {};

  if (userIds.length > 0) {
    const roles = await sql`
      SELECT
        id, user_id AS "userId", role, is_tax_specialist AS "isTaxSpecialist",
        valid_from AS "validFrom", valid_until AS "validUntil",
        assigned_by AS "assignedBy"
      FROM user_role_assignment
      WHERE user_id IN ${sql(userIds)}
    `;

    for (const r of roles) {
      if (!rolesByUser[r.userId]) rolesByUser[r.userId] = [];
      rolesByUser[r.userId].push({
        id: r.id,
        role: r.role,
        isTaxSpecialist: r.isTaxSpecialist,
        validFrom: r.validFrom,
        validUntil: r.validUntil,
        assignedBy: r.assignedBy,
      });
    }
  }

  const result: UserDetail[] = users.map((u: Record<string, unknown>) => ({
    ...u,
    roles: rolesByUser[u.id as string] || [],
  } as unknown as UserDetail));

  return {
    data: result,
    total: totalRes[0]?.count || 0,
  };
}

export async function getUserById(id: string): Promise<UserDetail> {
  const users = await sql`
    SELECT
      id, email, full_name AS "fullName", employee_id AS "employeeId",
      division_id AS "divisionId", branch_id AS "branchId",
      is_active AS "isActive", is_local_fallback AS "isLocalFallback",
      totp_enabled AS "totpEnabled", last_login_at AS "lastLoginAt",
      created_at AS "createdAt", updated_at AS "updatedAt"
    FROM app_user
    WHERE id = ${id}
  `;

  if (users.length === 0) {
    throw new NotFoundError(`Pengguna dengan ID ${id} tidak ditemukan.`);
  }

  const user = users[0];
  const roles = await sql`
    SELECT
      id, role, is_tax_specialist AS "isTaxSpecialist",
      valid_from AS "validFrom", valid_until AS "validUntil",
      assigned_by AS "assignedBy"
    FROM user_role_assignment
    WHERE user_id = ${id}
  `;

  return {
    ...user,
    roles: roles.map((r: Record<string, unknown>) => ({
      id: r.id as string,
      role: r.role as AppRole,
      isTaxSpecialist: Boolean(r.isTaxSpecialist),
      validFrom: r.validFrom as string,
      validUntil: (r.validUntil as string) || null,
      assignedBy: r.assignedBy as string,
    })),
  };
}

export async function createUser(input: CreateUserInput, createdBy: string): Promise<UserDetail> {
  const existingEmail = await sql`SELECT id FROM app_user WHERE email = ${input.email}`;
  if (existingEmail.length > 0) {
    throw new ConflictError(`Email ${input.email} sudah terdaftar dalam sistem.`);
  }

  const existingNip = await sql`SELECT id FROM app_user WHERE employee_id = ${input.employeeId}`;
  if (existingNip.length > 0) {
    throw new ConflictError(`NIP/Employee ID ${input.employeeId} sudah digunakan.`);
  }

  const userId = crypto.randomUUID();
  const passwordHash = input.initialPassword
    ? await Bun.password.hash(input.initialPassword, 'bcrypt')
    : null;

  await withTransaction(async (tx) => {
    await tx`
      INSERT INTO app_user (
        id, email, full_name, employee_id, division_id, branch_id,
        is_active, is_local_fallback, local_password_hash
      ) VALUES (
        ${userId}, ${input.email}, ${input.fullName}, ${input.employeeId},
        ${input.divisionId}, ${input.branchId}, TRUE,
        ${input.isLocalFallback ?? (passwordHash !== null)},
        ${passwordHash}
      )
    `;

    for (const r of input.roles) {
      await tx`
        INSERT INTO user_role_assignment (
          user_id, role, is_tax_specialist, valid_from, valid_until, assigned_by
        ) VALUES (
          ${userId}, ${r.role}, ${r.isTaxSpecialist ?? false},
          ${r.validFrom || sql`CURRENT_DATE`}, ${r.validUntil || null}, ${createdBy}
        )
      `;
    }
  });

  return getUserById(userId);
}

export async function updateUserRoles(
  userId: string,
  input: UpdateUserRolesInput,
  updatedBy: string
): Promise<UserDetail> {
  // Ensure user exists
  await getUserById(userId);

  await withTransaction(async (tx) => {
    await tx`
      DELETE FROM user_role_assignment
      WHERE user_id = ${userId}
    `;

    for (const r of input.roles) {
      await tx`
        INSERT INTO user_role_assignment (
          user_id, role, is_tax_specialist, valid_from, valid_until, assigned_by
        ) VALUES (
          ${userId}, ${r.role}, ${r.isTaxSpecialist ?? false},
          ${r.validFrom || sql`CURRENT_DATE`}, ${r.validUntil || null}, ${updatedBy}
        )
      `;
    }
  });

  return getUserById(userId);
}

export async function updateUserStatus(
  userId: string,
  isActive: boolean,
  updatedBy: string
): Promise<{ success: boolean; isActive: boolean }> {
  // Ensure user exists
  await getUserById(userId);

  if (!isActive) {
    // Triggers R64 deactivation cascade
    await deactivateUserAndRevokeDelegations(userId, updatedBy);
  } else {
    await sql`
      UPDATE app_user
      SET is_active = TRUE, updated_at = clock_timestamp()
      WHERE id = ${userId}
    `;
  }

  return { success: true, isActive };
}
