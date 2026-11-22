/**
 * dateUtil.js
 * Pure JavaScript helpers for local date operations (YYYY-MM-DD).
 * Avoids toISOString() to prevent timezone shifting in India (UTC+05:30).
 */

export function dateToString(date) {
  if (!date || !(date instanceof Date) || isNaN(date.getTime())) return '';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function todayString() {
  return dateToString(new Date());
}

export function isoToDateString(iso) {
  if (!iso || typeof iso !== 'string') return '';
  return iso.slice(0, 10);
}

export function dateStringToDate(s) {
  if (!s || typeof s !== 'string') return null;
  const parts = s.split('-');
  if (parts.length !== 3) return null;
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10);
  const day = parseInt(parts[2], 10);
  if (isNaN(year) || isNaN(month) || isNaN(day)) return null;
  return new Date(year, month - 1, day);
}

export function formatDisplay(s) {
  if (!s) return '';
  const d = dateStringToDate(s);
  if (!d || isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}
