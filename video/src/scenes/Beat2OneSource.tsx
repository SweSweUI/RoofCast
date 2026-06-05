import React from 'react';
import { useCurrentFrame, useVideoConfig, spring, interpolate } from 'remotion';
import { COLORS } from '../theme';

function AnimatedCounter({
  value,
  prefix = '',
  suffix = '',
  frame,
  startFrame,
  fps,
  decimals = 0,
}: {
  value: number;
  prefix?: string;
  suffix?: string;
  frame: number;
  startFrame: number;
  fps: number;
  decimals?: number;
}) {
  const progress = spring({
    frame: frame - startFrame,
    fps,
    config: { damping: 20, stiffness: 80 },
  });
  const displayed = value * Math.min(progress, 1);
  return (
    <span>
      {prefix}
      {displayed.toLocaleString('en-US', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      })}
      {suffix}
    </span>
  );
}

export const Beat2OneSource: React.FC<{ startFrame: number }> = ({ startFrame }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const local = frame - startFrame;

  const fadeIn = interpolate(local, [0, 20], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const lineScale = spring({ frame: local - 20, fps, config: { damping: 18, stiffness: 80 } });
  const kpiOpacity = interpolate(local, [30, 50], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        background: `linear-gradient(180deg, ${COLORS.ink} 0%, #0a1f3a 100%)`,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: "'Helvetica Neue', Arial, sans-serif",
        padding: '60px 100px',
        boxSizing: 'border-box',
      }}
    >
      <div style={{ opacity: fadeIn, textAlign: 'center', marginBottom: 56 }}>
        <div style={{ fontSize: 14, color: COLORS.teal, fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 12 }}>
          One Source of Truth
        </div>
        <div style={{ fontSize: 48, fontWeight: 800, color: COLORS.white, lineHeight: 1.2 }}>
          All 4 companies reconciled<br />
          into <span style={{ color: COLORS.teal }}>one unified data model</span>
        </div>
      </div>

      {/* The pipeline visual */}
      <div style={{ opacity: fadeIn, display: 'flex', alignItems: 'center', gap: 0, marginBottom: 48 }}>
        {['Snelstart', 'Exact GL', 'Gilde', 'Invoices'].map((src, i) => (
          <React.Fragment key={src}>
            <div style={{
              background: COLORS.slateLight,
              border: `1px solid ${COLORS.border}`,
              borderRadius: 8,
              padding: '10px 18px',
              fontSize: 13,
              color: COLORS.muted,
              fontWeight: 600,
              letterSpacing: '0.05em',
            }}>
              {src}
            </div>
            {i < 3 && (
              <div style={{ width: 24, height: 2, background: COLORS.muted, opacity: 0.4 }} />
            )}
          </React.Fragment>
        ))}
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <div style={{
            width: `${lineScale * 80}px`,
            height: 3,
            background: `linear-gradient(90deg, ${COLORS.teal} 0%, ${COLORS.tealLight} 100%)`,
            transition: 'none',
          }} />
          <div style={{
            background: `linear-gradient(135deg, ${COLORS.teal} 0%, ${COLORS.tealDark} 100%)`,
            borderRadius: 16,
            padding: '20px 36px',
            fontSize: 22,
            fontWeight: 800,
            color: COLORS.white,
            transform: `scale(${lineScale})`,
          }}>
            ALTIS MODEL
          </div>
        </div>
      </div>

      {/* KPI row */}
      <div style={{ opacity: kpiOpacity, display: 'flex', gap: 56, alignItems: 'flex-start' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 56, fontWeight: 900, color: COLORS.teal, lineHeight: 1 }}>
            <AnimatedCounter value={9958} frame={frame} startFrame={startFrame + 30} fps={fps} />
          </div>
          <div style={{ fontSize: 14, color: COLORS.muted, marginTop: 8, letterSpacing: '0.1em' }}>
            TRANSACTIONS RECONCILED
          </div>
          <div style={{ fontSize: 13, color: COLORS.teal, marginTop: 4, fontWeight: 600 }}>
            Peter Ummels lead reconciler
          </div>
        </div>
        <div style={{ width: 2, height: 80, background: COLORS.slateLight, alignSelf: 'center' }} />
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 56, fontWeight: 900, color: COLORS.amber, lineHeight: 1 }}>
            €<AnimatedCounter value={36.7} prefix="" suffix="M" frame={frame} startFrame={startFrame + 35} fps={fps} decimals={1} />
          </div>
          <div style={{ fontSize: 14, color: COLORS.muted, marginTop: 8, letterSpacing: '0.1em' }}>
            TOTAL VOLUME MODELLED
          </div>
          <div style={{ fontSize: 13, color: COLORS.amber, marginTop: 4, fontWeight: 600 }}>
            Across all 4 opcos
          </div>
        </div>
        <div style={{ width: 2, height: 80, background: COLORS.slateLight, alignSelf: 'center' }} />
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 56, fontWeight: 900, color: COLORS.white, lineHeight: 1 }}>
            <AnimatedCounter value={4} frame={frame} startFrame={startFrame + 40} fps={fps} />
          </div>
          <div style={{ fontSize: 14, color: COLORS.muted, marginTop: 8, letterSpacing: '0.1em' }}>
            OPCOS INTEGRATED
          </div>
          <div style={{ fontSize: 13, color: COLORS.muted, marginTop: 4, fontWeight: 600 }}>
            Single ledger, single model
          </div>
        </div>
      </div>
    </div>
  );
};
