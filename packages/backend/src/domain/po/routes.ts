import { Hono } from 'hono';
import {
  createVendor,
  createVendorBankAccount,
  verifyBankAccountStage,
} from '../vendor/service';
import {
  createPurchaseOrder,
  approvePurchaseOrder,
  issuePurchaseOrder,
  amendPurchaseOrder,
  generatePoPdf,
  getPurchaseOrderById,
} from './service';
import { formatProblemDetails } from '../sod/errors';

export function createPoAndVendorApp(): Hono {
  const app = new Hono();

  // 1. Create Vendor
  app.post('/vendors', async (c) => {
    const userId = c.get('authUser')?.userId || c.req.header('X-User-Id');
    if (!userId) {
      return c.json(formatProblemDetails(new Error('User ID diperlukan'), c.req.path), 401);
    }

    try {
      const body = await c.req.json();
      const vendor = await createVendor({
        ...body,
        createdBy: userId,
      });
      return c.json({ success: true, data: vendor }, 201);
    } catch (err: unknown) {
      return c.json(formatProblemDetails(err, c.req.path), 400);
    }
  });

  // 2. Create Vendor Bank Account
  app.post('/vendors/:id/bank-accounts', async (c) => {
    const vendorId = c.req.param('id');
    try {
      const body = await c.req.json();
      const bankAccount = await createVendorBankAccount({
        ...body,
        vendorId,
      });
      return c.json({ success: true, data: bankAccount }, 201);
    } catch (err: unknown) {
      return c.json(formatProblemDetails(err, c.req.path), 400);
    }
  });

  // 3. Verify Bank Account Stage 1 / Stage 2
  app.post('/vendors/:vendorId/bank-accounts/:bankId/verify', async (c) => {
    const bankAccountId = c.req.param('bankId');
    const userId = c.get('authUser')?.userId || c.req.header('X-User-Id');

    if (!userId) {
      return c.json(formatProblemDetails(new Error('User ID diperlukan untuk verifikasi'), c.req.path), 401);
    }

    try {
      const body = await c.req.json();
      const account = await verifyBankAccountStage({
        bankAccountId,
        verifierUserId: userId,
        action: body.action,
        rejectionReason: body.rejectionReason,
      });
      return c.json({ success: true, data: account });
    } catch (err: unknown) {
      return c.json(formatProblemDetails(err, c.req.path), 400);
    }
  });

  // 4. Create Purchase Order
  app.post('/purchase-orders', async (c) => {
    const userId = c.get('authUser')?.userId || c.req.header('X-User-Id');
    if (!userId) {
      return c.json(formatProblemDetails(new Error('User ID diperlukan'), c.req.path), 401);
    }

    try {
      const body = await c.req.json();
      const po = await createPurchaseOrder({
        ...body,
        createdBy: userId,
      });
      return c.json({ success: true, data: po }, 201);
    } catch (err: unknown) {
      return c.json(formatProblemDetails(err, c.req.path), 400);
    }
  });

  // 5. List Purchase Orders
  app.get('/purchase-orders', async (c) => {
    const status = c.req.query('status');
    try {
      const pos = await listPurchaseOrders({ status });
      return c.json({ success: true, data: pos });
    } catch (err: unknown) {
      return c.json(formatProblemDetails(err, c.req.path), 400);
    }
  });

  // 6. Get Purchase Order Details
  app.get('/purchase-orders/:id', async (c) => {
    const poId = c.req.param('id');
    try {
      const po = await getPurchaseOrderById(poId);
      return c.json({ success: true, data: po });
    } catch (err: unknown) {
      return c.json(formatProblemDetails(err, c.req.path), 404);
    }
  });

  // 6. Approve Purchase Order
  app.post('/purchase-orders/:id/approve', async (c) => {
    const poId = c.req.param('id');
    const userId = c.get('authUser')?.userId || c.req.header('X-User-Id');

    if (!userId) {
      return c.json(formatProblemDetails(new Error('User ID diperlukan'), c.req.path), 401);
    }

    try {
      const po = await approvePurchaseOrder(poId, userId);
      return c.json({ success: true, data: po });
    } catch (err: unknown) {
      return c.json(formatProblemDetails(err, c.req.path), 400);
    }
  });

  // 7. Issue Purchase Order
  app.post('/purchase-orders/:id/issue', async (c) => {
    const poId = c.req.param('id');
    const userId = c.get('authUser')?.userId || c.req.header('X-User-Id');

    if (!userId) {
      return c.json(formatProblemDetails(new Error('User ID diperlukan'), c.req.path), 401);
    }

    try {
      const po = await issuePurchaseOrder(poId, userId);
      return c.json({ success: true, data: po });
    } catch (err: unknown) {
      return c.json(formatProblemDetails(err, c.req.path), 400);
    }
  });

  // 8. Amend Purchase Order
  app.post('/purchase-orders/:id/amend', async (c) => {
    const poId = c.req.param('id');
    const userId = c.get('authUser')?.userId || c.req.header('X-User-Id');

    if (!userId) {
      return c.json(formatProblemDetails(new Error('User ID diperlukan'), c.req.path), 401);
    }

    try {
      const body = await c.req.json();
      const amendment = await amendPurchaseOrder({
        poId,
        authorizedById: userId,
        reason: body.reason,
        updatedTermsAndConditions: body.updatedTermsAndConditions,
      });
      return c.json({ success: true, data: amendment });
    } catch (err: unknown) {
      return c.json(formatProblemDetails(err, c.req.path), 400);
    }
  });

  // 9. Download PO PDF
  app.get('/purchase-orders/:id/pdf', async (c) => {
    const poId = c.req.param('id');
    try {
      const pdfBytes = await generatePoPdf(poId);
      return c.body(pdfBytes.buffer as ArrayBuffer, 200, {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="PO-${poId}.pdf"`,
      });
    } catch (err: unknown) {
      return c.json(formatProblemDetails(err, c.req.path), 404);
    }
  });

  return app;
}
