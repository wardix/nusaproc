import { describe, it, expect } from 'bun:test';
import {
  validateSodAction,
  type TransactionActors,
} from '../../../src/domain/sod/validator';
import {
  SodConflictError,
  ScopeLimitExceededError,
  formatProblemDetails,
} from '../../../src/domain/sod/errors';
import { validateApprovalScope, type DelegationRecord } from '../../../src/domain/sod/scope';
import {
  generateAuthToken,
  verifyAuthToken,
  generateReauthToken,
  verifyReauthToken,
} from '../../../src/domain/auth/token';
import { stepUpMiddleware } from '../../../src/middleware/reauth';
import { rbacMiddleware } from '../../../src/middleware/rbac';
import { Hono } from 'hono';

describe('Epic 3: 5-Layer Security & Separation of Duties (SoD) Engine', () => {
  describe('Layer 1 & 2: Token Authentication & RBAC Verification (R1, R2, R3)', () => {
    it('generates and verifies a valid JWT session token', async () => {
      const userPayload = {
        userId: 'user-auth-1',
        email: 'employee@nusanet.net.id',
        activeRole: 'REQUESTER' as const,
        divisionId: 'DIV-IT',
        branchId: 'HQ',
      };

      const token = await generateAuthToken(userPayload);
      expect(typeof token).toBe('string');

      const verified = await verifyAuthToken(token);
      expect(verified.userId).toBe('user-auth-1');
      expect(verified.activeRole).toBe('REQUESTER');
    });

    it('rejects invalid or tampered JWT token', async () => {
      let errorCaught = false;
      try {
        await verifyAuthToken('invalid.token.signature');
      } catch (err) {
        errorCaught = true;
      }
      expect(errorCaught).toBe(true);
    });

    it('RBAC middleware allows authorized roles and rejects unauthorized roles', async () => {
      const app = new Hono();
      app.use('/admin-only', rbacMiddleware(['ADMIN']));
      app.get('/admin-only', (c) => c.text('admin_success'));

      // Test with REQUESTER role (Unauthorized)
      const res1 = await app.request('/admin-only', {
        headers: { 'X-User-Role': 'REQUESTER' },
      });
      expect(res1.status).toBe(403);

      // Test with ADMIN role (Authorized)
      const res2 = await app.request('/admin-only', {
        headers: { 'X-User-Role': 'ADMIN' },
      });
      expect(res2.status).toBe(200);
    });
  });

  describe('Layer 3: SoD Conflict Matrix Validation (R15, R25, R31, R42)', () => {
    it('R15: Prevents PR Requester from approving their own PR (Self-Approval)', () => {
      const actorId = 'actor-requester-1';
      const actors: TransactionActors = {
        prRequesterId: actorId,
      };

      expect(() => {
        validateSodAction(actorId, 'APPROVE_PR', actors);
      }).toThrow(SodConflictError);

      try {
        validateSodAction(actorId, 'APPROVE_PR', actors);
      } catch (err: unknown) {
        if (err instanceof SodConflictError) {
          expect(err.ruleCode).toBe('R15_SELF_APPROVAL');
          expect(err.statusCode).toBe(403);
        }
      }
    });

    it('R15: Allows distinct approver to approve PR', () => {
      const actors: TransactionActors = {
        prRequesterId: 'actor-requester-1',
      };
      expect(() => {
        validateSodAction('actor-approver-2', 'APPROVE_PR', actors);
      }).not.toThrow();
    });

    it('R25: Prevents PO Author from approving their own PO', () => {
      const actorId = 'actor-po-author-1';
      const actors: TransactionActors = {
        poAuthorId: actorId,
      };

      expect(() => {
        validateSodAction(actorId, 'APPROVE_PO', actors);
      }).toThrow(SodConflictError);

      try {
        validateSodAction(actorId, 'APPROVE_PO', actors);
      } catch (err: unknown) {
        if (err instanceof SodConflictError) {
          expect(err.ruleCode).toBe('R25_PO_AUTHOR_CANNOT_APPROVE');
        }
      }
    });

    it('R25: Allows distinct approver to approve PO', () => {
      const actors: TransactionActors = {
        poAuthorId: 'actor-po-author-1',
      };
      expect(() => {
        validateSodAction('actor-manager-2', 'APPROVE_PO', actors);
      }).not.toThrow();
    });

    it('R31: Prevents PO Author from recording Goods Receipt (BAST)', () => {
      const actorId = 'actor-po-author-1';
      const actors: TransactionActors = {
        poAuthorId: actorId,
        poApproverId: 'actor-approver-2',
      };

      expect(() => {
        validateSodAction(actorId, 'RECEIVE_GOODS', actors);
      }).toThrow(SodConflictError);

      try {
        validateSodAction(actorId, 'RECEIVE_GOODS', actors);
      } catch (err: unknown) {
        if (err instanceof SodConflictError) {
          expect(err.ruleCode).toBe('R31_PO_AUTHOR_CANNOT_RECEIVE');
        }
      }
    });

    it('R31: Prevents PO Approver from recording Goods Receipt (BAST)', () => {
      const actorId = 'actor-po-approver-2';
      const actors: TransactionActors = {
        poAuthorId: 'actor-po-author-1',
        poApproverId: actorId,
      };

      expect(() => {
        validateSodAction(actorId, 'RECEIVE_GOODS', actors);
      }).toThrow(SodConflictError);

      try {
        validateSodAction(actorId, 'RECEIVE_GOODS', actors);
      } catch (err: unknown) {
        if (err instanceof SodConflictError) {
          expect(err.ruleCode).toBe('R31_PO_APPROVER_CANNOT_RECEIVE');
        }
      }
    });

    it('R31: Allows warehouse/independent receiver to record Goods Receipt', () => {
      const actors: TransactionActors = {
        poAuthorId: 'actor-po-author-1',
        poApproverId: 'actor-po-approver-2',
      };
      expect(() => {
        validateSodAction('actor-warehouse-3', 'RECEIVE_GOODS', actors);
      }).not.toThrow();
    });

    it('R42: Prevents Payment Maker from checking their own payment proposal (Maker-Checker)', () => {
      const makerId = 'actor-maker-1';
      const actors: TransactionActors = {
        paymentProposerId: makerId,
      };

      expect(() => {
        validateSodAction(makerId, 'CHECK_PAYMENT', actors);
      }).toThrow(SodConflictError);

      try {
        validateSodAction(makerId, 'CHECK_PAYMENT', actors);
      } catch (err: unknown) {
        if (err instanceof SodConflictError) {
          expect(err.ruleCode).toBe('R42_MAKER_CANNOT_CHECK');
        }
      }
    });

    it('R42: Prevents Payment Executor from being Maker or Checker', () => {
      const makerId = 'actor-maker-1';
      const checkerId = 'actor-checker-2';
      const actors: TransactionActors = {
        paymentProposerId: makerId,
        paymentCheckerId: checkerId,
      };

      // Maker attempts execution -> Fails
      expect(() => {
        validateSodAction(makerId, 'EXECUTE_PAYMENT', actors);
      }).toThrow(SodConflictError);

      // Checker attempts execution -> Fails
      expect(() => {
        validateSodAction(checkerId, 'EXECUTE_PAYMENT', actors);
      }).toThrow(SodConflictError);

      // Distinct 3rd actor executes -> Passes
      expect(() => {
        validateSodAction('actor-executor-3', 'EXECUTE_PAYMENT', actors);
      }).not.toThrow();
    });
  });

  describe('Layer 4: Scope & Delegation Guard (R4, R13)', () => {
    it('allows approval within user limit', () => {
      const result = validateApprovalScope({
        userId: 'user-mgr-1',
        userMaxLimit: 50_000_000,
        userDivisionId: 'DIV-TECH',
        requestAmount: 25_000_000,
        requestDivisionId: 'DIV-TECH',
      });
      expect(result.allowed).toBe(true);
    });

    it('rejects approval exceeding limit when no active delegation exists', () => {
      expect(() => {
        validateApprovalScope({
          userId: 'user-mgr-1',
          userMaxLimit: 50_000_000,
          userDivisionId: 'DIV-TECH',
          requestAmount: 100_000_000,
          requestDivisionId: 'DIV-TECH',
        });
      }).toThrow(ScopeLimitExceededError);
    });

    it('allows approval exceeding normal limit if active delegation covers the amount (R4)', () => {
      const delegation: DelegationRecord = {
        delegatorId: 'user-director-9',
        delegateeId: 'user-mgr-1',
        startDate: new Date(Date.now() - 3600000).toISOString(),
        endDate: new Date(Date.now() + 86400000).toISOString(),
        maxAmountLimit: 200_000_000,
        scopeDivisionId: 'DIV-TECH',
        isActive: true,
      };

      const result = validateApprovalScope({
        userId: 'user-mgr-1',
        userMaxLimit: 50_000_000,
        userDivisionId: 'DIV-TECH',
        requestAmount: 100_000_000,
        requestDivisionId: 'DIV-TECH',
        delegations: [delegation],
      });
      expect(result.allowed).toBe(true);
      expect(result.delegatedFrom).toBe('user-director-9');
    });

    it('rejects approval when delegation is expired', () => {
      const expiredDelegation: DelegationRecord = {
        delegatorId: 'user-director-9',
        delegateeId: 'user-mgr-1',
        startDate: new Date(Date.now() - 172800000).toISOString(),
        endDate: new Date(Date.now() - 86400000).toISOString(),
        maxAmountLimit: 200_000_000,
        scopeDivisionId: 'DIV-TECH',
        isActive: true,
      };

      expect(() => {
        validateApprovalScope({
          userId: 'user-mgr-1',
          userMaxLimit: 50_000_000,
          userDivisionId: 'DIV-TECH',
          requestAmount: 100_000_000,
          requestDivisionId: 'DIV-TECH',
          delegations: [expiredDelegation],
        });
      }).toThrow(ScopeLimitExceededError);
    });
  });

  describe('Layer 5: Step-Up Re-Authentication Engine (R5, R43)', () => {
    it('generates and verifies step-up reauth token bound to user and action', async () => {
      const reauthToken = await generateReauthToken({
        userId: 'user-exec-1',
        action: 'EXECUTE_PAYMENT',
        expiresInSeconds: 300,
      });

      expect(typeof reauthToken).toBe('string');
      const verified = await verifyReauthToken(reauthToken, 'EXECUTE_PAYMENT');
      expect(verified.userId).toBe('user-exec-1');
      expect(verified.action).toBe('EXECUTE_PAYMENT');
    });

    it('rejects step-up reauth token with mismatched action', async () => {
      const reauthToken = await generateReauthToken({
        userId: 'user-exec-1',
        action: 'APPROVE_PO',
        expiresInSeconds: 300,
      });

      let errorCaught = false;
      try {
        await verifyReauthToken(reauthToken, 'EXECUTE_PAYMENT');
      } catch (err) {
        errorCaught = true;
      }
      expect(errorCaught).toBe(true);
    });

    it('stepUpMiddleware rejects requests missing X-Reauth-Token with 401 / 403 Problem Details', async () => {
      const app = new Hono();
      app.use('/payments/execute', stepUpMiddleware('EXECUTE_PAYMENT'));
      app.post('/payments/execute', (c) => c.json({ success: true }));

      // Request without X-Reauth-Token header
      const res = await app.request('/payments/execute', {
        method: 'POST',
      });

      expect(res.status).toBe(403);
      const body = await res.json();
      expect(body.reauth_required).toBe(true);
      expect(body.ruleCode).toBe('R5_STEP_UP_REAUTH_REQUIRED');
    });

    it('stepUpMiddleware allows requests with valid X-Reauth-Token', async () => {
      const app = new Hono();
      app.use('/payments/execute', stepUpMiddleware('EXECUTE_PAYMENT'));
      app.post('/payments/execute', (c) => c.json({ success: true }));

      const validToken = await generateReauthToken({
        userId: 'user-exec-1',
        action: 'EXECUTE_PAYMENT',
      });

      const res = await app.request('/payments/execute', {
        method: 'POST',
        headers: {
          'X-Reauth-Token': validToken,
        },
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
    });
  });

  describe('RFC 7807 Problem Details Formatter', () => {
    it('formats SodConflictError into RFC 7807 complaint object', () => {
      const err = new SodConflictError(
        'Requester tidak boleh menyetujui PR miliknya sendiri',
        'R15_SELF_APPROVAL'
      );
      const problem = formatProblemDetails(err, '/api/v1/pr/123/approve');

      expect(problem.type).toBe('https://nusaproc.nusanet.net.id/errors/sod-conflict');
      expect(problem.title).toBe('Separation of Duties Conflict');
      expect(problem.status).toBe(403);
      expect(problem.detail).toBe('Requester tidak boleh menyetujui PR miliknya sendiri');
      expect(problem.instance).toBe('/api/v1/pr/123/approve');
      expect(problem.ruleCode).toBe('R15_SELF_APPROVAL');
    });
  });
});
