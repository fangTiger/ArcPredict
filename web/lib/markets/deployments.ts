import {
  ADMIN_EVENT_ORACLE_ADDRESS,
  AUTOMATED_EVENT_MARKET_ADDRESS,
  AUTOMATED_EVENT_ORACLE_ADDRESS,
  EVENT_MARKET_ADDRESS,
} from '../addresses';
import type { MarketCategory } from '../market-kind';

export type EventMarketDeploymentId = 'automated-v1' | 'worldcup-v1';

export type EventMarketDeployment = {
  id: EventMarketDeploymentId;
  label: string;
  eventMarketAddress: `0x${string}`;
  oracleAddress: `0x${string}`;
  categories: readonly MarketCategory[];
  sourceIds: readonly string[];
  fromBlock: bigint;
};

export const EVENT_MARKET_DEPLOYMENTS = [
  {
    id: 'automated-v1',
    label: 'Automated categories v1',
    eventMarketAddress: AUTOMATED_EVENT_MARKET_ADDRESS,
    oracleAddress: AUTOMATED_EVENT_ORACLE_ADDRESS,
    categories: ['macro', 'chain'],
    sourceIds: ['fred-macro', 'chain-event'],
    fromBlock: 0n,
  },
  {
    id: 'worldcup-v1',
    label: 'World Cup v1',
    eventMarketAddress: EVENT_MARKET_ADDRESS,
    oracleAddress: ADMIN_EVENT_ORACLE_ADDRESS,
    categories: ['worldcup'],
    sourceIds: [],
    fromBlock: 48_345_106n,
  },
] as const satisfies readonly EventMarketDeployment[];

export const DEFAULT_EVENT_MARKET_DEPLOYMENT = EVENT_MARKET_DEPLOYMENTS[1];

export const EVENT_MARKET_DEPLOYMENTS_BY_ID = new Map<EventMarketDeploymentId, EventMarketDeployment>(
  EVENT_MARKET_DEPLOYMENTS.map((deployment) => [deployment.id, deployment]),
);

export function eventMarketDeploymentById(id: string | null | undefined): EventMarketDeployment | undefined {
  if (!id) return undefined;
  return EVENT_MARKET_DEPLOYMENTS_BY_ID.get(id as EventMarketDeploymentId);
}

export function eventMarketDeploymentsForCategory(category: MarketCategory): EventMarketDeployment[] {
  if (category === 'crypto') return [];
  return EVENT_MARKET_DEPLOYMENTS.filter((deployment) =>
    (deployment.categories as readonly MarketCategory[]).includes(category),
  );
}

export function eventMarketDeploymentForSource(sourceId: string): EventMarketDeployment | undefined {
  return EVENT_MARKET_DEPLOYMENTS.find((deployment) =>
    (deployment.sourceIds as readonly string[]).includes(sourceId),
  );
}

export function attachDeploymentToEventRow<T extends object>(
  row: T,
  deployment: EventMarketDeployment,
): T & {
  deploymentId: EventMarketDeploymentId;
  eventMarketAddress: `0x${string}`;
  oracleAddress: `0x${string}`;
} {
  return {
    ...row,
    deploymentId: deployment.id,
    eventMarketAddress: deployment.eventMarketAddress,
    oracleAddress: deployment.oracleAddress,
  };
}
