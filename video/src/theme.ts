// Altis brand palette
export const COLORS = {
  ink: '#0f172a',
  teal: '#0d9488',
  tealLight: '#14b8a6',
  tealDark: '#0f766e',
  amber: '#b45309',
  amberLight: '#d97706',
  risk: '#b91c1c',
  riskLight: '#ef4444',
  white: '#f8fafc',
  muted: '#94a3b8',
  slate: '#1e293b',
  slateLight: '#334155',
  border: '#1e3a5f',
};

// Beat timings in seconds → convert to frames with *30
export const BEATS = {
  intro: 0,          // 0s – title card
  beat1: 3,          // 3s – fragmented data
  beat2: 15,         // 15s – one source of truth
  beat3: 27,         // 27s – weather insight
  beat4: 40,         // 40s – 13-week forecast
  beat5: 54,         // 54s – role dashboards
  beat6: 66,         // 66s – risk + traceability
  beat7: 76,         // 76s – honest close
  end: 82,           // 82s
};

export const s = (seconds: number) => Math.round(seconds * 30);
