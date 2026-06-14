import type { CSSProperties } from 'react';

export function LogoMark({
  size = 24,
  animate = true,
  className = '',
  style,
}: {
  size?: number;
  animate?: boolean;
  className?: string;
  style?: CSSProperties;
}) {
  // 几何：viewBox 24×24，圆心 (4,4) 半径 14，
  // path 从 (4,18) 到 (18,4)，sweep=1（向右下凸出的升起弧）。
  // 末端发光点 cx=18 cy=4。
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={style}
      aria-hidden="true"
    >
      <title>ArcPredict</title>
      <defs>
        <linearGradient id="arc-main" x1="0" y1="1" x2="1" y2="0">
          <stop offset="0%" stopColor="#1652F0" />
          <stop offset="100%" stopColor="#4DA8FF" />
        </linearGradient>
        <linearGradient id="arc-glow" x1="0" y1="1" x2="1" y2="0">
          <stop offset="0%" stopColor="#1652F0" />
          <stop offset="50%" stopColor="#6D5BFF" />
          <stop offset="100%" stopColor="#4DA8FF" />
        </linearGradient>
        <filter id="dot-halo" x="-150%" y="-150%" width="400%" height="400%">
          <feGaussianBlur stdDeviation="2" />
        </filter>
      </defs>

      {/* Layer 1: 模糊光晕弧 */}
      <path
        d="M 4 18 A 14 14 0 0 1 18 4"
        stroke="url(#arc-glow)"
        strokeWidth="2.25"
        strokeLinecap="round"
        fill="none"
        opacity="0.6"
        style={{ filter: 'blur(3px)' }}
      />

      {/* Layer 2: 主弧线 */}
      <path
        d="M 4 18 A 14 14 0 0 1 18 4"
        stroke="url(#arc-main)"
        strokeWidth="2.25"
        strokeLinecap="round"
        fill="none"
        className={animate ? 'mark-draw' : undefined}
      />

      {/* Layer 3: 末端发光点 */}
      <circle cx="18" cy="4" r="5" fill="#4DA8FF" opacity="0.35" filter="url(#dot-halo)" className={animate ? 'dot-pop' : undefined} />
      <circle cx="18" cy="4" r="2.5" fill="#4DA8FF" className={animate ? 'dot-pop' : undefined} />
      <circle cx="18" cy="4" r="1" fill="#FFFFFF" className={animate ? 'dot-pop' : undefined} />
    </svg>
  );
}
