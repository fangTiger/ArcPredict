'use client';

import { useEffect, useState } from 'react';

export type ArcBackgroundVariant = 'default' | 'pitch';

const ARC_BACKGROUND_VARIANT_ATTR = 'data-arc-background-variant';

function normalizeVariant(value: string | null | undefined): ArcBackgroundVariant {
  return value === 'pitch' ? 'pitch' : 'default';
}

export function ArcBackground({ variant }: { variant?: ArcBackgroundVariant }) {
  const [resolvedVariant, setResolvedVariant] = useState<ArcBackgroundVariant>('default');

  useEffect(() => {
    if (typeof document === 'undefined') return undefined;
    const root = document.documentElement;

    if (variant) {
      root.setAttribute(ARC_BACKGROUND_VARIANT_ATTR, variant);
      setResolvedVariant(variant);
      return () => {
        root.setAttribute(ARC_BACKGROUND_VARIANT_ATTR, 'default');
      };
    }

    const sync = () => {
      setResolvedVariant(normalizeVariant(root.getAttribute(ARC_BACKGROUND_VARIANT_ATTR)));
    };
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(root, { attributes: true, attributeFilter: [ARC_BACKGROUND_VARIANT_ATTR] });
    return () => observer.disconnect();
  }, [variant]);

  if (variant) return null;

  return (
    <>
      {/* Layer A · 极深底色（兜底，避免 blob 加载延迟时露白） */}
      <div className="pointer-events-none fixed inset-0 z-0 bg-bg-0" aria-hidden="true" />

      {/* Layer B · 极光团 */}
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden" aria-hidden="true">
        <div
          className="blob-a absolute"
          style={{
            top: '-200px',
            left: '-300px',
            width: '1200px',
            height: '1200px',
            background:
              'radial-gradient(circle, rgba(22,82,240,0.45) 0%, rgba(109,91,255,0) 60%)',
            filter: 'blur(120px)',
          }}
        />
        <div
          className="blob-b absolute"
          style={{
            bottom: '-200px',
            right: '-200px',
            width: '900px',
            height: '900px',
            background:
              'radial-gradient(circle, rgba(77,168,255,0.35) 0%, rgba(109,91,255,0) 60%)',
            filter: 'blur(140px)',
          }}
        />
      </div>

      {/* variant=pitch 的草坪网格（深色版） */}
      {resolvedVariant === 'pitch' ? (
        <div
          className="pointer-events-none fixed inset-0 z-0 opacity-100"
          aria-hidden="true"
          style={{
            backgroundImage:
              'linear-gradient(90deg, rgba(155,163,199,0.04) 0, rgba(155,163,199,0.04) 1px, transparent 1px, transparent 32px), linear-gradient(0deg, rgba(155,163,199,0.04) 0, rgba(155,163,199,0.04) 1px, transparent 1px, transparent 32px)',
            backgroundSize: '32px 32px',
          }}
        />
      ) : null}

      {/* Layer C · Arc 同心圆 + 1/4 弧线（品牌符号保留） */}
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden" aria-hidden="true">
        <svg
          viewBox="0 0 900 900"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="absolute -right-[200px] -top-[200px] h-[900px] w-[900px]"
        >
          <defs>
            <linearGradient id="arc-stroke-tr" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#4DA8FF" />
              <stop offset="100%" stopColor="#6D5BFF" />
            </linearGradient>
          </defs>
          <circle cx="450" cy="450" r="440" stroke="url(#arc-stroke-tr)" strokeWidth="1" strokeOpacity="0.15" />
          <circle cx="450" cy="450" r="360" stroke="url(#arc-stroke-tr)" strokeWidth="1" strokeOpacity="0.12" />
          <circle cx="450" cy="450" r="280" stroke="url(#arc-stroke-tr)" strokeWidth="1" strokeOpacity="0.09" />
          <circle cx="450" cy="450" r="200" stroke="url(#arc-stroke-tr)" strokeWidth="1" strokeOpacity="0.07" />
          <circle cx="450" cy="450" r="120" stroke="url(#arc-stroke-tr)" strokeWidth="1" strokeOpacity="0.05" />
        </svg>
        <svg
          viewBox="0 0 700 700"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="absolute -bottom-[300px] -left-[300px] h-[700px] w-[700px]"
        >
          <defs>
            <linearGradient id="arc-stroke-bl" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#6D5BFF" />
              <stop offset="100%" stopColor="#4DA8FF" />
            </linearGradient>
          </defs>
          <circle cx="350" cy="350" r="340" stroke="url(#arc-stroke-bl)" strokeWidth="1" strokeOpacity="0.10" />
          <circle cx="350" cy="350" r="260" stroke="url(#arc-stroke-bl)" strokeWidth="1" strokeOpacity="0.08" />
          <circle cx="350" cy="350" r="180" stroke="url(#arc-stroke-bl)" strokeWidth="1" strokeOpacity="0.06" />
        </svg>
      </div>
    </>
  );
}
