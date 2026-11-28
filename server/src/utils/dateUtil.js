/**
 * Date and timezone utilities for JalSetu.
 * Canonical timezone: Asia/Kolkata (IST, UTC+05:30).
 */

/**
 * Computes exact start and end timestamps and "YYYY-MM" string for a month
 * in Asia/Kolkata (+05:30) timezone.
 *
 * @param {string} [monthStr] Optional month in "YYYY-MM" format. If omitted, uses current IST month.
 * @returns {{ month: string, startDate: Date, endDate: Date } | null}
 */
function getIstMonthBounds(monthStr) {
  let str = monthStr;
  if (!str) {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
    });
    str = formatter.format(new Date()); // e.g. "2026-11" in IST
  }

  if (typeof str !== 'string' || !/^\d{4}-(0[1-9]|1[0-2])$/.test(str)) {
    return null;
  }

  const [yStr, mStr] = str.split('-');
  const year = parseInt(yStr, 10);
  const month = parseInt(mStr, 10);

  if (isNaN(year) || isNaN(month) || month < 1 || month > 12) {
    return null;
  }

  const mPadded = String(month).padStart(2, '0');
  // Start of month in IST: YYYY-MM-01T00:00:00.000+05:30
  const startDate = new Date(`${year}-${mPadded}-01T00:00:00.000+05:30`);

  // End of month in IST: 1 millisecond before the start of next month in IST
  const nextYear = month === 12 ? year + 1 : year;
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextPadded = String(nextMonth).padStart(2, '0');
  const nextStart = new Date(`${nextYear}-${nextPadded}-01T00:00:00.000+05:30`);
  const endDate = new Date(nextStart.getTime() - 1);

  return {
    month: str,
    startDate,
    endDate,
  };
}

module.exports = {
  getIstMonthBounds,
  resolveMonthRange: getIstMonthBounds,
};
