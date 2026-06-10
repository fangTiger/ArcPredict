'use client';

import { useEffect, useState } from 'react';
import type { DashboardRow } from '@/lib/derivePosition';
import { deriveStatus } from '@/lib/derivePosition';
import { fmtCountdown } from '@/lib/format';

const nowInSeconds = () => BigInt(Math.floor(Date.now() / 1000));

export function ResolveCountdown({ row }: { row: DashboardRow }) {
  const [now, setNow] = useState<bigint>(() => nowInSeconds());

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(nowInSeconds());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const status = deriveStatus(row, now);

  if (status === 'active') {
    const countdown = fmtCountdown(row.market.betDeadline, now);
    const countdownText = countdown === 'Closed' ? '已关闭' : countdown;

    return <span className="font-mono text-xs text-warning">距关闭 {countdownText}</span>;
  }

  if (status === 'resolving') {
    return <span className="font-mono text-xs text-warning">结算窗口开启</span>;
  }

  if (status === 'awaiting') {
    return <span className="font-mono text-xs text-zinc-500">等待结算</span>;
  }

  if (status === 'force-invalidatable') {
    return <span className="font-mono text-xs text-zinc-500">可强制作废</span>;
  }

  return <span className="font-mono text-xs text-zinc-500">已结算</span>;
}
