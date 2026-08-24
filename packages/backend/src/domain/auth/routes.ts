import { Hono } from 'hono';
import { z } from 'zod';
import { generateAuthToken, generateReauthToken } from './token';
import { DEMO_PERSONAS, type AppRole } from '@nusaproc/shared';

const stepUpSchema = z.object({
  action: z.string().min(1),
  password: z.string().optional(),
  totpCode: z.string().optional(),
});

const switchRoleSchema = z.object({
  role: z.enum([
    'REQUESTER',
    'APPROVER',
    'ACCOUNT_PAYABLE',
    'WAREHOUSE',
    'FINANCE',
    'AUDITOR',
    'ADMIN',
  ] as const),
});

export function createAuthApp(): Hono {
  const app = new Hono();

  // POST /auth/step-up-token (R5)
  app.post('/auth/step-up-token', async (c) => {
    const userId = c.req.header('X-User-Id') || '10000000-0000-0000-0000-000000000006';
    const body = await c.req.json().catch(() => ({}));
    const validated = stepUpSchema.parse(body);

    const token = await generateReauthToken({
      userId,
      action: validated.action,
      expiresInSeconds: 300,
    });

    return c.json({
      success: true,
      data: {
        token,
        action: validated.action,
        expiresInSeconds: 300,
      },
    });
  });

  // POST /auth/switch-role (US14)
  app.post('/auth/switch-role', async (c) => {
    const userId = c.req.header('X-User-Id') || '10000000-0000-0000-0000-000000000001';
    const body = await c.req.json().catch(() => ({}));
    const validated = switchRoleSchema.parse(body);

    const persona = DEMO_PERSONAS.find((p) => p.id === userId) || DEMO_PERSONAS[0];

    const token = await generateAuthToken({
      userId,
      email: persona.email,
      activeRole: validated.role as AppRole,
      divisionId: persona.divisionId,
      branchId: persona.branchId,
    });

    return c.json({
      success: true,
      data: {
        token,
        activeRole: validated.role,
      },
    });
  });

  return app;
}
