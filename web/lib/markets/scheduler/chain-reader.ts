import type { PublicClient } from 'viem';
import {
  eventMarketAbi,
  adminOracleAbi,
  ORACLE_STATUS,
  type OracleStatusValue,
} from './abi';

export type OracleStatusName = 'pending' | 'proposed' | 'challenged' | 'finalized';
const UNRESOLVED_OUTCOME = 255;

const statusName = (v: OracleStatusValue): OracleStatusName => {
  switch (v) {
    case ORACLE_STATUS.Pending:
      return 'pending';
    case ORACLE_STATUS.Proposed:
      return 'proposed';
    case ORACLE_STATUS.Challenged:
      return 'challenged';
    case ORACLE_STATUS.Finalized:
      return 'finalized';
  }
};

export interface ChainReaderOptions {
  client: PublicClient;
  eventMarketAddress: `0x${string}`;
  oracleAddress: `0x${string}`;
  fromBlock?: bigint;
}

type MarketTuple = readonly [
  `0x${string}`,
  number,
  bigint,
  bigint,
  readonly bigint[],
  bigint,
  bigint,
  number,
  `0x${string}`,
  number,
  bigint,
  string,
];

export function createChainReader(opts: ChainReaderOptions) {
  const { client, eventMarketAddress, oracleAddress, fromBlock = 0n } = opts;

  /** 通过扫 MarketCreated 事件实现 eventId 到 marketId 的映射与幂等去重。 */
  const marketIdForEventId = async (eventId: `0x${string}`): Promise<bigint | null> => {
    const events = await client.getContractEvents({
      address: eventMarketAddress,
      abi: eventMarketAbi,
      eventName: 'MarketCreated',
      args: { eventId },
      fromBlock,
    });
    if (events.length === 0) return null;
    const first = events[0] as unknown as { args: { id: bigint } };
    return first.args.id;
  };

  const oracleStatus = async (eventId: `0x${string}`): Promise<OracleStatusName> => {
    const raw = (await client.readContract({
      address: oracleAddress,
      abi: adminOracleAbi,
      functionName: 'getEventStatus',
      args: [eventId],
    })) as number;
    return statusName(raw as OracleStatusValue);
  };

  const marketSettled = async (marketId: bigint): Promise<boolean> => {
    const tuple = (await client.readContract({
      address: eventMarketAddress,
      abi: eventMarketAbi,
      functionName: 'markets',
      args: [marketId],
    })) as MarketTuple;
    const settledOutcome = tuple[9];
    return settledOutcome !== UNRESOLVED_OUTCOME;
  };

  return {
    marketIdForEventId,
    oracleStatus,
    marketSettled,

    async pendingMarketsForSource(_sourceId: string, knownEventIds: `0x${string}`[]) {
      const results: {
        marketId: bigint;
        eventId: `0x${string}`;
        resolveAfter: number;
        oracleStatus: OracleStatusName;
        proposedAt?: number;
        settled: boolean;
      }[] = [];

      for (const eventId of knownEventIds) {
        const marketId = await marketIdForEventId(eventId);
        if (marketId == null) continue;

        const tuple = (await client.readContract({
          address: eventMarketAddress,
          abi: eventMarketAbi,
          functionName: 'markets',
          args: [marketId],
        })) as MarketTuple;
        const settledOutcome = tuple[9];
        const settled = settledOutcome !== UNRESOLVED_OUTCOME;
        if (settled) continue;

        const status = await oracleStatus(eventId);
        let proposedAt: number | undefined;
        if (status === 'proposed') {
          const proposedEvents = await client.getContractEvents({
            address: oracleAddress,
            abi: adminOracleAbi,
            eventName: 'ResultProposed',
            args: { eventId },
            fromBlock,
          });
          const first = proposedEvents[0] as unknown as {
            args?: { proposedAt?: bigint | number };
          } | undefined;
          const rawProposedAt = first?.args?.proposedAt;
          proposedAt = rawProposedAt == null ? undefined : Number(rawProposedAt);
        }

        results.push({
          marketId,
          eventId,
          resolveAfter: Number(tuple[3]),
          oracleStatus: status,
          proposedAt,
          settled: false,
        });
      }

      return results;
    },
  };
}
