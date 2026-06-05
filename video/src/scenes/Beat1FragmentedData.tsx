import React from 'react';
import { useCurrentFrame, useVideoConfig, spring, interpolate } from 'remotion';
import { COLORS } from '../theme';

const SYSTEMS = [
  { name: 'Snelstart', opco: 'Roofing NL', color: COLORS.teal, icon: '📊', txns: '2,841' },
  { name: 'Exact GL', opco: 'Infra BE', color: COLORS.amber, icon: '📋', txns: '3,102' },
  { name: 'Gilde ERP', opco: 'Civil NL', color: '#7c3aed', icon: '🏗️', txns: '2,417' },
  { name: 'Invoice DB', opco: 'Maintenance', color: '#0ea5e9', icon: '🧾', txns: '1,598' },
];

export const Beat1FragmentedData: React.FC<{ startFrame: number }> = ({ startFrame }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const local = frame - startFrame;

  const titleOpacity = interpolate(local, [0, 20], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        background: COLORS.ink,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: "'Helvetica Neue', Arial, sans-serif",
        padding: '60px 80px',
        boxSizing: 'border-box',
      }}
    >
      {/* Section label */}
      <div style={{ opacity: titleOpacity, textAlign: 'center', marginBottom: 48 }}>
        <div style={{ fontSize: 14, color: COLORS.teal, fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 12 }}>
          The Challenge
        </div>
        <div style={{ fontSize: 44, fontWeight: 800, color: COLORS.white, lineHeight: 1.2 }}>
          4 Operating Companies.<br />
          <span style={{ color: COLORS.risk }}>4 Separate Accounting Systems.</span>
        </div>
        <div style={{ fontSize: 20, color: COLORS.muted, marginTop: 16 }}>
          No unified view. No shared model. No cash visibility.
        </div>
      </div>

      {/* System cards */}
      <div style={{ display: 'flex', gap: 28, opacity: titleOpacity }}>
        {SYSTEMS.map((sys, i) => {
          const cardDelay = i * 8;
          const cardScale = spring({
            frame: local - 15 - cardDelay,
            fps,
            config: { damping: 12, stiffness: 120 },
          });
          return (
            <div
              key={sys.name}
              style={{
                transform: `scale(${cardScale})`,
                background: COLORS.slate,
                border: `2px solid ${sys.color}`,
                borderRadius: 16,
                padding: '28px 32px',
                minWidth: 220,
                textAlign: 'center',
              }}
            >
              <div style={{ fontSize: 36, marginBottom: 12 }}>{sys.icon}</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: sys.color, marginBottom: 4 }}>
                {sys.name}
              </div>
              <div style={{ fontSize: 14, color: COLORS.muted, marginBottom: 12 }}>
                {sys.opco}
              </div>
              <div style={{ fontSize: 28, fontWeight: 800, color: COLORS.white }}>
                {sys.txns}
              </div>
              <div style={{ fontSize: 11, color: COLORS.muted, marginTop: 4, letterSpacing: '0.1em' }}>
                TRANSACTIONS
              </div>
            </div>
          );
        })}
      </div>

      {/* Disconnection arrows */}
      <div style={{
        opacity: interpolate(local, [50, 70], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }),
        marginTop: 36,
        fontSize: 18,
        color: COLORS.risk,
        fontWeight: 600,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
      }}>
        <div style={{ width: 32, height: 2, background: COLORS.risk }} />
        No shared data model — reconciliation done manually in Excel
        <div style={{ width: 32, height: 2, background: COLORS.risk }} />
      </div>
    </div>
  );
};
