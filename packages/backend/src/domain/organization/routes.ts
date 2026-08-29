import { Hono } from 'hono';
import {
  listBranches,
  getBranchById,
  createBranch,
  updateBranch,
  toggleBranchStatus,
  listDivisions,
  getDivisionById,
  createDivision,
  updateDivision,
  toggleDivisionStatus,
} from './service';
import {
  createBranchSchema,
  updateBranchSchema,
  createDivisionSchema,
  updateDivisionSchema,
  toggleStatusSchema,
} from './types';
import { rbacMiddleware } from '../../middleware/rbac';
import { formatProblemDetails, AppError } from '../sod/errors';

export function createOrganizationApp(): Hono {
  const app = new Hono();

  // ==========================================================================
  // Branch Endpoints
  // ==========================================================================

  // GET /branches (List branches, optional isActive filter)
  app.get('/branches', async (c) => {
    try {
      const isActiveQuery = c.req.query('isActive');
      const search = c.req.query('search');
      const isActive =
        isActiveQuery !== undefined && isActiveQuery !== ''
          ? isActiveQuery === 'true' || isActiveQuery === '1'
          : undefined;

      const branches = await listBranches({ isActive, search });
      return c.json({ success: true, data: branches }, 200);
    } catch (err: unknown) {
      const status = err instanceof AppError ? (err.statusCode as 400 | 401 | 403 | 404 | 409 | 500) : 500;
      return c.json(formatProblemDetails(err, c.req.path), status);
    }
  });

  // GET /branches/:id (Get single branch)
  app.get('/branches/:id', async (c) => {
    try {
      const id = c.req.param('id')!;
      const branch = await getBranchById(id);
      return c.json({ success: true, data: branch }, 200);
    } catch (err: unknown) {
      const status = err instanceof AppError ? (err.statusCode as 400 | 401 | 403 | 404 | 409 | 500) : 404;
      return c.json(formatProblemDetails(err, c.req.path), status);
    }
  });

  // POST /branches (Create branch - Admin only)
  app.post('/branches', rbacMiddleware(['ADMIN']), async (c) => {
    try {
      const adminId = c.get('authUser')?.userId || c.req.header('X-User-Id');
      const body = await c.req.json().catch(() => ({}));
      const validated = createBranchSchema.parse(body);
      const branch = await createBranch(validated, adminId);
      return c.json({ success: true, data: branch }, 201);
    } catch (err: unknown) {
      const status = err instanceof AppError ? (err.statusCode as 400 | 401 | 403 | 404 | 409 | 500) : 400;
      return c.json(formatProblemDetails(err, c.req.path), status);
    }
  });

  // PUT /branches/:id (Update branch - Admin only)
  app.put('/branches/:id', rbacMiddleware(['ADMIN']), async (c) => {
    try {
      const adminId = c.get('authUser')?.userId || c.req.header('X-User-Id');
      const id = c.req.param('id')!;
      const body = await c.req.json().catch(() => ({}));
      const validated = updateBranchSchema.parse(body);
      const branch = await updateBranch(id, validated, adminId);
      return c.json({ success: true, data: branch }, 200);
    } catch (err: unknown) {
      const status = err instanceof AppError ? (err.statusCode as 400 | 401 | 403 | 404 | 409 | 500) : 400;
      return c.json(formatProblemDetails(err, c.req.path), status);
    }
  });

  // PATCH /branches/:id/status (Toggle branch status - Admin only)
  app.patch('/branches/:id/status', rbacMiddleware(['ADMIN']), async (c) => {
    try {
      const adminId = c.get('authUser')?.userId || c.req.header('X-User-Id');
      const id = c.req.param('id')!;
      const body = await c.req.json().catch(() => ({}));
      const validated = toggleStatusSchema.parse(body);
      const branch = await toggleBranchStatus(id, validated.isActive, adminId);
      return c.json({ success: true, data: branch }, 200);
    } catch (err: unknown) {
      const status = err instanceof AppError ? (err.statusCode as 400 | 401 | 403 | 404 | 409 | 500) : 400;
      return c.json(formatProblemDetails(err, c.req.path), status);
    }
  });

  // ==========================================================================
  // Division Endpoints
  // ==========================================================================

  // GET /divisions (List divisions, optional isActive filter)
  app.get('/divisions', async (c) => {
    try {
      const isActiveQuery = c.req.query('isActive');
      const search = c.req.query('search');
      const isActive =
        isActiveQuery !== undefined && isActiveQuery !== ''
          ? isActiveQuery === 'true' || isActiveQuery === '1'
          : undefined;

      const divisions = await listDivisions({ isActive, search });
      return c.json({ success: true, data: divisions }, 200);
    } catch (err: unknown) {
      const status = err instanceof AppError ? (err.statusCode as 400 | 401 | 403 | 404 | 409 | 500) : 500;
      return c.json(formatProblemDetails(err, c.req.path), status);
    }
  });

  // GET /divisions/:id (Get single division)
  app.get('/divisions/:id', async (c) => {
    try {
      const id = c.req.param('id')!;
      const division = await getDivisionById(id);
      return c.json({ success: true, data: division }, 200);
    } catch (err: unknown) {
      const status = err instanceof AppError ? (err.statusCode as 400 | 401 | 403 | 404 | 409 | 500) : 404;
      return c.json(formatProblemDetails(err, c.req.path), status);
    }
  });

  // POST /divisions (Create division - Admin only)
  app.post('/divisions', rbacMiddleware(['ADMIN']), async (c) => {
    try {
      const adminId = c.get('authUser')?.userId || c.req.header('X-User-Id');
      const body = await c.req.json().catch(() => ({}));
      const validated = createDivisionSchema.parse(body);
      const division = await createDivision(validated, adminId);
      return c.json({ success: true, data: division }, 201);
    } catch (err: unknown) {
      const status = err instanceof AppError ? (err.statusCode as 400 | 401 | 403 | 404 | 409 | 500) : 400;
      return c.json(formatProblemDetails(err, c.req.path), status);
    }
  });

  // PUT /divisions/:id (Update division - Admin only)
  app.put('/divisions/:id', rbacMiddleware(['ADMIN']), async (c) => {
    try {
      const adminId = c.get('authUser')?.userId || c.req.header('X-User-Id');
      const id = c.req.param('id')!;
      const body = await c.req.json().catch(() => ({}));
      const validated = updateDivisionSchema.parse(body);
      const division = await updateDivision(id, validated, adminId);
      return c.json({ success: true, data: division }, 200);
    } catch (err: unknown) {
      const status = err instanceof AppError ? (err.statusCode as 400 | 401 | 403 | 404 | 409 | 500) : 400;
      return c.json(formatProblemDetails(err, c.req.path), status);
    }
  });

  // PATCH /divisions/:id/status (Toggle division status - Admin only)
  app.patch('/divisions/:id/status', rbacMiddleware(['ADMIN']), async (c) => {
    try {
      const adminId = c.get('authUser')?.userId || c.req.header('X-User-Id');
      const id = c.req.param('id')!;
      const body = await c.req.json().catch(() => ({}));
      const validated = toggleStatusSchema.parse(body);
      const division = await toggleDivisionStatus(id, validated.isActive, adminId);
      return c.json({ success: true, data: division }, 200);
    } catch (err: unknown) {
      const status = err instanceof AppError ? (err.statusCode as 400 | 401 | 403 | 404 | 409 | 500) : 400;
      return c.json(formatProblemDetails(err, c.req.path), status);
    }
  });

  return app;
}
