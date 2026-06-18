import { createDefiLlamaClient } from './clients/defillama';
import { createFredClient } from './clients/fred';
import { registerSource } from './registry';
import { createChainEventSource } from './sources/chain-event';
import { createFredMacroSource } from './sources/fred-macro';

let bootstrapped = false;

export function bootstrapSources(): void {
  if (bootstrapped) return;

  const fredClient = createFredClient();
  const defiLlama = createDefiLlamaClient();
  registerSource(createFredMacroSource({ fredClient }));
  registerSource(createChainEventSource({ defiLlama }));
  bootstrapped = true;
}

export function getClients() {
  return {
    fredClient: createFredClient(),
    defiLlama: createDefiLlamaClient(),
  };
}
