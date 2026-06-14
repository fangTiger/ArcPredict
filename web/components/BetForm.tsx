'use client';

import { useEffect, useMemo, useState } from 'react';
import { maxUint256, type Abi, type Hash } from 'viem';
import {
  useAccount,
  useReadContract,
  useSwitchChain,
  useWaitForTransactionReceipt,
  useWriteContract,
} from 'wagmi';
import ERC20Abi from '@/lib/abis/ERC20.json';
import PredictionMarketAbi from '@/lib/abis/PredictionMarket.json';
import { PREDICTION_MARKET_ADDRESS, USDC_ADDRESS } from '@/lib/addresses';
import { arcTestnet } from '@/lib/chain';
import type { DashboardRow } from '@/lib/derivePosition';
import { fmtUsdc, parseUsdc } from '@/lib/format';

type Props = {
  row: DashboardRow;
  side: boolean;
  onSuccess?: () => void;
  compact?: boolean;
};

type Step = 'idle' | 'approving' | 'betting' | 'success';

const erc20Abi = ERC20Abi as Abi;
const predictionMarketAbi = PredictionMarketAbi as Abi;
const MIN_BET_RAW = 100000n;

function safeParseUsdc(value: string): bigint | null {
  const trimmed = value.trim();

  if (!trimmed) {
    return null;
  }

  try {
    const parsed = parseUsdc(trimmed);

    return parsed >= 0n ? parsed : null;
  } catch {
    return null;
  }
}

function humanizeError(error: unknown): string {
  const maybeError = error as {
    code?: number;
    shortMessage?: string;
    message?: string;
    cause?: { message?: string };
  };
  const rawMessage =
    maybeError.shortMessage ??
    maybeError.message ??
    maybeError.cause?.message ??
    'unknown error';
  const lower = rawMessage.toLowerCase();

  if (maybeError.code === 4001 || lower.includes('reject') || lower.includes('denied')) {
    return '已取消';
  }

  if (lower.includes('timeout') || lower.includes('network') || lower.includes('fetch')) {
    return '网络异常，请重试。';
  }

  if (lower.includes('belowminbet')) {
    return '最小下注为 0.1 USDC。';
  }

  if (lower.includes('bettingclosed')) {
    return '下注窗口已关闭。';
  }

  if (lower.includes('alreadyresolved')) {
    return '该市场已完成结算。';
  }

  if (lower.includes('insufficient funds')) {
    return '钱包余额不足，无法支付链上费用。';
  }

  if (lower.includes('user rejected the request')) {
    return '已取消';
  }

  return '交易失败，请稍后重试。';
}

