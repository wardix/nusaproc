import type { Context, Next } from 'hono';
import {
  validateSodAction,
  type ActionType,
  type TransactionActors,
} from '../domain/sod/validator';
import { formatProblemDetails, SodConflictError } from '../domain/sod/errors';

export type ActorExtractor = (c: Context) => Promise<TransactionActors> | TransactionActors;

/**
 * Layer 3: Separation of Duties (SoD) Interceptor Middleware (R15, R25, R31, R42)
 */
export function sodMiddleware(action: ActionType, actorExtractor: ActorExtractor) {
  return async (c: Context, next: Next) => {
    const authUser = c.get('authUser');
    const headerUserId = c.req.header('X-User-Id');
    const currentUserId = authUser?.userId || headerUserId;

    if (!currentUserId) {
      return c.json(
        formatProblemDetails(new Error('User context tidak ditemukan untuk validasi SoD'), c.req.path),
        403
      );
    }

    try {
      const actors = await actorExtractor(c);
      validateSodAction(currentUserId, action, actors);
      await next();
    } catch (err: unknown) {
      if (err instanceof SodConflictError) {
        return c.json(formatProblemDetails(err, c.req.path), 403);
      }
      return c.json(formatProblemDetails(err, c.req.path), 500);
    }
  };
}
