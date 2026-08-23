import { Hono } from 'hono';
import { config } from './config';
import { createPrApp } from './domain/pr/routes';
import { createPoAndVendorApp } from './domain/po/routes';
import { createReceiptApp } from './domain/receipt/routes';

const app = new Hono();

app.get('/health', (c) => {
  return c.json({
    status: 'ok',
    service: 'nusaproc-backend',
    timestamp: new Date().toISOString(),
  });
});

const apiV1 = new Hono();
apiV1.route('/', createPrApp());
apiV1.route('/', createPoAndVendorApp());
apiV1.route('/', createReceiptApp());

app.route('/api/v1', apiV1);

export default {
  port: config.port,
  fetch: app.fetch,
};