export function BetForm({ row, side, onSuccess, compact = false }: Props) {
  const market = row.market;
  const [amount, setAmount] = useState('10');
  const [step, setStep] = useState<Step>('idle');
  const [feedback, setFeedback] = useState<string | null>(null);
  const [currentApproveHash, setCurrentApproveHash] = useState<Hash | undefined>();
  const [currentBetHash, setCurrentBetHash] = useState<Hash | undefined>();
  const [hasFreshApproval, setHasFreshApproval] = useState(false);

  const { address, chainId } = useAccount();
  const { switchChainAsync } = useSwitchChain();

  const {
    data: allowance,
    refetch: refetchAllowance,
  } = useReadContract({
    address: USDC_ADDRESS,
    abi: erc20Abi,
    functionName: 'allowance',
    args: address ? [address, PREDICTION_MARKET_ADDRESS] : undefined,
    chainId: arcTestnet.id,
    query: { enabled: !!address, refetchInterval: 10_000 },
  });

  const {
    data: balance,
    refetch: refetchBalance,
  } = useReadContract({
    address: USDC_ADDRESS,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    chainId: arcTestnet.id,
    query: { enabled: !!address, refetchInterval: 10_000 },
  });

  const approveWrite = useWriteContract();
  const betWrite = useWriteContract();
  const approveReceipt = useWaitForTransactionReceipt({
    chainId: arcTestnet.id,
    hash: currentApproveHash,
    query: { enabled: !!currentApproveHash },
  });
  const betReceipt = useWaitForTransactionReceipt({
    chainId: arcTestnet.id,
    hash: currentBetHash,
    query: { enabled: !!currentBetHash },
  });

  const parsedAmount = safeParseUsdc(amount);
  const previewAmount = parsedAmount !== null && parsedAmount >= 0n ? parsedAmount : 0n;
  const allowanceRaw = typeof allowance === 'bigint' ? allowance : null;
  const balanceRaw = typeof balance === 'bigint' ? balance : null;
  const readingAllowance = !!address && allowanceRaw === null && !hasFreshApproval;
  const readingBalance = !!address && balanceRaw === null;
  const needsApprove =
    !hasFreshApproval &&
    allowanceRaw !== null &&
    parsedAmount !== null &&
    parsedAmount > 0n &&
    allowanceRaw < parsedAmount;
  const wrongChain = !!address && chainId !== arcTestnet.id;
  const sideLabel = side ? 'YES' : 'NO';

  const amountError = useMemo(() => {
    const trimmed = amount.trim();

    if (!trimmed) {
      return '请输入下注金额。';
    }

    if (parsedAmount === null) {
      return '请输入有效的 USDC 金额。';
    }

    if (parsedAmount < MIN_BET_RAW) {
      return '最小下注为 0.1 USDC。';
    }

    return null;
  }, [amount, parsedAmount]);

  const insufficientBalance =
    balanceRaw !== null && parsedAmount !== null && balanceRaw < parsedAmount;
  const isPending =
    step !== 'idle' ||
    approveWrite.isPending ||
    betWrite.isPending ||
    approveReceipt.isLoading ||
    betReceipt.isLoading;

  const confirmDisabled =
    !address ||
    isPending ||
    amountError !== null ||
    insufficientBalance ||
    readingAllowance ||
    readingBalance;

  const totalPool = market.yesPool + market.noPool + previewAmount;
  const winPool = side ? market.yesPool + previewAmount : market.noPool + previewAmount;
  const protocolFee =
    ((side ? market.noPool : market.yesPool) * BigInt(market.feeBpsSnapshot)) / 10000n;
  const impliedWin =
    previewAmount > 0n && winPool > 0n
      ? (previewAmount * (totalPool - protocolFee)) / winPool
      : 0n;

  useEffect(() => {
    setHasFreshApproval(false);
  }, [address]);

  useEffect(() => {
    if (
      step !== 'approving' ||
      !currentApproveHash ||
      !approveReceipt.isSuccess ||
      parsedAmount === null
    ) {
      return;
    }

    setFeedback(null);
    setCurrentApproveHash(undefined);
    setHasFreshApproval(true);
    setStep('betting');
    void refetchAllowance();

    const placeBetAfterApprove = async () => {
      try {
        setCurrentBetHash(undefined);
        const hash = await betWrite.writeContractAsync({
          address: PREDICTION_MARKET_ADDRESS,
          abi: predictionMarketAbi,
          functionName: 'bet',
          args: [row.id, side, parsedAmount],
          chainId: arcTestnet.id,
        });
        setCurrentBetHash(hash);
      } catch (error) {
        setCurrentBetHash(undefined);
        setStep('idle');
        setFeedback(humanizeError(error));
      }
    };

    void placeBetAfterApprove();
  }, [
    currentApproveHash,
    approveReceipt.isSuccess,
    betWrite,
    parsedAmount,
    refetchAllowance,
    row.id,
    side,
    step,
  ]);

  useEffect(() => {
    if (step !== 'approving' || !currentApproveHash || !approveReceipt.isError) {
      return;
    }

    setCurrentApproveHash(undefined);
    setStep('idle');
    setFeedback(humanizeError(approveReceipt.error));
  }, [currentApproveHash, approveReceipt.error, approveReceipt.isError, step]);

  useEffect(() => {
    if (step !== 'betting' || !currentBetHash || !betReceipt.isSuccess) {
      return;
    }

    setCurrentBetHash(undefined);
    setStep('success');
    setFeedback('下注已提交成功。');
    void refetchAllowance();
    void refetchBalance();
    onSuccess?.();
  }, [
    currentBetHash,
    betReceipt.isSuccess,
    onSuccess,
    refetchAllowance,
    refetchBalance,
    step,
  ]);

  useEffect(() => {
    if (step !== 'betting' || !currentBetHash || !betReceipt.isError) {
      return;
    }

    setCurrentBetHash(undefined);
    setStep('idle');
    setFeedback(humanizeError(betReceipt.error));
  }, [currentBetHash, betReceipt.error, betReceipt.isError, step]);

  const handleConfirm = async () => {
    setFeedback(null);

    if (!address) {
      setFeedback('请先连接钱包。');
      return;
    }

    if (amountError) {
      setFeedback(amountError);
      return;
    }

    if (parsedAmount === null) {
      setFeedback('请输入有效的 USDC 金额。');
      return;
    }

    if (readingBalance) {
      setFeedback('正在读取 USDC 余额，请稍候。');
      return;
    }

    if (readingAllowance) {
      setFeedback('正在确认是否需要 Approve，请稍候。');
      return;
    }

    if (insufficientBalance) {
      setFeedback('余额不足，无法下注。');
      return;
    }

    if (wrongChain) {
      try {
        await switchChainAsync({ chainId: arcTestnet.id });
        setFeedback('切换到 Arc Testnet 后，请再次确认下注。');
        return;
      } catch (error) {
        setStep('idle');
        setFeedback(humanizeError(error));
        return;
      }
    }

    if (needsApprove) {
      setCurrentApproveHash(undefined);
      setCurrentBetHash(undefined);
      setStep('approving');

      try {
        const hash = await approveWrite.writeContractAsync({
          address: USDC_ADDRESS,
          abi: erc20Abi,
          functionName: 'approve',
          args: [PREDICTION_MARKET_ADDRESS, maxUint256],
          chainId: arcTestnet.id,
        });
        setCurrentApproveHash(hash);
      } catch (error) {
        setCurrentApproveHash(undefined);
        setStep('idle');
        setFeedback(humanizeError(error));
      }

      return;
    }

    setCurrentApproveHash(undefined);
    setCurrentBetHash(undefined);
    setStep('betting');

    try {
      const hash = await betWrite.writeContractAsync({
        address: PREDICTION_MARKET_ADDRESS,
        abi: predictionMarketAbi,
        functionName: 'bet',
        args: [row.id, side, parsedAmount],
        chainId: arcTestnet.id,
      });
      setCurrentBetHash(hash);
    } catch (error) {
      setCurrentBetHash(undefined);
      setStep('idle');
      setFeedback(humanizeError(error));
    }
  };

  return (
    <div className={compact ? 'space-y-3' : 'space-y-4'}>
      <div>
        <div className="mb-1 text-xs text-ink-2">下注</div>
        <div className="text-lg font-medium leading-7 text-ink">{market.question}</div>
      </div>

      <div className="flex items-center justify-between rounded-2xl border border-hair bg-bg-2/40 px-3 py-3">
        <div>
          <div className="mb-1 text-xs text-ink-2">方向</div>
          <div className={`text-sm font-semibold ${side ? 'text-yes' : 'text-no'}`}>
            {sideLabel}
          </div>
        </div>
        <div className="text-right">
          <div className="mb-1 text-xs text-ink-2">钱包余额</div>
          <div className="font-mono text-sm text-ink num-glow">
            {balanceRaw === null ? '读取中...' : `${fmtUsdc(balanceRaw)} USDC`}
          </div>
        </div>
      </div>

      <label className="block">
        <div className="mb-2 text-sm text-ink">金额</div>
        <div className="rounded-2xl border border-hair bg-bg-2/60 px-3 py-3">
          <input
            type="text"
            inputMode="decimal"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            disabled={step !== 'idle'}
            className="w-full bg-transparent font-mono text-lg text-ink num-glow outline-none placeholder:text-ink-3 disabled:cursor-not-allowed"
            placeholder="输入 USDC 金额"
          />
        </div>
        <div className="mt-2 text-xs text-ink-2">最小下注 0.1 USDC</div>
      </label>

      <div className="grid grid-cols-2 gap-3 rounded-2xl border border-hair bg-bg-2/40 p-4">
        <div>
          <div className="mb-1 text-xs text-ink-2">Your Stake</div>
          <div className="font-mono text-sm text-ink num-glow">{fmtUsdc(previewAmount)} USDC</div>
        </div>
        <div>
          <div className="mb-1 text-xs text-ink-2">Implied Win</div>
          <div className="font-mono text-sm text-yes num-glow">~{fmtUsdc(impliedWin)} USDC</div>
        </div>
      </div>

      <div className="rounded-2xl border border-heat/30 bg-heat/10 px-3 py-2 text-xs text-heat">
        赔率随新下注变化，最终会在截止后锁定。
      </div>

      {readingAllowance ? (
        <div className="rounded-2xl border border-hair bg-bg-2/40 px-3 py-3 text-xs text-ink-2">
          正在确认是否需要 Approve...
        </div>
      ) : needsApprove ? (
        <div className="rounded-2xl border border-hair bg-bg-2/40 px-3 py-3 text-xs text-ink-2">
          <div className="mb-1">Step 1/2: Approve USDC</div>
          <div>Step 2/2: Place Bet</div>
        </div>
      ) : (
        <div className="rounded-2xl border border-hair bg-bg-2/40 px-3 py-3 text-xs text-ink-2">
          已授权，当前将直接进入 Step 2/2: Place Bet
        </div>
      )}

      {amountError ? (
        <div className="rounded-2xl border border-heat/30 bg-heat/10 px-3 py-2 text-sm text-heat">
          {amountError}
        </div>
      ) : null}

      {readingBalance ? (
        <div className="rounded-2xl border border-hair bg-bg-2/40 px-3 py-2 text-sm text-ink-2">
          正在读取 USDC 余额，请稍候。
        </div>
      ) : null}

      {insufficientBalance ? (
        <div className="rounded-2xl border border-no/30 bg-no/10 px-3 py-2 text-sm text-no">
          余额不足，无法 Place Bet。请先前往{' '}
          <a
            href="https://faucet.circle.com"
            target="_blank"
            rel="noopener"
            className="font-medium underline underline-offset-4"
          >
            Circle Faucet
          </a>{' '}
          领取 testnet USDC。
        </div>
      ) : null}

      {feedback ? (
        <div
          className={`rounded-2xl px-3 py-2 text-sm ${
            step === 'success'
              ? 'border border-yes/30 bg-yes/10 text-yes'
              : 'border border-hair bg-bg-2/40 text-ink-2'
          }`}
        >
          {feedback}
        </div>
      ) : null}

      <button
        type="button"
        onClick={() => {
          void handleConfirm();
        }}
        disabled={confirmDisabled}
        className={`w-full rounded-2xl border px-4 py-3 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-bg-0 disabled:cursor-not-allowed disabled:opacity-50 ${
          side
            ? 'border-yes/40 bg-yes/15 text-yes hover:bg-yes/25 hover:shadow-[inset_0_0_24px_rgba(52,211,153,0.25),0_0_40px_-12px_rgba(52,211,153,0.5)] focus-visible:ring-yes/60'
            : 'border-no/40 bg-no/15 text-no hover:bg-no/25 hover:shadow-[inset_0_0_24px_rgba(248,113,113,0.25),0_0_40px_-12px_rgba(248,113,113,0.5)] focus-visible:ring-no/60'
        }`}
      >
        {step === 'idle' && `确认下注 · ${needsApprove ? 'Approve USDC' : 'Place Bet'}`}
        {step === 'approving' && '等待 Approve USDC'}
        {step === 'betting' && '等待 Place Bet'}
        {step === 'success' && '已完成'}
      </button>
    </div>
  );
}
