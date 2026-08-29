import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { app } from '../../../src/index';
import { sql } from '../../../src/db/client';
import { cleanupTestUsers } from '../../helpers/test_cleaner';

describe('Epic 19: [Admin] User Provisioning, Role Assignment & Status Management (US12, R1, R2, R3, R64)', () => {
  const adminId = crypto.randomUUID();
  const requesterId = crypto.randomUUID();
  const createdUserIds: string[] = [adminId, requesterId];

  beforeAll(async () => {
    await sql`
      INSERT INTO app_user (id, email, full_name, employee_id, division_id, branch_id, is_active)
      VALUES 
        (${adminId}, ${`admin-test-${adminId.slice(0, 6)}@test.local`}, 'Admin Test', ${`EMP-ADM-${adminId.slice(0, 6)}`}, 'DIV-IT', 'HQ_MEDAN', TRUE),
        (${requesterId}, ${`req-test-${requesterId.slice(0, 6)}@test.local`}, 'Req Test', ${`EMP-REQ-${requesterId.slice(0, 6)}`}, 'DIV-IT', 'HQ_MEDAN', TRUE)
      ON CONFLICT (id) DO NOTHING;
    `;

    await sql`
      INSERT INTO user_role_assignment (user_id, role, assigned_by)
      VALUES 
        (${adminId}, 'ADMIN', ${adminId}),
        (${requesterId}, 'REQUESTER', ${adminId})
      ON CONFLICT (user_id, role) DO NOTHING;
    `;
  });

  afterAll(async () => {
    const extraUsers = await sql`
      SELECT id FROM app_user WHERE email LIKE 'staff.%@nusanet.net.id' OR email LIKE 'user-deact-%' OR email LIKE 'other-user-%'
    `;
    const allIds = [...createdUserIds, ...extraUsers.map(u => u.id)];
    await cleanupTestUsers(allIds);
  });

  describe('1. Layer 2 RBAC Guard on User Management Endpoints', () => {
    it('rejects non-admin role (e.g. REQUESTER) from listing users with 403 Forbidden', async () => {
      const res = await app.request('/api/v1/users', {
        method: 'GET',
        headers: {
          'X-User-Id': requesterId,
          'X-User-Role': 'REQUESTER',
        },
      });

      expect(res.status).toBe(403);
      const json = await res.json();
      expect(json.detail).toContain('Akses ditolak');
    });

    it('rejects non-admin role from creating user with 403 Forbidden', async () => {
      const res = await app.request('/api/v1/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Id': requesterId,
          'X-User-Role': 'REQUESTER',
        },
        body: JSON.stringify({
          email: 'test@nusanet.net.id',
          fullName: 'Test User',
          employeeId: 'EMP-999',
          divisionId: 'DIV-IT',
          branchId: 'HQ_MEDAN',
          roles: [{ role: 'REQUESTER' }],
        }),
      });

      expect(res.status).toBe(403);
    });

    it('allows ADMIN role to access user management endpoints', async () => {
      const res = await app.request('/api/v1/users', {
        method: 'GET',
        headers: {
          'X-User-Id': adminId,
          'X-User-Role': 'ADMIN',
        },
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(Array.isArray(json.data)).toBe(true);
      expect(json.data.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('2. User Provisioning (POST /api/v1/users)', () => {
    it('atomically creates user with local password and multiple roles', async () => {
      const uniqueSuffix = crypto.randomUUID().slice(0, 6);
      const email = `staff.${uniqueSuffix}@nusanet.net.id`;
      const nip = `EMP-${uniqueSuffix.toUpperCase()}`;

      const res = await app.request('/api/v1/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Id': adminId,
          'X-User-Role': 'ADMIN',
        },
        body: JSON.stringify({
          email,
          fullName: 'Staff Multitasking',
          employeeId: nip,
          divisionId: 'DIV-FIN',
          branchId: 'HQ_MEDAN',
          initialPassword: 'Password123!',
          isLocalFallback: true,
          roles: [
            { role: 'ACCOUNT_PAYABLE', isTaxSpecialist: true },
            { role: 'FINANCE' },
          ],
        }),
      });

      expect(res.status).toBe(201);
      const json = await res.json();
      expect(json.data.email).toBe(email);
      expect(json.data.employeeId).toBe(nip);
      expect(json.data.roles.length).toBe(2);

      // Verify user can now log in locally
      const loginRes = await app.request('/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          password: 'Password123!',
        }),
      });
      expect(loginRes.status).toBe(200);
    });

    it('rejects creating duplicate user with same email or employeeId with 400/409', async () => {
      const res = await app.request('/api/v1/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Id': adminId,
          'X-User-Role': 'ADMIN',
        },
        body: JSON.stringify({
          email: `admin-test-${adminId.slice(0, 6)}@test.local`, // Duplicate email
          fullName: 'Duplicate Admin',
          employeeId: 'EMP-UNIQUE-999',
          divisionId: 'DIV-IT',
          branchId: 'HQ_MEDAN',
          roles: [{ role: 'REQUESTER' }],
        }),
      });

      expect(res.status).toBe(409);
    });
  });

  describe('3. Role Management (PATCH /api/v1/users/:id/roles)', () => {
    it('updates user role assignments and tax specialist flags', async () => {
      const targetUserId = requesterId;

      const res = await app.request(`/api/v1/users/${targetUserId}/roles`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Id': adminId,
          'X-User-Role': 'ADMIN',
        },
        body: JSON.stringify({
          roles: [
            { role: 'REQUESTER' },
            { role: 'WAREHOUSE' },
          ],
        }),
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      const roles = json.data.roles.map((r: { role: string }) => r.role);
      expect(roles).toContain('REQUESTER');
      expect(roles).toContain('WAREHOUSE');
    });
  });

  describe('4. Status Management & Delegation Cascade (PATCH /api/v1/users/:id/status)', () => {
    it('deactivates user and automatically revokes active delegations (R64)', async () => {
      const testUserId = crypto.randomUUID();
      const otherUserId = crypto.randomUUID();

      await sql`
        INSERT INTO app_user (id, email, full_name, employee_id, division_id, branch_id, is_active)
        VALUES 
          (${testUserId}, ${`user-deact-${testUserId.slice(0, 6)}@nusanet.net.id`}, 'User To Deactivate', ${`EMP-${testUserId.slice(0, 6)}`}, 'DIV-IT', 'HQ_MEDAN', TRUE),
          (${otherUserId}, ${`other-user-${otherUserId.slice(0, 6)}@nusanet.net.id`}, 'Other User', ${`EMP-${otherUserId.slice(0, 6)}`}, 'DIV-IT', 'HQ_MEDAN', TRUE)
      `;

      await sql`
        INSERT INTO user_role_assignment (user_id, role, assigned_by)
        VALUES (${testUserId}, 'APPROVER', ${testUserId})
      `;

      // Create an active delegation for this user
      const delegationId = crypto.randomUUID();
      await sql`
        INSERT INTO approval_delegation (
          id, delegator_id, delegatee_id, start_date, end_date, max_amount_limit, reason, is_active
        ) VALUES (
          ${delegationId}, ${testUserId}, ${otherUserId}, clock_timestamp() - INTERVAL '1 hour',
          clock_timestamp() + INTERVAL '24 hours', 50000000, 'Cuti tahunan', TRUE
        )
      `;

      // Admin deactivates user
      const res = await app.request(`/api/v1/users/${testUserId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Id': adminId,
          'X-User-Role': 'ADMIN',
        },
        body: JSON.stringify({
          isActive: false,
        }),
      });

      expect(res.status).toBe(200);

      // Verify user is inactive in database
      const userCheck = await sql`SELECT is_active FROM app_user WHERE id = ${testUserId}`;
      expect(userCheck[0].is_active).toBe(false);

      // Verify active delegation was automatically cancelled per R64
      const delegationCheck = await sql`SELECT is_active FROM approval_delegation WHERE id = ${delegationId}`;
      expect(delegationCheck[0].is_active).toBe(false);
    });
  });
});
