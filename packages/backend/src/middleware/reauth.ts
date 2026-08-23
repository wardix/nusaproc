import type { Context, Next } from 'hono';
import { verifyReauthToken } from '../domain/auth/token';
import { formatProblemDetails, StepUpRequiredError } from '../domain/sod/errors';

/**
 * Layer 5: Step-Up Re-Authentication Middleware for High-Risk Actions (R5, R43)
 */
export function stepUpMiddleware(requiredAction: string) {
  return async (c: Context, next: Next) => {
    const reauthToken = c.req.header('X-Reauth-Token');

    if (!reauthToken) {
      const error = new StepUpRequiredError(
        `Tindakan '${requiredAction}' memerlukan verifikasi ulang kredensial (Step-Up Re-Auth). Sertakan token pada header 'X-Reauth-Token'.`
      );
      return c.json(formatProblemDetails(error, c.req.path), 403);
    }

    try {
      await verifyReauthToken(reauthToken, requiredAction);
      await next();
    } catch (err: unknown) {
      const error = new StepUpRequiredError(
        err instanceof Error ? err.message : 'Verifikasi token step-up re-autentikasi gagal.'
      );
      return c.json(formatProblemDetails(error, c.req.path), 403);
    }
  };
}
