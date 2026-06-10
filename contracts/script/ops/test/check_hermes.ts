import assert from "node:assert/strict";
import { fetchCurrentPrice, type HermesLike } from "../lib/hermes.ts";

type AsyncVoid = () => Promise<void> | void;

const cases: Array<{ name: string; fn: AsyncVoid }> = [];

function test(name: string, fn: AsyncVoid) {
  cases.push({ name, fn });
}

function normalizeId(id: string): string {
  return id.replace(/^0x/i, "").toLowerCase();
}

class StubHermes implements HermesLike {
  constructor(
    private readonly parsed: Array<{
      id: string;
      price: { price: string; expo: number; publish_time: number };
    }>,
  ) {}

  async getLatestPriceUpdates(ids: string[], opts: { encoding: "hex"; parsed: true }) {
    assert.deepEqual(opts, { encoding: "hex", parsed: true });

    return {
      parsed: this.parsed.filter((entry) => ids.some((id) => normalizeId(id) === normalizeId(entry.id))),
      binary: { data: [] },
    };
  }
}

test("fetchCurrentPrice 返回人类价 = price * 10^expo", async () => {
  const stub = new StubHermes([
    { id: "abc", price: { price: "7123456789012", expo: -8, publish_time: 1 } },
  ]);
  const value = await fetchCurrentPrice(stub, "0xabc");
  assert.ok(Math.abs(value - 71234.56789012) < 1e-6);
});

test("fetchCurrentPrice 找不到 id 抛错", async () => {
  const stub = new StubHermes([]);
  await assert.rejects(() => fetchCurrentPrice(stub, "0xabc"), /价格未返回/);
});

test("fetchCurrentPrice 支持 priceId 大小写与 0x 前缀混用匹配", async () => {
  const stub = new StubHermes([
    { id: "0xAbC", price: { price: "1234500", expo: -2, publish_time: 1 } },
  ]);

  const value = await fetchCurrentPrice(stub, "ABC");

  assert.equal(value, 12345);
});

test("fetchCurrentPrice 遇到零价或负价抛错", async () => {
  const zeroStub = new StubHermes([
    { id: "abc", price: { price: "0", expo: 0, publish_time: 1 } },
  ]);
  const negativeStub = new StubHermes([
    { id: "abc", price: { price: "-1", expo: 0, publish_time: 1 } },
  ]);

  await assert.rejects(() => fetchCurrentPrice(zeroStub, "0xabc"), /价格无效/);
  await assert.rejects(() => fetchCurrentPrice(negativeStub, "0xabc"), /价格无效/);
});

let failures = 0;

for (const { name, fn } of cases) {
  try {
    await fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    failures += 1;
    console.error(`not ok - ${name}`);
    console.error(error);
  }
}

if (failures > 0) {
  console.error(`共 ${failures} 个 Hermes 检查失败`);
  process.exit(1);
}

console.log(`全部 ${cases.length} 个 Hermes 检查通过`);
