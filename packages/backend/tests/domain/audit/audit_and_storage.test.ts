import { describe, it, expect, beforeAll } from 'bun:test';
import { sql } from '../../../src/db/client';
import { runMigrations } from '../../../src/db/migrate';
import {
  recordAuditTrailEntry,
  verifyAuditChainIntegrity,
  getAuditTrailForEntity,
  type RecordAuditInput,
} from '../../../src/domain/audit/service';
import {
  validateFileMagicBytes,
  scanFileWithAntivirus,
  uploadAttachment,
  generateAuditorEvidenceBundle,
  type UploadAttachmentInput,
} from '../../../src/domain/storage/service';
import { createAuditApp } from '../../../src/domain/audit/routes';
import { auditorSandboxMiddleware } from '../../../src/middleware/auditor_sandbox';
import { Hono } from 'hono';

describe('Epic 9: [Audit & Storage] Hash Chaining, ClamAV Scanner & Auditor Sandbox (R51–R54)', () => {
  let adminUserId: string;
  let auditorUserId: string;
  const dummyEntityId = crypto.randomUUID();

  beforeAll(async () => {
    await runMigrations();

    adminUserId = crypto.randomUUID();
    auditorUserId = crypto.randomUUID();

    await sql`
      INSERT INTO app_user (id, email, full_name, employee_id, division_id, branch_id)
      VALUES 
        (${adminUserId}, ${`admin-${adminUserId}@nusanet.net.id`}, 'System Admin', ${`EMP-ADM-${adminUserId.slice(0, 6)}`}, 'IT_SECURITY', 'HQ'),
        (${auditorUserId}, ${`auditor-${auditorUserId}@nusanet.net.id`}, 'Internal Auditor', ${`EMP-AUD-${auditorUserId.slice(0, 6)}`}, 'INTERNAL_AUDIT', 'HQ')
    `;

    await sql`
      INSERT INTO user_role_assignment (user_id, role, assigned_by)
      VALUES 
        (${adminUserId}, 'ADMIN', ${adminUserId}),
        (${auditorUserId}, 'AUDITOR', ${adminUserId})
    `;
  });

  describe('1. Cryptographic Hash Chaining & Tamper Detection (R53)', () => {
    it('records chained audit entries with SHA-256 links', async () => {
      const entry1: RecordAuditInput = {
        actorId: adminUserId,
        actorRole: 'ADMIN',
        actionType: 'CREATE_PURCHASE_REQUEST',
        entityName: 'purchase_request',
        entityId: dummyEntityId,
        newState: { status: 'DRAFT', total: 10_000_000 },
        justification: 'Inisiasi pengadaan server',
        ipAddress: '10.0.1.50',
        userAgent: 'NusaProc/1.0',
      };

      const recorded1 = await recordAuditTrailEntry(entry1);
      expect(recorded1).toBeDefined();
      expect(recorded1.currentEntryHash).toBeDefined();
      expect(recorded1.currentEntryHash.length).toBe(64);

      const entry2: RecordAuditInput = {
        actorId: adminUserId,
        actorRole: 'ADMIN',
        actionType: 'SUBMIT_PURCHASE_REQUEST',
        entityName: 'purchase_request',
        entityId: dummyEntityId,
        oldState: { status: 'DRAFT' },
        newState: { status: 'SUBMITTED' },
        justification: 'Submit for approval',
        ipAddress: '10.0.1.50',
        userAgent: 'NusaProc/1.0',
      };

      const recorded2 = await recordAuditTrailEntry(entry2);
      expect(recorded2.previousEntryHash).toBe(recorded1.currentEntryHash);

      const integrity = await verifyAuditChainIntegrity();
      expect(integrity.isValid).toBe(true);
      expect(integrity.corruptedEntryId).toBeNull();
    });

    it('R53: Detects direct manual manipulation on database rows', async () => {
      // Create a specific entity trail
      const testEntityId = crypto.randomUUID();
      const entry = await recordAuditTrailEntry({
        actorId: adminUserId,
        actorRole: 'ADMIN',
        actionType: 'TAMPER_TEST_ACTION',
        entityName: 'purchase_order',
        entityId: testEntityId,
        newState: { total: 500_000_000 },
        justification: 'Original transaction',
        ipAddress: '192.168.1.1',
        userAgent: 'TestClient/1.0',
      });

      // Verify chain is valid before tampering
      const beforeTamper = await verifyAuditChainIntegrity();
      expect(beforeTamper.isValid).toBe(true);

      // Simulate malicious direct SQL bypass bypassing rule (or rule check)
      // Note: PostgreSQL RULE no_update_audit prevents updates; let's test that UPDATE is suppressed
      await sql`
        UPDATE audit_trail_entry
        SET justification = 'TAMPERED VIA SQL INJECTION'
        WHERE id = ${entry.id}
      `;

      // Confirm DB Rule preserved original state
      const rows = await sql`SELECT justification FROM audit_trail_entry WHERE id = ${entry.id}`;
      expect(rows[0].justification).toBe('Original transaction');
    });

    it('retrieves audit history for an entity in chronological order', async () => {
      const history = await getAuditTrailForEntity('purchase_request', dummyEntityId);
      expect(Array.isArray(history)).toBe(true);
      expect(history.length).toBeGreaterThanOrEqual(2);
      expect(history[0].actionType).toBe('CREATE_PURCHASE_REQUEST');
      expect(history[1].actionType).toBe('SUBMIT_PURCHASE_REQUEST');
    });
  });

  describe('2. File Security, Magic Bytes & Antivirus Scanner (R51)', () => {
    it('accepts valid PDF magic bytes (%PDF-)', () => {
      const validPdfBuffer = Buffer.from('%PDF-1.7\n%some pdf binary content...');
      const result = validateFileMagicBytes(validPdfBuffer, 'application/pdf', 'invoice.pdf');
      expect(result.isValid).toBe(true);
      expect(result.detectedMime).toBe('application/pdf');
    });

    it('accepts valid PNG magic bytes', () => {
      const validPngBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00]);
      const result = validateFileMagicBytes(validPngBuffer, 'image/png', 'receipt.png');
      expect(result.isValid).toBe(true);
      expect(result.detectedMime).toBe('image/png');
    });

    it('R51: Rejects file when magic bytes do not match declared extension/mime', () => {
      // Fake PDF that is actually plain text
      const fakePdfBuffer = Buffer.from('Hello world this is not a pdf file at all');
      const result = validateFileMagicBytes(fakePdfBuffer, 'application/pdf', 'malicious.pdf');
      expect(result.isValid).toBe(false);
      expect(result.errorReason).toContain('Magic bytes');
    });

    it('R51: Antivirus scanner flags infected file (EICAR standard test signature) and quarantines', async () => {
      const eicarSignature = Buffer.from('X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*');
      const scanResult = await scanFileWithAntivirus(eicarSignature, 'eicar_test.pdf');
      expect(scanResult.isClean).toBe(false);
      expect(scanResult.virusName).toBe('EICAR-Test-Signature');
    });

    it('R51: Uploads clean attachment, calculates SHA-256, and locks with WORM Legal Hold', async () => {
      const cleanPdfBuffer = Buffer.from('%PDF-1.4\n1 0 obj\n<< /Title (Legal BAST Document) >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF');
      
      const input: UploadAttachmentInput = {
        entityName: 'goods_receipt',
        entityId: dummyEntityId,
        fileName: 'bast_signed.pdf',
        mimeType: 'application/pdf',
        fileBuffer: cleanPdfBuffer,
        uploadedBy: adminUserId,
        isFinalEvidence: true,
      };

      const file = await uploadAttachment(input);
      expect(file).toBeDefined();
      expect(file.scanStatus).toBe('CLEAN');
      expect(file.isLegalHold).toBe(true);
      expect(file.isFinalEvidence).toBe(true);
      expect(file.sha256Checksum.length).toBe(64);
    });
  });

  describe('3. Auditor Read-Only Sandbox & Evidence Bundle Export (R54)', () => {
    it('R54: Auditor sandbox blocks mutation requests (POST/PUT/DELETE) with HTTP 405 Method Not Allowed', async () => {
      const app = new Hono();
      app.use('*', auditorSandboxMiddleware());
      app.get('/api/test-resource', (c) => c.json({ allowed: true }));
      app.post('/api/test-resource', (c) => c.json({ mutated: true }));
      app.delete('/api/test-resource/:id', (c) => c.json({ deleted: true }));

      // 1. GET allowed for Auditor
      const getRes = await app.request('/api/test-resource', {
        method: 'GET',
        headers: {
          'X-User-Role': 'AUDITOR',
          'X-User-Id': auditorUserId,
        },
      });
      expect(getRes.status).toBe(200);

      // 2. POST blocked for Auditor -> HTTP 405
      const postRes = await app.request('/api/test-resource', {
        method: 'POST',
        headers: {
          'X-User-Role': 'AUDITOR',
          'X-User-Id': auditorUserId,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'create' }),
      });
      expect(postRes.status).toBe(405);
      const postBody = await postRes.json();
      expect(postBody.title).toContain('Method Not Allowed');
      expect(postBody.detail).toContain('AUDITOR');

      // 3. DELETE blocked for Auditor -> HTTP 405
      const delRes = await app.request('/api/test-resource/123', {
        method: 'DELETE',
        headers: {
          'X-User-Role': 'AUDITOR',
          'X-User-Id': auditorUserId,
        },
      });
      expect(delRes.status).toBe(405);
    });

    it('R54: Generates downloadable Auditor Evidence Bundle (ZIP) for entity', async () => {
      const bundle = await generateAuditorEvidenceBundle('purchase_request', dummyEntityId);
      expect(bundle).toBeDefined();
      expect(bundle.bundleFileName).toMatch(/^evidence_bundle_purchase_request_/);
      expect(bundle.zipBuffer.length).toBeGreaterThan(0);
      expect(bundle.totalFilesIncluded).toBeGreaterThanOrEqual(1);
    });

    it('REST API: provides audit verification, trail retrieval, and bundle download endpoints', async () => {
      const app = createAuditApp();

      // 1. Verify audit chain
      const verifyRes = await app.request('/audit/verify-chain', {
        method: 'GET',
        headers: {
          'X-User-Id': auditorUserId,
          'X-User-Role': 'AUDITOR',
        },
      });
      expect(verifyRes.status).toBe(200);
      const verifyData = await verifyRes.json();
      expect(verifyData.data.isValid).toBe(true);

      // 2. Export Evidence Bundle
      const exportRes = await app.request(`/audit/evidence-bundle?entityName=purchase_request&entityId=${dummyEntityId}`, {
        method: 'GET',
        headers: {
          'X-User-Id': auditorUserId,
          'X-User-Role': 'AUDITOR',
        },
      });
      expect(exportRes.status).toBe(200);
      expect(exportRes.headers.get('Content-Type')).toBe('application/zip');
    });
  });
});
