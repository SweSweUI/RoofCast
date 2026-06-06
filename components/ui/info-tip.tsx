'use client';
import { useId, useState } from 'react';
import clsx from 'clsx';

/**
 * Small circled-"i" affordance that reveals a plain-language explanation on
 * hover or keyboard focus. Used to surface the methodology right next to the
 * dashboard element it explains (KPIs, charts, tables, risk cards).
 */
export function InfoTip({
  text,
  label,
  align = 'left',
  className,
}: {
  /** Plain-language explanation shown in the tooltip bubble. */
  text: string;
  /** Accessible name for the trigger (defaults to a generic phrase). */
  label?: string;
  /** Which edge the bubble hangs from — use 'right' near the viewport edge. */
  align?: 'left' | 'right';
  className?: string;
}) {
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const open = hovered || focused;
  const id = useId();

  return (
    <span className={clsx('relative inline-flex align-middle', className)}>
      <button
        type="button"
        aria-label={label ?? 'More information'}
        aria-describedby={open ? id : undefined}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        className="inline-flex h-3.5 w-3.5 items-center justify-center rounded-full text-ink-faint/80 transition-colors hover:text-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
      >
        <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5" aria-hidden="true">
          <path
            fillRule="evenodd"
            d="M10 18a8 8 0 100-16 8 8 0 000 16zM9 7a1 1 0 112 0 1 1 0 01-2 0zm.25 2.75a.75.75 0 011.5 0v4.5a.75.75 0 01-1.5 0v-4.5z"
            clipRule="evenodd"
          />
        </svg>
      </button>
      <span
        role="tooltip"
        id={id}
        className={clsx(
          'pointer-events-none absolute top-[1.4rem] z-30 w-56 rounded-md border border-panel-line bg-panel px-2.5 py-2 text-left text-2xs font-normal normal-case leading-relaxed tracking-normal text-ink-soft shadow-card transition-opacity duration-150',
          align === 'right' ? 'right-0' : 'left-0',
          open ? 'opacity-100' : 'invisible opacity-0',
        )}
      >
        {text}
      </span>
    </span>
  );
}
