'use client';

import { useEffect, useMemo, useState } from 'react';
import { maxUint256, zeroAddress, type Abi, type Hash } from 'viem';
import {
  useAccount,
  useReadContract,
  useSwitchChain,
  useWaitForTransactionReceipt,
  useWriteContract,
} from 'wagmi';
import ERC20Abi from '@/lib/abis/ERC20.json';
import EventMarketAbi from '@/lib/abis/EventMarket.json';
import { EVENT_MARKET_ADDRESS, USDC_ADDRESS } from '@/lib/addresses';
import { arcTestnet } from '@/lib/chain';
import { fmtUsdc, parseUsdc } from '@/lib/format';
import type { WorldCupMarketRow } from '@/lib/worldcup-markets';

type EventBetModalProps = {
  row: WorldCupMarketRow;
  outcomeIndex: number;
  onClose: () => void;
};

type Step = 'idle' | 'approving' | 'betting' | 'success';

const erc20Abi = ERC20Abi as Abi;
const eventMarketAbi = EventMarketAbi as Abi;
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
    return 'Transaction rejected.';
  }

  if (lower.includes('timeout') || lower.includes('network') || lower.includes('fetch')) {
    return 'Network issue. Please try again.';
  }

  if (lower.includes('belowminbet')) {
    return 'Minimum stake is 0.1 USDC.';
  }

  if (lower.includes('bettingclosed')) {
    return 'Betting is closed for this market.';
  }

  if (lower.includes('alreadyresolved')) {
    return 'This market is already settled.';
  }

  if (lower.includes('invalidmarketid')) {
    return 'This event market is not available on-chain yet.';
  }

  if (lower.includes('insufficient funds')) {
    return 'Your wallet does not have enough gas.';
  }

  return 'Transaction failed. Please try again.';
}

