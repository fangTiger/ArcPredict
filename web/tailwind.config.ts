import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // 背景层
        'bg-0': '#050614',
        'bg-1': '#0A0B1E',
        'bg-2': '#12142B',
        // 文字层
        ink: '#F0F2FF',
        'ink-2': '#9BA3C7',
        'ink-3': '#5B6188',
        // 品牌主光源
        arc: '#1652F0',
        'arc-glow': '#4DA8FF',
        'arc-deep': '#0B2DB8',
        // 副渐变
        violet: '#6D5BFF',
        // 语义色（深色环境调亮）
        yes: '#34D399',
        no: '#F87171',
        heat: '#FF8A4C',
        // 分隔
        hair: 'rgba(155,163,199,0.12)',
        // 向后兼容：保留旧名 canvas/paper 暂指向新背景，期 B–E 中各组件会迁移走
        canvas: '#050614',
        paper: '#0A0B1E',
      },
      fontFamily: {
        sans: ['Geist', 'system-ui', 'sans-serif'],
        display: ['Instrument Serif', 'Georgia', 'serif'],
        mono: ['Geist Mono', 'monospace'],
      },
      backgroundImage: {
        aurora:
          'linear-gradient(135deg, #1652F0 0%, #6D5BFF 50%, #4DA8FF 100%)',
        'aurora-text':
          'linear-gradient(135deg, #4DA8FF 0%, #6D5BFF 100%)',
      },
    },
  },
  plugins: [],
};

export default config;
