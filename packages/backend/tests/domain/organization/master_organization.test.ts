import { describe, it, expect, beforeAll } from 'bun:test';
import { createApp } from '../../../src';
import { runSeed } from '../../../src/db/seed';

describe('Epic Master Data: Branch Offices & Divisions Management (US12, R1, R2)', () => {
  const app = createApp();
  const adminHeaders = {
    'Content-Type': 'application/json',
    'X-User-Id': '00000000-0000-0000-0000-000000000002',
    'X-User-Role': 'ADMIN',
  };
  const requesterHeaders = {
    'Content-Type': 'application/json',
    'X-User-Id': '00000000-0000-0000-0000-000000000001',
    'X-User-Role': 'REQUESTER',
  };

  beforeAll(async () => {
    await runSeed();
  });

  describe('1. Master Branch Office Endpoints', () => {
    it('GET /api/v1/branches lists all active branch offices', async () => {
      const res = await app.request('/api/v1/branches', { method: 'GET' });
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.success).toBe(true);
      expect(Array.isArray(json.data)).toBe(true);
      expect(json.data.length).toBeGreaterThanOrEqual(4);

      const codes = json.data.map((b: { code: string }) => b.code);
      expect(codes).toContain('HQ_MEDAN');
      expect(codes).toContain('BRANCH-JKT-01');
    });

    it('POST /api/v1/branches rejects non-ADMIN users with 403 Forbidden', async () => {
      const res = await app.request('/api/v1/branches', {
        method: 'POST',
        headers: requesterHeaders,
        body: JSON.stringify({
          code: 'BRANCH-TEST-01',
          name: 'Kantor Cabang Uji Coba',
          city: 'Medan',
        }),
      });

      expect(res.status).toBe(403);
    });

    it('POST /api/v1/branches allows ADMIN to create a new branch office', async () => {
      const newCode = `BRANCH-BALI-${crypto.randomUUID().slice(0, 4)}`;
      const res = await app.request('/api/v1/branches', {
        method: 'POST',
        headers: adminHeaders,
        body: JSON.stringify({
          code: newCode,
          name: 'Kantor Cabang Denpasar Bali',
          city: 'Denpasar',
          address: 'Jl. Teuku Umar No. 88, Denpasar Barat',
          isActive: true,
        }),
      });

      expect(res.status).toBe(201);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.code).toBe(newCode);
      expect(json.data.city).toBe('Denpasar');
      expect(json.data.isActive).toBe(true);
    });

    it('POST /api/v1/branches rejects duplicate branch codes with 409 Conflict', async () => {
      const res = await app.request('/api/v1/branches', {
        method: 'POST',
        headers: adminHeaders,
        body: JSON.stringify({
          code: 'HQ_MEDAN',
          name: 'Duplikat Kantor Pusat',
          city: 'Medan',
        }),
      });

      expect(res.status).toBe(409);
      const json = await res.json();
      expect(json.detail).toContain('sudah terdaftar');
    });

    it('PUT /api/v1/branches/:id updates branch details', async () => {
      // First get an existing branch
      const listRes = await app.request('/api/v1/branches?search=Jakarta', { method: 'GET' });
      const listJson = await listRes.json();
      const jktBranch = listJson.data[0];
      expect(jktBranch).toBeDefined();

      const updateRes = await app.request(`/api/v1/branches/${jktBranch.id}`, {
        method: 'PUT',
        headers: adminHeaders,
        body: JSON.stringify({
          name: 'Kantor Cabang Utama Jakarta Selatan',
          city: 'Jakarta Selatan',
          address: 'Cyber 2 Tower Lt. 19 (Updated), Kuningan, Jakarta Selatan',
        }),
      });

      expect(updateRes.status).toBe(200);
      const updateJson = await updateRes.json();
      expect(updateJson.data.name).toBe('Kantor Cabang Utama Jakarta Selatan');
      expect(updateJson.data.city).toBe('Jakarta Selatan');
    });

    it('PATCH /api/v1/branches/:id/status toggles branch active status', async () => {
      // Create a temporary branch to toggle
      const tempCode = `BRANCH-TOGGLE-${crypto.randomUUID().slice(0, 4)}`;
      const createRes = await app.request('/api/v1/branches', {
        method: 'POST',
        headers: adminHeaders,
        body: JSON.stringify({
          code: tempCode,
          name: 'Branch for Status Toggle',
          city: 'Makassar',
        }),
      });
      const created = (await createRes.json()).data;

      // Deactivate
      const deactRes = await app.request(`/api/v1/branches/${created.id}/status`, {
        method: 'PATCH',
        headers: adminHeaders,
        body: JSON.stringify({ isActive: false }),
      });
      expect(deactRes.status).toBe(200);
      expect((await deactRes.json()).data.isActive).toBe(false);

      // Reactivate
      const reactRes = await app.request(`/api/v1/branches/${created.id}/status`, {
        method: 'PATCH',
        headers: adminHeaders,
        body: JSON.stringify({ isActive: true }),
      });
      expect(reactRes.status).toBe(200);
      expect((await reactRes.json()).data.isActive).toBe(true);
    });
  });

  describe('2. Master Division Endpoints', () => {
    it('GET /api/v1/divisions lists all active divisions', async () => {
      const res = await app.request('/api/v1/divisions', { method: 'GET' });
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.success).toBe(true);
      expect(Array.isArray(json.data)).toBe(true);
      expect(json.data.length).toBeGreaterThanOrEqual(5);

      const codes = json.data.map((d: { code: string }) => d.code);
      expect(codes).toContain('DIV-IT');
      expect(codes).toContain('DIV-FIN');
    });

    it('POST /api/v1/divisions rejects non-ADMIN users with 403 Forbidden', async () => {
      const res = await app.request('/api/v1/divisions', {
        method: 'POST',
        headers: requesterHeaders,
        body: JSON.stringify({
          code: 'DIV-TEST',
          name: 'Divisi Uji Coba',
        }),
      });

      expect(res.status).toBe(403);
    });

    it('POST /api/v1/divisions allows ADMIN to create a new division', async () => {
      const newCode = `DIV-SEC-${crypto.randomUUID().slice(0, 4)}`;
      const res = await app.request('/api/v1/divisions', {
        method: 'POST',
        headers: adminHeaders,
        body: JSON.stringify({
          code: newCode,
          name: 'Divisi Keamanan Siber & Kepatuhan',
          description: 'Bertanggung jawab atas audit ISO 27001 dan keamanan SOC',
          isActive: true,
        }),
      });

      expect(res.status).toBe(201);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.code).toBe(newCode);
      expect(json.data.name).toBe('Divisi Keamanan Siber & Kepatuhan');
    });

    it('POST /api/v1/divisions rejects duplicate division codes with 409 Conflict', async () => {
      const res = await app.request('/api/v1/divisions', {
        method: 'POST',
        headers: adminHeaders,
        body: JSON.stringify({
          code: 'DIV-IT',
          name: 'Duplikat Divisi IT',
        }),
      });

      expect(res.status).toBe(409);
      const json = await res.json();
      expect(json.detail).toContain('sudah terdaftar');
    });

    it('PUT /api/v1/divisions/:id updates division details', async () => {
      const listRes = await app.request('/api/v1/divisions?search=Logistik', { method: 'GET' });
      const listJson = await listRes.json();
      const logDiv = listJson.data[0];
      expect(logDiv).toBeDefined();

      const updateRes = await app.request(`/api/v1/divisions/${logDiv.id}`, {
        method: 'PUT',
        headers: adminHeaders,
        body: JSON.stringify({
          name: 'Divisi Supply Chain & Logistik Terpadu',
          description: 'Pengadaan barang, logistik, dan manajemen aset gudang',
        }),
      });

      expect(updateRes.status).toBe(200);
      const updateJson = await updateRes.json();
      expect(updateJson.data.name).toBe('Divisi Supply Chain & Logistik Terpadu');
    });

    it('PATCH /api/v1/divisions/:id/status toggles division active status', async () => {
      const tempCode = `DIV-TOGGLE-${crypto.randomUUID().slice(0, 4)}`;
      const createRes = await app.request('/api/v1/divisions', {
        method: 'POST',
        headers: adminHeaders,
        body: JSON.stringify({
          code: tempCode,
          name: 'Division for Status Toggle',
        }),
      });
      const created = (await createRes.json()).data;

      // Deactivate
      const deactRes = await app.request(`/api/v1/divisions/${created.id}/status`, {
        method: 'PATCH',
        headers: adminHeaders,
        body: JSON.stringify({ isActive: false }),
      });
      expect(deactRes.status).toBe(200);
      expect((await deactRes.json()).data.isActive).toBe(false);

      // Reactivate
      const reactRes = await app.request(`/api/v1/divisions/${created.id}/status`, {
        method: 'PATCH',
        headers: adminHeaders,
        body: JSON.stringify({ isActive: true }),
      });
      expect(reactRes.status).toBe(200);
      expect((await reactRes.json()).data.isActive).toBe(true);
    });
  });
});
