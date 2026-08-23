import { describe, it, expect } from 'bun:test';
import { validateSodAction, SodConflictError } from '../../src/domain/sod/validator';

describe('Domain: SoD Validator', () => {
  it('prevents PR requester from approving their own PR (R15)', () => {
    expect(() => {
      validateSodAction('user-1', 'APPROVE_PR', { prRequesterId: 'user-1' });
    }).toThrow(SodConflictError);
  });

  it('allows different user to approve PR', () => {
    expect(() => {
      validateSodAction('user-2', 'APPROVE_PR', { prRequesterId: 'user-1' });
    }).not.toThrow();
  });

  it('prevents PO author from approving their own PO (R25)', () => {
    expect(() => {
      validateSodAction('user-1', 'APPROVE_PO', { poAuthorId: 'user-1' });
    }).toThrow(SodConflictError);
  });

  it('prevents PO author or approver from receiving goods (R31)', () => {
    expect(() => {
      validateSodAction('user-author', 'RECEIVE_GOODS', { poAuthorId: 'user-author' });
    }).toThrow(SodConflictError);

    expect(() => {
      validateSodAction('user-approver', 'RECEIVE_GOODS', { poApproverId: 'user-approver' });
    }).toThrow(SodConflictError);
  });

  it('enforces Maker-Checker-Executor distinct roles (R42)', () => {
    // Maker cannot check
    expect(() => {
      validateSodAction('user-maker', 'CHECK_PAYMENT', { paymentProposerId: 'user-maker' });
    }).toThrow(SodConflictError);

    // Executor cannot be Maker or Checker
    expect(() => {
      validateSodAction('user-maker', 'EXECUTE_PAYMENT', {
        paymentProposerId: 'user-maker',
        paymentCheckerId: 'user-checker',
      });
    }).toThrow(SodConflictError);

    expect(() => {
      validateSodAction('user-checker', 'EXECUTE_PAYMENT', {
        paymentProposerId: 'user-maker',
        paymentCheckerId: 'user-checker',
      });
    }).toThrow(SodConflictError);

    // Valid 3 distinct actors
    expect(() => {
      validateSodAction('user-executor', 'EXECUTE_PAYMENT', {
        paymentProposerId: 'user-maker',
        paymentCheckerId: 'user-checker',
      });
    }).not.toThrow();
  });
});
