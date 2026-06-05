'use client';
import type { ForecastWeek } from '@/lib/types';
import { eur, signedEur, weekRange } from '@/lib/format';
import { Pill, RiskBadge, Td, Th } from './ui';

/** The 13-week forecast table. Click a row to open the traceability drawer. */
export function WeekTable({
  weeks,
  onPick,
  showHeadroom = true,
}: {
  weeks: ForecastWeek[];
  onPick?: (weekStart: string) => void;
  showHeadroom?: boolean;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[760px]">
        <thead>
          <tr>
            <Th>Week</Th>
            <Th>Weather</Th>
            <Th right>Cash-in</Th>
            <Th right>Cash-out</Th>
            <Th right>Net</Th>
            <Th right>Closing</Th>
            {showHeadroom && <Th right>Headroom</Th>}
            <Th>Risk</Th>
            <Th></Th>
          </tr>
        </thead>
        <tbody>
          {weeks.map((w) => (
            <tr
              key={w.weekStart}
              className={onPick ? 'cursor-pointer hover:bg-panel-sunken' : ''}
              onClick={() => onPick?.(w.weekStart)}
            >
              <Td>
                <div className="font-medium text-ink">{weekRange(w.weekStart)}</div>
                <div className="text-2xs text-ink-faint">W{w.weekIndex}</div>
              </Td>
              <Td>
                <div className="flex items-center gap-1.5">
                  <RiskBadge level={w.weatherRisk} />
                  {w.isLiveWeather ? (
                    <Pill tone="live">live</Pill>
                  ) : (
                    <Pill tone="muted">seasonal</Pill>
                  )}
                </div>
                <div className="mt-0.5 text-2xs text-ink-faint tnum">
                  {w.expectedRainWorkdays} rain workdays
                </div>
              </Td>
              <Td right>{eur(w.forecastCashIn)}</Td>
              <Td right>{eur(w.forecastCashOut)}</Td>
              <Td right>
                <span className={w.netCashFlow < 0 ? 'text-risk-high' : 'text-ink-soft'}>
                  {signedEur(w.netCashFlow)}
                </span>
              </Td>
              <Td right>{eur(w.closingCash)}</Td>
              {showHeadroom && (
                <Td right>
                  {w.covenantHeadroom == null ? (
                    <span className="text-ink-faint">–</span>
                  ) : (
                    <span className={w.covenantHeadroom < 0 ? 'text-risk-high' : 'text-ink-soft'}>
                      {signedEur(w.covenantHeadroom)}
                    </span>
                  )}
                </Td>
              )}
              <Td>
                <RiskBadge level={w.riskLevel} />
              </Td>
              <Td className="text-2xs text-accent">{onPick ? 'trace →' : ''}</Td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
