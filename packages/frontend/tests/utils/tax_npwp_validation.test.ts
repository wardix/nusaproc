import { describe, it, expect } from 'bun:test';
import { maskNpwp, cleanNpwp, validateNpwp } from '../../src/utils/tax';

describe('NPWP Masking and Format Validation (15/16 Digit - R17, Coretax)', () => {
  describe('1. cleanNpwp', () => {
    it('returns empty string for null, undefined, or empty values', () => {
      expect(cleanNpwp(null)).toBe('');
      expect(cleanNpwp(undefined)).toBe('');
      expect(cleanNpwp('')).toBe('');
    });

    it('strips all non-digit characters', () => {
      expect(cleanNpwp('01.234.567.8-012.000')).toBe('012345678012000');
      expect(cleanNpwp('NPWP: 01-234-567-8')).toBe('012345678');
    });
  });

  describe('2. maskNpwp (Auto-Formatting)', () => {
    it('handles empty or falsy inputs', () => {
      expect(maskNpwp(null)).toBe('');
      expect(maskNpwp(undefined)).toBe('');
      expect(maskNpwp('')).toBe('');
    });

    it('formats partial input progressively as user types', () => {
      expect(maskNpwp('01')).toBe('01');
      expect(maskNpwp('012')).toBe('01.2');
      expect(maskNpwp('01234')).toBe('01.234');
      expect(maskNpwp('012345')).toBe('01.234.5');
      expect(maskNpwp('01234567')).toBe('01.234.567');
      expect(maskNpwp('012345678')).toBe('01.234.567.8');
      expect(maskNpwp('0123456780')).toBe('01.234.567.8-0');
      expect(maskNpwp('012345678012')).toBe('01.234.567.8-012');
      expect(maskNpwp('0123456780120')).toBe('01.234.567.8-012.0');
    });

    it('formats full 15-digit legacy NPWP correctly', () => {
      const raw15 = '012345678012000';
      expect(maskNpwp(raw15)).toBe('01.234.567.8-012.000');
    });

    it('formats full 16-digit Coretax / PMK 112 NPWP correctly', () => {
      const raw16 = '0123456780120001';
      expect(maskNpwp(raw16)).toBe('01.234.567.8-012.0001');
    });

    it('handles already formatted string or pasted string with dots/dashes', () => {
      expect(maskNpwp('01.234.567.8-012.000')).toBe('01.234.567.8-012.000');
      expect(maskNpwp('01-234-567-8-012-000')).toBe('01.234.567.8-012.000');
    });

    it('limits input to maximum 16 digits', () => {
      const extraDigits = '012345678012000199999';
      expect(maskNpwp(extraDigits)).toBe('01.234.567.8-012.0001');
      expect(cleanNpwp(maskNpwp(extraDigits)).length).toBe(16);
    });
  });

  describe('3. validateNpwp', () => {
    it('rejects empty or whitespace values', () => {
      expect(validateNpwp('').isValid).toBe(false);
      expect(validateNpwp('   ').isValid).toBe(false);
      expect(validateNpwp(null).isValid).toBe(false);
      expect(validateNpwp(undefined).isValid).toBe(false);
    });

    it('accepts valid 15-digit NPWP (formatted or plain digits)', () => {
      const validPlain15 = validateNpwp('012345678012000');
      expect(validPlain15.isValid).toBe(true);
      expect(validPlain15.digitCount).toBe(15);

      const validFormatted15 = validateNpwp('01.234.567.8-012.000');
      expect(validFormatted15.isValid).toBe(true);
      expect(validFormatted15.digitCount).toBe(15);
    });

    it('accepts valid 16-digit Coretax NPWP (formatted or plain digits)', () => {
      const validPlain16 = validateNpwp('0123456780120001');
      expect(validPlain16.isValid).toBe(true);
      expect(validPlain16.digitCount).toBe(16);

      const validFormatted16 = validateNpwp('01.234.567.8-012.0001');
      expect(validFormatted16.isValid).toBe(true);
      expect(validFormatted16.digitCount).toBe(16);
    });

    it('rejects numbers with fewer than 15 digits', () => {
      const shortNpwp = validateNpwp('01.234.567.8-012.00'); // 14 digits
      expect(shortNpwp.isValid).toBe(false);
      expect(shortNpwp.digitCount).toBe(14);
      expect(shortNpwp.message).toContain('14 digit');
    });

    it('rejects numbers with more than 16 digits', () => {
      const longNpwp = validateNpwp('01234567890123456'); // 17 digits
      expect(longNpwp.isValid).toBe(false);
      expect(longNpwp.digitCount).toBe(17);
    });
  });
});
