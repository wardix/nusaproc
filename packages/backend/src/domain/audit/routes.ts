import { Hono } from 'hono';
import { verifyAuditChainIntegrity, getAuditTrailForEntity } from './service';
import { generateAuditorEvidenceBundle } from '../storage/service';
import { formatProblemDetails } from '../sod/errors';

export function createAuditApp(): Hono {
  const app = new Hono();

  // 1. Verify cryptographic hash chain integrity
  app.get('/audit/verify-chain', async (c) => {
    try {
      const integrity = await verifyAuditChainIntegrity();
      return c.json({ success: true, data: integrity });
    } catch (err: unknown) {
      return c.json(formatProblemDetails(err, c.req.path), 500);
    }
  });

  // 2. Get Audit Trail for an entity
  app.get('/audit/trail', async (c) => {
    const entityName = c.req.query('entityName');
    const entityId = c.req.query('entityId');

    if (!entityName || !entityId) {
      return c.json(
        {
          title: 'Bad Request',
          status: 400,
          detail: 'Parameter query entityName dan entityId wajib diisi.',
        },
        400
      );
    }

    try {
      const trail = await getAuditTrailForEntity(entityName, entityId);
      return c.json({ success: true, data: trail });
    } catch (err: unknown) {
      return c.json(formatProblemDetails(err, c.req.path), 400);
    }
  });

  // 3. Export Auditor Evidence Bundle (ZIP)
  app.get('/audit/evidence-bundle', async (c) => {
    const entityName = c.req.query('entityName');
    const entityId = c.req.query('entityId');

    if (!entityName || !entityId) {
      return c.json(
        {
          title: 'Bad Request',
          status: 400,
          detail: 'Parameter query entityName dan entityId wajib diisi.',
        },
        400
      );
    }

    try {
      const bundle = await generateAuditorEvidenceBundle(entityName, entityId);
      return new Response(new Uint8Array(bundle.zipBuffer), {
        headers: {
          'Content-Type': 'application/zip',
          'Content-Disposition': `attachment; filename="${bundle.bundleFileName}"`,
        },
      });
    } catch (err: unknown) {
      return c.json(formatProblemDetails(err, c.req.path), 400);
    }
  });

  return app;
}
