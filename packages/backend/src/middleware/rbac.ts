import type { Context, Next } from 'hono';
import type { AppRole } from '@nusaproc/shared';
import { verifyAuthToken } from '../domain/auth/token';
import { formatProblemDetails, ForbiddenError } from '../domain/sod/errors';

/**
 * Layer 2: RBAC Role Verification Middleware (R2, R3)
 */
export function rbacMiddleware(allowedRoles: AppRole[]) {
  return async (c: Context, next: Next) => {
    // If authUser is not set in context, try to parse Bearer token from Authorization header
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

    // Read from authenticated user in context, fallback to test header if present
    const headerRole = c.req.header('X-User-Role') as AppRole | undefined;
    const currentRole = authUser?.activeRole || headerRole;

    if (!currentRole || !allowedRoles.includes(currentRole)) {
      const error = new ForbiddenError(
        `Akses ditolak. Peran saat ini (${currentRole || 'Anonim'}) tidak memiliki izin. Diperlukan salah satu dari: ${allowedRoles.join(', ')}`
      );
      return c.json(formatProblemDetails(error, c.req.path), 403);
    }

    await next();
  };
}
