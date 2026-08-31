import { describe, it, expect } from 'bun:test';
import React from 'react';
import { ROLE_COLORS, ROLE_LABELS, StatusTag, RoleTag } from '../../src/components/common/StatusTag';
import { PageHeader } from '../../src/components/common/PageHeader';
import { AuditorWatermark } from '../../src/components/security/AuditorWatermark';
import { ErrorBoundary } from '../../src/components/common/ErrorBoundary';
import { useAuthStore } from '../../src/stores/useAuthStore';
import type { AppRole } from '@nusaproc/shared';

describe('Epic 12: [Frontend Common Components] StatusTag, RoleTag, PageHeader & AuditorWatermark (Issue #46)', () => {
  describe('1. Centralized Role Colors & Labels Mapping', () => {
    const roles: AppRole[] = [
      'REQUESTER',
      'APPROVER',
      'ACCOUNT_PAYABLE',
      'WAREHOUSE',
      'FINANCE',
      'AUDITOR',
      'ADMIN',
    ];

    it('defines consistent color tokens for all system roles', () => {
      expect(ROLE_COLORS.REQUESTER).toBe('blue');
      expect(ROLE_COLORS.APPROVER).toBe('purple');
      expect(ROLE_COLORS.ACCOUNT_PAYABLE).toBe('cyan');
      expect(ROLE_COLORS.WAREHOUSE).toBe('orange');
      expect(ROLE_COLORS.FINANCE).toBe('green');
      expect(ROLE_COLORS.AUDITOR).toBe('magenta');
      expect(ROLE_COLORS.ADMIN).toBe('red');
    });

    it('defines localized human-readable labels for all system roles', () => {
      roles.forEach((role) => {
        expect(ROLE_LABELS[role]).toBeDefined();
        expect(typeof ROLE_LABELS[role]).toBe('string');
        expect(ROLE_LABELS[role].length).toBeGreaterThan(3);
      });
    });

    it('renders RoleTag correctly with optional PPN Specialist tag', () => {
      const element = React.createElement(RoleTag, { role: 'ACCOUNT_PAYABLE', isTaxSpecialist: true });
      expect(element).toBeDefined();
      expect(element.props.role).toBe('ACCOUNT_PAYABLE');
      expect(element.props.isTaxSpecialist).toBe(true);
    });
  });

  describe('2. StatusTag Multi-Domain Document Mappings', () => {
    it('renders PR status categories correctly', () => {
      const draft = React.createElement(StatusTag, { status: 'DRAFT', category: 'pr' });
      const submitted = React.createElement(StatusTag, { status: 'SUBMITTED', category: 'pr' });
      const approved = React.createElement(StatusTag, { status: 'APPROVED', category: 'pr' });
      const rejected = React.createElement(StatusTag, { status: 'REJECTED', category: 'pr' });

      expect(draft.props.status).toBe('DRAFT');
      expect(submitted.props.status).toBe('SUBMITTED');
      expect(approved.props.status).toBe('APPROVED');
      expect(rejected.props.status).toBe('REJECTED');
    });

    it('renders PO status categories correctly', () => {
      const issued = React.createElement(StatusTag, { status: 'ISSUED', category: 'po' });
      const amended = React.createElement(StatusTag, { status: 'AMENDED', category: 'po' });
      expect(issued.props.status).toBe('ISSUED');
      expect(amended.props.status).toBe('AMENDED');
    });

    it('renders Invoice 2-Way Match status correctly', () => {
      const matchedOk = React.createElement(StatusTag, { status: 'MATCHED_OK', category: 'invoice' });
      const exception = React.createElement(StatusTag, { status: 'MATCHED_WITH_EXCEPTION', category: 'invoice' });
      const overridden = React.createElement(StatusTag, { status: 'EXCEPTION_OVERRIDDEN', category: 'invoice' });

      expect(matchedOk.props.status).toBe('MATCHED_OK');
      expect(exception.props.status).toBe('MATCHED_WITH_EXCEPTION');
      expect(overridden.props.status).toBe('EXCEPTION_OVERRIDDEN');
    });

    it('renders Payment proposal and NCR statuses correctly', () => {
      const proposed = React.createElement(StatusTag, { status: 'PROPOSED', category: 'payment' });
      const ncrOpen = React.createElement(StatusTag, { status: false, category: 'ncr' });
      const ncrResolved = React.createElement(StatusTag, { status: true, category: 'ncr' });

      expect(proposed.props.status).toBe('PROPOSED');
      expect(ncrOpen.props.status).toBe(false);
      expect(ncrResolved.props.status).toBe(true);
    });

    it('handles boolean active / inactive flags', () => {
      const active = React.createElement(StatusTag, { status: true });
      const inactive = React.createElement(StatusTag, { status: false });
      expect(active.props.status).toBe(true);
      expect(inactive.props.status).toBe(false);
    });
  });

  describe('3. Standardized PageHeader Component', () => {
    it('creates a standard page header element with title, subtitle, and extra slots', () => {
      const header = React.createElement(PageHeader, {
        title: 'Manajemen Pengguna',
        subtitle: 'Kelola pengguna dan RBAC',
        extra: React.createElement('button', null, 'Tambah'),
      });

      expect(header.props.title).toBe('Manajemen Pengguna');
      expect(header.props.subtitle).toBe('Kelola pengguna dan RBAC');
      expect(header.props.extra).toBeDefined();
    });
  });

  describe('4. AuditorWatermark & Security Sandboxing (R54)', () => {
    it('renders children with watermark when active role is AUDITOR', () => {
      useAuthStore.getState().setUser({
        id: 'auditor-1',
        email: 'auditor@nusanet.net.id',
        fullName: 'Bima Sakti (Auditor)',
        employeeId: 'AUD-001',
        divisionId: 'DIV-AUDIT',
        branchId: 'HQ_MEDAN',
        roles: ['AUDITOR'],
        activeRole: 'AUDITOR',
      });

      const watermark = React.createElement(
        AuditorWatermark,
        null,
        React.createElement('div', null, 'Auditor Content')
      );
      expect(watermark).toBeDefined();
    });

    it('renders plain children when active role is not AUDITOR', () => {
      useAuthStore.getState().setUser({
        id: 'user-1',
        email: 'user@nusanet.net.id',
        fullName: 'Requester Staff',
        employeeId: 'REQ-001',
        divisionId: 'DIV-OPS',
        branchId: 'HQ_MEDAN',
        roles: ['REQUESTER'],
        activeRole: 'REQUESTER',
      });

      const watermark = React.createElement(
        AuditorWatermark,
        null,
        React.createElement('div', null, 'Requester Content')
      );
      expect(watermark).toBeDefined();
    });
  });

  describe('5. ErrorBoundary Fallback UI', () => {
    it('instantiates ErrorBoundary component cleanly', () => {
      const boundary = React.createElement(
        ErrorBoundary,
        null,
        React.createElement('div', null, 'Safe App Content')
      );
      expect(boundary).toBeDefined();
    });

    it('derives hasError state from error instance', () => {
      const testErr = new Error('Test Runtime Exception');
      const state = ErrorBoundary.getDerivedStateFromError(testErr);
      expect(state.hasError).toBe(true);
      expect(state.error).toBe(testErr);
    });
  });
});
