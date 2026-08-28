import { Hono } from 'hono';
import { config } from './config';
import { createAuthApp } from './domain/auth/routes';
import { createPrApp } from './domain/pr/routes';
import { createPoAndVendorApp } from './domain/po/routes';
import { createReceiptApp } from './domain/receipt/routes';
import { createInvoiceApp } from './domain/invoice/routes';
import { createPaymentApp } from './domain/payment/routes';
import { createAuditApp } from './domain/audit/routes';
import { createOrganizationApp } from './domain/organization/routes';
import { createDocsApp } from './docs/swaggerUi';
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

  // Interactive OpenAPI & Swagger UI Documentation (Epic 16)
  app.route('/api/docs', createDocsApp());
  app.get('/docs', (c) => c.redirect('/api/docs'));

  const apiV1 = new Hono();
  apiV1.use('*', auditorSandboxMiddleware());
  apiV1.route('/', createAuthApp());
  apiV1.route('/', createPrApp());
  apiV1.route('/', createPoAndVendorApp());
  apiV1.route('/', createReceiptApp());
  apiV1.route('/', createInvoiceApp());
  apiV1.route('/', createPaymentApp());
  apiV1.route('/', createAuditApp());
  apiV1.route('/', createOrganizationApp());

  app.route('/api/v1', apiV1);
  return app;
}

export const app = createApp();

export default {
  port: config.port,
  fetch: app.fetch,
};
