import { describe, it, expect } from 'bun:test';
import { formatDate, formatDateTime, formatRelativeTime, dayjs } from '../../src/utils/date';
import { formatRupiah, formatRupiahCompact, parseRupiah } from '../../src/utils/currency';
import { STATUS_LABELS, ROLE_LABELS } from '../../src/components/common/StatusTag';

describe('Issue #49: i18n Date (Dayjs ID Locale), Rupiah Currency & Glossary Standardization', () => {
  describe('1. Currency Formatter (formatRupiah, formatRupiahCompact, parseRupiah)', () => {
    it('formats standard Rupiah amount properly with IDR symbol and thousands separator', () => {
      expect(formatRupiah(25000000)).toBe('Rp 25.000.000');
      expect(formatRupiah(1500750)).toBe('Rp 1.500.750');
      expect(formatRupiah('50000000')).toBe('Rp 50.000.000');
    });

    it('handles 0, null, undefined, empty string and NaN gracefully', () => {
      expect(formatRupiah(0)).toBe('Rp 0');
      expect(formatRupiah(null)).toBe('Rp 0');
      expect(formatRupiah(undefined)).toBe('Rp 0');
      expect(formatRupiah('')).toBe('Rp 0');
      expect(formatRupiah('invalid_number')).toBe('Rp 0');
    });

    it('formats compact Rupiah for dashboard statistics', () => {
      expect(formatRupiahCompact(75000000)).toBe('Rp 75 Juta');
      expect(formatRupiahCompact(1500000000)).toBe('Rp 1,5 Miliar');
      expect(formatRupiahCompact(2000000000000)).toBe('Rp 2 Triliun');
      expect(formatRupiahCompact(500000)).toBe('Rp 500 Ribu');
      expect(formatRupiahCompact(0)).toBe('Rp 0');
      expect(formatRupiahCompact(null)).toBe('Rp 0');
    });

    it('parses formatted Rupiah string back to numeric value', () => {
      expect(parseRupiah('Rp 25.000.000')).toBe(25000000);
      expect(parseRupiah('Rp 1.500.750,50')).toBe(1500750.5);
      expect(parseRupiah('')).toBe(0);
    });
  });

  describe('2. Date & Time Formatter with Indonesian Locale (Dayjs)', () => {
    it('sets Dayjs default locale to Indonesian (id)', () => {
      expect(dayjs.locale()).toBe('id');
    });

    it('formats dates in Indonesian short month format (DD MMM YYYY)', () => {
      const d = '2026-08-31';
      const formatted = formatDate(d);
      expect(formatted).toContain('2026');
      expect(formatted).toMatch(/31\s+Ag(t|u(s)?)\s+2026/i);
    });

    it('handles null, undefined and invalid dates gracefully', () => {
      expect(formatDate(null)).toBe('-');
      expect(formatDate(undefined)).toBe('-');
      expect(formatDate('')).toBe('-');
      expect(formatDate('invalid-date')).toBe('-');
    });

    it('formats date and time in standard Indonesian display', () => {
      const d = '2026-08-31T14:30:00.000Z';
      const formatted = formatDateTime(d);
      expect(formatted).toContain('2026');
      expect(formatted).toContain('WIB');
    });

    it('formats relative time in Indonesian', () => {
      const now = new Date();
      expect(formatRelativeTime(now)).toMatch(/(beberapa detik|baru saja|yang lalu)/i);
    });
  });

  describe('3. Indonesian Procurement Glossary & Status Labels', () => {
    it('provides standardized Indonesian role labels', () => {
      expect(ROLE_LABELS['REQUESTER']).toBe('Pengaju (Requester)');
      expect(ROLE_LABELS['APPROVER']).toBe('Penyetuju (Approver)');
      expect(ROLE_LABELS['ACCOUNT_PAYABLE']).toBe('Hutang Usaha (Account Payable)');
      expect(ROLE_LABELS['WAREHOUSE']).toBe('Gudang (Warehouse)');
      expect(ROLE_LABELS['FINANCE']).toBe('Keuangan (Finance)');
      expect(ROLE_LABELS['AUDITOR']).toBe('Auditor Internal');
      expect(ROLE_LABELS['ADMIN']).toBe('Administrator Sistem');
    });

    it('provides standardized status tags for all procurement categories', () => {
      // PR
      expect(STATUS_LABELS['PR:DRAFT']).toBe('Draft');
      expect(STATUS_LABELS['PR:SUBMITTED']).toBe('Diajukan');
      expect(STATUS_LABELS['PR:APPROVED']).toBe('Disetujui');
      expect(STATUS_LABELS['PR:REJECTED']).toBe('Ditolak');

      // PO
      expect(STATUS_LABELS['PO:ISSUED']).toBe('Diterbitkan (Issued)');
      expect(STATUS_LABELS['PO:AMENDED']).toBe('Diamandemen');

      // Invoice
      expect(STATUS_LABELS['INVOICE:MATCHED_OK']).toBe('Cocok Sempurna (Matched)');
      expect(STATUS_LABELS['INVOICE:MATCHED_WITH_EXCEPTION']).toBe('Selisih (Exception)');

      // Payment
      expect(STATUS_LABELS['PAYMENT:PROPOSED']).toBe('Diajukan (Maker)');
      expect(STATUS_LABELS['PAYMENT:CHECKED']).toBe('Diperiksa (Checker)');
      expect(STATUS_LABELS['PAYMENT:EXECUTED']).toBe('Dibayar (Executor)');

      // NCR
      expect(STATUS_LABELS['NCR:RESOLVED']).toBe('Selesai (Resolved)');
      expect(STATUS_LABELS['NCR:OPEN']).toBe('Dalam Investigasi (Open)');
    });
  });
});
