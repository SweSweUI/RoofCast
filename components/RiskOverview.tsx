'use client';
import clsx from 'clsx';
import { useApi } from '@/lib/client/hooks';
import type { RiskLevel, RiskSignal, Scenario } from '@/lib/types';
import { eurCompact } from '@/lib/format';
import { Card, LoadingBlock, RiskBadge } from './ui';
import { FlippingCard } from './ui/flipping-card';

interface RisksResponse {
  meanConfidence: number;
  signals: RiskSignal[];
}

const ORDER: Record<RiskLevel, number> = { high: 0, medium: 1, low: 2 };
const BORDER: Record<RiskLevel, string> = {
  high: 'border-l-risk-high',
  medium: 'border-l-risk-medium',
  low: 'border-l-risk-low',
};

/** Risk-first overview: the eight weather-to-cash risk signals as cards. */
export function RiskOverview({
  company,
  scenario,
  extra = '',
  horizonWeeks = 13,
}: {
  company: string;
  scenario: Scenario;
  extra?: string;
  horizonWeeks?: number;
}) {
  const { data, loading } = useApi<RisksResponse>(
    `/api/risks?company=${encodeURIComponent(company)}&scenario=${scenario}${extra}`,
  );

  if (loading && !data) return <LoadingBlock label="Assessing risk signals…" />;
  if (!data) return null;

  const signals = [...data.signals].sort((a, b) => ORDER[a.level] - ORDER[b.level]);
  const high = signals.filter((s) => s.level === 'high').length;
  const medium = signals.filter((s) => s.level === 'medium').length;

  return (
    <Card
      title="Risk overview — weather-to-cash"
      subtitle={`Eight signals: where billing/cash timing, assumptions and covenants put the ${horizonWeeks}-week forecast at risk`}
      info="The main things that could throw the forecast off — weather delays, tight cash weeks, and assumptions we had to make. Flip a card to see why it's flagged and where the number comes from."
      right={
        <div className="flex items-center gap-2 text-2xs">
          <span className="rounded bg-red-50 px-1.5 py-0.5 font-medium text-risk-high">{high} high</span>
          <span className="rounded bg-amber-50 px-1.5 py-0.5 font-medium text-risk-medium">{medium} medium</span>
          <span className="rounded bg-panel-sunken px-1.5 py-0.5 font-medium text-ink-muted">
            confidence {data.meanConfidence}%
          </span>
        </div>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {signals.map((s) => (
          <FlippingCard
            key={s.key}
            height={200}
            width={280}
            className={clsx('border-l-4', BORDER[s.level])}
            frontContent={
              <div className="flex h-full w-full flex-col justify-between p-4">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-lg font-semibold leading-tight text-ink">{s.title}</h3>
                  <RiskBadge level={s.level} />
                </div>
                <div className="tnum">
                  {s.eurImpact != null ? (
                    <>
                      <div className="text-3xl font-bold leading-none text-ink">{eurCompact(s.eurImpact)}</div>
                      <div className="mt-1 text-2xs uppercase tracking-wide text-ink-faint">estimated € impact</div>
                    </>
                  ) : (
                    <>
                      <div className="text-3xl font-bold leading-none text-ink">{s.confidence}%</div>
                      <div className="mt-1 text-2xs uppercase tracking-wide text-ink-faint">forecast confidence</div>
                    </>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-0.5 text-sm text-ink-muted tnum">
                  <span>
                    <span className="text-ink-faint">conf </span>
                    <span className="font-semibold text-ink-soft">{s.confidence}%</span>
                  </span>
                  {s.impactedWeeks.length > 0 && (
                    <span>
                      <span className="text-ink-faint">weeks </span>
                      <span className="font-semibold text-ink-soft">{s.impactedWeeks.length}</span>
                    </span>
                  )}
                </div>
              </div>
            }
            backContent={
              <div className="flex h-full w-full flex-col justify-center p-4">
                <p className="text-2xs leading-relaxed text-ink-soft">{s.reason}</p>
                <p className="mt-2 text-[10px] leading-snug text-ink-faint">{s.trace}</p>
              </div>
            }
          />
        ))}
      </div>
    </Card>
  );
}
