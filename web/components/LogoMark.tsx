import { useId, type CSSProperties } from 'react';

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
  const rawId = useId().replace(/:/g, '');
  const arcGradientId = `${rawId}-arc-mark`;
  const signalGradientId = `${rawId}-arc-signal`;
  const nodeGlowId = `${rawId}-arc-node-glow`;

  // 新几何：外侧厚弧表达 Arc 的轨道，内部折线表达预测概率走势。
  // 切口用背景色压出负空间，避免旧版单条发光弧显得像装饰线。
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
        <linearGradient id={arcGradientId} x1="4" y1="18" x2="20" y2="4" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#1652F0" />
          <stop offset="100%" stopColor="#2563FF" />
        </linearGradient>
        <linearGradient id={signalGradientId} x1="6" y1="17" x2="19" y2="7" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#1652F0" />
          <stop offset="100%" stopColor="#4DA8FF" />
        </linearGradient>
        <filter id={nodeGlowId} x="-180%" y="-180%" width="460%" height="460%">
          <feGaussianBlur stdDeviation="1.5" />
        </filter>
      </defs>

      <path
        data-logo-part="outer-arc"
        d="M5 17.25A12.5 12.5 0 0 1 19 4.75"
        stroke={`url(#${arcGradientId})`}
        strokeWidth="3.15"
        strokeLinecap="round"
        fill="none"
        className={animate ? 'mark-draw' : undefined}
      />
      <path
        data-logo-part="aperture-cut"
        d="M5.6 17.1L7.5 14.95"
        stroke="#050614"
        strokeWidth="2.2"
        strokeLinecap="round"
        fill="none"
      />
      <path
        data-logo-part="probability-line"
        d="M6.35 16.35L9.55 12.55L12.15 14.35L18.35 7.55"
        stroke={`url(#${signalGradientId})`}
        strokeWidth="2.65"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
        className={animate ? 'mark-draw' : undefined}
      />
      <circle
        data-logo-part="signal-node"
        cx="18.35"
        cy="7.55"
        r="3.25"
        fill="#4DA8FF"
        opacity="0.16"
        filter={`url(#${nodeGlowId})`}
        className={animate ? 'dot-pop' : undefined}
      />
      <circle cx="18.35" cy="7.55" r="1.85" fill="#4DA8FF" className={animate ? 'dot-pop' : undefined} />
      <circle cx="18.35" cy="7.55" r="0.7" fill="#F0F2FF" className={animate ? 'dot-pop' : undefined} />
    </svg>
  );
}
