import React from 'react';
import {
  useCurrentFrame,
  useVideoConfig,
  spring,
  interpolate,
} from 'remotion';
import { COLORS } from '../theme';

export const Intro: React.FC<{ startFrame: number }> = ({ startFrame }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const local = frame - startFrame;

  const logoScale = spring({ frame: local, fps, config: { damping: 14, stiffness: 100 } });
  const taglineOpacity = interpolate(local, [20, 40], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const subtitleOpacity = interpolate(local, [40, 60], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        background: `linear-gradient(135deg, ${COLORS.ink} 0%, #0a1628 50%, #071020 100%)`,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: "'Helvetica Neue', Arial, sans-serif",
      }}
    >
      {/* Logo mark */}
      <div
        style={{
          transform: `scale(${logoScale})`,
          marginBottom: 32,
          display: 'flex',
          alignItems: 'center',
          gap: 16,
        }}
      >
        <div
          style={{
            width: 64,
            height: 64,
            borderRadius: 12,
            background: `linear-gradient(135deg, ${COLORS.teal} 0%, ${COLORS.tealDark} 100%)`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
            <path d="M6 28 L18 8 L30 28" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M10 22 L26 22" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
          </svg>
        </div>
        <span
          style={{
            fontSize: 52,
            fontWeight: 800,
            color: COLORS.white,
            letterSpacing: '-1px',
          }}
        >
          ALTIS
        </span>
      </div>

      {/* Tagline */}
      <div
        style={{
          opacity: taglineOpacity,
          fontSize: 28,
          color: COLORS.teal,
          fontWeight: 600,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          marginBottom: 16,
        }}
      >
        Financial Intelligence Platform
      </div>

      {/* Subtitle */}
      <div
        style={{
          opacity: subtitleOpacity,
          fontSize: 18,
          color: COLORS.muted,
          fontWeight: 400,
          maxWidth: 680,
          textAlign: 'center',
          lineHeight: 1.6,
        }}
      >
        Weather-aware billing-to-cash forecasting for construction portfolios
      </div>
    </div>
  );
};
