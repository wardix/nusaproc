/**
 * Standard Indonesian Rupiah Currency Formatter (e.g. "Rp 25.000.000")
 */
export function formatRupiah(
  amount: number | string | null | undefined,
  options?: {
    withSymbol?: boolean;
    minimumFractionDigits?: number;
    maximumFractionDigits?: number;
  }
): string {
  if (amount === null || amount === undefined || amount === '') {
    return 'Rp 0';
  }
  const numericVal = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (isNaN(numericVal)) {
    return 'Rp 0';
  }

  const withSymbol = options?.withSymbol ?? true;
  const minDigits = options?.minimumFractionDigits ?? 0;
  const maxDigits = options?.maximumFractionDigits ?? 2;

  const formatted = new Intl.NumberFormat('id-ID', {
    minimumFractionDigits: minDigits,
    maximumFractionDigits: maxDigits,
  }).format(numericVal);

  return withSymbol ? `Rp ${formatted}` : formatted;
}

/**
 * Compact Indonesian Rupiah Formatter for statistics / dashboards (e.g. "Rp 75 Juta", "Rp 1,5 Miliar")
 */
export function formatRupiahCompact(amount: number | string | null | undefined): string {
  if (amount === null || amount === undefined || amount === '') {
    return 'Rp 0';
  }
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (isNaN(num)) {
    return 'Rp 0';
  }

  const abs = Math.abs(num);
  if (abs >= 1_000_000_000_000) {
    const formatted = (num / 1_000_000_000_000).toLocaleString('id-ID', { maximumFractionDigits: 1 });
    return `Rp ${formatted} Triliun`;
  }
  if (abs >= 1_000_000_000) {
    const formatted = (num / 1_000_000_000).toLocaleString('id-ID', { maximumFractionDigits: 1 });
    return `Rp ${formatted} Miliar`;
  }
  if (abs >= 1_000_000) {
    const formatted = (num / 1_000_000).toLocaleString('id-ID', { maximumFractionDigits: 1 });
    return `Rp ${formatted} Juta`;
  }
  if (abs >= 1_000) {
    const formatted = (num / 1_000).toLocaleString('id-ID', { maximumFractionDigits: 1 });
    return `Rp ${formatted} Ribu`;
  }

  return formatRupiah(num);
}

/**
 * Parse formatted Rupiah string back to number
 */
export function parseRupiah(val: string): number {
  if (!val) return 0;
  const clean = val.replace(/[^0-9,-]/g, '').replace(',', '.');
  const num = parseFloat(clean);
  return isNaN(num) ? 0 : num;
}
