import type { DefiLlamaClient } from '../../markets/clients/defillama';

export interface ChainLensInput {
  defiLlama: DefiLlamaClient;
  market: {
    eventId: `0x${string}`;
    question: string;
    externalKey: string;
    outcomes: { id: string; label: string }[];
  };
}

export interface ChainLensContext {
  chainId: string;
  thresholdTvl: number;
  deadline: string;
  currentTvl: number | null;
  gapToThresholdRatio: number | null;
  prose: string;
}

const CHAIN_DEFILLAMA_NAME: Record<string, string> = {
  eth: 'Ethereum',
  arb: 'Arbitrum',
};

export async function buildChainLensContext(
  input: ChainLensInput,
): Promise<ChainLensContext> {
  const [chainId, , , thresholdStr, deadline] = input.market.externalKey.split(':');
  const thresholdTvl = Number(thresholdStr);
  const llamaName = CHAIN_DEFILLAMA_NAME[chainId] ?? chainId;
  const currentTvl = await input.defiLlama.getChainTvl(llamaName);

  const gap = currentTvl != null ? currentTvl / thresholdTvl : null;
  const proseLines = [
    `Question: ${input.market.question}`,
    `Target chain: ${llamaName} (id=${chainId}).`,
    `Threshold TVL: $${(thresholdTvl / 1e9).toFixed(2)}B.`,
    `Deadline: ${deadline}.`,
  ];

  if (currentTvl != null && gap != null) {
    proseLines.push(
      `Current TVL: $${(currentTvl / 1e9).toFixed(2)}B (${(gap * 100).toFixed(1)}% of threshold).`,
    );
  } else {
    proseLines.push('Current TVL unavailable.');
  }

  return {
    chainId,
    thresholdTvl,
    deadline,
    currentTvl,
    gapToThresholdRatio: gap,
    prose: proseLines.join(' '),
  };
}
