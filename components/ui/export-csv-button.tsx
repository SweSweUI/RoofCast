'use client';
import clsx from 'clsx';
import { downloadCsv, type CsvRow } from '@/lib/csv';

/** Small, unobtrusive button that exports the given rows as a CSV file. */
export function ExportCsvButton({
  rows,
  filename,
  columns,
  className,
}: {
  rows: CsvRow[];
  filename: string;
  columns?: string[];
  className?: string;
}) {
  const disabled = !rows || rows.length === 0;
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => downloadCsv(filename, rows, columns)}
      title={disabled ? 'No data to export' : `Export ${rows.length} rows as CSV`}
      aria-label="Export chart data as CSV"
      className={clsx(
        'inline-flex items-center gap-1 rounded-md border border-panel-line bg-panel/85 px-1.5 py-0.5 text-2xs font-medium text-ink-muted shadow-card backdrop-blur transition-colors hover:bg-panel-sunken hover:text-ink disabled:cursor-not-allowed disabled:opacity-40',
        className,
      )}
    >
      <svg
        viewBox="0 0 24 24"
        className="h-3 w-3"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <path d="M12 3v11m0 0l-4-4m4 4l4-4M5 21h14" />
      </svg>
      CSV
    </button>
  );
}
