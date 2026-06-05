'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import clsx from 'clsx';
import type { ReactNode } from 'react';
import { SCENARIOS, SCENARIO_LABELS, type Company } from '@/lib/types';
import { useApi, useDashboardState } from '@/lib/client/hooks';
import { Pill } from './ui';

const NAV = [
  { href: '/cfo', label: 'CFO', desc: '13-week operating cash' },
  { href: '/board', label: 'PE Board', desc: 'Portfolio & covenants' },
  { href: '/opco', label: 'Opco MD', desc: 'Single-company ops' },
  { href: '/project', label: 'Project Lead', desc: 'Weather & schedule' },
  { href: '/data-quality', label: 'Data Quality', desc: 'Ingestion & assumptions' },
  { href: '/methodology', label: 'Methodology', desc: 'Lag analysis & model' },
];

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { scenario, company, setScenario, setCompany } = useDashboardState();
  const { data } = useApi<{ companies: Company[] }>('/api/companies');
  const companies = data?.companies ?? [];

  const hideCompany = pathname?.startsWith('/board') || pathname?.startsWith('/data-quality');
  const allowPortfolio = pathname?.startsWith('/cfo');

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className="hidden w-56 shrink-0 flex-col border-r border-panel-line bg-panel md:flex">
        <div className="flex items-center gap-2 px-4 py-4">
          <div className="flex h-8 w-8 items-center justify-center rounded bg-ink text-sm font-bold text-white">
            A
          </div>
          <div className="leading-tight">
            <div className="text-sm font-semibold text-ink">Altis</div>
            <div className="text-2xs text-ink-faint">Weather-aware cash</div>
          </div>
        </div>
        <nav className="flex-1 px-2 py-2">
          {NAV.map((n) => {
            const active = pathname?.startsWith(n.href);
            return (
              <Link
                key={n.href}
                href={`${n.href}?scenario=${scenario}&company=${encodeURIComponent(company)}`}
                className={clsx(
                  'mb-0.5 block rounded-md px-3 py-2 text-sm transition-colors',
                  active
                    ? 'bg-ink text-white'
                    : 'text-ink-soft hover:bg-panel-sunken',
                )}
              >
                <div className="font-medium">{n.label}</div>
                <div className={clsx('text-2xs', active ? 'text-white/70' : 'text-ink-faint')}>
                  {n.desc}
                </div>
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-panel-line px-4 py-3 text-2xs text-ink-faint">
          PE-backed roofing portfolio · prototype
        </div>
      </aside>

      {/* Main column */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Topbar */}
        <header className="sticky top-0 z-20 flex flex-wrap items-center justify-between gap-3 border-b border-panel-line bg-panel/95 px-4 py-2.5 backdrop-blur">
          <div className="flex items-center gap-2">
            <span className="text-2xs font-medium uppercase tracking-wide text-ink-faint">
              Scenario
            </span>
            <div className="inline-flex rounded-md border border-panel-line bg-panel-sunken p-0.5">
              {SCENARIOS.map((s) => (
                <button
                  key={s}
                  onClick={() => setScenario(s)}
                  className={clsx(
                    'rounded px-2.5 py-1 text-xs font-medium transition-colors',
                    scenario === s ? 'bg-ink text-white shadow-sm' : 'text-ink-muted hover:text-ink',
                  )}
                >
                  {SCENARIO_LABELS[s]}
                </button>
              ))}
            </div>
          </div>

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
                    <option key={c.code} value={c.code}>
                      {c.shortName}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <Pill tone="live" title="Near-term weeks use live Open-Meteo forecast">
              ● Live weather
            </Pill>
          </div>
        </header>

        <main className="mx-auto w-full max-w-7xl flex-1 p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
