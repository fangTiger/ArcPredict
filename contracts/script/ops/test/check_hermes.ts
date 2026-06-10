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

function stubWithResponse(response: unknown): HermesLike {
  return {
    async getLatestPriceUpdates(ids: string[], opts: { encoding: "hex"; parsed: true }) {
      assert.equal(ids.length, 1);
      assert.deepEqual(opts, { encoding: "hex", parsed: true });
      return response as never;
    },
  };
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

test("fetchCurrentPrice 请求 Hermes 时保留调用方传入的原始 priceId", async () => {
  let requestedIds: string[] = [];
  const stub: HermesLike = {
    async getLatestPriceUpdates(ids: string[], opts: { encoding: "hex"; parsed: true }) {
      requestedIds = [...ids];
      assert.deepEqual(opts, { encoding: "hex", parsed: true });
      return {
        parsed: [{ id: "abc", price: { price: "1234500", expo: -2, publish_time: 1 } }],
        binary: { data: [] },
      };
    },
  };

  const value = await fetchCurrentPrice(stub, "0xAbC");

  assert.equal(value, 12345);
  assert.deepEqual(requestedIds, ["0xAbC"]);
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

test("fetchCurrentPrice 遇到非数字 price 字符串抛错", async () => {
  const stub = stubWithResponse({
    parsed: [{ id: "abc", price: { price: "NaN", expo: 0, publish_time: 1 } }],
    binary: { data: [] },
  });

  await assert.rejects(() => fetchCurrentPrice(stub, "0xabc"), /价格无效/);
});

test("fetchCurrentPrice 遇到 matched.price 缺失或格式错误时抛价格无效", async () => {
  const invalidResponses = [
    {
      name: "matched.price 缺失",
      response: {
        parsed: [{ id: "abc" }],
        binary: { data: [] },
      },
    },
    {
      name: "matched.price 为 null",
      response: {
        parsed: [{ id: "abc", price: null }],
        binary: { data: [] },
      },
    },
    {
      name: "matched.price.price 不是字符串",
      response: {
        parsed: [{ id: "abc", price: { price: 123, expo: 0, publish_time: 1 } }],
        binary: { data: [] },
      },
    },
    {
      name: "matched.price.expo 不是有限数字",
      response: {
        parsed: [{ id: "abc", price: { price: "123", expo: Number.NaN, publish_time: 1 } }],
        binary: { data: [] },
      },
    },
  ];

  for (const { name, response } of invalidResponses) {
    await assert.rejects(
      () => fetchCurrentPrice(stubWithResponse(response as unknown), "0xabc"),
      /价格无效/,
      name,
    );
  }
});

test("fetchCurrentPrice 遇到 parsed 为 null 按未返回处理", async () => {
  const stub = stubWithResponse({
    parsed: null,
    binary: { data: [] },
  });

  await assert.rejects(() => fetchCurrentPrice(stub, "0xabc"), /价格未返回/);
});

test("fetchCurrentPrice 遇到缺失 parsed 按未返回处理", async () => {
  const stub = stubWithResponse({
    binary: { data: [] },
  });

  await assert.rejects(() => fetchCurrentPrice(stub, "0xabc"), /价格未返回/);
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
