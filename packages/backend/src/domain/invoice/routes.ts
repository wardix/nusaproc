import { Hono } from 'hono';
import {
  createInvoice,
  getInvoiceById,
  listInvoices,
  runTwoWayMatching,
  overrideMatchingException,
} from './service';
import { InvoiceRepository } from './repository';
import { formatProblemDetails } from '../sod/errors';

export function createInvoiceApp(): Hono {
  const app = new Hono();

  // 1. Create Invoice
  app.post('/invoices', async (c) => {
    const userId = c.req.header('X-User-Id');
    if (!userId) {
      return c.json({ title: 'Unauthorized', status: 401, detail: 'Header X-User-Id wajib disertakan.' }, 401);
    }

    try {
      const body = await c.req.json();
      const invoice = await createInvoice({
        ...body,
        uploadedBy: body.uploadedBy || userId,
      });

      return c.json({ success: true, data: invoice }, 201);
    } catch (err: unknown) {
      return c.json(formatProblemDetails(err, c.req.path), 400);
    }
  });

  // 2. Get Invoice by ID
  app.get('/invoices/:id', async (c) => {
    const id = c.req.param('id');
    try {
      const invoice = await getInvoiceById(id);
      return c.json({ success: true, data: invoice });
    } catch (err: unknown) {
      return c.json(formatProblemDetails(err, c.req.path), 404);
    }
  });

  // 3. List Invoices
  app.get('/invoices', async (c) => {
    const vendorId = c.req.query('vendorId');
    const poId = c.req.query('poId');
    const matchStatus = c.req.query('matchStatus');
    try {
      const list = await listInvoices({ vendorId, poId, matchStatus });
      return c.json({ success: true, data: list });
    } catch (err: unknown) {
      return c.json(formatProblemDetails(err, c.req.path), 400);
    }
  });

  // 4. Run 2-Way Matching Engine
  app.post('/invoices/:id/match', async (c) => {
    const id = c.req.param('id');
    try {
      const result = await runTwoWayMatching(id);
      return c.json({ success: true, data: result });
    } catch (err: unknown) {
      return c.json(formatProblemDetails(err, c.req.path), 400);
    }
  });

  // 5. Override Matching Exception by Head of AP
  app.post('/invoices/:id/override', async (c) => {
    const id = c.req.param('id');
    const userId = c.req.header('X-User-Id');
    if (!userId) {
      return c.json({ title: 'Unauthorized', status: 401, detail: 'Header X-User-Id wajib disertakan.' }, 401);
    }

    try {
      const body = await c.req.json();
      const invoice = await overrideMatchingException({
        invoiceId: id,
        userId,
        overrideReason: body.overrideReason,
      });

      return c.json({ success: true, data: invoice });
    } catch (err: unknown) {
      return c.json(formatProblemDetails(err, c.req.path), 400);
    }
  });

  // 6. Get Matching Exceptions for Invoice
  app.get('/invoices/:id/exceptions', async (c) => {
    const id = c.req.param('id');
    const repo = new InvoiceRepository();
    try {
      const exceptions = await repo.findMatchingExceptionsByInvoiceId(id);
      return c.json({ success: true, data: exceptions });
    } catch (err: unknown) {
      return c.json(formatProblemDetails(err, c.req.path), 400);
    }
  });

  return app;
}
