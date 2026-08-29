import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { app } from '../../../src/index';
import { sql } from '../../../src/db/client';
import { verifyAuthToken } from '../../../src/domain/auth/token';
import { cleanupTestUsers } from '../../helpers/test_cleaner';

describe('Epic 19: [Hybrid Auth] Google Workspace SSO & Local Fallback Login (R1, R2, R3)', () => {
  const budiId = crypto.randomUUID();
  const adminId = crypto.randomUUID();
  const sitiId = crypto.randomUUID();
  const wardixId = crypto.randomUUID();

  beforeAll(async () => {
    const passwordHash = await Bun.password.hash('Password123!', 'bcrypt');

    // Create required test personas and use returning IDs
    const [budi] = await sql`
      INSERT INTO app_user (id, email, full_name, employee_id, division_id, branch_id, is_active, is_local_fallback, local_password_hash)
      VALUES (${budiId}, 'budi.santoso@nusanet.net.id', 'Budi Santoso', 'EMP-TEST-BUDI', 'DIV-IT', 'HQ_MEDAN', TRUE, TRUE, ${passwordHash})
      ON CONFLICT (email) DO UPDATE SET is_active = TRUE, is_local_fallback = TRUE, local_password_hash = EXCLUDED.local_password_hash
      RETURNING id;
    `;
    const [admin] = await sql`
      INSERT INTO app_user (id, email, full_name, employee_id, division_id, branch_id, is_active, is_local_fallback, local_password_hash)
      VALUES (${adminId}, 'admin@nusanet.net.id', 'Administrator Test', 'EMP-TEST-ADM', 'DIV-IT', 'HQ_MEDAN', TRUE, TRUE, ${passwordHash})
      ON CONFLICT (email) DO UPDATE SET is_active = TRUE, is_local_fallback = TRUE, local_password_hash = EXCLUDED.local_password_hash
      RETURNING id;
    `;
    const [siti] = await sql`
      INSERT INTO app_user (id, email, full_name, employee_id, division_id, branch_id, is_active, is_local_fallback, local_password_hash)
      VALUES (${sitiId}, 'siti.aminah@nusanet.net.id', 'Siti Aminah', 'EMP-TEST-SITI', 'DIV-FIN', 'HQ_MEDAN', TRUE, TRUE, ${passwordHash})
      ON CONFLICT (email) DO UPDATE SET is_active = TRUE, is_local_fallback = TRUE, local_password_hash = EXCLUDED.local_password_hash
      RETURNING id;
    `;
    const [wardix] = await sql`
      INSERT INTO app_user (id, email, full_name, employee_id, division_id, branch_id, is_active, is_local_fallback, local_password_hash)
      VALUES (${wardixId}, 'wardix@nusa.id', 'Wardi', 'EMP-TEST-WARDIX', 'DIV-IT', 'HQ_MEDAN', TRUE, TRUE, ${passwordHash})
      ON CONFLICT (email) DO UPDATE SET is_active = TRUE, is_local_fallback = TRUE, local_password_hash = EXCLUDED.local_password_hash
      RETURNING id;
    `;

    await sql`
      INSERT INTO user_role_assignment (user_id, role, assigned_by)
      VALUES
        (${budi.id}, 'REQUESTER', ${budi.id}),
        (${admin.id}, 'ADMIN', ${admin.id}),
        (${admin.id}, 'REQUESTER', ${admin.id}),
        (${siti.id}, 'APPROVER', ${siti.id}),
        (${wardix.id}, 'ADMIN', ${wardix.id})
      ON CONFLICT (user_id, role) DO NOTHING;
    `;
  });

  afterAll(async () => {
    const testUsers = await sql`
      SELECT id FROM app_user 
      WHERE email IN ('budi.santoso@nusanet.net.id', 'siti.aminah@nusanet.net.id', 'admin@nusanet.net.id') 
         OR email LIKE 'inactive.%' 
         OR email LIKE 'new.engineer.%'
    `;
    await cleanupTestUsers(testUsers.map((u: { id: string }) => u.id));
  });

  describe('1. Local Email/Password Fallback Login (R1)', () => {
    it('successfully authenticates active user with correct password', async () => {
      const res = await app.request('/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'budi.santoso@nusanet.net.id',
          password: 'Password123!',
        }),
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.token).toBeDefined();
      expect(json.data.user.email).toBe('budi.santoso@nusanet.net.id');
      expect(json.data.user.activeRole).toBe('REQUESTER');
      expect(json.data.user.roles).toContain('REQUESTER');

      // Verify JWT signature and payload
      const payload = await verifyAuthToken(json.data.token);
      expect(payload.email).toBe('budi.santoso@nusanet.net.id');
      expect(payload.activeRole).toBe('REQUESTER');
    });

    it('allows user with multiple roles to select requestedRole at login', async () => {
      const res = await app.request('/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'admin@nusanet.net.id',
          password: 'Password123!',
          requestedRole: 'ADMIN',
        }),
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.data.user.activeRole).toBe('ADMIN');
    });

    it('rejects login attempt with incorrect password with 401 Unauthorized', async () => {
      const res = await app.request('/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'budi.santoso@nusanet.net.id',
          password: 'WrongPassword999!',
        }),
      });

      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.detail).toContain('Email atau kata sandi tidak valid');
    });

    it('rejects login attempt with non-existent email with 401 Unauthorized', async () => {
      const res = await app.request('/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'unknown.user@nusanet.net.id',
          password: 'Password123!',
        }),
      });

      expect(res.status).toBe(401);
    });

    it('rejects login for deactivated user with 403 Forbidden RFC 7807', async () => {
      const deactivatedUserId = crypto.randomUUID();
      const deactEmail = `inactive.${deactivatedUserId.slice(0, 8)}@nusanet.net.id`;
      const passwordHash = await Bun.password.hash('Password123!', 'bcrypt');

      await sql`
        INSERT INTO app_user (
          id, email, full_name, employee_id, division_id, branch_id,
          is_active, is_local_fallback, local_password_hash
        ) VALUES (
          ${deactivatedUserId}, ${deactEmail}, 'Inactive User',
          ${`EMP-${deactivatedUserId.slice(0, 8)}`}, 'DIV-OPS', 'HQ_MEDAN',
          FALSE, TRUE, ${passwordHash}
        )
      `;

      await sql`
        INSERT INTO user_role_assignment (user_id, role, assigned_by, valid_from)
        VALUES (${deactivatedUserId}, 'WAREHOUSE', ${deactivatedUserId}, CURRENT_DATE)
      `;

      const res = await app.request('/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: deactEmail,
          password: 'Password123!',
        }),
      });

      expect(res.status).toBe(403);
      const json = await res.json();
      expect(json.detail).toContain('dinonaktifkan');
    });
  });

  describe('2. Google Workspace SSO (R2, R3)', () => {
    it('authenticates existing user via Google Workspace credential', async () => {
      const mockGooglePayload = JSON.stringify({
        email: 'siti.aminah@nusanet.net.id',
        name: 'Siti Aminah',
        hd: 'nusanet.net.id',
        sub: 'google-oauth2-12345678',
      });

      const res = await app.request('/api/v1/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          credential: mockGooglePayload,
        }),
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.user.email).toBe('siti.aminah@nusanet.net.id');
      expect(json.data.user.activeRole).toBe('APPROVER');
    });

    it('rejects Google account not belonging to allowed Nusanet domains with 403 Forbidden', async () => {
      const mockExternalGooglePayload = JSON.stringify({
        email: 'attacker@gmail.com',
        name: 'External Attacker',
        hd: 'gmail.com',
        sub: 'google-oauth2-87654321',
      });

      const res = await app.request('/api/v1/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          credential: mockExternalGooglePayload,
        }),
      });

      expect(res.status).toBe(403);
      const json = await res.json();
      expect(json.detail).toContain('Google Workspace resmi');
    });

    it('successfully allows Google account from @nusa.id domain', async () => {
      const mockNusaIdPayload = JSON.stringify({
        email: 'wardix@nusa.id',
        name: 'Wardi',
        hd: 'nusa.id',
        sub: 'google-oauth2-wardix-1234',
      });

      const res = await app.request('/api/v1/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          credential: mockNusaIdPayload,
        }),
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.user.email).toBe('wardix@nusa.id');
    });

    it('performs Just-In-Time (JIT) provisioning for new Nusanet employee on first login', async () => {
      const uniqueEmployeeEmail = `new.engineer.${crypto.randomUUID().slice(0, 6)}@nusanet.net.id`;
      const mockNewEmployeePayload = JSON.stringify({
        email: uniqueEmployeeEmail,
        name: 'New Nusanet Engineer',
        hd: 'nusanet.net.id',
        sub: 'google-oauth2-99887766',
      });

      const res = await app.request('/api/v1/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          credential: mockNewEmployeePayload,
        }),
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.data.user.email).toBe(uniqueEmployeeEmail);
      expect(json.data.user.activeRole).toBe('REQUESTER');
      expect(json.data.user.roles).toContain('REQUESTER');

      // Verify user was stored in database
      const dbUsers = await sql`SELECT id, email, is_active FROM app_user WHERE email = ${uniqueEmployeeEmail}`;
      expect(dbUsers.length).toBe(1);
      expect(dbUsers[0].is_active).toBe(true);
    });
  });
});
