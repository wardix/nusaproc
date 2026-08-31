import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { createApp } from '../../../src/index';
import { generateAuthToken } from '../../../src/domain/auth/token';
import { runMigrations } from '../../../src/db/migrate';
import { sql } from '../../../src/db/client';

describe('Epic 20: [Feedback & Bug Report] Browser Screenshot & User Feedback', () => {
  let app: ReturnType<typeof createApp>;
  let requesterToken: string;
  let adminToken: string;
  let createdFeedbackId: string;

  beforeAll(async () => {
    await runMigrations();
    app = createApp();

    // Ensure a test user exists
    const [user] = await sql`
      INSERT INTO app_user (id, email, full_name, employee_id, division_id, branch_id, is_active)
      VALUES ('20000000-0000-0000-0000-000000000001', 'feedback_tester@nusanet.net.id', 'Feedback Tester', 'EMP-FB-01', 'IT', 'MEDAN', TRUE)
      ON CONFLICT (email) DO UPDATE SET is_active = TRUE
      RETURNING id;
    `;

    requesterToken = await generateAuthToken({
      userId: user.id,
      email: 'feedback_tester@nusanet.net.id',
      activeRole: 'REQUESTER',
    });

    adminToken = await generateAuthToken({
      userId: user.id,
      email: 'feedback_tester@nusanet.net.id',
      activeRole: 'ADMIN',
    });
  });

  it('1. User (Requester) can submit feedback with screenshot data URI', async () => {
    const res = await app.request('/api/v1/feedbacks', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${requesterToken}`,
      },
      body: JSON.stringify({
        category: 'BUG',
        urgency: 'HIGH',
        title: 'Tombol submit PR tidak merespons',
        description: 'Saat menekan tombol kirim di halaman /pr/create, tidak ada loading indicator.',
        pageUrl: '/pr/create',
        activeRole: 'REQUESTER',
        screenshotData: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
        systemInfo: {
          userAgent: 'Mozilla/5.0 (X11; Linux x86_64)',
          screenWidth: 1920,
          screenHeight: 1080,
        },
      }),
    });

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.id).toBeDefined();
    expect(body.data.category).toBe('BUG');
    expect(body.data.urgency).toBe('HIGH');
    expect(body.data.status).toBe('OPEN');
    expect(body.data.screenshotData).toContain('data:image/png;base64');

    createdFeedbackId = body.data.id;
  });

  it('2. Non-Admin (e.g. REQUESTER) is forbidden from listing feedbacks with 403', async () => {
    const res = await app.request('/api/v1/feedbacks', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${requesterToken}`,
      },
    });

    expect(res.status).toBe(403);
  });

  it('3. Admin can list feedbacks and view user metadata', async () => {
    const res = await app.request('/api/v1/feedbacks?status=OPEN', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${adminToken}`,
      },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.total).toBeGreaterThanOrEqual(1);

    const found = body.data.find((f: { id: string }) => f.id === createdFeedbackId);
    expect(found).toBeDefined();
    expect(found.userFullName).toBe('Feedback Tester');
  });

  it('4. Admin can update feedback status and add admin notes', async () => {
    const res = await app.request(`/api/v1/feedbacks/${createdFeedbackId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        status: 'IN_PROGRESS',
        adminNotes: 'Sedang diinvestigasi oleh tim frontend.',
      }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.status).toBe('IN_PROGRESS');
    expect(body.data.adminNotes).toBe('Sedang diinvestigasi oleh tim frontend.');
  });

  afterAll(async () => {
    await sql`TRUNCATE TABLE system_feedback CASCADE;`;
  });
});
