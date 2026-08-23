import { Hono } from 'hono';
import { config } from './config';
import { createPrApp } from './domain/pr/routes';
import { createPoAndVendorApp } from './domain/po/routes';
import { createReceiptApp } from './domain/receipt/routes';
import { createInvoiceApp } from './domain/invoice/routes';
import { createPaymentApp } from './domain/payment/routes';
import { createAuditApp } from './domain/audit/routes';
import { auditorSandboxMiddleware } from './middleware/auditor_sandbox';

export function createApp(): Hono {
  const app = new Hono();

  app.get('/health', (c) => {
    return c.json({
      status: 'ok',
      service: 'nusaproc-backend',
      timestamp: new Date().toISOString(),
    });
  });

  const apiV1 = new Hono();
  apiV1.use('*', auditorSandboxMiddleware());
  apiV1.route('/', createPrApp());
  apiV1.route('/', createPoAndVendorApp());
  apiV1.route('/', createReceiptApp());
  apiV1.route('/', createInvoiceApp());
  apiV1.route('/', createPaymentApp());
  apiV1.route('/', createAuditApp());

  app.route('/api/v1', apiV1);
  return app;
}

export const app = createApp();

export default {
  port: config.port,
  fetch: app.fetch,
};
