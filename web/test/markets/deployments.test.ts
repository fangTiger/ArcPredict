import { describe, expect, it } from 'vitest';

import {
  EVENT_MARKET_DEPLOYMENTS,
  eventMarketDeploymentForSource,
  eventMarketDeploymentsForCategory,
} from '../../lib/markets/deployments';

describe('event market deployments', () => {
  it('keeps automated macro/chain and worldcup deployments active together', () => {
    expect(EVENT_MARKET_DEPLOYMENTS.map((deployment) => deployment.id)).toEqual([
      'automated-v1',
      'worldcup-v1',
    ]);

    expect(eventMarketDeploymentsForCategory('macro').map((deployment) => deployment.id)).toEqual([
      'automated-v1',
    ]);
    expect(eventMarketDeploymentsForCategory('chain').map((deployment) => deployment.id)).toEqual([
      'automated-v1',
    ]);
    expect(eventMarketDeploymentsForCategory('worldcup').map((deployment) => deployment.id)).toEqual([
      'worldcup-v1',
    ]);
  });

  it('routes automated sources to the legacy automated deployment', () => {
    expect(eventMarketDeploymentForSource('fred-macro')?.id).toBe('automated-v1');
    expect(eventMarketDeploymentForSource('chain-event')?.id).toBe('automated-v1');
  });
});
