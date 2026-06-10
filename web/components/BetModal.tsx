'use client';

import { useEffect, useMemo, useState } from 'react';
import type { Abi } from 'viem';
import { maxUint256 } from 'viem';
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

type BetModalProps = {
  row: DashboardRow;
  side: boolean;
  onClose: () => void;
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
    return parseUsdc(trimmed);
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

export function BetModal({ row, side, onClose }: BetModalProps) {
  const market = row.market;
  const [amount, setAmount] = useState('10');
  const [step, setStep] = useState<Step>('idle');
  const [feedback, setFeedback] = useState<string | null>(null);

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
    query: { enabled: !!address, refetchInterval: 10_000 },
  });

  const approveWrite = useWriteContract();
  const betWrite = useWriteContract();
  const approveHash = approveWrite.data;
  const betHash = betWrite.data;
  const approveReceipt = useWaitForTransactionReceipt({
    chainId: arcTestnet.id,
    hash: approveHash,
    query: { enabled: !!approveHash },
  });
  const betReceipt = useWaitForTransactionReceipt({
    chainId: arcTestnet.id,
    hash: betHash,
    query: { enabled: !!betHash },
  });

  const parsedAmount = safeParseUsdc(amount);
  const safeAmount = parsedAmount ?? 0n;
  const allowanceRaw = (allowance as bigint | undefined) ?? 0n;
  const balanceRaw = (balance as bigint | undefined) ?? 0n;
  const needsApprove = parsedAmount !== null && parsedAmount > 0n && allowanceRaw < parsedAmount;
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

  const insufficientBalance = parsedAmount !== null && balanceRaw < parsedAmount;
  const isPending =
    step !== 'idle' ||
    approveWrite.isPending ||
    betWrite.isPending ||
    approveReceipt.isLoading ||
    betReceipt.isLoading;

  const confirmDisabled =
    !address || isPending || amountError !== null || insufficientBalance;

  const totalPool = market.yesPool + market.noPool + safeAmount;
  const winPool = side ? market.yesPool + safeAmount : market.noPool + safeAmount;
  const protocolFee =
    ((side ? market.noPool : market.yesPool) * BigInt(market.feeBpsSnapshot)) / 10000n;
  const impliedWin =
    safeAmount > 0n && winPool > 0n ? (safeAmount * (totalPool - protocolFee)) / winPool : 0n;

  useEffect(() => {
    if (step !== 'approving' || !approveReceipt.isSuccess || parsedAmount === null) {
      return;
    }

    setFeedback(null);
    setStep('betting');
    void refetchAllowance();

    const placeBetAfterApprove = async () => {
      try {
        await betWrite.writeContractAsync({
          address: PREDICTION_MARKET_ADDRESS,
          abi: predictionMarketAbi,
          functionName: 'bet',
          args: [row.id, side, parsedAmount],
          chainId: arcTestnet.id,
        });
      } catch (error) {
        setStep('idle');
        setFeedback(humanizeError(error));
      }
    };

    void placeBetAfterApprove();
  }, [
    approveReceipt.isSuccess,
    betWrite,
    parsedAmount,
    refetchAllowance,
    row.id,
    side,
    step,
  ]);

  useEffect(() => {
    if (step !== 'approving' || !approveReceipt.isError) {
      return;
    }

    setStep('idle');
    setFeedback(humanizeError(approveReceipt.error));
  }, [approveReceipt.error, approveReceipt.isError, step]);

  useEffect(() => {
    if (step !== 'betting' || !betReceipt.isSuccess) {
      return;
    }

    setStep('success');
    setFeedback('下注已提交成功。');
    void refetchAllowance();
    void refetchBalance();

    const timer = window.setTimeout(() => {
      onClose();
    }, 1200);

    return () => window.clearTimeout(timer);
  }, [
    betReceipt.isSuccess,
    onClose,
    refetchAllowance,
    refetchBalance,
    step,
  ]);

  useEffect(() => {
    if (step !== 'betting' || !betReceipt.isError) {
      return;
    }

    setStep('idle');
    setFeedback(humanizeError(betReceipt.error));
  }, [betReceipt.error, betReceipt.isError, step]);

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

    if (insufficientBalance) {
      setFeedback('余额不足，无法下注。');
      return;
    }

    if (wrongChain) {
      try {
        await switchChainAsync({ chainId: arcTestnet.id });
      } catch (error) {
        setStep('idle');
        setFeedback(humanizeError(error));
        return;
      }
    }

    if (needsApprove) {
      setStep('approving');

      try {
        await approveWrite.writeContractAsync({
          address: USDC_ADDRESS,
          abi: erc20Abi,
          functionName: 'approve',
          args: [PREDICTION_MARKET_ADDRESS, maxUint256],
          chainId: arcTestnet.id,
        });
      } catch (error) {
        setStep('idle');
        setFeedback(humanizeError(error));
      }

      return;
    }

    setStep('betting');

    try {
      await betWrite.writeContractAsync({
        address: PREDICTION_MARKET_ADDRESS,
        abi: predictionMarketAbi,
        functionName: 'bet',
        args: [row.id, side, parsedAmount],
        chainId: arcTestnet.id,
      });
    } catch (error) {
      setStep('idle');
      setFeedback(humanizeError(error));
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-base/80 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        className="w-full max-w-md rounded-lg border border-white/10 bg-elevated p-5 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-1 text-xs text-zinc-500">下注</div>
        <div className="mb-4 text-lg font-medium leading-7 text-white">{market.question}</div>

        <div className="mb-4 flex items-center justify-between rounded-lg border border-white/10 bg-white/5 px-3 py-3">
          <div>
            <div className="mb-1 text-xs text-zinc-500">方向</div>
            <div className={`text-sm font-semibold ${side ? 'text-yes' : 'text-no'}`}>
              {sideLabel}
            </div>
          </div>
          <div className="text-right">
            <div className="mb-1 text-xs text-zinc-500">钱包余额</div>
            <div className="font-mono text-sm text-white">{fmtUsdc(balanceRaw)} USDC</div>
          </div>
        </div>

        <label className="mb-3 block">
          <div className="mb-2 text-sm text-zinc-300">金额</div>
          <div className="rounded-lg border border-white/10 bg-surface px-3 py-3">
            <input
              type="text"
              inputMode="decimal"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              disabled={step !== 'idle'}
              className="w-full bg-transparent text-lg text-white outline-none placeholder:text-zinc-500 disabled:cursor-not-allowed"
              placeholder="10"
            />
          </div>
          <div className="mt-2 text-xs text-zinc-500">最小下注 0.1 USDC</div>
        </label>

        <div className="mb-3 grid grid-cols-2 gap-3 rounded-lg border border-white/10 bg-white/5 p-4">
          <div>
            <div className="mb-1 text-xs text-zinc-500">Your Stake</div>
            <div className="font-mono text-sm text-white">{fmtUsdc(safeAmount)} USDC</div>
          </div>
          <div>
            <div className="mb-1 text-xs text-zinc-500">Implied Win</div>
            <div className="font-mono text-sm text-yes">~{fmtUsdc(impliedWin)} USDC</div>
          </div>
        </div>

        <div className="mb-3 rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-warning">
          赔率随新下注变化，最终会在截止后锁定。
        </div>

        {needsApprove ? (
          <div className="mb-4 rounded-lg border border-white/10 bg-white/5 px-3 py-3 text-xs text-zinc-300">
            <div className="mb-1">Step 1/2: Approve USDC</div>
            <div>Step 2/2: Place Bet</div>
          </div>
        ) : (
          <div className="mb-4 rounded-lg border border-white/10 bg-white/5 px-3 py-3 text-xs text-zinc-300">
            已授权，当前将直接进入 Step 2/2: Place Bet
          </div>
        )}

        {amountError ? (
          <div className="mb-3 rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-sm text-warning">
            {amountError}
          </div>
        ) : null}

        {insufficientBalance ? (
          <div className="mb-3 rounded-lg border border-no/30 bg-no/10 px-3 py-2 text-sm text-no">
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
            className={`mb-3 rounded-lg px-3 py-2 text-sm ${
              step === 'success'
                ? 'border border-yes/30 bg-yes/10 text-yes'
                : 'border border-white/10 bg-white/5 text-zinc-300'
            }`}
          >
            {feedback}
          </div>
        ) : null}

        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-white/10 px-4 py-3 text-sm text-zinc-200 transition hover:bg-white/5"
          >
            取消
          </button>
          <button
            type="button"
            onClick={() => {
              void handleConfirm();
            }}
            disabled={confirmDisabled}
            className="rounded-lg bg-accent px-4 py-3 text-sm font-semibold text-zinc-950 transition hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {step === 'idle' && (needsApprove ? 'Approve USDC' : 'Place Bet')}
            {step === 'approving' && '等待 Approve USDC'}
            {step === 'betting' && '等待 Place Bet'}
            {step === 'success' && '已完成'}
          </button>
        </div>
      </div>
    </div>
  );
}
