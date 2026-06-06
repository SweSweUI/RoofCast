'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import clsx from 'clsx';
import { useEffect, useState, type ReactNode } from 'react';
import type { Company } from '@/lib/types';
import { useApi, useDashboardState } from '@/lib/client/hooks';
import { createSupabaseBrowser } from '@/lib/supabase/client';
import { ROLE_LABEL, canAccess, type Role } from '@/lib/rbac';
import type { SessionUser } from '@/lib/supabase/server';
import { Pill } from './ui';

const NAV = [
  { href: '/cfo', seg: 'cfo', label: 'CFO', desc: 'Operating cash forecast' },
  { href: '/board', seg: 'board', label: 'PE Board', desc: 'Portfolio & covenants' },
  { href: '/map', seg: 'map', label: 'Map', desc: 'Locations & weather risk' },
  { href: '/agent', seg: 'agent', label: 'Agent', desc: 'Ask forecast questions' },
  { href: '/connectors', seg: 'connectors', label: 'API', desc: 'Accounting connectors' },
  { href: '/opco', seg: 'opco', label: 'Opco MD', desc: 'Single-company ops' },
  { href: '/project', seg: 'project', label: 'Project Lead', desc: 'Weather & schedule' },
  { href: '/data-quality', seg: 'data-quality', label: 'Data Quality', desc: 'Ingestion & assumptions' },
  { href: '/methodology', seg: 'methodology', label: 'Methodology', desc: 'Lag analysis & model' },
  { href: '/admin', seg: 'admin', label: 'Admin', desc: 'Users & data governance' },
];

async function signOut() {
  await createSupabaseBrowser().auth.signOut();
  window.location.assign('/login');
}

