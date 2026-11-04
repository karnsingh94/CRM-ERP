/**
 * RFC-4180 Compliant CSV Export Utility
 * Zero external dependencies.
 * Includes CSV formula injection (CWE-1236) protection.
 */

const FORMULA_TRIGGERS = ['=', '+', '-', '@', '\t', '\r'];

/**
 * Sanitize cell content against CSV/Spreadsheet formula injection
 * Prepends a single quote if string starts with formula trigger characters.
 */
export function sanitizeCellValue(val) {
  if (val === null || val === undefined) {
    return '';
  }

  // Handle Date
  if (val instanceof Date) {
    return isNaN(val.getTime()) ? '' : val.toISOString().slice(0, 10);
  }

  // Handle Boolean or Number
  if (typeof val === 'number' || typeof val === 'boolean') {
    return String(val);
  }

  // Handle Decimal or objects with toString()
  let str = String(val);

  // Trim whitespace
  const trimmed = str.trim();
  if (trimmed.length > 0 && FORMULA_TRIGGERS.includes(trimmed[0])) {
    str = `'${str}`;
  }

  // Escape quotes according to RFC-4180
  if (str.includes('"') || str.includes(',') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }

  return str;
}

/**
 * Format a Decimal or Numeric value safely to 2 decimal places
 */
export function formatCurrency(val, fallback = '0.00') {
  if (val === null || val === undefined) return fallback;
  const num = Number(val);
  return isNaN(num) ? fallback : num.toFixed(2);
}

/**
 * Generate complete CSV string from headers and data rows
 * @param {Array<{ key: string, label: string, format?: Function }>} headers
 * @param {Array<Object>} rows
 * @param {Object} options
 * @param {boolean} options.includeBom - Include UTF-8 BOM for Excel native compatibility
 * @returns {string} CSV text
 */
export function generateCSV(headers = [], rows = [], options = { includeBom: true }) {
  if (!Array.isArray(headers) || headers.length === 0) {
    throw new Error('Headers array is required for CSV export.');
  }

  const lines = [];

  // Header line
  const headerLine = headers.map((h) => sanitizeCellValue(h.label || h.key)).join(',');
  lines.push(headerLine);

  // Row lines
  for (const row of rows) {
    const rowValues = headers.map((h) => {
      let rawVal = row[h.key];
      if (typeof h.format === 'function') {
        rawVal = h.format(rawVal, row);
      }
      return sanitizeCellValue(rawVal);
    });
    lines.push(rowValues.join(','));
  }

  const content = lines.join('\r\n');
  return options.includeBom ? `\uFEFF${content}` : content;
}

export default {
  sanitizeCellValue,
  formatCurrency,
  generateCSV,
};

