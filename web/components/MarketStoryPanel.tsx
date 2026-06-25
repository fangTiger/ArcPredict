import React from 'react';
import type { MarketStory } from '@/lib/market-richness';

function StoryBlock({ title, body }: { title: string; body: string }) {
  return React.createElement(
    'div',
    { className: 'rounded-xl border border-hair bg-bg-0 px-4 py-4' },
    React.createElement(
      'div',
      { className: 'font-mono text-[11px] uppercase text-ink-3' },
      title,
    ),
    React.createElement(
      'p',
      { className: 'mt-3 text-sm leading-6 text-ink-2' },
      body,
    ),
  );
}

export function MarketStoryPanel({ story }: { story: MarketStory }) {
  return React.createElement(
    'section',
    { className: 'rounded-xl border border-hair bg-bg-1 p-5' },
    React.createElement(
      'div',
      { className: 'font-mono text-[11px] uppercase text-ink-3' },
      story.eyebrow,
    ),
    React.createElement(
      'h2',
      { className: 'mt-2 text-xl font-semibold text-ink' },
      'Market story',
    ),
    React.createElement(
      'div',
      { className: 'mt-5 grid gap-4 md:grid-cols-3' },
      React.createElement(StoryBlock, { title: 'Why it matters', body: story.whyItMatters }),
      React.createElement(StoryBlock, { title: 'What moves it', body: story.whatMovesIt }),
      React.createElement(StoryBlock, { title: 'What to watch', body: story.whatToWatch }),
    ),
  );
}
