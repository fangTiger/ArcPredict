'use client';

import { useAccount, useChainId } from 'wagmi';
import { arcTestnet } from '@/lib/chain';
import { WalletPill } from './WalletPill';

type Props = {
  onAddNetwork: () => void;
  isAddPending: boolean;
  faucetHref?: string;
};

export function ConnectChecklist({ onAddNetwork, isAddPending, faucetHref = '/faucet' }: Props) {
  const { address } = useAccount();
  const chainId = useChainId();

  const step1Done = !!address;
  const step2Done = step1Done && chainId === arcTestnet.id;
  const step3Done = false; // 用户领水成功后会跳走，无需在前端硬判定

  return (
    <ol className="space-y-3">
      <Step
        n={1}
        label="连接钱包"
        done={step1Done}
        active={!step1Done}
        action={<WalletPill />}
      />
      <Step
        n={2}
        label="添加 Arc 网络"
        done={step2Done}
        active={step1Done && !step2Done}
        action={
          <button
            type="button"
            onClick={onAddNetwork}
            disabled={isAddPending || !step1Done}
            className="rounded-xl border border-arc-glow/40 bg-arc/15 px-4 py-2 text-sm font-semibold text-arc-glow transition hover:bg-arc/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-arc-glow/60 focus-visible:ring-offset-2 focus-visible:ring-offset-bg-0 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {isAddPending ? '处理中…' : '一键添加'}
          </button>
        }
      />
      <Step
        n={3}
        label="领取测试 USDC"
        done={step3Done}
        active={step2Done && !step3Done}
        action={
          <a
            href={faucetHref}
            className="rounded-xl border border-hair px-4 py-2 text-sm text-ink-2 transition hover:border-arc-glow/30 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-arc-glow/60 focus-visible:ring-offset-2 focus-visible:ring-offset-bg-0"
          >
            前往领水
          </a>
        }
      />
    </ol>
  );
}

function Step({
  n, label, done, active, action,
}: {
  n: number;
  label: string;
  done: boolean;
  active: boolean;
  action: React.ReactNode;
}) {
  const stateClass = done
    ? 'border-yes/30 bg-yes/5'
    : active
      ? 'border-arc-glow/40 bg-arc/5 shadow-[0_0_40px_-16px_rgba(77,168,255,0.6)]'
      : 'border-hair';
  const bulletClass = done
    ? 'bg-yes/20 text-yes border-yes/40'
    : active
      ? 'bg-arc/20 text-arc-glow border-arc-glow/40'
      : 'bg-bg-2 text-ink-3 border-hair';

  return (
    <li className={`flex items-center gap-3 rounded-2xl border px-4 py-3 transition ${stateClass}`}>
      <span className={`inline-flex h-7 w-7 items-center justify-center rounded-full border font-mono text-sm ${bulletClass}`}>
        {done ? '✓' : n}
      </span>
      <span className="flex-1 text-ink">{label}</span>
      <span>{action}</span>
    </li>
  );
}
