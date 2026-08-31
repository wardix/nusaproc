import { Hono } from 'hono';
import {
  submitFeedback,
  listFeedbacks,
  getFeedbackById,
  updateFeedbackStatus,
} from './service';
import { rbacMiddleware } from '../../middleware/rbac';
import { verifyAuthToken } from '../auth/token';
import { formatProblemDetails } from '../sod/errors';
import type { FeedbackCategory, FeedbackStatus } from './types';

export function createFeedbackApp(): Hono {
  const app = new Hono();

  // POST /feedbacks (Submit user feedback/bug report)
  app.post('/feedbacks', async (c) => {
    try {
      let authUser = c.get('authUser');
      if (!authUser) {
        const authHeader = c.req.header('Authorization');
        if (authHeader && authHeader.startsWith('Bearer ')) {
          try {
            authUser = await verifyAuthToken(authHeader.substring(7).trim());
            c.set('authUser', authUser);
          } catch {}
        }
      }
      const userId = authUser?.userId || c.req.header('X-User-Id');
      const body = await c.req.json();
      const feedback = await submitFeedback(body, userId);
      return c.json({ success: true, data: feedback }, 201);
    } catch (err: unknown) {
      return c.json(formatProblemDetails(err, c.req.path), 400);
    }
  });

  // GET /feedbacks (List all feedbacks - Admin only)
  app.get('/feedbacks', rbacMiddleware(['ADMIN']), async (c) => {
    try {
      const category = c.req.query('category') as FeedbackCategory | undefined;
      const status = c.req.query('status') as FeedbackStatus | undefined;
      const search = c.req.query('search');
      const limit = Number(c.req.query('limit')) || 50;
      const offset = Number(c.req.query('offset')) || 0;

      const result = await listFeedbacks({ category, status, search, limit, offset });
      return c.json({ success: true, data: result.items, total: result.total }, 200);
    } catch (err: unknown) {
      return c.json(formatProblemDetails(err, c.req.path), 500);
    }
  });

  // GET /feedbacks/:id (Get single feedback - Admin only)
  app.get('/feedbacks/:id', rbacMiddleware(['ADMIN']), async (c) => {
    try {
      const id = c.req.param('id');
      const feedback = await getFeedbackById(id);
      return c.json({ success: true, data: feedback }, 200);
    } catch (err: unknown) {
      return c.json(formatProblemDetails(err, c.req.path), 404);
    }
  });

  // PATCH /feedbacks/:id (Update feedback status / admin notes - Admin only)
  app.patch('/feedbacks/:id', rbacMiddleware(['ADMIN']), async (c) => {
    try {
      const id = c.req.param('id');
      const body = await c.req.json();
      const feedback = await updateFeedbackStatus(id, body);
      return c.json({ success: true, data: feedback }, 200);
    } catch (err: unknown) {
      return c.json(formatProblemDetails(err, c.req.path), 400);
    }
  });

  return app;
}