export function EventBetModal({ row, outcomeIndex, onClose }: EventBetModalProps) {
  const selectedOutcome = row.outcomes[outcomeIndex];
  const [amount, setAmount] = useState('10');
  const [step, setStep] = useState<Step>('idle');
  const [feedback, setFeedback] = useState<string | null>(null);
  const [currentApproveHash, setCurrentApproveHash] = useState<Hash | undefined>();
  const [currentBetHash, setCurrentBetHash] = useState<Hash | undefined>();
  const [hasFreshApproval, setHasFreshApproval] = useState(false);

  const { address, chainId } = useAccount();
  const { switchChainAsync } = useSwitchChain();
  const rowEventMarketAddress = row.eventMarketAddress ?? EVENT_MARKET_ADDRESS;
  const eventMarketConfigured = rowEventMarketAddress !== zeroAddress;

  const {
    data: allowance,
    refetch: refetchAllowance,
  } = useReadContract({
    address: USDC_ADDRESS,
    abi: erc20Abi,
    functionName: 'allowance',
    args: address && eventMarketConfigured ? [address, rowEventMarketAddress] : undefined,
    chainId: arcTestnet.id,
    query: { enabled: !!address && eventMarketConfigured, refetchInterval: 10_000 },
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
  const readingAllowance = !!address && eventMarketConfigured && allowanceRaw === null && !hasFreshApproval;
  const readingBalance = !!address && balanceRaw === null;
  const needsApprove =
    !hasFreshApproval &&
    eventMarketConfigured &&
    allowanceRaw !== null &&
    parsedAmount !== null &&
    parsedAmount > 0n &&
    allowanceRaw < parsedAmount;
  const wrongChain = !!address && chainId !== arcTestnet.id;

  const amountError = useMemo(() => {
    const trimmed = amount.trim();

    if (!trimmed) {
      return 'Enter a stake amount.';
    }

    if (parsedAmount === null) {
      return 'Enter a valid USDC amount.';
    }

    if (parsedAmount < MIN_BET_RAW) {
      return 'Minimum stake is 0.1 USDC.';
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
    !eventMarketConfigured ||
    !address ||
    isPending ||
    amountError !== null ||
    insufficientBalance ||
    readingAllowance ||
    readingBalance ||
    !selectedOutcome;

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
          address: rowEventMarketAddress,
          abi: eventMarketAbi,
          functionName: 'bet',
          args: [row.id, outcomeIndex, parsedAmount],
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
    outcomeIndex,
    parsedAmount,
    refetchAllowance,
    row.id,
    rowEventMarketAddress,
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
    setFeedback('Bet submitted.');
    void refetchAllowance();
    void refetchBalance();
    onClose();
  }, [
    currentBetHash,
    betReceipt.isSuccess,
    onClose,
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

    if (!eventMarketConfigured) {
      setFeedback('EventMarket address is not configured for this deployment.');
      return;
    }

    if (!address) {
      setFeedback('Connect your wallet first.');
      return;
    }

    if (amountError) {
      setFeedback(amountError);
      return;
    }

    if (parsedAmount === null) {
      setFeedback('Enter a valid USDC amount.');
      return;
    }

    if (readingBalance) {
      setFeedback('Reading USDC balance. Please wait.');
      return;
    }

    if (readingAllowance) {
      setFeedback('Checking USDC approval. Please wait.');
      return;
    }

    if (insufficientBalance) {
      setFeedback('Insufficient USDC balance.');
      return;
    }

    if (wrongChain) {
      try {
        await switchChainAsync({ chainId: arcTestnet.id });
        setFeedback('Switched to Arc Testnet. Confirm again.');
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
          args: [rowEventMarketAddress, maxUint256],
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
        address: rowEventMarketAddress,
        abi: eventMarketAbi,
        functionName: 'bet',
        args: [row.id, outcomeIndex, parsedAmount],
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
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(10,11,15,0.24)] p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        className="w-full max-w-md rounded-[16px] border border-hair bg-bg-1 p-5 shadow-[0_24px_60px_rgba(10,11,15,0.16)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-1 text-xs uppercase text-ink-2">World Cup bet</div>
        <div className="mb-4 text-lg font-medium leading-7 text-ink">{row.question}</div>

        <div className="mb-4 flex items-center justify-between rounded-[12px] border border-hair bg-bg-0 px-3 py-3">
          <div>
            <div className="mb-1 text-xs text-ink-2">Selection</div>
            <div className="text-sm font-semibold text-emerald-700">
              {selectedOutcome?.label ?? `Outcome ${outcomeIndex + 1}`}
            </div>
          </div>
          <div className="text-right">
            <div className="mb-1 text-xs text-ink-2">Wallet balance</div>
            <div className="font-mono text-sm text-ink">
              {balanceRaw === null ? 'Reading...' : `${fmtUsdc(balanceRaw)} USDC`}
            </div>
          </div>
        </div>

        {!eventMarketConfigured ? (
          <div className="mb-4 rounded-[12px] border border-heat/30 bg-heat/10 px-3 py-2 text-sm text-heat">
            EventMarket address is not configured for this deployment. Add the deployed address before placing on-chain bets.
          </div>
        ) : null}

        <label className="mb-3 block">
          <div className="mb-2 text-sm text-ink">Stake</div>
          <div className="rounded-[12px] border border-hair bg-bg-0 px-3 py-3">
            <input
              type="text"
              inputMode="decimal"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              disabled={step !== 'idle'}
              className="w-full bg-transparent text-lg text-ink outline-none placeholder:text-ink-2 disabled:cursor-not-allowed"
              placeholder="10"
            />
          </div>
          <div className="mt-2 text-xs text-ink-2">Minimum stake 0.1 USDC</div>
        </label>

        <div className="mb-3 grid grid-cols-2 gap-3 rounded-[12px] border border-hair bg-bg-0 p-4">
          <div>
            <div className="mb-1 text-xs text-ink-2">Your Stake</div>
            <div className="font-mono text-sm text-ink">{fmtUsdc(previewAmount)} USDC</div>
          </div>
          <div>
            <div className="mb-1 text-xs text-ink-2">Market odds</div>
            <div className="font-mono text-sm text-emerald-700">
              {selectedOutcome ? `${selectedOutcome.odds.toFixed(2)}x` : '-'}
            </div>
          </div>
        </div>

        <div className="mb-3 rounded-[12px] border border-heat/30 bg-heat/10 px-3 py-2 text-xs text-heat">
          Odds move with every bet and settle after the betting window closes.
        </div>

        {readingAllowance ? (
          <div className="mb-4 rounded-[12px] border border-hair bg-bg-0 px-3 py-3 text-xs text-ink-2">
            Checking USDC approval...
          </div>
        ) : needsApprove ? (
          <div className="mb-4 rounded-[12px] border border-hair bg-bg-0 px-3 py-3 text-xs text-ink-2">
            <div className="mb-1">Step 1/2: Approve USDC</div>
            <div>Step 2/2: Place Bet</div>
          </div>
        ) : (
          <div className="mb-4 rounded-[12px] border border-hair bg-bg-0 px-3 py-3 text-xs text-ink-2">
            Ready for Step 2/2: Place Bet
          </div>
        )}

        {amountError ? (
          <div className="mb-3 rounded-[12px] border border-heat/30 bg-heat/10 px-3 py-2 text-sm text-heat">
            {amountError}
          </div>
        ) : null}

        {readingBalance ? (
          <div className="mb-3 rounded-[12px] border border-hair bg-bg-0 px-3 py-2 text-sm text-ink-2">
            Reading USDC balance. Please wait.
          </div>
        ) : null}

        {insufficientBalance ? (
          <div className="mb-3 rounded-lg border border-no/30 bg-no/10 px-3 py-2 text-sm text-no">
            Insufficient balance. Use the{' '}
            <a
              href="https://faucet.circle.com"
              target="_blank"
              rel="noopener"
              className="font-medium underline underline-offset-4"
            >
              Circle Faucet
            </a>{' '}
            to get testnet USDC.
          </div>
        ) : null}

        {feedback ? (
          <div
            className={`mb-3 rounded-[12px] px-3 py-2 text-sm ${
              step === 'success'
                ? 'border border-yes/30 bg-yes/10 text-yes'
                : 'border border-hair bg-bg-0 text-ink-2'
            }`}
          >
            {feedback}
          </div>
        ) : null}

        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-hair px-4 py-3 text-sm text-ink transition hover:bg-bg-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-arc-glow/60 focus-visible:ring-offset-2 focus-visible:ring-offset-bg-0"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => {
              void handleConfirm();
            }}
            disabled={confirmDisabled}
            className="rounded-full bg-arc px-4 py-3 text-sm font-semibold text-bg-1 transition hover:bg-arc-deep focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-arc-glow/60 focus-visible:ring-offset-2 focus-visible:ring-offset-bg-0 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {step === 'idle' && (needsApprove ? 'Approve USDC' : 'Place Bet')}
            {step === 'approving' && 'Waiting for approval'}
            {step === 'betting' && 'Placing bet'}
            {step === 'success' && 'Submitted'}
          </button>
        </div>
      </div>
    </div>
  );
}
