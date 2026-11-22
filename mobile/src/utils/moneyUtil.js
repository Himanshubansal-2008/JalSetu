/**
 * moneyUtil.js
 * Pure JavaScript helpers for converting between rupees and paise.
 * No dependencies or framework imports.
 */

export function rupeesToPaise(text) {
  if (text === null || text === undefined) return null;
  const trimmed = String(text).trim();
  if (trimmed === '') return null;

  // Replace one comma with dot (some mobile keyboards provide comma as decimal point)
  const normalized = trimmed.replace(',', '.');

  // Accept only non-negative amounts with up to 2 decimal digits
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) {
    return NaN;
  }

  const parts = normalized.split('.');
  const whole = parseInt(parts[0], 10);
  const decimals = parts.length > 1 ? parts[1].padEnd(2, '0') : '00';
  const paise = parseInt(decimals, 10);

  return whole * 100 + paise;
}

export function paiseToRupees(paise) {
  if (paise === null || paise === undefined || paise === '') return '';
  const num = Number(paise);
  if (isNaN(num)) return '';

  const whole = Math.floor(num / 100);
  const remainder = num % 100;

  if (remainder === 0) {
    return String(whole);
  }

  return `${whole}.${String(remainder).padStart(2, '0')}`;
}

export function formatRupees(paise) {
  if (paise === null || paise === undefined || paise === '') return '';
  const num = Number(paise);
  if (isNaN(num)) return '';

  const whole = Math.floor(num / 100);
  const remainder = num % 100;

  let wholeStr = String(whole);
  if (whole >= 1000) {
    const lastThree = wholeStr.slice(-3);
    const otherNumbers = wholeStr.slice(0, -3);
    const formattedOthers = otherNumbers.replace(/\B(?=(\d{2})+(?!\d))/g, ',');
    wholeStr = `${formattedOthers},${lastThree}`;
  }

  const decStr = remainder > 0 ? `.${String(remainder).padStart(2, '0')}` : '';
  return `₹${wholeStr}${decStr}`;
}
