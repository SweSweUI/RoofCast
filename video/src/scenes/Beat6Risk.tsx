import React from 'react';
import { useCurrentFrame, useVideoConfig, spring, interpolate } from 'remotion';
import { COLORS } from '../theme';

const RISK_SIGNALS = [
  { id: 1, signal: 'Rain forecast >3 days next week', confidence: 82, category: 'Weather', color: '#38bdf8' },
  { id: 2, signal: 'Milestone slip >5 days (Roofing NL)', confidence: 74, category: 'Operations', color: COLORS.amber },
  { id: 3, signal: 'Invoice trigger delay ≥2 weeks', confidence: 68, category: 'Billing', color: COLORS.risk },
  { id: 4, signal: 'Cash-in lag exceeds 45 days (Exact GL)', confidence: 71, category: 'Receivables', color: COLORS.risk },
  { id: 5, signal: 'Covenant floor breach W5–W7', confidence: 61, category: 'Liquidity', color: COLORS.risk },
  { id: 6, signal: 'Subcontractor payroll pressure (Gilde)', confidence: 56, category: 'Cash-out', color: COLORS.amber },
  { id: 7, signal: 'Wet workdays t+3 catch-up spike', confidence: 77, category: 'Weather', color: '#38bdf8' },
  { id: 8, signal: 'Material cost overrun >8%', confidence: 48, category: 'Cost', color: COLORS.amber },
];

const TRACEABILITY_CHAIN = [
  { step: 'Source txns', detail: '9,958 reconciled', color: COLORS.teal },
  { step: 'Drivers', detail: 'Rain, milestones, terms', color: '#38bdf8' },
  { step: 'Assumptions', detail: 'Net 30–45, floor €2.1M', color: COLORS.amber },
  { step: 'Forecast', detail: '13-week per week', color: COLORS.tealLight },
  { step: 'Audit trail', detail: 'Every number sourced', color: COLORS.white },
];

function confidenceColor(c: number): string {
  if (c >= 75) return COLORS.teal;
  if (c >= 60) return COLORS.amber;
  return COLORS.risk;
}

export const Beat6Risk: React.FC<{ startFrame: number }> = ({ startFrame }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const local = frame - startFrame;

  const titleOpacity = interpolate(local, [0, 20], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const traceOpacity = interpolate(local, [50, 70], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        background: COLORS.ink,
        display: 'flex',
        flexDirection: 'column',
        fontFamily: "'Helvetica Neue', Arial, sans-serif",
        padding: '48px 80px',
        boxSizing: 'border-box',
      }}
    >
      {/* Header */}
      <div style={{ opacity: titleOpacity, marginBottom: 28 }}>
        <div style={{ fontSize: 14, color: COLORS.risk, fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 8 }}>
          Risk Signals + Full Traceability
        </div>
        <div style={{ fontSize: 40, fontWeight: 800, color: COLORS.white }}>
          8 weather-to-cash risk signals.<br />
          <span style={{ color: COLORS.teal }}>Every number traces to source.</span>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 48, flex: 1 }}>
        {/* Risk signal grid */}
        <div style={{ flex: 1 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {RISK_SIGNALS.map((signal, i) => {
              const cardSpring = spring({
                frame: local - 20 - i * 4,
                fps,
                config: { damping: 16, stiffness: 120 },
              });
              const cc = confidenceColor(signal.confidence);
              return (
                <div
                  key={signal.id}
                  style={{
                    transform: `scale(${cardSpring})`,
                    background: COLORS.slate,
                    border: `1px solid ${signal.color}33`,
                    borderLeft: `3px solid ${signal.color}`,
                    borderRadius: 10,
                    padding: '12px 16px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: 12,
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, color: signal.color, fontWeight: 700, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                      {signal.category}
                    </div>
                    <div style={{ fontSize: 13, color: COLORS.white, lineHeight: 1.4 }}>
                      {signal.signal}
                    </div>
                  </div>
                  <div style={{ textAlign: 'center', minWidth: 52 }}>
                    <div style={{ fontSize: 20, fontWeight: 900, color: cc }}>{signal.confidence}%</div>
                    <div style={{ fontSize: 10, color: COLORS.muted, textTransform: 'uppercase', letterSpacing: '0.07em' }}>conf.</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Traceability chain */}
        <div style={{ width: 280, opacity: traceOpacity }}>
          <div style={{ fontSize: 14, color: COLORS.muted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 20 }}>
            Audit trail
          </div>
          {TRACEABILITY_CHAIN.map((step, i) => {
            const stepSpring = spring({ frame: local - 52 - i * 5, fps, config: { damping: 16, stiffness: 100 } });
            return (
              <div key={step.step} style={{ opacity: stepSpring, marginBottom: 0 }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                }}>
                  <div style={{
                    width: 36,
                    height: 36,
                    borderRadius: '50%',
                    background: `${step.color}22`,
                    border: `2px solid ${step.color}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 14,
                    fontWeight: 800,
                    color: step.color,
                    flexShrink: 0,
                  }}>
                    {i + 1}
                  </div>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: step.color }}>{step.step}</div>
                    <div style={{ fontSize: 12, color: COLORS.muted }}>{step.detail}</div>
                  </div>
                </div>
                {i < TRACEABILITY_CHAIN.length - 1 && (
                  <div style={{ marginLeft: 17, width: 2, height: 20, background: `${step.color}44` }} />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
