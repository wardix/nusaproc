import type { Context, Next } from 'hono';
import type { AppRole } from '@nusaproc/shared';
import { sql } from '../db/client';
import { verifyAuthToken } from '../domain/auth/token';
import { formatProblemDetails, ForbiddenError } from '../domain/sod/errors';

/**
 * Layer 2: RBAC Role Verification Middleware (R2, R3)
 */
export function rbacMiddleware(allowedRoles: AppRole[]) {
  return async (c: Context, next: Next) => {
    // 1. If authUser is not set in context, try to parse Bearer token from Authorization header
    let authUser = c.get('authUser');
    if (!authUser) {
      const authHeader = c.req.header('Authorization');
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7).trim();
        try {
          authUser = await verifyAuthToken(token);
          c.set('authUser', authUser);
        } catch {
          // Token invalid or expired; proceed to fallback check
        }
      }
    }

    const headerRole = c.req.header('X-User-Role') as AppRole | undefined;
    const currentUserId = authUser?.userId || c.req.header('X-User-Id');

    // Priority 1: Check header role (e.g. switched in frontend) or active token role
    const currentRole = headerRole || authUser?.activeRole;
    if (currentRole && allowedRoles.includes(currentRole)) {
      if (authUser && headerRole) {
        authUser.activeRole = headerRole;
      }
      return await next();
    }

    // Priority 2: If activeRole doesn't match directly, check if user has ANY of the allowedRoles assigned in DB
    if (currentUserId) {
      const userRoles = await sql`
        SELECT role FROM user_role_assignment
        WHERE user_id = ${currentUserId}
          AND (valid_until IS NULL OR valid_until >= CURRENT_DATE)
          AND valid_from <= CURRENT_DATE
      `;
      const assignedRoles = userRoles.map((r: { role: AppRole }) => r.role);
      const matchingRole = allowedRoles.find((r) => assignedRoles.includes(r));

      if (matchingRole) {
        if (authUser) {
          authUser.activeRole = headerRole && assignedRoles.includes(headerRole) ? headerRole : matchingRole;
        }
        return await next();
      }
    }

    const error = new ForbiddenError(
      `Akses ditolak. Peran saat ini (${currentRole || 'Anonim'}) tidak memiliki izin. Diperlukan salah satu dari: ${allowedRoles.join(', ')}`
    );
    return c.json(formatProblemDetails(error, c.req.path), 403);
  };
}
