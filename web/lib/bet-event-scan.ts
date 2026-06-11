export const LOG_SCAN_BLOCK_STEP = 10_000n;

type LogScanClient<
  TLog,
  TAddress extends `0x${string}` = `0x${string}`,
  TEvent = unknown,
  TArgs = Record<string, unknown> | undefined,
> = {
  getLogs: (params: {
    address: TAddress;
    event: TEvent;
    args?: TArgs;
    fromBlock: bigint;
    toBlock: bigint;
  }) => Promise<readonly TLog[]>;
  getBlockNumber?: () => Promise<bigint>;
};

type FetchLogsPagedParams<
  TAddress extends `0x${string}` = `0x${string}`,
  TEvent = unknown,
  TArgs = Record<string, unknown> | undefined,
> = {
  address: TAddress;
  event: TEvent;
  args?: TArgs;
  fromBlock: bigint;
  toBlock: bigint | 'latest';
};

async function resolveToBlock<TLog, TAddress extends `0x${string}`, TEvent, TArgs>(
  client: LogScanClient<TLog, TAddress, TEvent, TArgs>,
  toBlock: bigint | 'latest',
): Promise<bigint> {
  if (toBlock !== 'latest') {
    return toBlock;
  }

  if (!client.getBlockNumber) {
    throw new Error("toBlock 为 'latest' 时需要 getBlockNumber 支持。");
  }

  return client.getBlockNumber();
}

export async function fetchLogsPaged<
  TLog,
  TAddress extends `0x${string}` = `0x${string}`,
  TEvent = unknown,
  TArgs = Record<string, unknown> | undefined,
>(
  client: LogScanClient<TLog, TAddress, TEvent, TArgs>,
  params: FetchLogsPagedParams<TAddress, TEvent, TArgs>,
): Promise<TLog[]> {
  const { address, event, args, fromBlock, toBlock } = params;
  const resolvedToBlock = await resolveToBlock(client, toBlock);

  if (fromBlock > resolvedToBlock) {
    return [];
  }

  const logs: TLog[] = [];

  // Arc RPC 单次 eth_getLogs 只允许扫描 10,000 个区块，前端必须按页读取。
  for (let cursor = fromBlock; cursor <= resolvedToBlock; cursor += LOG_SCAN_BLOCK_STEP) {
    const chunkToBlock =
      cursor + LOG_SCAN_BLOCK_STEP - 1n < resolvedToBlock
        ? cursor + LOG_SCAN_BLOCK_STEP - 1n
        : resolvedToBlock;
    const chunkLogs = await client.getLogs({
      address,
      event,
      args,
      fromBlock: cursor,
      toBlock: chunkToBlock,
    });

    logs.push(...chunkLogs);
  }

  return logs;
}
