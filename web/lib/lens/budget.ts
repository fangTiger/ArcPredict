/**
 * 注：默认价格按 DeepSeek V3 cache-miss 取值；V4 正式上线后，
 * 请在 .env 用 LENS_INPUT_PRICE_PER_M_TOKENS / LENS_OUTPUT_PRICE_PER_M_TOKENS 覆盖。
 * 参考：https://api-docs.deepseek.com/quick_start/pricing
 */
export type BudgetOptions = {
  dailyLimitUsd: number;
  inputPricePerMTokens?: number;
  outputPricePerMTokens?: number;
  nowMs?: () => number;
};

const dayKey = (ms: number): string => {
  const d = new Date(ms);
  return `${d.getUTCFullYear()}-${d.getUTCMonth()}-${d.getUTCDate()}`;
};

export function createBudgetTracker(opts: BudgetOptions) {
  const now = opts.nowMs ?? (() => Date.now());
  const inputPrice = opts.inputPricePerMTokens ?? 0.07;
  const outputPrice = opts.outputPricePerMTokens ?? 1.10;
  let currentDay = dayKey(now());
  let spent = 0;

  const rollover = () => {
    const today = dayKey(now());
    if (today !== currentDay) {
      currentDay = today;
      spent = 0;
    }
  };

  return {
    canSpend(usd: number): boolean {
      rollover();
      return spent + usd <= opts.dailyLimitUsd;
    },
    record(usd: number) {
      rollover();
      spent += usd;
    },
    spentToday(): number {
      rollover();
      return spent;
    },
    estimateCostUsd(inputTokens: number, outputTokens: number): number {
      return (inputTokens * inputPrice + outputTokens * outputPrice) / 1_000_000;
    },
  };
}
