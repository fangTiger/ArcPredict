# ArcPredict 首页 UI 重设需求（给 codex）

> **日期**：2026-06-11
> **设计稿**：`mockups/phase16/home.html`（v1 已锁）
> **范围**：仅重写首页 UI + 全站主题切换。`/market/[id]` 与 `/connect` 两页本轮不重写，按相同设计语言推过去是后续任务。

---

## 总目标

把现有 **dark + dashboardy** 的首页，彻底替换为 **light/white + Arc-native + prediction-first** 的样子。**所有数据流、wagmi hook、合约调用不变**，只换 UI 结构与样式。

## 设计稿对照

直接打开 `mockups/phase16/home.html` 在浏览器看：

- header：Arc Ring（蓝圈 + 脉冲蓝点）+ "Arc*Predict*" 字标 + chain badge + Connect Wallet
- filter bar：Asset 与 Cadence 两组 chip，夹在两条 hair line 之间
- market grid：2 列卡片网格
- footer：一行细字
- 背景：右上 + 左下两组同心 Arc 弧线（fixed，pointer-events:none）

---

## 1. 颜色 token（替换 `web/tailwind.config.ts`）

把现有 `base / surface / elevated / accent / yes / no / warning` **全部删除**，改为：

```ts
colors: {
  canvas:   '#FBFAF7',
  paper:    '#FFFFFF',
  ink:      '#0A0B0F',
  'ink-2':  '#5B6478',
  hair:     '#E8E6DF',
  arc:      '#1652F0',
  'arc-deep': '#0B2DB8',
  'arc-tint': '#E8EEFE',
  yes:      '#16A34A',
  no:       '#DC2626',
  heat:     '#FF6B35',
}
```

## 2. 字体

保留 `Geist` (body) + `Geist Mono` (mono)。**新加 `Instrument Serif`** 作为 display：

- 在 `app/layout.tsx` 头部加 Google Fonts link：
  `https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&display=swap`
- Tailwind 加 `fontFamily.display: ['Instrument Serif', 'Georgia', 'serif']`

## 3. `app/globals.css`

- 删 `color-scheme: dark`
- body 默认 light：`bg-canvas text-ink`
- 保留 `font-variant-numeric: tabular-nums` 与 `text-wrap: pretty`

## 4. `app/layout.tsx`

- body 改 `className="bg-canvas text-ink"`
- 在 body 内顶部插一个全局 `<ArcBackground />` 组件（两组同心圆 SVG，fixed 定位，z-index:0，pointer-events:none），具体形态拷贝 `home.html` 里的 `.bg-arc` 和 `.bg-arc-2` 两段 SVG

## 5. `app/page.tsx`（首页）

**删除**：

- `SummaryCard` 4 格栅（"活跃市场" / "活跃总池" / "已加载 / 总数" / "钱包状态"）
- 右侧 sidebar 整列：`FaucetCard` + "链上入口" + "市场状态"
- "市场总览"标题 + 描述段
- 底部"我的持仓"和"已结算市场"两栏（`PositionList` / `ResolvedList` 引用）
- 内联函数 `SummaryCard` 与 `EmptyPanel`
- `shortAddress` 函数（已无用）

**保留**：

- `useReadContract({ functionName: 'getDashboardLatest', args: [user, 100n] })` 整段
- `activeMarkets` / `visibleActiveMarkets` 计算
- `BetModal` 触发（从新 MarketCard 的 YES/NO 按钮）
- `useState<BetSelection | null>` 状态

**新顺序**：

```tsx
<>
  <NetworkBanner />           {/* 非 Arc 链时才显示，样式见 §10 */}
  <SiteHeader />              {/* 新增 */}
  <main>
    <MarketFilterBar ... />   {/* 重写样式，见 §7 */}
    <MarketGrid markets={visibleActiveMarkets} onBet={...} />  {/* 用新 MarketCard */}
  </main>
  <SiteFooter />              {/* 新增 */}
  {betting && <BetModal ... />}
</>
```

**`ActivityBadges` 删掉**——首页已无 hero / 顶部 stats 区，badges 不再有位置。组件文件与对应测试同步删除。

## 6. `MarketCard.tsx`

按 `home.html` 的 `.card` 完全重写，组件分块：

- **card-top**：左侧 `asset-symbol`（圆形 logo，BTC 橙 `#F7931A`、ETH 紫 `#627EEA`、SOL 紫绿渐变）+ `market-id` mono；右侧 `cadence-chip`（默认 `bg-arc-tint text-arc-deep`，临近到期 `bg-heat/10 text-heat`，文案改为 `Monthly · closing` 这种）
- **question**：`font-display text-[26px] leading-[1.18]`，threshold 数字单独 `text-arc`，使用 `≥` 符号 span
- **resolve-at**：mono 小字
- **odds**：左右两侧大百分比（display 28px）+ 单条 6px 进度条；底色 `bg-no/15`，填充 `bg-yes`
- **pools**：双格 mono `bg-canvas` 圆角
- **actions**：双 pill 按钮，YES 绿描边 hover 反色填满，NO 红描边 hover 反色填满
- **card-bottom**：dashed 顶分隔 + 倒计时 + seed disclosure 文案

**触发**：YES / NO 按钮调 `onBet(row.id, true)` / `onBet(row.id, false)`，签名不变。

