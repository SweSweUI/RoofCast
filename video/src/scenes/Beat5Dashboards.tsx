import React from 'react';
import { useCurrentFrame, useVideoConfig, spring, interpolate } from 'remotion';
import { COLORS } from '../theme';

const ROLES = [
  {
    id: 'cfo',
    title: 'CFO',
    color: COLORS.teal,
    access: 'Full portfolio',
    stats: [
      { label: 'Net 13w', value: '€2.29M' },
      { label: 'Covenant margin', value: '+€0.19M' },
    ],
    scenario: 'base / wet / dry',
    icon: '💼',
  },
  {
    id: 'pe',
    title: 'PE Board',
    color: COLORS.amber,
    access: 'Portfolio + risk',
    stats: [
      { label: 'Weeks at risk (wet)', value: '7 / 13' },
      { label: 'Coverage ratio', value: '1.09×' },
    ],
    scenario: 'base / wet / dry',
    icon: '📈',
  },
  {
    id: 'opco',
    title: 'Opco MD',
    color: '#7c3aed',
    access: 'Own opco only',
    stats: [
      { label: 'Billing this week', value: '€445k' },
      { label: 'Cash in W+2', value: '€360k' },
    ],
    scenario: 'base only',
    icon: '🏗️',
  },
  {
    id: 'pm',
    title: 'Project Lead',
    color: '#0ea5e9',
    access: 'Own projects',
    stats: [
      { label: 'Milestone delay', value: '−3 days' },
      { label: 'Invoice risk', value: 'Medium' },
    ],
    scenario: 'milestone view',
    icon: '📋',
  },
];

const SCENARIO_BARS = [
  { label: 'Dry quarter', value: 100, color: COLORS.amber, weeks: 2 },
  { label: 'Base case', value: 68, color: COLORS.teal, weeks: 3 },
  { label: 'Wet quarter', value: 30, color: COLORS.risk, weeks: 7 },
];

export const Beat5Dashboards: React.FC<{ startFrame: number }> = ({ startFrame }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const local = frame - startFrame;

  const titleOpacity = interpolate(local, [0, 20], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const scenarioOpacity = interpolate(local, [40, 60], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

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
      <div style={{ opacity: titleOpacity, marginBottom: 32 }}>
        <div style={{ fontSize: 14, color: COLORS.teal, fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 8 }}>
          Role-Based Dashboards — Login + RBAC
        </div>
        <div style={{ fontSize: 40, fontWeight: 800, color: COLORS.white }}>
          Every stakeholder sees <span style={{ color: COLORS.teal }}>exactly their view</span>
        </div>
      </div>

      {/* Role cards */}
      <div style={{ opacity: titleOpacity, display: 'flex', gap: 20, marginBottom: 36 }}>
        {ROLES.map((role, i) => {
          const cardSpring = spring({
            frame: local - 20 - i * 6,
            fps,
            config: { damping: 14, stiffness: 120 },
          });
          return (
            <div
              key={role.id}
              style={{
                transform: `translateY(${(1 - cardSpring) * 30}px)`,
                opacity: cardSpring,
                flex: 1,
                background: COLORS.slate,
                border: `2px solid ${role.color}55`,
                borderRadius: 14,
                padding: '20px 20px',
                borderTop: `3px solid ${role.color}`,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                <span style={{ fontSize: 24 }}>{role.icon}</span>
                <div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: role.color }}>{role.title}</div>
                  <div style={{ fontSize: 11, color: COLORS.muted, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{role.access}</div>
                </div>
              </div>
              {role.stats.map((stat) => (
                <div key={stat.label} style={{ marginBottom: 8 }}>
                  <div style={{ fontSize: 11, color: COLORS.muted, marginBottom: 2 }}>{stat.label}</div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: COLORS.white }}>{stat.value}</div>
                </div>
              ))}
              <div style={{
                marginTop: 12,
                fontSize: 11,
                color: role.color,
                background: `${role.color}15`,
                border: `1px solid ${role.color}33`,
                borderRadius: 6,
                padding: '4px 8px',
                display: 'inline-block',
                fontWeight: 600,
              }}>
                {role.scenario}
              </div>
            </div>
          );
        })}
      </div>

      {/* Scenario comparison */}
      <div style={{ opacity: scenarioOpacity }}>
        <div style={{ fontSize: 14, color: COLORS.muted, fontWeight: 600, marginBottom: 14, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
          Scenario impact — weeks at covenant risk
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {SCENARIO_BARS.map((sc, i) => {
            const barSpring = spring({
              frame: local - 45 - i * 6,
              fps,
              config: { damping: 18, stiffness: 80 },
            });
            return (
              <div key={sc.label} style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <div style={{ width: 120, fontSize: 14, color: COLORS.muted, fontWeight: 600, textAlign: 'right' }}>{sc.label}</div>
                <div style={{ flex: 1, height: 28, background: COLORS.slateLight, borderRadius: 6, overflow: 'hidden' }}>
                  <div style={{
                    width: `${sc.value * barSpring}%`,
                    height: '100%',
                    background: `linear-gradient(90deg, ${sc.color} 0%, ${sc.color}aa 100%)`,
                    borderRadius: 6,
                  }} />
                </div>
                <div style={{ width: 80, fontSize: 15, fontWeight: 800, color: sc.color }}>
                  {sc.weeks} wks
                </div>
              </div>
            );
          })}
        </div>
        <div style={{ fontSize: 13, color: COLORS.muted, marginTop: 12, fontStyle: 'italic' }}>
          Wet quarter: weeks-at-risk 3 → 7 (+133% vs base). Scenario driver: rain workday forecasts from KNMI.
        </div>
      </div>
    </div>
  );
};
