import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        'bg-0': '#f5f7fb',
        'bg-1': '#ffffff',
        'bg-2': '#eef2f6',
        ink: '#101828',
        'ink-2': '#475467',
        'ink-3': '#667085',
        arc: '#1652F0',
        'arc-glow': '#2559D6',
        'arc-deep': '#0B2DB8',
        yes: '#15803D',
        no: '#B42318',
        heat: '#B54708',
        hair: 'rgba(15,23,42,0.10)',
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
