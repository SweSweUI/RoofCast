export type CsvRow = Record<string, unknown>;

function escapeCell(value: unknown): string {
  if (value == null) return '';
  const s = typeof value === 'number' && Number.isFinite(value) ? String(value) : String(value);
  // Quote when the cell contains a delimiter, quote, or line break.
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Serialize an array of row objects to a CSV string (CRLF line endings). */
export function toCsv(rows: CsvRow[], columns?: string[]): string {
  if (!rows.length) return '';
  const keys = columns ?? Object.keys(rows[0]);
  const header = keys.map(escapeCell).join(',');
  const body = rows
    .map((row) => keys.map((k) => escapeCell(row[k])).join(','))
    .join('\r\n');
  return `${header}\r\n${body}`;
}

/**
 * Build a CSV from the given rows and trigger a browser download. A UTF-8 BOM
 * is prepended so spreadsheet apps (Excel) detect the encoding correctly.
 */
export function downloadCsv(filename: string, rows: CsvRow[], columns?: string[]): void {
  if (typeof window === 'undefined' || !rows.length) return;
  const csv = toCsv(rows, columns);
  const blob = new Blob(['\uFEFF', csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.toLowerCase().endsWith('.csv') ? filename : `${filename}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
