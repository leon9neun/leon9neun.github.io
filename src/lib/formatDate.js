/**
 * Formats a month like "2024-04" as "04/2024". "heute" stays unchanged.
 * @param {string} value
 * @returns {string}
 */
export function formatMonth(value) {
  const [year, month] = value.split('-');
  return month ? `${month}/${year}` : value;
}

/**
 * Formats the period of a station, e.g. "04/2024 – heute".
 * @param {string} start - "YYYY-MM"
 * @param {string} end - "YYYY-MM" or "heute"
 * @returns {string}
 */
export function formatPeriod(start, end) {
  return `${formatMonth(start)} – ${formatMonth(end)}`;
}
