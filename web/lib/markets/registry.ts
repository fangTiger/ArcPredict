import type { MarketSource } from './sources/base';

const sources = new Map<string, MarketSource>();

export function registerSource(source: MarketSource): void {
  if (sources.has(source.id)) {
    throw new Error(`duplicate source registration: ${source.id}`);
  }
  sources.set(source.id, source);
}

export function enabledSources(): MarketSource[] {
  return Array.from(sources.values()).filter((s) => s.enabled);
}

export function getSource(id: string): MarketSource | undefined {
  return sources.get(id);
}

/** 仅用于单测，清空注册表。 */
export function resetRegistry(): void {
  sources.clear();
}
