import React from 'react';
import { useCurrentFrame, useVideoConfig, spring, interpolate } from 'remotion';
import { COLORS } from '../theme';

const LAG_BARS = [
  { label: 't+1', value: -3, note: '' },
  { label: 't+2', value: -7, note: '' },
  { label: 't+3', value: -12, note: 'Peak delay' },
  { label: 't+4', value: +16, note: 'Catch-up surge' },
  { label: 't+5', value: -7, note: 'Fade-out' },
  { label: 't+6', value: +2, note: '' },
];

export const Beat3Weather: React.FC<{ startFrame: number }> = ({ startFrame }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const local = frame - startFrame;

  const titleOpacity = interpolate(local, [0, 20], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const chartOpacity = interpolate(local, [20, 40], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  const MAX_BAR = 80;

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        background: `radial-gradient(ellipse at 30% 20%, #0f2744 0%, ${COLORS.ink} 60%)`,
        display: 'flex',
        flexDirection: 'column',
        fontFamily: "'Helvetica Neue', Arial, sans-serif",
        padding: '56px 100px',
        boxSizing: 'border-box',
      }}
    >
      {/* Header */}
      <div style={{ opacity: titleOpacity, marginBottom: 40 }}>
        <div style={{ fontSize: 14, color: '#38bdf8', fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 12 }}>
          Weather × Cash — Risk Signal
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 20 }}>
          <div style={{ fontSize: 44, fontWeight: 800, color: COLORS.white, lineHeight: 1.2 }}>
            Rain workdays delay roofing milestones
          </div>
        </div>
        <div style={{ fontSize: 18, color: COLORS.muted, marginTop: 8 }}>
          → delayed billing → delayed cash-in. Correlation suggestive, <strong style={{ color: '#38bdf8' }}>not causal</strong> (p ≈ 0.07–0.19)
        </div>
      </div>

      {/* Main layout: lag profile + rain map */}
      <div style={{ display: 'flex', gap: 60, alignItems: 'flex-start', opacity: chartOpacity }}>
        {/* Lag profile chart */}
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 15, color: COLORS.muted, fontWeight: 600, marginBottom: 24, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
            Billing delta vs. rain workdays (percentage points)
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 20, height: 200 }}>
            {LAG_BARS.map((bar, i) => {
              const barSpring = spring({
                frame: local - 30 - i * 5,
                fps,
                config: { damping: 18, stiffness: 100 },
              });
              const height = Math.abs(bar.value) / 16 * MAX_BAR * barSpring;
              const isPos = bar.value > 0;
              const color = isPos ? COLORS.teal : COLORS.risk;
              return (
                <div key={bar.label} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                  {/* Value label */}
                  <div style={{
                    fontSize: 16,
                    fontWeight: 800,
                    color: color,
                    opacity: barSpring > 0.5 ? 1 : 0,
                  }}>
                    {bar.value > 0 ? '+' : ''}{bar.value}pp
                  </div>
                  {/* Bar */}
                  <div style={{
                    width: 64,
                    height: `${height}px`,
                    background: `linear-gradient(${isPos ? '180deg' : '0deg'}, ${color} 0%, ${color}99 100%)`,
                    borderRadius: isPos ? '4px 4px 0 0' : '0 0 4px 4px',
                    marginTop: isPos ? 0 : 0,
                  }} />
                  {/* Axis label */}
                  <div style={{ fontSize: 13, color: COLORS.muted, fontWeight: 600 }}>{bar.label}</div>
                  {/* Note */}
                  {bar.note && (
                    <div style={{ fontSize: 11, color: color, fontWeight: 600, maxWidth: 70, textAlign: 'center', lineHeight: 1.3 }}>
                      {bar.note}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <div style={{ width: '100%', height: 2, background: COLORS.slateLight, marginTop: 4 }} />
        </div>

        {/* Insight callout */}
        <div style={{ width: 380 }}>
          <div style={{ background: COLORS.slate, border: `1px solid ${COLORS.border}`, borderRadius: 16, padding: '28px 32px', marginBottom: 20 }}>
            <div style={{ fontSize: 13, color: '#38bdf8', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 10 }}>
              Mechanism
            </div>
            <div style={{ fontSize: 16, color: COLORS.white, lineHeight: 1.6 }}>
              Roofing cannot proceed on wet days → milestone completion slips → invoice triggers delay → cash receipt lags 3–5 weeks
            </div>
          </div>
          <div style={{ background: COLORS.slate, border: `1px solid ${COLORS.amber}33`, borderRadius: 16, padding: '20px 24px' }}>
            <div style={{ fontSize: 13, color: COLORS.amber, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8 }}>
              Statistical note
            </div>
            <div style={{ fontSize: 14, color: COLORS.muted, lineHeight: 1.6 }}>
              p ≈ 0.07–0.19 across lag windows.<br />
              Pattern is <em>suggestive</em> — incorporated as scenario driver, flagged as uncertain in all outputs.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
