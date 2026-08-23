import type { MiddlewareHandler } from 'hono';

export function auditorSandboxMiddleware(): MiddlewareHandler {
  return async (c, next) => {
    const role = c.req.header('X-User-Role');

    if (role === 'AUDITOR') {
      const method = c.req.method.toUpperCase();

      // Read-Only sandbox allows GET/HEAD/OPTIONS only
      if (!['GET', 'HEAD', 'OPTIONS'].includes(method)) {
        return c.json(
          {
            type: 'https://nusaproc.nusanet.net.id/errors/R54_AUDITOR_READ_ONLY',
            title: 'Method Not Allowed',
            status: 405,
            detail: 'Role AUDITOR hanya diperkenankan mengakses operasi baca (Read-Only) dalam sandbox (R54). Operasi mutasi data diblokir.',
            instance: c.req.path,
          },
          405
        );
      }
    }

    await next();
  };
}
