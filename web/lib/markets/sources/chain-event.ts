import type { DefiLlamaClient } from '../clients/defillama';
import {
  ResolveStillOpen,
  type MarketDraft,
  type MarketSource,
  type OnChainMarket,
  type ResolvedOutcome,
} from './base';

const TVL_BUMP_FACTORS = [1.05, 1.10, 1.20];
const TVL_DEADLINE_DAYS = 90;
const TRACKED_CHAINS: { id: string; defiLlamaName: string }[] = [
  { id: 'eth', defiLlamaName: 'Ethereum' },
  { id: 'arb', defiLlamaName: 'Arbitrum' },
];

function isoDateOffset(now: Date, days: number): string {
  return new Date(now.getTime() + days * 86_400_000).toISOString().slice(0, 10);
}

function formatUsdBillions(value: number): string {
  return `${(value / 1e9).toFixed(2)}B`;
}

export interface ChainEventSourceOptions {
  defiLlama: DefiLlamaClient;
}

export function createChainEventSource(opts: ChainEventSourceOptions): MarketSource {
  return {
    id: 'chain-event',
    category: 'chain',
    enabled: true,

    async fetchUpcoming(now: Date): Promise<MarketDraft[]> {
      const drafts: MarketDraft[] = [];

      for (const chain of TRACKED_CHAINS) {
        const current = await opts.defiLlama.getChainTvl(chain.defiLlamaName);
        if (current == null) continue;

        for (const bump of TVL_BUMP_FACTORS) {
          const threshold = Math.floor(current * bump);
          const deadline = isoDateOffset(now, TVL_DEADLINE_DAYS);
          const deadlineTs = Math.floor(Date.parse(`${deadline}T00:00:00Z`) / 1000);
          drafts.push({
            externalKey: `${chain.id}:tvl:gte:${threshold}:${deadline}`,
            category: 'chain',
            question: `Will ${chain.defiLlamaName} TVL be >= $${formatUsdBillions(threshold)} by ${deadline}?`,
            outcomes: [
              { id: 'yes', label: 'Yes' },
              { id: 'no', label: 'No' },
            ],
            betDeadline: deadlineTs - 86400,
            resolveAfter: deadlineTs,
            resolveSourceMeta: {
              chainId: chain.id,
              chainName: chain.defiLlamaName,
              thresholdUsd: threshold,
              deadline,
            },
          });
        }
      }

      return drafts;
    },

    async resolve(market: OnChainMarket, now: Date): Promise<ResolvedOutcome> {
      const parts = market.externalKey.split(':');
      if (parts.length !== 5 || parts[1] !== 'tvl' || parts[2] !== 'gte') {
        return { kind: 'invalid', reason: `unknown externalKey shape: ${market.externalKey}` };
      }

      const chainId = parts[0];
      const threshold = Number(parts[3]);
      const deadline = parts[4];
      const deadlineTs = Math.floor(Date.parse(`${deadline}T00:00:00Z`) / 1000);

      if (!Number.isFinite(threshold) || Number.isNaN(deadlineTs)) {
        return { kind: 'invalid', reason: `invalid externalKey: ${market.externalKey}` };
      }

      if (Math.floor(now.getTime() / 1000) < deadlineTs) {
        return ResolveStillOpen;
      }

      const chain = TRACKED_CHAINS.find((c) => c.id === chainId);
      if (!chain) return { kind: 'invalid', reason: `unknown chainId: ${chainId}` };

      const current = await opts.defiLlama.getChainTvl(chain.defiLlamaName);
      if (current == null) return ResolveStillOpen;

      return {
        kind: 'settled',
        settledOutcomeIndex: current >= threshold ? 0 : 1,
        publishedAt: Math.floor(now.getTime() / 1000),
        evidence: {
          sourceUrl: `https://defillama.com/chain/${chain.defiLlamaName}`,
          rawValue: current,
        },
      };
    },
  };
}
