import { NextResponse } from 'next/server';
import { createPublicClient, createWalletClient, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { mainnet, sepolia } from 'viem/chains';

import { arcTestnet } from '../../../../../lib/chain';
import { bootstrapSources } from '../../../../../lib/markets/bootstrap';
import { createChainReader } from '../../../../../lib/markets/scheduler/chain-reader';
import { createChainWriter } from '../../../../../lib/markets/scheduler/chain-writer';
import { createLensPreloader } from '../../../../../lib/markets/scheduler/lens-preloader';
import { runTick } from '../../../../../lib/markets/scheduler/tick';
import { createSeedLiquidity } from '../../../../../lib/markets/scheduler/seed-liquidity';

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

    const eventMarketAddress = requireEnv('NEXT_PUBLIC_EVENT_MARKET_ADDRESS') as `0x${string}`;
    const oracleAddress = requireEnv('NEXT_PUBLIC_EVENT_ORACLE_ADDRESS') as `0x${string}`;
    const usdcAddress = requireEnv('NEXT_PUBLIC_USDC_ADDRESS') as `0x${string}`;

    const reader = createChainReader({
      client: publicClient,
      eventMarketAddress,
      oracleAddress,
      fromBlock: BigInt(process.env.MARKETS_FROM_BLOCK ?? '0'),
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

    const report = await runTick({
      now: new Date(),
      reader,
      writer,
      seedLiquidity,
      preloader,
    });

    return NextResponse.json({ ok: true, report });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
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
