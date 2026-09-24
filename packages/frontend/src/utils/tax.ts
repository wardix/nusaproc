/**
 * Utility functions for NPWP (Nomor Pokok Wajib Pajak) masking and validation
 * Supports both legacy 15-digit format and new 16-digit Coretax / PMK 112/2022 format.
 */

/**
 * Masks raw input string into standard NPWP display format:
 * - 15 digits: XX.XXX.XXX.X-XXX.XXX
 * - 16 digits: XX.XXX.XXX.X-XXX.XXXX
 */
export function maskNpwp(value: string | undefined | null): string {
  if (!value) return '';
  const digits = value.replace(/\D/g, '').slice(0, 16);
  if (!digits) return '';

  if (digits.length <= 2) {
    return digits;
  }
  if (digits.length <= 5) {
    return `${digits.slice(0, 2)}.${digits.slice(2)}`;
  }
  if (digits.length <= 8) {
    return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5)}`;
  }
  if (digits.length <= 9) {
    return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}.${digits.slice(8)}`;
  }
  if (digits.length <= 12) {
    return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}.${digits.slice(8, 9)}-${digits.slice(9)}`;
  }
  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}.${digits.slice(8, 9)}-${digits.slice(9, 12)}.${digits.slice(12)}`;
}

/**
 * Strips all non-digit characters from an NPWP string.
 */
export function cleanNpwp(value: string | undefined | null): string {
  if (!value) return '';
  return value.replace(/\D/g, '');
}

export interface NpwpValidationResult {
  isValid: boolean;
  digitCount: number;
  message?: string;
}

/**
 * Validates whether the given NPWP string contains exactly 15 or 16 numeric digits.
 */
export function validateNpwp(value: string | undefined | null): NpwpValidationResult {
  if (!value || !value.trim()) {
    return {
      isValid: false,
      digitCount: 0,
      message: 'NPWP wajib diisi',
    };
  }

  const digits = cleanNpwp(value);
  if (digits.length === 15 || digits.length === 16) {
    return {
      isValid: true,
      digitCount: digits.length,
    };
  }

  return {
    isValid: false,
    digitCount: digits.length,
    message: `NPWP harus terdiri dari 15 digit (format lama) atau 16 digit (Coretax). Saat ini: ${digits.length} digit.`,
  };
}
