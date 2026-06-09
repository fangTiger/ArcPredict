import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        accent: '#ff6b35',
        yes: '#22c55e',
        no: '#ef4444',
        warning: '#f59e0b',
        base: '#0b0c0e',
        surface: '#14161a',
        elevated: '#1c1f24',
      },
      fontFamily: {
        sans: ['Geist', 'system-ui', 'sans-serif'],
        mono: ['Geist Mono', 'monospace'],
      },
    },
  },
  plugins: [],
};

export default config;
