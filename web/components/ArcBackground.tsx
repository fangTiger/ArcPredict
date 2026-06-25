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
      <div className="pointer-events-none fixed inset-0 z-0 bg-bg-0" aria-hidden="true" />

      <div
        className="pointer-events-none fixed inset-0 z-0"
        aria-hidden="true"
        style={{
          background:
            'radial-gradient(circle at top left, rgba(22,82,240,0.08) 0%, rgba(22,82,240,0) 42%), radial-gradient(circle at bottom right, rgba(22,82,240,0.05) 0%, rgba(22,82,240,0) 36%)',
        }}
      />

      {resolvedVariant === 'pitch' ? (
        <div
          className="pointer-events-none fixed inset-0 z-0 opacity-100"
          aria-hidden="true"
          style={{
            backgroundImage:
              'linear-gradient(90deg, rgba(15,23,42,0.04) 0, rgba(15,23,42,0.04) 1px, transparent 1px, transparent 32px), linear-gradient(0deg, rgba(15,23,42,0.04) 0, rgba(15,23,42,0.04) 1px, transparent 1px, transparent 32px)',
            backgroundSize: '32px 32px',
          }}
        />
      ) : null}

      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden" aria-hidden="true">
        <svg
          viewBox="0 0 900 900"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="absolute -right-[200px] -top-[200px] h-[900px] w-[900px]"
        >
          <defs>
            <linearGradient id="arc-stroke-tr" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#1652F0" />
              <stop offset="100%" stopColor="#2559D6" />
            </linearGradient>
          </defs>
          <circle cx="450" cy="450" r="440" stroke="url(#arc-stroke-tr)" strokeWidth="1" strokeOpacity="0.10" />
          <circle cx="450" cy="450" r="360" stroke="url(#arc-stroke-tr)" strokeWidth="1" strokeOpacity="0.08" />
          <circle cx="450" cy="450" r="280" stroke="url(#arc-stroke-tr)" strokeWidth="1" strokeOpacity="0.06" />
          <circle cx="450" cy="450" r="200" stroke="url(#arc-stroke-tr)" strokeWidth="1" strokeOpacity="0.05" />
          <circle cx="450" cy="450" r="120" stroke="url(#arc-stroke-tr)" strokeWidth="1" strokeOpacity="0.04" />
        </svg>
        <svg
          viewBox="0 0 700 700"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="absolute -bottom-[300px] -left-[300px] h-[700px] w-[700px]"
        >
          <defs>
            <linearGradient id="arc-stroke-bl" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#2559D6" />
              <stop offset="100%" stopColor="#1652F0" />
            </linearGradient>
          </defs>
          <circle cx="350" cy="350" r="340" stroke="url(#arc-stroke-bl)" strokeWidth="1" strokeOpacity="0.08" />
          <circle cx="350" cy="350" r="260" stroke="url(#arc-stroke-bl)" strokeWidth="1" strokeOpacity="0.06" />
          <circle cx="350" cy="350" r="180" stroke="url(#arc-stroke-bl)" strokeWidth="1" strokeOpacity="0.05" />
        </svg>
      </div>
    </>
  );
}