倒计时与 `now < betDeadline` 判断照搬现有 `useEffect` 1 秒 tick；当 `betDeadline - now < 24h` 时 `countdown` 染 heat 色。

## 7. `MarketFilterBar.tsx`

按 mock 的 `.filterbar` 重写：

- 容器：`flex flex-wrap gap-6 border-y border-hair my-10 py-3 px-2`
- 两个分组中间一个 `w-px h-6 bg-hair` 分隔
- `chip` 默认 `text-ink-2 hover:bg-paper hover:border-hair`
- `chip.active` 改 `bg-ink text-paper`
- 标签 `Asset` / `Cadence` 改 `text-xs uppercase tracking-[0.1em] text-ink-2`

`filterMarkets` 纯函数与现有测试 `check_market_filter.mjs` 不动。

## 8. 新组件 `web/components/SiteHeader.tsx`

```
sticky top-0 z-50 bg-paper/85 backdrop-blur-md border-b border-hair
内部 max-w-7xl mx-auto flex justify-between px-8 py-3.5

左侧：
  <span class="ring" />         (Arc Ring：22px 蓝圈 + 7px 中心蓝点 + pulse 动画)
  <span class="font-display text-[22px]">Arc<em class="text-arc not-italic">Predict</em></span>

右侧：
  <ChainBadge />                 (pill：蓝点 + 'Arc Testnet' + mono '·5042002')
  <WalletPill />                 (重写见 §9)
```

Arc Ring 动画照搬 mock 里的 `@keyframes pulse`。

## 9. `WalletPill.tsx`

- 默认（未连接）：`bg-ink text-paper rounded-full px-4 py-2 text-sm font-medium`，hover `bg-arc-deep` + `-translate-y-px`
- 已连接：同样 pill，左侧加一个 8px 圆形 `bg-arc`，地址截短

## 10. `NetworkBanner.tsx`

保留功能（错误链时提示切链）。**样式翻 light**：

- 顶部全宽细条，`bg-heat/10 text-heat border-b border-heat/30`
- 中间英文文案 "Wrong network. Switch to Arc Testnet."
- 右侧 inline 按钮 `Switch`

## 11. 新组件 `web/components/SiteFooter.tsx`

按 mock 的 footer：

- `max-w-7xl mx-auto px-8 py-6 mt-16 border-t border-hair flex justify-between text-xs text-ink-2`
- 左：`Built on Arc Testnet · Settled by Pyth Network · USDC parimutuel`
- 右：Arcscan / Contract / Faucet 三个外链

## 12. 新组件 `web/components/ArcBackground.tsx`

全局背景两组同心圆 SVG，照搬 mock 的 `.bg-arc` 与 `.bg-arc-2` 两段 SVG 与定位 CSS。挂在 `app/layout.tsx` body 顶部。

## 13. 删除的文件

- `web/components/ActivityBadges.tsx`
- `web/test/check_activity_badges.mjs`

## 14. 保留但暂不引用的文件

下面这些组件**不要删**，只是首页不再用——后续 `/portfolio` 或 `/connect` 页面还会引：

- `web/components/FaucetCard.tsx`
- `web/components/PositionList.tsx`
- `web/components/ResolvedList.tsx`

## 15. 数据流不变

所有 `useReadContract` / `useAccount` / wagmi config / viem client / `PredictionMarket.json` ABI / `PREDICTION_MARKET_ADDRESS` 路径**完全不动**。

---

## 验收

- `cd web && pnpm typecheck` 通过
- `cd web && pnpm build` 通过（warning 可有）
- `find web/test -maxdepth 1 -name 'check_*.mjs' -exec node {} \;` 全绿（注意 `check_activity_badges.mjs` 已删）
- `npm run dev` 后浏览 `http://localhost:3000`：
  - 全站 light/white 主题，**无任何 dark 残留**
  - 与 `mockups/phase16/home.html` 视觉 80%+ 还原（字体、颜色、间距、布局比例）
  - 真实 testnet 数据填进去，market 卡片正常渲染（threshold、odds、pool、倒计时）
  - BetModal 仍能从 YES / NO 按钮触发
  - chain badge 显示正确 chainId
  - 钱包未连接时 `WalletPill` 是 "Connect Wallet"，连接后变截短地址 + 蓝点头像
  - 移动端 375px：filter bar 不溢出，市场卡片单列

---

## 全程约束

- 中文 commit message + 中文代码注释
- 每个独立改动 commit 一次：颜色 token → 字体 → globals/layout → 删旧组件 → 新组件（SiteHeader / SiteFooter / ArcBackground） → MarketCard → MarketFilterBar → WalletPill → NetworkBanner → app/page.tsx 主体
- **不要 `git push`**，不要 `--no-verify`
- 任何步骤如果 plan 与 mock 不一致先按 **mock 为准**；mock 不清的回到本文档 §1–§12
- 合约不动；`forge test` 必须仍 130 passed（理论上 UI 改动不影响，跑一次确认）

---

## 不动的部分

- 合约 ABI / 部署地址
- `contracts/script/ops/` 整个不动（Phase 16+ 后端调度器已落地）
- 现有 `wagmi.config.ts` / RainbowKit 配置
- `/market/[id]` 与 `/connect` 两页（本轮不重写）

---

完成后回报：所有 commit hash 列表 + `pnpm build` 输出 + `localhost:3000` 截图（home + filter 切换后 + mobile 375px）。
