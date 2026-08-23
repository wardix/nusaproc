import { Hono } from 'hono';
import { config } from './config';

const app = new Hono();

app.get('/health', (c) => {
  return c.json({
    status: 'ok',
    service: 'nusaproc-backend',
    timestamp: new Date().toISOString(),
  });
});

export default {
  port: config.port,
  fetch: app.fetch,
};
