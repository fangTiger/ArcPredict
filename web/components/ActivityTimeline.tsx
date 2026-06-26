import React from 'react';

export type ActivityTimelineItem = {
  id: string;
  label: string;
  detail: string;
};

export function ActivityTimeline({ items }: { items: ActivityTimelineItem[] }) {
  if (items.length === 0) {
    return null;
  }

  return React.createElement(
    'section',
    { className: 'glass rounded-3xl p-6' },
    React.createElement(
      'h2',
      { className: 'font-display text-2xl text-ink' },
      'Activity timeline',
    ),
    React.createElement(
      'div',
      { className: 'mt-5 space-y-4' },
      items.map((item, index) =>
        React.createElement(
          'div',
          { key: item.id, className: 'flex gap-4' },
          React.createElement(
            'div',
            { className: 'flex flex-col items-center' },
            React.createElement('span', {
              className:
                'mt-1 h-3 w-3 rounded-full bg-arc-glow shadow-[0_0_18px_rgba(77,168,255,0.85)]',
            }),
            index < items.length - 1
              ? React.createElement('span', {
                  className: 'mt-2 h-full w-px bg-hair',
                  'aria-hidden': 'true',
                })
              : null,
          ),
          React.createElement(
            'div',
            { className: 'min-w-0 rounded-2xl border border-hair bg-bg-1/45 px-4 py-3' },
            React.createElement(
              'div',
              { className: 'font-mono text-[11px] uppercase text-arc-glow' },
              item.label,
            ),
            React.createElement(
              'p',
              { className: 'mt-2 text-sm leading-6 text-ink-2' },
              item.detail,
            ),
          ),
        ),
      ),
    ),
  );
}
