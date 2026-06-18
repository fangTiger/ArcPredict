import { afterEach, describe, expect, it } from 'vitest';
import { createPublicClient, createWalletClient, http, type PublicClient } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { foundry } from 'viem/chains';

import { computeMarketId } from '../../lib/markets/external-key';
import { registerSource, resetRegistry } from '../../lib/markets/registry';
import { createChainReader } from '../../lib/markets/scheduler/chain-reader';
import { createChainWriter } from '../../lib/markets/scheduler/chain-writer';
import { createLensPreloader } from '../../lib/markets/scheduler/lens-preloader';
import { createSeedLiquidity } from '../../lib/markets/scheduler/seed-liquidity';
import { runTick, type RunTickArgs } from '../../lib/markets/scheduler/tick';
import {
  ResolveStillOpen,
  type MarketDraft,
  type MarketSource,
  type ResolvedOutcome,
} from '../../lib/markets/sources/base';

const DAY_SECONDS = 86_400;
const CHALLENGE_WINDOW_SECONDS = 72 * 3_600;
const E2E_SOURCE_ID = 'e2e-tick-source';

type HexAddress = `0x${string}`;

function requireHexEnv(key: string): HexAddress {
  const value = process.env[key];
  if (!value || !value.startsWith('0x')) {
    throw new Error(`missing ${key}; run with E2E=1 and an anvil fork deployment env`);
  }
  return value as HexAddress;
}

async function advanceAnvilTime(client: PublicClient, seconds: number): Promise<void> {
  const request = client.request as unknown as (args: {
    method: string;
    params?: unknown[];
  }) => Promise<unknown>;
  await request({ method: 'evm_increaseTime', params: [seconds] });
  await request({ method: 'evm_mine', params: [] });
}

function makeSource(draft: MarketDraft): MarketSource {
  return {
    id: E2E_SOURCE_ID,
    category: 'chain',
    enabled: true,
    async fetchUpcoming() {
      return [draft];
    },
    async resolve(_market, now): Promise<ResolvedOutcome> {
      if (Math.floor(now.getTime() / 1000) < draft.resolveAfter) {
        return ResolveStillOpen;
      }
      return {
        kind: 'settled',
        settledOutcomeIndex: 0,
        publishedAt: Math.floor(now.getTime() / 1000),
        evidence: {
          sourceUrl: 'anvil://e2e-tick',
          rawValue: 'yes',
        },
      };
    },
  };
}

afterEach(() => {
  resetRegistry();
});

describe.skipIf(!process.env.E2E)('E2E tick on fork', () => {
  it('runs full lifecycle: open -> seed -> preload -> propose -> finalize -> settle', async () => {
    resetRegistry();

    const eventMarketAddress = requireHexEnv('E2E_EVENT_MARKET');
    const oracleAddress = requireHexEnv('E2E_ORACLE');
    const usdcAddress = requireHexEnv('E2E_USDC');
    const account = privateKeyToAccount(requireHexEnv('E2E_PRIVATE_KEY'));
    const transport = http(process.env.E2E_RPC_URL ?? 'http://localhost:8545');
    const publicClient = createPublicClient({ chain: foundry, transport });
    const walletClient = createWalletClient({ chain: foundry, transport, account });
    const startBlock = await publicClient.getBlock();
    const startSec = Number(startBlock.timestamp);

    const draft: MarketDraft = {
      externalKey: `e2e:${startSec}:${Date.now()}`,
      category: 'chain',
      question: 'E2E anvil lifecycle market resolves to yes',
      outcomes: [
        { id: 'yes', label: 'Yes' },
        { id: 'no', label: 'No' },
      ],
      betDeadline: startSec + 90 * DAY_SECONDS,
      resolveAfter: startSec + 99 * DAY_SECONDS,
      resolveSourceMeta: { kind: 'e2e' },
    };
    registerSource(makeSource(draft));

    const reader = createChainReader({
      client: publicClient,
      eventMarketAddress,
      oracleAddress,
    });
    const writer = createChainWriter({
      walletClient,
      eventMarketAddress,
      oracleAddress,
      usdcAddress,
    });
    const seedLiquidity = createSeedLiquidity({
      writer,
      walletClient,
      eventMarketAddress,
      perMarketUsdc: 10_000_000n,
    });
    const preloaded: HexAddress[] = [];
    const preloader = createLensPreloader({
      warmFn: async (target) => {
        preloaded.push(target.eventId);
        return { status: 'ok' };
      },
    });
    const argsAt = (nowSec: number): RunTickArgs => ({
      now: new Date(nowSec * 1000),
      reader,
      writer,
      seedLiquidity,
      preloader,
    });

    const eventId = computeMarketId(E2E_SOURCE_ID, draft.externalKey);

    // tick 1: open + seed + preload
    const report1 = await runTick(argsAt(startSec));
    expect(report1.perSource[E2E_SOURCE_ID].opened).toBe(1);
    expect(await reader.marketIdForEventId(eventId)).not.toBeNull();
    expect(preloaded).toContain(eventId);

    // tick 2: after 100 days, source result is available and oracle proposal is submitted
    await advanceAnvilTime(publicClient, 100 * DAY_SECONDS);
    const report2 = await runTick(argsAt(startSec + 100 * DAY_SECONDS));
    expect(report2.perSource[E2E_SOURCE_ID].resolvedProposed).toBe(1);
    expect(await reader.oracleStatus(eventId)).toBe('proposed');

    // tick 3: after 72h challenge window, proposal finalizes and EventMarket settles
    await advanceAnvilTime(publicClient, CHALLENGE_WINDOW_SECONDS + 60);
    const report3 = await runTick(argsAt(startSec + 100 * DAY_SECONDS + CHALLENGE_WINDOW_SECONDS + 60));
    expect(report3.perSource[E2E_SOURCE_ID].resolvedFinalized).toBe(1);
    expect(report3.perSource[E2E_SOURCE_ID].resolvedSettled).toBe(1);

    const marketId = await reader.marketIdForEventId(eventId);
    expect(marketId).not.toBeNull();
    expect(await reader.marketSettled(marketId!)).toBe(true);
  }, 60_000);
});
