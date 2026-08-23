import type { Context, Next } from 'hono';
import { verifyAuthToken, type AuthTokenPayload } from '../domain/auth/token';
import { formatProblemDetails, UnauthorizedError } from '../domain/sod/errors';

declare module 'hono' {
  interface ContextVariableMap {
    authUser: AuthTokenPayload;
  }
}

/**
 * Layer 1: JWT & Session Authentication Middleware
 */
export function authMiddleware() {
  return async (c: Context, next: Next) => {
    const authHeader = c.req.header('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      const error = new UnauthorizedError('Header Authorization dengan format Bearer token diperlukan');
      return c.json(formatProblemDetails(error, c.req.path), 401);
    }

    const token = authHeader.substring(7).trim();
    try {
      const payload = await verifyAuthToken(token);
      c.set('authUser', payload);
      await next();
    } catch (err) {
      return c.json(formatProblemDetails(err, c.req.path), 401);
    }
  };
}
