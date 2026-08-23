import { Hono } from 'hono';
import {
  proposePayment,
  checkPaymentProposal,
  executePaymentTransfer,
  getPaymentProposalById,
  listPaymentProposals,
} from './service';
import { formatProblemDetails } from '../sod/errors';

export function createPaymentApp(): Hono {
  const app = new Hono();

  // 1. Propose Payment (Maker)
  app.post('/payments/proposals', async (c) => {
    const userId = c.req.header('X-User-Id');
    if (!userId) {
      return c.json({ title: 'Unauthorized', status: 401, detail: 'Header X-User-Id wajib disertakan.' }, 401);
    }

    try {
      const body = await c.req.json();
      const proposal = await proposePayment({
        ...body,
        proposedBy: body.proposedBy || userId,
      });

      return c.json({ success: true, data: proposal }, 201);
    } catch (err: unknown) {
      return c.json(formatProblemDetails(err, c.req.path), 400);
    }
  });

  // 2. Get Payment Proposal by ID
  app.get('/payments/proposals/:id', async (c) => {
    const id = c.req.param('id');
    try {
      const proposal = await getPaymentProposalById(id);
      return c.json({ success: true, data: proposal });
    } catch (err: unknown) {
      return c.json(formatProblemDetails(err, c.req.path), 404);
    }
  });

  // 3. List Payment Proposals
  app.get('/payments/proposals', async (c) => {
    const vendorId = c.req.query('vendorId');
    const status = c.req.query('status');
    try {
      const list = await listPaymentProposals({ vendorId, status });
      return c.json({ success: true, data: list });
    } catch (err: unknown) {
      return c.json(formatProblemDetails(err, c.req.path), 400);
    }
  });

  // 4. Check Payment Proposal (Checker)
  app.post('/payments/proposals/:id/check', async (c) => {
    const id = c.req.param('id');
    const userId = c.req.header('X-User-Id');
    if (!userId) {
      return c.json({ title: 'Unauthorized', status: 401, detail: 'Header X-User-Id wajib disertakan.' }, 401);
    }

    try {
      const proposal = await checkPaymentProposal({
        proposalId: id,
        checkedBy: userId,
      });

      return c.json({ success: true, data: proposal });
    } catch (err: unknown) {
      return c.json(formatProblemDetails(err, c.req.path), 400);
    }
  });

  // 5. Execute Payment Transfer (Executor)
  app.post('/payments/proposals/:id/execute', async (c) => {
    const id = c.req.param('id');
    const userId = c.req.header('X-User-Id');
    const reauthToken = c.req.header('X-Reauth-Token');
    const idempotencyKey = c.req.header('Idempotency-Key');

    if (!userId) {
      return c.json({ title: 'Unauthorized', status: 401, detail: 'Header X-User-Id wajib disertakan.' }, 401);
    }
    if (!reauthToken) {
      return c.json({ title: 'Step-Up Re-Authentication Required', status: 403, detail: 'Header X-Reauth-Token wajib disertakan.' }, 403);
    }

    try {
      const body = await c.req.json().catch(() => ({}));
      const proposal = await executePaymentTransfer({
        proposalId: id,
        executedBy: userId,
        reauthToken,
        idempotencyKey,
        bankReferenceNumber: body.bankReferenceNumber,
        executionReceiptFileId: body.executionReceiptFileId,
      });

      return c.json({ success: true, data: proposal });
    } catch (err: unknown) {
      return c.json(formatProblemDetails(err, c.req.path), 400);
    }
  });

  return app;
}
