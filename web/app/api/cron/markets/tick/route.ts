import { NextResponse } from 'next/server';
import { createPublicClient, createWalletClient, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { mainnet, sepolia } from 'viem/chains';

import { USDC_ADDRESS } from '../../../../../lib/addresses';
import { arcTestnet } from '../../../../../lib/chain';
import { bootstrapSources } from '../../../../../lib/markets/bootstrap';
import { eventMarketDeploymentForSource } from '../../../../../lib/markets/deployments';
import { createChainReader } from '../../../../../lib/markets/scheduler/chain-reader';
import { createChainWriter } from '../../../../../lib/markets/scheduler/chain-writer';
import { createLensPreloader } from '../../../../../lib/markets/scheduler/lens-preloader';
import { safeErrorMessage } from '../../../../../lib/markets/scheduler/safe-report';
import { runTick, type SourceTickRuntime } from '../../../../../lib/markets/scheduler/tick';
import { createSeedLiquidity } from '../../../../../lib/markets/scheduler/seed-liquidity';
import { AUTOMATED_MARKET_SEED_USDC } from '../../../../../lib/markets/scheduler/seed-config';
import type { MarketSource } from '../../../../../lib/markets/sources/base';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) throw new Error(`missing env: ${key}`);
  return value;
}

function automationChain() {
  switch (process.env.AUTOMATION_CHAIN) {
    case 'mainnet':
      return mainnet;
    case 'sepolia':
      return sepolia;
    default:
      return arcTestnet;
  }
}

function automationPrivateKey(): `0x${string}` {
  const raw = requireEnv('AUTOMATION_PRIVATE_KEY');
  return raw.startsWith('0x') ? raw as `0x${string}` : `0x${raw}` as `0x${string}`;
}

async function handleTick(req: Request): Promise<Response> {
  const cronSecret = process.env.CRON_SECRET;
  const auth = req.headers.get('authorization');
  if (!cronSecret || auth !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  try {
    bootstrapSources();

    const rpcUrl = requireEnv('AUTOMATION_RPC_URL');
    const chain = automationChain();
    const account = privateKeyToAccount(automationPrivateKey());
    const publicClient = createPublicClient({ chain, transport: http(rpcUrl) });
    const walletClient = createWalletClient({ chain, transport: http(rpcUrl), account });

    const usdcAddress = (process.env.NEXT_PUBLIC_USDC_ADDRESS || USDC_ADDRESS) as `0x${string}`;
    const preloader = createLensPreloader({
      warmFn: async (target) => {
        try {
          const baseUrl = process.env.LENS_PRELOAD_BASE_URL ?? '';
          const res = await fetch(`${baseUrl}/api/lens/${target.eventId}`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ preload: true }),
          });
          return res.ok ? { status: 'ok' } : { status: 'error' };
        } catch {
          return { status: 'error' };
        }
      },
    });
    const runtimeCache = new Map<string, SourceTickRuntime>();
    const runtimeForSource = (source: MarketSource): SourceTickRuntime => {
      const deployment = eventMarketDeploymentForSource(source.id);
      if (!deployment) {
        throw new Error(`missing event market deployment for source: ${source.id}`);
      }

      const cached = runtimeCache.get(deployment.id);
      if (cached) {
        return cached;
      }

      const reader = createChainReader({
        client: publicClient,
        eventMarketAddress: deployment.eventMarketAddress,
        oracleAddress: deployment.oracleAddress,
        fromBlock: BigInt(process.env.MARKETS_FROM_BLOCK ?? deployment.fromBlock.toString()),
      });
      const writer = createChainWriter({
        walletClient,
        publicClient,
        eventMarketAddress: deployment.eventMarketAddress,
        oracleAddress: deployment.oracleAddress,
        usdcAddress,
      });
      const seedLiquidity = createSeedLiquidity({
        writer,
        walletClient,
        publicClient,
        eventMarketAddress: deployment.eventMarketAddress,
        perMarketUsdc: AUTOMATED_MARKET_SEED_USDC,
      });
      const runtime = {
        deploymentId: deployment.id,
        reader,
        writer,
        seedLiquidity,
        preloader,
      };
      runtimeCache.set(deployment.id, runtime);
      return runtime;
    };

    const report = await runTick({
      now: new Date(),
      runtimeForSource,
    });

    return NextResponse.json({ ok: true, report });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: safeErrorMessage(err, 'cron tick failed') },
      { status: 500 },
    );
  }
}

export async function POST(req: Request): Promise<Response> {
  return handleTick(req);
}

export async function GET(req: Request): Promise<Response> {
  return handleTick(req);
}
