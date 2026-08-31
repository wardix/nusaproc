import dayjs from 'dayjs';
import 'dayjs/locale/id';
import relativeTime from 'dayjs/plugin/relativeTime.js';
import localizedFormat from 'dayjs/plugin/localizedFormat.js';
import customParseFormat from 'dayjs/plugin/customParseFormat.js';

dayjs.extend(relativeTime);
dayjs.extend(localizedFormat);
dayjs.extend(customParseFormat);
dayjs.locale('id');

export { dayjs };

/**
 * Format date to standard Indonesian display (e.g. "31 Agu 2026")
 */
export function formatDate(
  date: string | number | Date | dayjs.Dayjs | null | undefined,
  formatPattern: string = 'DD MMM YYYY'
): string {
  if (!date) return '-';
  const d = dayjs(date);
  if (!d.isValid()) return '-';
  return d.format(formatPattern);
}

/**
 * Format datetime to standard Indonesian display (e.g. "31 Agu 2026, 12:30 WIB")
 */
export function formatDateTime(
  date: string | number | Date | dayjs.Dayjs | null | undefined,
  formatPattern: string = 'DD MMM YYYY, HH:mm [WIB]'
): string {
  if (!date) return '-';
  const d = dayjs(date);
  if (!d.isValid()) return '-';
  return d.format(formatPattern);
}

/**
 * Format relative time (e.g. "2 jam yang lalu", "dalam 5 menit")
 */
export function formatRelativeTime(
  date: string | number | Date | dayjs.Dayjs | null | undefined
): string {
  if (!date) return '-';
  const d = dayjs(date);
  if (!d.isValid()) return '-';
  return d.fromNow();
}
