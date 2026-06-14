'use client';

import { useEffect, useRef } from 'react';
import type { DashboardRow } from '@/lib/derivePosition';
import { useMediaQuery } from '@/lib/use-media-query';
import { BetForm } from './BetForm';

type BetModalProps = {
  row: DashboardRow;
  side: boolean;
  onClose: () => void;
};

export function BetModal({ row, side, onClose }: BetModalProps) {
  const closeBtnRef = useRef<HTMLButtonElement>(null);
  const isMobile = useMediaQuery('(max-width: 639px)');

  useEffect(() => {
    closeBtnRef.current?.focus();
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="bet-modal-title"
      className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center"
      onClick={onClose}
    >
      <div
        className="absolute inset-0 backdrop-blur-md"
        style={{ background: 'rgba(5,6,20,0.7)' }}
        aria-hidden="true"
      />
      <div
        onClick={(event) => event.stopPropagation()}
        className={`relative z-10 glass w-full max-w-[480px] p-6 ${
          isMobile
            ? 'rounded-t-3xl animate-[modal-drawer-up_320ms_cubic-bezier(0.2,0.8,0.2,1)_both]'
            : 'mx-4 rounded-3xl animate-[modal-pop_280ms_cubic-bezier(0.2,0.8,0.2,1)_both]'
        }`}
        style={{
          boxShadow:
            '0 0 0 1px rgba(77,168,255,0.25), 0 60px 120px -40px rgba(22,82,240,0.6), inset 0 1px 0 rgba(255,255,255,0.08)',
        }}
      >
        {isMobile ? (
          <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-ink-3/40" aria-hidden="true" />
        ) : null}

        <div className="mb-4 flex items-start justify-between">
          <h2 id="bet-modal-title" className="font-display text-xl text-ink">
            下注 · {side ? 'YES' : 'NO'}
          </h2>
          <button
            ref={closeBtnRef}
            type="button"
            onClick={onClose}
            aria-label="关闭"
            className="rounded-full p-1 text-ink-2 transition hover:bg-bg-2/60 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-arc-glow/60 focus-visible:ring-offset-2 focus-visible:ring-offset-bg-0"
          >
            ✕
          </button>
        </div>

        <BetForm row={row} side={side} onSuccess={onClose} />
      </div>
    </div>
  );
}
