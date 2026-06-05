import React from 'react';
import { useCurrentFrame, useVideoConfig, spring, interpolate } from 'remotion';
import { COLORS } from '../theme';

// 13-week forecast data (illustrative model output, not real bank cashflow)
const WEEKS = [
  { w: 'W1', billing: 380, cashIn: 290, cashOut: 310, net: -20 },
  { w: 'W2', billing: 420, cashIn: 310, cashOut: 295, net: 15 },
  { w: 'W3', billing: 390, cashIn: 360, cashOut: 305, net: 55 },
  { w: 'W4', billing: 445, cashIn: 400, cashOut: 315, net: 85 },
  { w: 'W5', billing: 410, cashIn: 385, cashOut: 300, net: 85 },
  { w: 'W6', billing: 380, cashIn: 370, cashOut: 290, net: 80 },
  { w: 'W7', billing: 460, cashIn: 415, cashOut: 320, net: 95 },
  { w: 'W8', billing: 430, cashIn: 395, cashOut: 310, net: 85 },
  { w: 'W9', billing: 470, cashIn: 420, cashOut: 305, net: 115 },
  { w: 'W10', billing: 450, cashIn: 410, cashOut: 315, net: 95 },
  { w: 'W11', billing: 440, cashIn: 400, cashOut: 300, net: 100 },
  { w: 'W12', billing: 480, cashIn: 440, cashOut: 320, net: 120 },
  { w: 'W13', billing: 490, cashIn: 455, cashOut: 310, net: 145 },
];

const MAX_VAL = 490;
const BAR_MAX_H = 140;

export const Beat4Forecast: React.FC<{ startFrame: number }> = ({ startFrame }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const local = frame - startFrame;

  const titleOpacity = interpolate(local, [0, 20], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const assumptionsOpacity = interpolate(local, [50, 70], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

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
        <div style={{ fontSize: 14, color: COLORS.teal, fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 8 }}>
          13-Week Billing-to-Cash Forecast
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
          <div style={{ fontSize: 38, fontWeight: 800, color: COLORS.white }}>
            Portfolio Base Scenario — Net ≈ <span style={{ color: COLORS.teal }}>€2.29M</span>
          </div>
          <div style={{ fontSize: 14, color: COLORS.amber, fontWeight: 700, background: `${COLORS.amber}22`, border: `1px solid ${COLORS.amber}55`, borderRadius: 8, padding: '6px 14px' }}>
            Min liquidity floor: €2.1M
          </div>
        </div>
      </div>

      {/* Chart */}
      <div style={{ opacity: titleOpacity, flex: 1, display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: BAR_MAX_H + 40, marginBottom: 8 }}>
          {WEEKS.map((week, i) => {
            const barSpring = spring({
              frame: local - 20 - i * 3,
              fps,
              config: { damping: 20, stiffness: 100 },
            });
            const cashInH = (week.cashIn / MAX_VAL) * BAR_MAX_H * barSpring;
            const cashOutH = (week.cashOut / MAX_VAL) * BAR_MAX_H * barSpring;
            const isNeg = week.net < 0;
            return (
              <div key={week.w} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1, gap: 2 }}>
                {/* Net indicator dot */}
                <div style={{
                  width: 8, height: 8, borderRadius: '50%',
                  background: isNeg ? COLORS.risk : COLORS.teal,
                  opacity: barSpring > 0.5 ? 1 : 0,
                  marginBottom: 4,
                }} />
                {/* Bars side by side */}
                <div style={{ display: 'flex', gap: 2, alignItems: 'flex-end' }}>
                  <div style={{
                    width: 18,
                    height: `${cashInH}px`,
                    background: `linear-gradient(180deg, ${COLORS.teal} 0%, ${COLORS.tealDark} 100%)`,
                    borderRadius: '3px 3px 0 0',
                  }} />
                  <div style={{
                    width: 18,
                    height: `${cashOutH}px`,
                    background: `linear-gradient(180deg, ${COLORS.risk}cc 0%, ${COLORS.risk}66 100%)`,
                    borderRadius: '3px 3px 0 0',
                  }} />
                </div>
                <div style={{ fontSize: 10, color: COLORS.muted, fontWeight: 600 }}>{week.w}</div>
              </div>
            );
          })}
        </div>
        {/* Axis line */}
        <div style={{ width: '100%', height: 2, background: COLORS.slateLight }} />

        {/* Legend */}
        <div style={{ display: 'flex', gap: 24, marginTop: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 16, height: 8, background: COLORS.teal, borderRadius: 2 }} />
            <span style={{ fontSize: 13, color: COLORS.muted }}>Cash In</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 16, height: 8, background: COLORS.risk, borderRadius: 2 }} />
            <span style={{ fontSize: 13, color: COLORS.muted }}>Cash Out</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: COLORS.teal }} />
            <span style={{ fontSize: 13, color: COLORS.muted }}>Positive net</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: COLORS.risk }} />
            <span style={{ fontSize: 13, color: COLORS.muted }}>Negative net</span>
          </div>
          <div style={{ marginLeft: 'auto', fontSize: 12, color: COLORS.muted, fontStyle: 'italic' }}>
            €k per week — model output, not real bank cashflow
          </div>
        </div>
      </div>

      {/* Explicit assumptions */}
      <div style={{ opacity: assumptionsOpacity, marginTop: 16 }}>
        <div style={{ display: 'flex', gap: 20 }}>
          {[
            { label: 'Payment terms', value: 'Net 30–45 days' },
            { label: 'Cash-out drivers', value: 'Wages, materials, subcon' },
            { label: 'Opening cash', value: '€2.4M (modelled)' },
            { label: 'Covenant floor', value: '€2.1M minimum' },
          ].map((item) => (
            <div key={item.label} style={{
              background: COLORS.slate,
              border: `1px solid ${COLORS.border}`,
              borderRadius: 10,
              padding: '10px 18px',
              flex: 1,
            }}>
              <div style={{ fontSize: 11, color: COLORS.muted, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>{item.label}</div>
              <div style={{ fontSize: 15, color: COLORS.white, fontWeight: 700 }}>{item.value}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
