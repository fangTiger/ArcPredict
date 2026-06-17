import type { FredClient } from '../../markets/clients/fred';

export interface MacroLensInput {
  fredClient: FredClient;
  market: {
    eventId: `0x${string}`;
    question: string;
    externalKey: string;
    outcomes: { id: string; label: string }[];
  };
}

export interface MacroLensContext {
  seriesId: string;
  releaseDate: string;
  latest: { date: string; value: number } | null;
  outcomes: { id: string; label: string }[];
  /** 给 LLM 的补充说明：当前指标值、发布时间与 outcome 含义。 */
  prose: string;
}

const SERIES_NAMES: Record<string, string> = {
  CPIAUCSL: 'US CPI YoY (%)',
  FEDFUNDS: 'Fed Funds Rate (%)',
  PAYEMS: 'Non-Farm Payrolls (MoM change, thousands)',
};

export async function buildMacroLensContext(
  input: MacroLensInput,
): Promise<MacroLensContext> {
  const [seriesId, releaseDate] = input.market.externalKey.split(':');
  const latest = await input.fredClient.getLatestObservation(seriesId);

  const seriesName = SERIES_NAMES[seriesId] ?? seriesId;
  const latestLine = latest
    ? `Latest published ${seriesName}: ${latest.value} on ${latest.date}.`
    : `No recent published value available for ${seriesName}.`;

  const outcomeLines = input.market.outcomes
    .map((outcome, index) => `(${index}) ${outcome.label}`)
    .join(', ');

  const prose = [
    `Question: ${input.market.question}`,
    latestLine,
    `Possible outcomes: ${outcomeLines}.`,
    `Next release date: ${releaseDate}.`,
  ].join(' ');

  return {
    seriesId,
    releaseDate,
    latest,
    outcomes: input.market.outcomes,
    prose,
  };
}
