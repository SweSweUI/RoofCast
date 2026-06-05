import React from 'react';
import { useCurrentFrame, useVideoConfig, spring, interpolate } from 'remotion';
import { COLORS } from '../theme';

export const Beat7Close: React.FC<{ startFrame: number }> = ({ startFrame }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const local = frame - startFrame;

  const bgOpacity = interpolate(local, [0, 15], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const line1Spring = spring({ frame: local - 5, fps, config: { damping: 14, stiffness: 80 } });
  const line2Opacity = interpolate(local, [20, 35], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const line3Opacity = interpolate(local, [35, 50], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const disclaimerOpacity = interpolate(local, [50, 70], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const govOpacity = interpolate(local, [65, 85], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const logoOpacity = interpolate(local, [80, 100], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        background: `linear-gradient(135deg, ${COLORS.ink} 0%, #061020 100%)`,
        opacity: bgOpacity,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: "'Helvetica Neue', Arial, sans-serif",
        padding: '60px 120px',
        boxSizing: 'border-box',
        textAlign: 'center',
      }}
    >
      {/* Main statement */}
      <div
        style={{
          transform: `scale(${line1Spring})`,
          fontSize: 38,
          fontWeight: 800,
          color: COLORS.white,
          lineHeight: 1.3,
          marginBottom: 20,
          maxWidth: 900,
        }}
      >
        A <span style={{ color: COLORS.teal }}>weather-aware</span> billing-to-cash forecast<br />
        on <span style={{ color: COLORS.amber }}>explicit, auditable assumptions</span>
      </div>

      {/* Sub-statement */}
      <div style={{
        opacity: line2Opacity,
        fontSize: 22,
        color: COLORS.muted,
        maxWidth: 780,
        lineHeight: 1.6,
        marginBottom: 16,
      }}>
        Not a replacement for your accountant or bank.<br />
        Not real bank cashflow data.
      </div>

      <div style={{
        opacity: line3Opacity,
        fontSize: 20,
        color: COLORS.teal,
        fontWeight: 600,
        marginBottom: 48,
      }}>
        A decision-support layer that makes the invisible, visible.
      </div>

      {/* Honest disclaimer box */}
      <div style={{
        opacity: disclaimerOpacity,
        background: `${COLORS.amber}15`,
        border: `1px solid ${COLORS.amber}44`,
        borderRadius: 14,
        padding: '20px 36px',
        maxWidth: 820,
        marginBottom: 24,
      }}>
        <div style={{ fontSize: 13, color: COLORS.amber, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>
          Important note
        </div>
        <div style={{ fontSize: 16, color: COLORS.white, lineHeight: 1.6 }}>
          All forecasts are model outputs built on explicit assumptions (payment terms, cash-out drivers, covenant floors).
          Weather correlation is suggestive (p ≈ 0.07–0.19), not causal. Altis does not report real bank cashflow data.
        </div>
      </div>

      {/* Data governance */}
      <div style={{
        opacity: govOpacity,
        background: `${COLORS.teal}15`,
        border: `1px solid ${COLORS.teal}33`,
        borderRadius: 14,
        padding: '16px 32px',
        maxWidth: 820,
        marginBottom: 40,
      }}>
        <div style={{ fontSize: 13, color: COLORS.teal, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6 }}>
          Data Governance
        </div>
        <div style={{ fontSize: 15, color: COLORS.muted }}>
          Demo data is deleted within 3 days of hackathon evaluation. No financial data is retained beyond the agreed window.
        </div>
      </div>

      {/* Altis logo footer */}
      <div style={{ opacity: logoOpacity, display: 'flex', alignItems: 'center', gap: 14 }}>
        <div style={{
          width: 44,
          height: 44,
          borderRadius: 8,
          background: `linear-gradient(135deg, ${COLORS.teal} 0%, ${COLORS.tealDark} 100%)`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <svg width="26" height="26" viewBox="0 0 36 36" fill="none">
            <path d="M6 28 L18 8 L30 28" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M10 22 L26 22" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
          </svg>
        </div>
        <div>
          <div style={{ fontSize: 24, fontWeight: 800, color: COLORS.white }}>ALTIS</div>
          <div style={{ fontSize: 13, color: COLORS.muted }}>Financial Intelligence Platform</div>
        </div>
      </div>
    </div>
  );
};
