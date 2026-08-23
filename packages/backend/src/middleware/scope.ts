import type { Context, Next } from 'hono';
import {
  validateApprovalScope,
  type ScopeValidationParams,
  type ScopeValidationResult,
} from '../domain/sod/scope';
import { formatProblemDetails, ScopeLimitExceededError } from '../domain/sod/errors';

export type ScopeParamsExtractor = (c: Context) => Promise<ScopeValidationParams> | ScopeValidationParams;

declare module 'hono' {
  interface ContextVariableMap {
    approvalScope: ScopeValidationResult;
  }
}

/**
 * Layer 4: Scope & Delegation Guard Middleware (R4, R13)
 */
export function scopeMiddleware(scopeExtractor: ScopeParamsExtractor) {
  return async (c: Context, next: Next) => {
    try {
      const params = await scopeExtractor(c);
      const result = validateApprovalScope(params);
      c.set('approvalScope', result);
      await next();
    } catch (err: unknown) {
      if (err instanceof ScopeLimitExceededError) {
        return c.json(formatProblemDetails(err, c.req.path), 403);
      }
      return c.json(formatProblemDetails(err, c.req.path), 500);
    }
  };
}
