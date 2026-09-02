import { Hono } from 'hono';
import {
  createPurchaseRequest,
  submitPurchaseRequest,
  decideApprovalStep,
  updatePurchaseRequest,
  closePartialPurchaseRequest,
  getPurchaseRequestById,
  listMasterUoms,
} from './service';
import { PrRepository } from './repository';
import { formatProblemDetails } from '../sod/errors';

export function createPrApp(): Hono {
  const app = new Hono();

  // Create PR (Requester)
  app.post('/purchase-requests', async (c) => {
    const userId = c.get('authUser')?.userId || c.req.header('X-User-Id');
    if (!userId) {
      return c.json(formatProblemDetails(new Error('User ID diperlukan'), c.req.path), 401);
    }

    try {
      const body = await c.req.json();
      const pr = await createPurchaseRequest({
        ...body,
        requesterId: userId,
      });

      return c.json({ success: true, data: pr }, 201);
    } catch (err: unknown) {
      return c.json(formatProblemDetails(err, c.req.path), 400);
    }
  });

  // Get PR by ID
  app.get('/purchase-requests/:id', async (c) => {
    const prId = c.req.param('id');
    try {
      const pr = await getPurchaseRequestById(prId);
      return c.json({ success: true, data: pr });
    } catch (err: unknown) {
      return c.json(formatProblemDetails(err, c.req.path), 404);
    }
  });

  // Submit PR (Requester)
  app.post('/purchase-requests/:id/submit', async (c) => {
    const prId = c.req.param('id');
    const userId = c.get('authUser')?.userId || c.req.header('X-User-Id');

    if (!userId) {
      return c.json(formatProblemDetails(new Error('User ID diperlukan'), c.req.path), 401);
    }

    try {
      const pr = await submitPurchaseRequest(prId, userId);
      return c.json({ success: true, data: pr });
    } catch (err: unknown) {
      return c.json(formatProblemDetails(err, c.req.path), 400);
    }
  });

  // Decide Approval Step (Approver)
  app.post('/purchase-requests/:id/decide', async (c) => {
    const prId = c.req.param('id');
    const userId = c.get('authUser')?.userId || c.req.header('X-User-Id');

    if (!userId) {
      return c.json(formatProblemDetails(new Error('User ID diperlukan'), c.req.path), 401);
    }

    try {
      const body = await c.req.json();
      const pr = await decideApprovalStep({
        prId,
        approverId: userId,
        decision: body.decision,
        rejectionReason: body.rejectionReason,
        approverMaxLimit: body.approverMaxLimit,
        approverDivisionId: body.approverDivisionId,
      });

      return c.json({ success: true, data: pr });
    } catch (err: unknown) {
      const problem = formatProblemDetails(err, c.req.path);
      return c.json(problem, (problem.status as any) || 400);
    }
  });

  // Close Partial (R11)
  app.post('/purchase-requests/:id/close-partial', async (c) => {
    const prId = c.req.param('id');
    const userId = c.get('authUser')?.userId || c.req.header('X-User-Id');

    if (!userId) {
      return c.json(formatProblemDetails(new Error('User ID diperlukan'), c.req.path), 401);
    }

    try {
      const body = await c.req.json();
      const pr = await closePartialPurchaseRequest(prId, userId, body.reason || '');
      return c.json({ success: true, data: pr });
    } catch (err: unknown) {
      return c.json(formatProblemDetails(err, c.req.path), 400);
    }
  });

  // Update PR Draft
  app.patch('/purchase-requests/:id', async (c) => {
    const prId = c.req.param('id');
    try {
      const body = await c.req.json();
      const pr = await updatePurchaseRequest(prId, body);
      return c.json({ success: true, data: pr });
    } catch (err: unknown) {
      return c.json(formatProblemDetails(err, c.req.path), 400);
    }
  });

  // List PRs
  app.get('/purchase-requests', async (c) => {
    const requesterId = c.req.query('requesterId');
    const status = c.req.query('status');
    const limit = Number(c.req.query('limit')) || 50;
    const offset = Number(c.req.query('offset')) || 0;

    const repo = new PrRepository();
    const prs = await repo.list({ requesterId, status, limit, offset });
    return c.json({ success: true, data: prs });
  });

  // GET /uoms (List active units of measure with optional search)
  app.get('/uoms', async (c) => {
    try {
      const search = c.req.query('search');
      const isActiveParam = c.req.query('isActive');
      const isActive = isActiveParam !== undefined ? isActiveParam === 'true' : true;
      const uoms = await listMasterUoms({ search, isActive });
      return c.json({ success: true, data: uoms }, 200);
    } catch (err: unknown) {
      return c.json(formatProblemDetails(err, c.req.path), 500);
    }
  });

  return app;
}
