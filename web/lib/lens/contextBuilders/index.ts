import type { MarketCategory } from '../../market-kind';
import type { DefiLlamaClient } from '../../markets/clients/defillama';
import type { FredClient } from '../../markets/clients/fred';
import { buildChainLensContext } from './chain';
import { buildMacroLensContext } from './macro';

export interface CategoryContextInput {
  category: MarketCategory;
  market: {
    eventId: `0x${string}`;
    question: string;
    externalKey: string;
    outcomes: { id: string; label: string }[];
  };
  fredClient?: FredClient;
  defiLlama?: DefiLlamaClient;
}

export async function buildCategoryContextProse(
  input: CategoryContextInput,
): Promise<string | null> {
  switch (input.category) {
    case 'macro':
      if (!input.fredClient) return null;
      return (await buildMacroLensContext({ fredClient: input.fredClient, market: input.market })).prose;
    case 'chain':
      if (!input.defiLlama) return null;
      return (await buildChainLensContext({ defiLlama: input.defiLlama, market: input.market })).prose;
    case 'crypto':
    case 'worldcup':
    default:
      return null;
  }
}
