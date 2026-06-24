import React from 'react';
import type { MarketCategory } from '@/lib/market-kind';

type MarketCategoryIconKind = MarketCategory | 'theme';

type MarketCategoryIconProps = {
  category: MarketCategoryIconKind;
  label?: string;
  size?: 'sm' | 'md';
};

function iconLabel(category: MarketCategoryIconKind, fallback?: string): string {
  if (fallback) {
    return fallback;
  }

  if (category === 'macro') {
    return 'Macro';
  }

  if (category === 'chain') {
    return 'On-chain';
  }

  if (category === 'theme') {
    return 'Weekly Theme Pack';
  }

  if (category === 'worldcup') {
    return 'World Cup';
  }

  return 'Crypto';
}

function tintClassName(category: MarketCategoryIconKind): string {
  if (category === 'macro') {
    return 'border-heat/40 bg-heat/10 text-heat shadow-[0_0_18px_-8px_rgba(255,181,71,0.75)]';
  }

  if (category === 'chain') {
    return 'border-arc-glow/40 bg-arc/10 text-arc-glow shadow-[0_0_18px_-8px_rgba(77,168,255,0.78)]';
  }

  if (category === 'theme') {
    return 'border-yes/35 bg-yes/10 text-yes shadow-[0_0_18px_-8px_rgba(97,255,189,0.72)]';
  }

  if (category === 'worldcup') {
    return 'border-arc-glow/35 bg-arc/10 text-arc-glow';
  }

  return 'border-hair bg-bg-1 text-ink-2';
}

function MacroGlyph() {
  return React.createElement(
    'span',
    { className: 'flex h-4 items-end gap-[3px]', 'aria-hidden': 'true' },
    React.createElement('span', { className: 'h-2 w-[3px] rounded-full bg-current opacity-70' }),
    React.createElement('span', { className: 'h-3 w-[3px] rounded-full bg-current' }),
    React.createElement('span', { className: 'h-4 w-[3px] rounded-full bg-current opacity-80' }),
  );
}

function ChainGlyph() {
  return React.createElement(
    'span',
    { className: 'relative block h-4 w-5', 'aria-hidden': 'true' },
    React.createElement('span', { className: 'absolute left-[5px] top-[7px] h-px w-3 rotate-[-24deg] bg-current opacity-70' }),
    React.createElement('span', { className: 'absolute bottom-[3px] left-[5px] h-px w-3 rotate-[26deg] bg-current opacity-70' }),
    React.createElement('span', { className: 'absolute left-0 top-[5px] h-[7px] w-[7px] rounded-full border border-current bg-bg-0' }),
    React.createElement('span', { className: 'absolute right-0 top-0 h-[7px] w-[7px] rounded-full border border-current bg-bg-0' }),
    React.createElement('span', { className: 'absolute bottom-0 right-0 h-[7px] w-[7px] rounded-full border border-current bg-bg-0' }),
  );
}

function ThemeGlyph() {
  return React.createElement(
    'span',
    { className: 'grid grid-cols-2 gap-[3px]', 'aria-hidden': 'true' },
    React.createElement('span', { className: 'h-[6px] w-[6px] rounded-[2px] bg-current opacity-70' }),
    React.createElement('span', { className: 'h-[6px] w-[6px] rounded-[2px] bg-current' }),
    React.createElement('span', { className: 'h-[6px] w-[6px] rounded-[2px] bg-current' }),
    React.createElement('span', { className: 'h-[6px] w-[6px] rounded-[2px] bg-current opacity-70' }),
  );
}

function CryptoGlyph() {
  return React.createElement('span', {
    className: 'h-3.5 w-3.5 rotate-45 rounded-[3px] border border-current',
    'aria-hidden': 'true',
  });
}

function glyphFor(category: MarketCategoryIconKind) {
  if (category === 'macro') {
    return React.createElement(MacroGlyph);
  }

  if (category === 'chain') {
    return React.createElement(ChainGlyph);
  }

  if (category === 'theme') {
    return React.createElement(ThemeGlyph);
  }

  return React.createElement(CryptoGlyph);
}

export function MarketCategoryIcon({
  category,
  label,
  size = 'md',
}: MarketCategoryIconProps) {
  const dimensionClassName = size === 'sm' ? 'h-7 w-7 rounded-[10px]' : 'h-9 w-9 rounded-[12px]';
  const resolvedLabel = iconLabel(category, label);

  return React.createElement(
    'span',
    {
      'aria-label': `${resolvedLabel} icon`,
      'data-market-category-icon': category,
      className: `inline-flex shrink-0 items-center justify-center border ${dimensionClassName} ${tintClassName(category)}`,
      role: 'img',
    },
    glyphFor(category),
  );
}
