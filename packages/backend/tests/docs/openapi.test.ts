import { describe, it, expect } from 'bun:test';
import { app } from '../../src/index';

describe('Epic 16: Interactive OpenAPI 3.0 Specification & Swagger UI (/api/docs)', () => {
  it('serves valid OpenAPI 3.0 JSON specification at /api/docs/openapi.json', async () => {
    const res = await app.request('/api/docs/openapi.json');
    expect(res.status).toBe(200);

    const contentType = res.headers.get('content-type');
    expect(contentType).toContain('application/json');

    const spec = await res.json();
    expect(spec.openapi).toBe('3.0.3');
    expect(spec.info.title).toContain('NusaProc');
    expect(spec.info.version).toBe('1.0.0');

    // Verify critical paths
    const paths = Object.keys(spec.paths);
    expect(paths).toContain('/purchase-requests');
    expect(paths).toContain('/purchase-requests/{id}/submit');
    expect(paths).toContain('/purchase-requests/{id}/decide');
    expect(paths).toContain('/vendors');
    expect(paths).toContain('/vendors/{vendorId}/bank-accounts/{bankId}/verify');
    expect(paths).toContain('/purchase-orders');
    expect(paths).toContain('/purchase-orders/{id}/issue');
    expect(paths).toContain('/purchase-orders/{id}/pdf');
    expect(paths).toContain('/receipts');
    expect(paths).toContain('/invoices');
    expect(paths).toContain('/invoices/{id}/match');
    expect(paths).toContain('/invoices/{id}/override');
    expect(paths).toContain('/payments/proposals');
    expect(paths).toContain('/payments/proposals/{id}/check');
    expect(paths).toContain('/payments/proposals/{id}/execute');
    expect(paths).toContain('/audit/verify-chain');
    expect(paths).toContain('/audit/evidence-bundle');

    // Verify security schemes
    const sec = spec.components.securitySchemes;
    expect(sec.BearerAuth).toBeDefined();
    expect(sec.ReauthTokenHeader).toBeDefined();
    expect(sec.UserIdHeader).toBeDefined();
    expect(sec.UserRoleHeader).toBeDefined();

    // Verify RFC 7807 problem details schema
    expect(spec.components.schemas.ProblemDetails).toBeDefined();
  });

  it('serves interactive Swagger UI HTML interface at /api/docs', async () => {
    const res = await app.request('/api/docs');
    expect(res.status).toBe(200);

    const contentType = res.headers.get('content-type');
    expect(contentType).toContain('text/html');

    const html = await res.text();
    expect(html).toContain('SwaggerUIBundle');
    expect(html).toContain('/api/docs/openapi.json');
    expect(html).toContain('NusaProc API Documentation');
  });

  it('redirects /docs to /api/docs', async () => {
    const res = await app.request('/docs', { redirect: 'manual' });
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toBe('/api/docs');
  });
});
