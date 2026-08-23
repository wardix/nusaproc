import { Hono } from 'hono';
import {
  recordGoodsReceipt,
  getGoodsReceiptById,
  listGoodsReceipts,
  listNcrs,
} from './service';
import { formatProblemDetails } from '../sod/errors';

export function createReceiptApp(): Hono {
  const app = new Hono();

  // 1. Record Goods Receipt (BAST) with optional simultaneous invoice
  app.post('/receipts', async (c) => {
    const userId = c.req.header('X-User-Id');
    if (!userId) {
      return c.json({ title: 'Unauthorized', status: 401, detail: 'Header X-User-Id wajib disertakan.' }, 401);
    }

    try {
      const body = await c.req.json();
      const receipt = await recordGoodsReceipt({
        ...body,
        receivedBy: body.receivedBy || userId,
      });

      return c.json({ success: true, data: receipt }, 201);
    } catch (err: unknown) {
      return c.json(formatProblemDetails(err, c.req.path), 400);
    }
  });

  // 2. Get Goods Receipt by ID
  app.get('/receipts/:id', async (c) => {
    const id = c.req.param('id');
    try {
      const receipt = await getGoodsReceiptById(id);
      return c.json({ success: true, data: receipt });
    } catch (err: unknown) {
      return c.json(formatProblemDetails(err, c.req.path), 404);
    }
  });

  // 3. List Goods Receipts
  app.get('/receipts', async (c) => {
    const poId = c.req.query('poId');
    try {
      const list = await listGoodsReceipts({ poId });
      return c.json({ success: true, data: list });
    } catch (err: unknown) {
      return c.json(formatProblemDetails(err, c.req.path), 400);
    }
  });

  // 4. List Non-Conformance Reports (NCR)
  app.get('/ncrs', async (c) => {
    const poId = c.req.query('poId');
    const isResolved = c.req.query('isResolved') !== undefined ? c.req.query('isResolved') === 'true' : undefined;
    try {
      const ncrs = await listNcrs({ poId, isResolved });
      return c.json({ success: true, data: ncrs });
    } catch (err: unknown) {
      return c.json(formatProblemDetails(err, c.req.path), 400);
    }
  });

  return app;
}