export function AppShell({ children, user }: { children: ReactNode; user?: SessionUser | null }) {
  const pathname = usePathname();
  const { company, setCompany } = useDashboardState();
  const { data } = useApi<{ companies: Company[] }>('/api/companies');
  const companies = data?.companies ?? [];

  // collapsible sidebar: hover the left edge to reveal; pin to lock it open.
  const [pinned, setPinned] = useState(false);
  const [hovered, setHovered] = useState(false);
  useEffect(() => {
    setPinned(localStorage.getItem('altis-sidebar-pinned') === '1');
  }, []);
  const togglePin = () =>
    setPinned((p) => {
      const next = !p;
      localStorage.setItem('altis-sidebar-pinned', next ? '1' : '0');
      return next;
    });
  const expanded = pinned || hovered;

  // role-aware nav: with a user, filter by RBAC; without (local mode) hide Admin
  const nav = NAV.filter((n) =>
    user ? canAccess(user.role, n.seg) : n.seg !== 'admin',
  );

  const hideCompany = pathname?.startsWith('/board') || pathname?.startsWith('/map') || pathname?.startsWith('/connectors') || pathname?.startsWith('/data-quality') || pathname?.startsWith('/admin');
  const allowPortfolio = pathname?.startsWith('/cfo');

  return (
    <div className="flex min-h-screen flex-col">
      {/* hackathon data-handling reminder — always visible */}
      <div className="flex items-center justify-center gap-2 bg-amber-100 px-3 py-1 text-center text-2xs text-amber-900">
        <span>⚠ Altis data is anonymised and for the hackathon only — copies must be deleted within 3 days after the event.</span>
      </div>

      <div className="flex min-h-0 flex-1">
        {/* Sidebar — collapsed to a thin strip; hover the left edge to reveal, pin to lock open */}
        <aside
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
          className={clsx(
            'relative z-10 hidden shrink-0 flex-col overflow-hidden border-r border-panel-line bg-panel transition-[width] duration-300 ease-in-out md:flex',
            expanded ? 'w-56' : 'w-4',
          )}
        >
          {/* collapsed hint: arrow inviting hover */}
          <div
            className={clsx(
              'pointer-events-none absolute inset-y-0 left-0 flex w-4 items-center justify-center transition-opacity duration-200',
              expanded ? 'opacity-0' : 'opacity-100',
            )}
            aria-hidden
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4 text-ink-faint" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 6l6 6-6 6" />
            </svg>
          </div>

          {/* full sidebar content — fixed width, clipped while the strip is collapsed */}
          <div
            className={clsx(
              'flex h-full w-56 flex-col transition-opacity duration-200',
              expanded ? 'opacity-100' : 'pointer-events-none opacity-0',
            )}
          >
          <div className="flex items-center gap-2 px-4 py-4">
            <div className="flex h-8 w-8 items-center justify-center rounded bg-ink text-sm font-bold text-white">A</div>
            <div className="leading-tight">
              <div className="text-sm font-semibold text-ink">Altis</div>
              <div className="text-2xs text-ink-faint">Weather-aware cash</div>
            </div>
            <button
              onClick={togglePin}
              title={pinned ? 'Unpin sidebar (auto-collapse on leave)' : 'Pin sidebar open'}
              aria-pressed={pinned}
              className={clsx(
                'ml-auto rounded-md p-1.5 transition-colors',
                pinned ? 'bg-ink text-white' : 'text-ink-faint hover:bg-panel-sunken hover:text-ink-soft',
              )}
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M15 6l-6 6 6 6" />
              </svg>
            </button>
          </div>
          <nav className="flex-1 px-2 py-2">
            {nav.map((n) => {
              const active = pathname?.startsWith(n.href);
              return (
                <Link
                  key={n.href}
                  href={`${n.href}?company=${encodeURIComponent(company)}`}
                  className={clsx(
                    'mb-0.5 block rounded-md px-3 py-2 text-sm transition-colors',
                    active ? 'bg-ink text-white' : 'text-ink-soft hover:bg-panel-sunken',
                  )}
                >
                  <div className="font-medium">{n.label}</div>
                  <div className={clsx('text-2xs', active ? 'text-white/70' : 'text-ink-faint')}>{n.desc}</div>
                </Link>
              );
            })}
          </nav>
          {/* user / sign-out */}
          <div className="border-t border-panel-line px-3 py-3">
            {user ? (
              <div>
                <div className="truncate text-2xs font-medium text-ink-soft">{user.email}</div>
                <div className="mt-1 flex items-center justify-between">
                  <Pill tone="accent">{ROLE_LABEL[(user.role as Role)] ?? user.role}</Pill>
                  <button onClick={signOut} className="text-2xs text-ink-muted hover:text-risk-high">Sign out</button>
                </div>
              </div>
            ) : (
              <div className="text-2xs text-ink-faint">Local mode · no auth</div>
            )}
          </div>
          </div>
        </aside>

        {/* Main column */}
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-20 flex flex-wrap items-center justify-between gap-3 border-b border-panel-line bg-panel/95 px-4 py-2.5 backdrop-blur">
            <Pill tone="live" title="The operating forecast uses live Open-Meteo data for the near term and seasonal climatology beyond that window.">
              ● Live weather forecast
            </Pill>

            <div className="flex items-center gap-3">
              {!hideCompany && (
                <label className="flex items-center gap-1.5 text-xs text-ink-muted">
                  <span className="uppercase tracking-wide text-ink-faint">Company</span>
                  <select
                    value={company}
                    onChange={(e) => setCompany(e.target.value)}
                    className="rounded-md border border-panel-line bg-panel px-2 py-1 text-xs text-ink focus:outline-none focus:ring-2 focus:ring-accent/40"
                  >
                    {allowPortfolio && <option value="portfolio">Portfolio (all opcos)</option>}
                    {companies.map((c) => (
                      <option key={c.code} value={c.code}>{c.shortName}</option>
                    ))}
                  </select>
                </label>
              )}
              {user && (
                <button onClick={signOut} className="rounded-md border border-panel-line px-2 py-1 text-2xs text-ink-muted hover:text-risk-high md:hidden">
                  Sign out
                </button>
              )}
            </div>
          </header>

          <main className="mx-auto w-full max-w-7xl flex-1 p-4 md:p-6">{children}</main>
        </div>
      </div>
    </div>
  );
}
