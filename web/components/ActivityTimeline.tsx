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
    { className: 'rounded-xl border border-hair bg-bg-1 p-5' },
    React.createElement(
      'h2',
      { className: 'text-xl font-semibold text-ink' },
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
                'mt-1 h-3 w-3 rounded-full bg-arc',
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
            { className: 'min-w-0 rounded-xl border border-hair bg-bg-0 px-4 py-3' },
            React.createElement(
              'div',
              { className: 'font-mono text-[11px] uppercase text-ink-3' },
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
