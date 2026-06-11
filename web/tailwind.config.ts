import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        canvas: '#FBFAF7',
        paper: '#FFFFFF',
        ink: '#0A0B0F',
        'ink-2': '#5B6478',
        hair: '#E8E6DF',
        arc: '#1652F0',
        'arc-deep': '#0B2DB8',
        'arc-tint': '#E8EEFE',
        yes: '#16A34A',
        no: '#DC2626',
        heat: '#FF6B35',
      },
      fontFamily: {
        sans: ['Geist', 'system-ui', 'sans-serif'],
        display: ['Instrument Serif', 'Georgia', 'serif'],
        mono: ['Geist Mono', 'monospace'],
      },
    },
  },
  plugins: [],
};

export default config;
