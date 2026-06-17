export * from './schema';
export * from './prompts';
export * from './cache';
export * from './budget';
export * from './llm';
export * from './contextBuilders/crypto';
export * from './contextBuilders/event';

export type LensRouteResponseOk = {
  status: 'ok';
  cached: boolean;
  output: import('./schema').LensOutput;
  meta: { last_updated_ms: number; input_hash: string };
};

export type LensRouteResponseErr = {
  status: 'error';
  code:
    | 'invalid_market'
    | 'budget_exhausted'
    | 'llm_failure'
    | 'schema_failure'
    | 'rate_limited';
  message: string;
};

export type LensRouteResponse = LensRouteResponseOk | LensRouteResponseErr;
