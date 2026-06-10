import { parseAbiItem } from "viem";
import type { Address } from "./clients.ts";

export type BetEvent = {
  id: bigint;
  user: Address;
  yes: boolean;
  amount: bigint;
};

const BET_EVENT = parseAbiItem(
  "event Bet(uint256 indexed id, address indexed user, bool yes, uint128 amount, uint128 yesPoolAfter, uint128 noPoolAfter)",
);

type BetLogArgs = Partial<BetEvent>;

type BetLog = {
  args?: BetLogArgs;
};

export type BetEventLogClient = {
  getLogs: (params: {
    address: Address;
    event: typeof BET_EVENT;
    fromBlock: bigint;
    toBlock: bigint | "latest";
  }) => Promise<readonly BetLog[]>;
};

export function collectSeededMarketIds(events: readonly BetEvent[], seeds: readonly Address[]): Set<bigint> {
  const lowerSeeds = new Set(seeds.map((seed) => seed.toLowerCase()));
  const seeded = new Set<bigint>();

  for (const event of events) {
    if (lowerSeeds.has(event.user.toLowerCase())) {
      seeded.add(event.id);
    }
  }

  return seeded;
}

function requireBetArg<K extends keyof BetEvent>(args: BetLogArgs | undefined, key: K): BetEvent[K] {
  const value = args?.[key];
  if (value === undefined) {
    throw new Error(`Bet 事件缺少必需参数: ${key}`);
  }
  return value;
}

export async function fetchBetEvents(
  client: BetEventLogClient,
  marketAddress: Address,
  fromBlock: bigint,
  toBlock: bigint | "latest" = "latest",
): Promise<BetEvent[]> {
  const logs = await client.getLogs({
    address: marketAddress,
    event: BET_EVENT,
    fromBlock,
    toBlock,
  });

  return logs.map((log) => ({
    id: requireBetArg(log.args, "id"),
    user: requireBetArg(log.args, "user"),
    yes: requireBetArg(log.args, "yes"),
    amount: requireBetArg(log.args, "amount"),
  }));
}
