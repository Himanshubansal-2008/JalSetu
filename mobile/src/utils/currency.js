/**
 * currency.js
 * Shared currency formatting and parsing utilities for integer paise.
 * Operates purely on integers to prevent floating-point inaccuracies.
 */

/**
 * Formats a non-negative whole rupee integer using the Indian numbering system:
 * 1250 -> "1,250"
 * 100000 -> "1,00,000"
 */
function formatIndianWholeNumber(wholeNum) {
  const s = String(wholeNum);
  if (s.length <= 3) return s;
  const lastThree = s.slice(-3);
  const otherNumbers = s.slice(0, -3);
  const formattedOthers = otherNumbers.replace(/\B(?=(\d{2})+(?!\d))/g, ',');
  return `${formattedOthers},${lastThree}`;
}

/**
 * Formats integer paise into a human-readable rupee string with two decimal places.
 * e.g.,
 *   125000 -> "₹1,250.00"
 *   0 -> "₹0.00"
 *   -150000 -> "-₹1,500.00"
 *   formatPaiseToRupees(125000, { showSign: true }) -> "+₹1,250.00"
 *   formatPaiseToRupees(-150000, { showSign: true }) -> "-₹1,500.00"
 *
 * @param {number|string|null|undefined} paise
 * @param {{ showSign?: boolean }} [options]
 * @returns {string}
 */
export function formatPaiseToRupees(paise, options = {}) {
  const { showSign = false } = options || {};

  if (paise === null || paise === undefined || paise === '') {
    return '₹0.00';
  }

  const num = Number(paise);
  if (isNaN(num)) {
    return '₹0.00';
  }

  // Integer paise rounding to avoid any float drift
  const totalPaise = Math.round(num);
  const isNegative = totalPaise < 0;
  const absPaise = Math.abs(totalPaise);

  const wholeRupees = Math.floor(absPaise / 100);
  const remainderPaise = absPaise % 100;

  const wholeStr = formatIndianWholeNumber(wholeRupees);
  const decStr = String(remainderPaise).padStart(2, '0');
  const amountStr = `${wholeStr}.${decStr}`;

  if (isNegative) {
    return `-₹${amountStr}`;
  }
  if (showSign && totalPaise > 0) {
    return `+₹${amountStr}`;
  }
  return `₹${amountStr}`;
}

/**
 * Converts user input rupee text into integer paise.
 * Strips currency symbols (₹), commas, and whitespace.
 * Uses Math.round(Number(cleaned) * 100).
 * Returns null if the input is empty or invalid.
 *
 * @param {string|number|null|undefined} rupeeText
 * @returns {number|null}
 */
export function rupeesInputToPaise(rupeeText) {
  if (rupeeText === null || rupeeText === undefined) {
    return null;
  }

  const cleaned = String(rupeeText).replace(/[₹,\s]/g, '').trim();
  if (cleaned === '') {
    return null;
  }

  const num = Number(cleaned);
  if (isNaN(num) || !isFinite(num)) {
    return null;
  }

  return Math.round(num * 100);
}

/**
 * Converts integer paise into a plain rupee string without formatting (e.g. 15000 -> "150", 15050 -> "150.50").
 * Useful for pre-filling text inputs.
 *
 * @param {number|string|null|undefined} paise
 * @returns {string}
 */
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

export const rupeesToPaise = rupeesInputToPaise;
export const formatRupees = formatPaiseToRupees;

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    formatPaiseToRupees,
    rupeesInputToPaise,
    paiseToRupees,
    rupeesToPaise,
    formatRupees,
  };
}
