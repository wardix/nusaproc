import { Hono } from 'hono';
import { z } from 'zod';
import { generateAuthToken, generateReauthToken } from './token';
import {
  loginWithLocalPassword,
  loginWithGoogleSso,
  listUsers,
  getUserById,
  createUser,
  updateUserRoles,
  updateUserStatus,
} from './service';
import {
  loginSchema,
  googleAuthSchema,
  createUserSchema,
  updateUserRolesSchema,
  updateUserStatusSchema,
} from './types';
import { rbacMiddleware } from '../../middleware/rbac';
import { formatProblemDetails, AppError } from '../sod/errors';
import { DEMO_PERSONAS, type AppRole } from '@nusaproc/shared';

const stepUpSchema = z.object({
  action: z.string().min(1),
  password: z.string().optional(),
  totpCode: z.string().optional(),
});

const switchRoleSchema = z.object({
  role: z.enum([
    'REQUESTER',
    'APPROVER',
    'ACCOUNT_PAYABLE',
    'WAREHOUSE',
    'FINANCE',
    'AUDITOR',
    'ADMIN',
  ] as const),
});

export function createAuthApp(): Hono {
  const app = new Hono();

  // ============================================================================
  // 1. HYBRID AUTHENTICATION ENDPOINTS (R1, R2)
  // ============================================================================

  // POST /auth/login (Local Email & Password Login)
  app.post('/auth/login', async (c) => {
    try {
      const body = await c.req.json().catch(() => ({}));
      const validated = loginSchema.parse(body);
      const result = await loginWithLocalPassword(validated);
      return c.json({ success: true, data: result }, 200);
    } catch (err) {
      const status = err instanceof AppError ? (err.statusCode as 400 | 401 | 403 | 404 | 409 | 500) : 400;
      return c.json(formatProblemDetails(err, c.req.path), status);
    }
  });

  // POST /auth/google (Google Workspace SSO with JIT Provisioning)
  app.post('/auth/google', async (c) => {
    try {
      const body = await c.req.json().catch(() => ({}));
      const validated = googleAuthSchema.parse(body);
      const result = await loginWithGoogleSso(validated);
      return c.json({ success: true, data: result }, 200);
    } catch (err) {
      const status = err instanceof AppError ? (err.statusCode as 400 | 401 | 403 | 404 | 409 | 500) : 400;
      return c.json(formatProblemDetails(err, c.req.path), status);
    }
  });

  // POST /auth/step-up-token (R5)
  app.post('/auth/step-up-token', async (c) => {
    try {
      const userId = c.req.header('X-User-Id') || '10000000-0000-0000-0000-000000000006';
      const body = await c.req.json().catch(() => ({}));
      const validated = stepUpSchema.parse(body);

      const token = await generateReauthToken({
        userId,
        action: validated.action,
        expiresInSeconds: 300,
      });

      return c.json({
        success: true,
        data: {
          token,
          action: validated.action,
          expiresInSeconds: 300,
        },
      });
    } catch (err) {
      return c.json(formatProblemDetails(err, c.req.path), 400);
    }
  });

  // POST /auth/switch-role (US14)
  app.post('/auth/switch-role', async (c) => {
    try {
      let authUser = c.get('authUser');
      if (!authUser) {
        const authHeader = c.req.header('Authorization');
        if (authHeader && authHeader.startsWith('Bearer ')) {
          try {
            authUser = await verifyAuthToken(authHeader.substring(7).trim());
          } catch {}
        }
      }
      const userId = authUser?.userId || c.req.header('X-User-Id');
      if (!userId) {
        throw new UnauthorizedError('Sesi autentikasi diperlukan untuk beralih peran');
      }

      const body = await c.req.json().catch(() => ({}));
      const validated = switchRoleSchema.parse(body);

      const user = await getUserById(userId);
      const hasRole = user.roles.some((r) => r.role === validated.role);
      if (!hasRole) {
        throw new ForbiddenError(`Pengguna tidak memiliki peran ${validated.role}`);
      }

      const token = await generateAuthToken({
        userId: user.id,
        email: user.email,
        activeRole: validated.role as AppRole,
        divisionId: user.divisionId,
        branchId: user.branchId,
      });

      return c.json({
        success: true,
        data: {
          token,
          activeRole: validated.role,
        },
      });
    } catch (err) {
      const status = err instanceof AppError ? (err.statusCode as 400 | 401 | 403 | 404 | 409 | 500) : 400;
      return c.json(formatProblemDetails(err, c.req.path), status);
    }
  });

  // ============================================================================
  // 2. ADMIN USER & ROLE MANAGEMENT ENDPOINTS (US12, R1, R2, R3)
  // Protected strictly by Layer 2 RBAC (ADMIN role only)
  // ============================================================================

  // GET /users (List all users with pagination and filters)
  app.get('/users', rbacMiddleware(['ADMIN']), async (c) => {
    try {
      const query = c.req.query();
      const isActiveParam = query.isActive !== undefined ? query.isActive === 'true' : undefined;
      const limit = query.limit ? Number(query.limit) : undefined;
      const offset = query.offset ? Number(query.offset) : undefined;

      const result = await listUsers({
        search: query.search,
        divisionId: query.divisionId,
        branchId: query.branchId,
        role: query.role,
        isActive: isActiveParam,
        limit,
        offset,
      });

      return c.json({ success: true, ...result }, 200);
    } catch (err) {
      const status = err instanceof AppError ? (err.statusCode as 400 | 401 | 403 | 404 | 409 | 500) : 500;
      return c.json(formatProblemDetails(err, c.req.path), status);
    }
  });

  // GET /users/:id (Get single user detail)
  app.get('/users/:id', rbacMiddleware(['ADMIN']), async (c) => {
    try {
      const id = c.req.param('id')!;
      const user = await getUserById(id);
      return c.json({ success: true, data: user }, 200);
    } catch (err) {
      const status = err instanceof AppError ? (err.statusCode as 400 | 401 | 403 | 404 | 409 | 500) : 404;
      return c.json(formatProblemDetails(err, c.req.path), status);
    }
  });

  // POST /users (Create new user with atomic role assignments)
  app.post('/users', rbacMiddleware(['ADMIN']), async (c) => {
    try {
      const adminId = c.get('authUser')?.userId || c.req.header('X-User-Id');
      const body = await c.req.json().catch(() => ({}));
      const validated = createUserSchema.parse(body);
      const user = await createUser(validated, adminId);
      return c.json({ success: true, data: user }, 201);
    } catch (err) {
      const status = err instanceof AppError ? (err.statusCode as 400 | 401 | 403 | 404 | 409 | 500) : 400;
      return c.json(formatProblemDetails(err, c.req.path), status);
    }
  });

  // PATCH /users/:id/roles (Update user assigned roles)
  app.patch('/users/:id/roles', rbacMiddleware(['ADMIN']), async (c) => {
    try {
      const adminId = c.get('authUser')?.userId || c.req.header('X-User-Id');
      const id = c.req.param('id')!;
      const body = await c.req.json().catch(() => ({}));
      const validated = updateUserRolesSchema.parse(body);
      const user = await updateUserRoles(id, validated, adminId);
      return c.json({ success: true, data: user }, 200);
    } catch (err) {
      const status = err instanceof AppError ? (err.statusCode as 400 | 401 | 403 | 404 | 409 | 500) : 400;
      return c.json(formatProblemDetails(err, c.req.path), status);
    }
  });

  // PATCH /users/:id/status (Toggle user active status with R64 delegation revocation)
  app.patch('/users/:id/status', rbacMiddleware(['ADMIN']), async (c) => {
    try {
      const adminId = c.get('authUser')?.userId || c.req.header('X-User-Id');
      const id = c.req.param('id')!;
      const body = await c.req.json().catch(() => ({}));
      const validated = updateUserStatusSchema.parse(body);
      const result = await updateUserStatus(id, validated.isActive, adminId);
      return c.json({ success: true, data: result }, 200);
    } catch (err) {
      const status = err instanceof AppError ? (err.statusCode as 400 | 401 | 403 | 404 | 409 | 500) : 400;
      return c.json(formatProblemDetails(err, c.req.path), status);
    }
  });

  return app;
}
