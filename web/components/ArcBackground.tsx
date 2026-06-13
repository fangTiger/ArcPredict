'use client';

import { useEffect, useState } from 'react';

export type ArcBackgroundVariant = 'default' | 'pitch';

const ARC_BACKGROUND_VARIANT_ATTR = 'data-arc-background-variant';
// 默认蓝色弧线基线：stroke="#1652F0"

function normalizeVariant(
  value: string | null | undefined,
): ArcBackgroundVariant {
  return value === 'pitch' ? 'pitch' : 'default';
}

export function ArcBackground({
  variant,
}: {
  variant?: ArcBackgroundVariant;
}) {
  const [resolvedVariant, setResolvedVariant] = useState<ArcBackgroundVariant>('default');

  useEffect(() => {
    if (typeof document === 'undefined') {
      return undefined;
    }

    const root = document.documentElement;

    if (variant) {
      root.setAttribute(ARC_BACKGROUND_VARIANT_ATTR, variant);
      setResolvedVariant(variant);

      return () => {
        root.setAttribute(ARC_BACKGROUND_VARIANT_ATTR, 'default');
      };
    }

    const syncVariant = () => {
      setResolvedVariant(normalizeVariant(root.getAttribute(ARC_BACKGROUND_VARIANT_ATTR)));
    };

    syncVariant();

    const observer = new MutationObserver(syncVariant);
    observer.observe(root, {
      attributes: true,
      attributeFilter: [ARC_BACKGROUND_VARIANT_ATTR],
    });

    return () => {
      observer.disconnect();
    };
  }, [variant]);

  if (variant) {
    return null;
  }

  const strokeColor = resolvedVariant === 'pitch' ? '#3D8B5B' : '#1652F0';
  const topOpacity = resolvedVariant === 'pitch' ? 'opacity-65' : 'opacity-50';
  const bottomOpacity = resolvedVariant === 'pitch' ? 'opacity-55' : 'opacity-40';

  return (
    <>
      {resolvedVariant === 'pitch' ? (
        <div
          className="pointer-events-none fixed inset-0 z-0"
          aria-hidden="true"
          style={{
            background:
              'linear-gradient(180deg, rgba(240,248,241,0.95) 0%, rgba(229,243,232,0.92) 42%, rgba(215,236,221,0.90) 100%)',
          }}
        >
          <div
            className="absolute inset-0 opacity-60"
            style={{
              backgroundImage:
                'linear-gradient(90deg, rgba(61,139,91,0.08) 0, rgba(61,139,91,0.08) 2px, transparent 2px, transparent 120px), linear-gradient(0deg, rgba(61,139,91,0.05) 0, rgba(61,139,91,0.05) 2px, transparent 2px, transparent 120px)',
              backgroundSize: '120px 120px',
            }}
          />
        </div>
      ) : null}

      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden" aria-hidden="true">
        <svg
          viewBox="0 0 900 900"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className={`absolute -right-[200px] -top-[200px] h-[900px] w-[900px] ${topOpacity}`}
        >
          <circle cx="450" cy="450" r="440" stroke={strokeColor} strokeWidth="1" strokeOpacity="0.12" />
          <circle cx="450" cy="450" r="360" stroke={strokeColor} strokeWidth="1" strokeOpacity="0.10" />
          <circle cx="450" cy="450" r="280" stroke={strokeColor} strokeWidth="1" strokeOpacity="0.08" />
          <circle cx="450" cy="450" r="200" stroke={strokeColor} strokeWidth="1" strokeOpacity="0.06" />
          <circle cx="450" cy="450" r="120" stroke={strokeColor} strokeWidth="1" strokeOpacity="0.05" />
          <path
            d="M 50 450 A 400 400 0 0 1 450 50"
            stroke={strokeColor}
            strokeWidth="1.5"
            strokeOpacity="0.18"
          />
        </svg>
      </div>

      <svg
        viewBox="0 0 700 700"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={`pointer-events-none fixed -bottom-[300px] -left-[300px] z-0 h-[700px] w-[700px] ${bottomOpacity}`}
        aria-hidden="true"
      >
        <circle cx="350" cy="350" r="340" stroke={strokeColor} strokeWidth="1" strokeOpacity="0.08" />
        <circle cx="350" cy="350" r="260" stroke={strokeColor} strokeWidth="1" strokeOpacity="0.06" />
        <circle cx="350" cy="350" r="180" stroke={strokeColor} strokeWidth="1" strokeOpacity="0.05" />
      </svg>
    </>
  );
}
