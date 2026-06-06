import type { Config } from 'tailwindcss';

/**
 * Calm, operational palette. Slate-based neutrals with a single restrained
 * accent (teal) and semantic risk colors. No gradients, no decoration.
 */
const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        ink: {
          DEFAULT: '#0f172a', // slate-900
          soft: '#1e293b', // slate-800
          muted: '#475569', // slate-600
          faint: '#94a3b8', // slate-400
        },
        panel: {
          DEFAULT: '#ffffff',
          sunken: '#f8fafc', // slate-50
          line: '#e2e8f0', // slate-200
        },
        accent: {
          DEFAULT: '#0d9488', // teal-600
          soft: '#ccfbf1', // teal-100
        },
        risk: {
          low: '#15803d', // green-700
          medium: '#b45309', // amber-700
          high: '#b91c1c', // red-700
        },
        cashin: '#0d9488', // teal-600
        cashout: '#64748b', // slate-500
      },
      fontFamily: {
        sans: ['IBM Plex Mono', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'Helvetica', 'Arial', 'sans-serif'],
        mono: ['IBM Plex Mono', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      fontSize: {
        '2xs': ['0.6875rem', { lineHeight: '1rem' }],
      },
      boxShadow: {
        card: '0 1px 2px 0 rgb(15 23 42 / 0.04), 0 1px 3px 0 rgb(15 23 42 / 0.06)',
      },
    },
  },
  plugins: [],
};

export default config;
