# ArcPredict Synthra 风深色改造 · 设计文档

> 日期：2026-06-14
> 范围：ArcPredict 前端（`web/`）全量视觉重做 + 品牌资产（Logo / favicon）
> 灵感参考：app.synthra.org（深色 + 紫蓝渐变光晕 + 玻璃拟态卡片 + 微动效）
> 业务侵入：零（合约调用、状态管理、过滤逻辑全部保留）

---

## 0. 设计哲学

从「纸面预测市场」走向「链上观测台」。

- 黑色画布 = 夜空
- Arc 蓝 = 核心星光（品牌锚）
- 电气青 = 数据流（高光与发光）
- 深紫 = 不确定性（背景渐变副）

设计目标：在保留 ArcPredict 品牌 DNA（Arc 蓝 + 弧线语言）的前提下，达到 Synthra 同款的视觉冲击力与现代 DeFi 气质。

---

## 1. 设计语言与色彩系统

### 1.1 调色板（替换 `web/tailwind.config.ts`）

```text
背景层
  bg-0      #050614   极深底（页面最底层，近黑带紫调）
  bg-1      #0A0B1E   一级面板底
  bg-2      #12142B   二级面板底（卡片底色，有玻璃感时半透明叠加）

文字层
  ink       #F0F2FF   主要文字（不用纯白，带一丝冷蓝避免刺眼）
  ink-2     #9BA3C7   次要文字
  ink-3     #5B6188   辅助 / 标签

品牌主光源
  arc       #1652F0   Arc 蓝（保留品牌锚）
  arc-glow  #4DA8FF   电气青高光（用于发光、悬停、激活）
  arc-deep  #0B2DB8   深沉蓝（按下、压暗态）

副渐变 / 氛围
  violet    #6D5BFF   深紫（背景渐变副色）
  aurora    [gradient]  主光晕渐变 arc → violet → arc-glow（不是单色 token，
            而是页面背景 blob 与大字渐变文字共用的渐变定义）

语义色（深色环境下调亮饱和）
  yes       #34D399   涨 / Yes
  no        #F87171   跌 / No
  heat      #FF8A4C   热度 / 警示

分隔与玻璃
  hair      rgba(155,163,199,0.12)  极细分隔线
  glass     rgba(18,20,43,0.55) + backdrop-blur-xl + border rgba(255,255,255,0.06)
```

### 1.2 Surface / Elevation 规则

- **L0 页面背景**：`bg-0` + 缓动光晕大色团 + 极淡 Arc 同心圆 stroke
- **L1 卡片**：玻璃底 + 内描边 `inset 0 1px 0 rgba(255,255,255,0.06)` + 阴影 `0 1px 0 rgba(255,255,255,0.04), 0 24px 80px -32px rgba(22,82,240,0.35)`
- **L2 悬停态**：L1 + 外加发光环 `0 0 0 1px rgba(77,168,255,0.35), 0 0 60px -20px rgba(77,168,255,0.55)`
- **L3 弹窗**：更强玻璃 + 更深遮罩 `rgba(5,6,20,0.7)` + 高斯模糊

### 1.3 字体

保留现有 Geist / Geist Mono / Instrument Serif 三套字体。深色化下追加：

- Mono 数字：`text-shadow: 0 0 24px rgba(77,168,255,0.25)`（让价格 / 赔率发光）
- Display 衬线（wordmark）：从纯白调整为带极淡冷青渐变 `ink → arc-glow`

---

## 2. Logo 系统 + favicon

### 2.1 核心图形（mark）

一段 270° 起、收于 0° 的 1/4 圆弧 + 末端发光圆点。几何精确到像素：

```text
viewBox       24 24
弧线圆心      (4, 4)    ← 左上
弧线半径      14
弧线起点      (4, 18)   ← 左下（描边起点）
弧线终点      (18, 4)   ← 右上（末端发光点）
SVG path      M 4 18 A 14 14 0 0 1 18 4
线宽          2.25（主线）/ 圆角端点
末端发光点    cx=18 cy=4 r=2.5（亮点）+ r=5（光晕模糊）
```

视觉上：弧线从左下起，向右上"升起"，末端发光点位于右上方。这是与"预测概率向上走"的隐喻一致的方向。SVG sweep-flag=1 让弧线向右下方向凸出（远离左上圆心），形成一条从左下到右上、底部凸出的优雅升起曲线。

### 2.2 配色（三层叠加，从下到上）

```text
Layer 1 (最底，模糊光晕)
  stroke linearGradient: arc #1652F0 → violet #6D5BFF → arc-glow #4DA8FF
  filter blur(8px) opacity 0.6
Layer 2 (主弧线)
  stroke linearGradient: arc #1652F0 → arc-glow #4DA8FF
  无模糊
Layer 3 (末端亮点)
  fill #4DA8FF + <feGaussianBlur> 模拟外光晕
  内核纯白 #FFFFFF r=1
```

### 2.3 Wordmark（横排组合）

```text
[mark]  Arc Predict
        ↑      ↑
        Geist  渐变文字
        600    #4DA8FF→#6D5BFF
        ink
```

- mark 与文字间距 10px
- mark 高度 = 文字 cap height + 4px
- 垂直对齐：mark 与 wordmark 顶部对齐（弧线起点对齐到文字 ascender，发光点在右上自然"挑起"wordmark 的视觉重心）

### 2.4 变体

| 用途 | 尺寸 | 文件 / 组件 |
|---|---|---|
| Header logo（桌面） | mark 24px + wordmark | `<Logo size="md"/>` |
| Header logo（移动） | mark 22px + wordmark | 同组件，自适应 |
| Mark-only（连接钱包页 / loading） | 64px | `<LogoMark size={64}/>` |
| favicon 多分辨率 | 16 / 32 / 48 / 64 | `web/public/favicon.svg` + `web/public/favicon.ico` |
| Apple touch | 180×180 | `web/public/apple-touch-icon.png` |
| OG / Twitter card | 1200×630 | `web/public/og-image.png` |

### 2.5 favicon 适配深色 / 浅色浏览器

- 主交付 SVG（`favicon.svg`）内嵌 `prefers-color-scheme`：
  - 浅色浏览器标签栏：实色 `#0B2DB8`（避免发光丢失）
  - 深色浏览器标签栏：渐变 + 发光
- 兜底 `favicon.ico`：16 / 32 像素纯色版本（无渐变、避免锯齿）
- Apple touch icon：180×180 PNG，深色圆角方底 + 居中发光 mark

### 2.6 入场动画

- mark 弧线 `stroke-dasharray + dashoffset` 在 600ms 内由零绘制完成
- 末端发光点 `opacity 0→1 + scale 0.6→1` 在最后 200ms 浮现
- 仅首次加载与路由切换出现，不循环

### 2.7 与现有 header 的延续性

当前 `web/components/SiteHeader.tsx:18-19` 的"圆环 + 脉冲点"会被新 logo 替换。脉冲点的品牌记忆转移到"末端发光点"。`@keyframes pulse` 的 jsx 代码块删除。

---

## 3. 全局基础

### 3.1 ArcBackground 重做（`web/components/ArcBackground.tsx`）

保留 `data-arc-background-variant` 切换机制。新版三层叠加：

```text
Layer A · 极深底色
  bg-0 #050614 实色（兜底）

Layer B · 慢漂浮极光团（核心氛围）
  blob-1: 1200×1200，左上 -300/-200
          radial: arc #1652F0 40% → violet #6D5BFF 0% → 透明
          opacity 0.45, filter blur(120px)
          animation: 32s ease-in-out infinite alternate（±60px 平移）
  blob-2: 900×900，右下 -200/-100
          radial: arc-glow #4DA8FF 60% → violet #6D5BFF 0% → 透明
          opacity 0.35, filter blur(140px)
          animation: 38s 反向、相位差 0.5

Layer C · Arc 同心圆 + 1/4 弧线（保留品牌符号）
  SVG 结构基本不变
  stroke 改为 linearGradient #4DA8FF→#6D5BFF
  stroke-opacity 0.15→0.05 由内向外
  右上同心圆 + 左下小圆都保留
```

**variant=pitch（世界杯）的变化：** 不再用绿色背景。改为相同的紫蓝极光团 + 一个 32px 间距的极淡草坪格 stroke（`rgba(155,163,199,0.04)`），用结构暗示球场，而非颜色。

### 3.2 `web/app/globals.css` 增量

```css
:root {
  --bg-0: #050614;
  --bg-1: #0A0B1E;
  --bg-2: #12142B;
  --ink: #F0F2FF;
  --ink-2: #9BA3C7;
  --ink-3: #5B6188;
  --arc: #1652F0;
  --arc-glow: #4DA8FF;
  --arc-deep: #0B2DB8;
  --violet: #6D5BFF;
  --yes: #34D399;
  --no: #F87171;
  --heat: #FF8A4C;
  --hair: rgba(155, 163, 199, 0.12);
  color-scheme: dark;
  font-family: 'Geist', system-ui, sans-serif;
  font-variant-numeric: tabular-nums;
}

body {
  background: var(--bg-0);
  color: var(--ink);
}

.glass {
  background: rgba(18, 20, 43, 0.55);
  backdrop-filter: blur(20px) saturate(140%);
  border: 1px solid rgba(255, 255, 255, 0.06);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.06),
    0 24px 80px -32px rgba(22, 82, 240, 0.35);
}

.glass-hover:hover {
  border-color: rgba(77, 168, 255, 0.35);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.08),
    0 0 0 1px rgba(77, 168, 255, 0.35),
    0 0 60px -20px rgba(77, 168, 255, 0.55),
    0 24px 80px -32px rgba(22, 82, 240, 0.45);
}

.num-glow {
  text-shadow: 0 0 24px rgba(77, 168, 255, 0.25);
}

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.001ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.001ms !important;
  }
}
```

### 3.3 SiteHeader 改造（`web/components/SiteHeader.tsx`）

- 容器：`sticky top-0 z-50` + `border-b border-hair` + 背景 `rgba(10,11,30,0.65) + backdrop-blur-xl + saturate(160%)`（旧 `bg-paper/85` 删除）
- 左侧：`<Logo size="md"/>`（替换现有 ring + pulse + wordmark），wordmark 中 "Predict" 改为渐变文字
- 网络徽章：圆点 `#4DA8FF` + `box-shadow 0 0 0 4px rgba(77,168,255,0.2)`，文字 `ink-2`，边框 `hair`，"Arc Testnet · 5042002" 排版不变
- WalletPill：见 §4.3

### 3.4 SiteFooter 改造

- 背景透明 + `border-t border-hair`
- 文字 `ink-3`，链接 hover `text-arc-glow`
- 如有 socials，统一 outline icon + hover 发光环

### 3.5 NetworkBanner 改造

- 默认：`bg-arc/10 border-b border-arc/20 text-arc-glow` 玻璃感横条
- 错误：`bg-no/10 border-b border-no/30 text-no`
- 不用警示黄（深色下黄色刺眼）

### 3.6 Layout 元数据更新（`web/app/layout.tsx`）

```tsx
export const metadata: Metadata = {
  title: 'ArcPredict · 链上预测市场',
  description: '在 Arc 上用 USDC 参与预测市场。',
  icons: {
    icon: [
      { url: '/favicon.svg', type: 'image/svg+xml' },
      { url: '/favicon.ico', sizes: 'any' },
    ],
    apple: '/apple-touch-icon.png',
  },
  themeColor: '#050614',
  openGraph: {
    images: ['/og-image.png'],
  },
};
```

`<html lang="zh-CN" className="dark">`（仅单主题，加 `dark` class 是为后续如有库依赖 `dark:` prefix 的情况兜底）。

---

## 4. 关键组件

### 4.1 MarketCard 系列

涉及：`BaseMarketCard.tsx` / `CryptoMarketCard.tsx` / `WorldCupMarketCard.tsx` / `MarketCard.tsx`。

**容器：** `glass glass-hover` + `rounded-3xl` + `p-6`。

**结构（三段式）：**

```text
┌─────────────────────────────────────────────┐
│ ① 头部条 - 资产 / 频次 / 状态                │
│   左: 资产图标(发光环) · 资产名 · 频次徽标    │
│   右: 解析倒计时 ResolveCountdown            │
├─────────────────────────────────────────────┤
│ ② 主信息区                                   │
│   大字号当前价（mono + num-glow 发光）       │
│   下方一行: 行权价 / 方向语义（"高于 $X.XX"）│
│   右侧紧贴: 含蓄概率环（小型径向进度，0-100%）│
├─────────────────────────────────────────────┤
│ ③ 投注按钮组                                 │
│   YES(60%) / NO(40%) 双按钮，按比例视觉分配   │
│   YES: bg-yes/15 border-yes/40 text-yes      │
│   NO : bg-no/15  border-no/40  text-no       │
│   hover 时按钮自带 inset 发光                 │
└─────────────────────────────────────────────┘
```

**WorldCupMarketCard 差异：** 头部条左侧为两国国旗 + 国家代码（保留 flag-icons），中部主信息换为 `胜 / 平 / 负` 或 `阶段晋级` 三选一面板，依靠现有 `OUTCOMES` 数据驱动，不改业务。

**键鼠交互：**
- hover：`glass-hover` 发光环 + `translate-y-[-2px]`（200ms ease-out）
- focus-visible：`ring-2 ring-arc-glow ring-offset-2 ring-offset-bg-0`
- 点击区分：点卡片→详情；点 YES/NO→开 BetModal（保留现有 `setBetting` 逻辑）

**ImpliedProbabilityChart 概率环（卡片右上微型版）：** 36px 径向环 + 中间百分数 mono。深色下背景轨道 `hair`，进度 stroke 用 `arc → arc-glow` 渐变 + `filter: drop-shadow(0 0 6px rgba(77,168,255,0.6))`。详情页大版同样的渐变与发光，体感统一。

### 4.2 BetModal 改造（`web/components/BetModal.tsx`）

**容器：** 居中浮层，最大宽度 480，`rounded-3xl`，玻璃 `backdrop-blur-2xl`，外加发光环 `0 0 0 1px rgba(77,168,255,0.25), 0 60px 120px -40px rgba(22,82,240,0.6)`。

**遮罩：** `bg-bg-0/70 backdrop-blur-md`。

**结构：**

```text
关闭叉(右上) · 资产 + 方向标题
─────────────────────────
当前价 / 行权价 / 倒计时（mono num-glow，三列）
─────────────────────────
输入金额 USDC（大号 mono 输入框，placeholder ink-3）
快捷金额按钮组：10 / 50 / 100 / MAX
─────────────────────────
回报预估卡（含蓄概率 + 潜在收益）
─────────────────────────
主 CTA「确认下注 YES」（满宽，YES/NO 语义色，hover 发光）
取消（次级文字按钮）
```

**入场动效：** 遮罩 `opacity 0→1 200ms`；卡片 `opacity 0→1, scale 0.96→1, translateY 8→0` 280ms `cubic-bezier(0.2,0.8,0.2,1)`。出场反向 180ms。

**移动端：** viewport `< sm` 时，BetModal 改为底部抽屉（`rounded-t-3xl` + 顶部 drag-handle），从 `y=100%` 滑入。用 `web/lib/use-media-query.ts` 判定。

### 4.3 WalletPill 改造（`web/components/WalletPill.tsx`）

三状态视觉统一玻璃丸：

```text
未连接: glass + 边框 hair + 文字 "连接钱包" + 右侧小箭头
       hover 转发光态（border arc-glow/40）

已连接: glass + 左侧地址首尾截断（mono）+ 右侧网络色圆点
       hover 展开下拉（断开连接 / 查看地址 / 复制）

错误网络: 边框 no/40 + 文字 "切换到 Arc" + 红色脉冲点
```

下拉：玻璃面板 + 入场 `scale 0.95→1 + opacity` 160ms。

### 4.4 MarketFilterBar 改造

- 类别 Tab（加密 / 世界杯）：pill 形，激活态 `bg-arc/15 + 边框 arc-glow/40 + 文字 arc-glow`
- 资产 / 阶段筛选：同样 pill，未激活态 玻璃透明 + 边框 hair
- Cadence 频次：同上
- 排版：横向滚动（mobile） + `flex-wrap`（desktop）
- 切换 transition 150ms

### 4.5 其余统一原则

`PositionList` / `ResolvedList` / `FaucetCard` / `SeedDisclosure`：

- 全部 `glass` 容器 + `rounded-3xl`
- 表格行用 `border-b border-hair` 代替完整 stroke
- 状态徽标：`bg-yes/15 text-yes border-yes/30`（盈利）/ `bg-no/15 text-no border-no/30`（亏损）
- 表头用 mono 小字 `ink-3`
- FaucetCard "领水"按钮与 BetModal 主 CTA 同款（发光主按钮）
- SeedDisclosure 折叠：chevron + 玻璃折叠面板

### 4.6 ResolveCountdown 改造

- 数字 mono + `num-glow`
- 到期前 < 1 小时：颜色相位在 `arc-glow ↔ heat` 间慢动（不闪烁）

---

## 5. 页面级布局

### 5.1 首页 `/`（`web/app/page.tsx`）

业务逻辑（合约读取、过滤、状态）完全不动，只重写视觉层。新版三屏：

**屏 1 · Hero 区（新增，~480px 高）**

```text
┌────────────────────────────────────────────────────────────┐
│                                                            │
│      链上预测，看见概率                                     │
│      ──────────────                                       │
│      在 Arc 上用 USDC 参与加密价格与世界杯双轨预测市场     │
│                                                            │
│      [立即参与]  [了解 Arc 网络]                            │
│                                                            │
│              ↗ 24h 活跃合约 · 12                            │
│              ↗ 总投注金额 · $48,210 USDC                    │
│              ↗ 待结算 · 7                                   │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

- 大标题：Instrument Serif 60–84px，渐变文字 `ink → arc-glow`
- 副标题：`ink-2`，最大宽度 640px
- CTA：主按钮 `arc-glow` 发光填充 + 次按钮玻璃 outline
- 右下统计 3 条：mono + `num-glow`，数据从现有 dashboard 衍生计算，算不出降级隐藏，**不写假数**
- Hero 区背后叠一段超大的弧线（mark 放大、blur、opacity 0.15），自动呼应 logo

**屏 2 · 市场区**

- 顶部贴 `MarketFilterBar`
- 卡片网格：`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5`
- 网格上方小标题 + 数量统计："加密市场（{n}）" —— mono `ink-2`
- 空状态：玻璃面板 + 褪色 mark + "暂无符合条件的合约"

**屏 3 · 持仓 / 已结算区**

- 两个并列玻璃面板：`PositionList` + `ResolvedList`
- 桌面 2 列，移动纵向
- 顶部右侧保留 "全部持仓" pill 链接

**EventInfoPanel：** worldcup 类别时显示赛事阶段说明，深色化即可，结构不动。

**滚动反馈：** Hero 不固定，自然滚走。Header 始终 sticky 玻璃半透明。

### 5.2 市场详情页 `/market/[id]`

按以下骨架重排：

```text
┌─────────────────────────────────────────────────────────┐
│ ←  返回 · ASSET/EVENT · 频次 · 倒计时        分享/复制   │
├─────────────────────────────────────────────────────────┤
│ 主玻璃卡（左 2/3）        │ 右侧操作栏（右 1/3）         │
│                          │                              │
│ 标题问题（display 字体）  │ 玻璃面板：                   │
│ 当前价 / 行权价 / 方向    │  - 你的持仓（如有）          │
│   mono num-glow          │  - 立即下注（嵌入式 BetForm） │
│                          │                              │
│ ImpliedProbabilityChart   │                              │
│   大版径向环 + 时间序列   │                              │
│   渐变发光                 │                              │
│                          │                              │
│ Seed/解析机制 折叠面板    │                              │
│ EventInfo / OutcomePanel │                              │
└─────────────────────────────────────────────────────────┘
```

- 桌面端 12 栅格，左 8 / 右 4；移动端单列纵向
- 右侧 "立即下注" 桌面端为常驻嵌入式 `BetForm`（新组件：从 `BetModal` 中抽出可复用的表单主体，去除外壳遮罩与浮层）
- 移动端复用 `BetModal` 抽屉，点击 sticky bottom CTA 才唤起
- 拆分原则：`BetForm` 负责输入金额、回报预估、确认按钮等表单逻辑；`BetModal` 负责浮层、遮罩、动效、聚焦管理
- 详情页相比首页最大的体验升级：桌面用户直接在右侧填好下注，不再点 YES→弹窗→输入

### 5.3 连接钱包页 `/connect`

```text
┌──────────────────────────────────────────┐
│                                          │
│            [发光 mark 96px]               │
│            ArcPredict                    │
│                                          │
│      欢迎进入 Arc 链上预测市场             │
│      连接钱包并切换到 Arc Testnet         │
│                                          │
│      ┌──────────────────────────────┐    │
│      │  ① 连接钱包       [WalletPill]│    │
│      ├──────────────────────────────┤    │
│      │  ② 添加 Arc 网络  [一键添加]  │    │
│      ├──────────────────────────────┤    │
│      │  ③ 领取测试 USDC  [前往领水]  │    │
│      └──────────────────────────────┘    │
│                                          │
│      [展开网络参数 · 手动配置 ↓]          │
│                                          │
└──────────────────────────────────────────┘
```

- 中央玻璃面板宽 480
- 三步走清单（每完成一步打勾、自动滚到下一步高亮）
- 现有 `DetailRow` 改为深色 mono 行，"复制"按钮 hover 发光
- 错误提示用半透明红色玻璃条（无碍后续操作），不是阻塞模态
- 完成后自动跳回首页 / 用户来源页

---

## 6. 动效

平衡型动效清单（全部列尽，避免后续返工）：

| # | 触发 | 元素 | 行为 | 时长 / 缓动 |
|---|---|---|---|---|
| 1 | 首次加载 | Logo mark | 弧线 stroke 由 0 到 100% + 末端点 fade-in | 600ms `cubic-bezier(0.2,0.8,0.2,1)` |
| 2 | 持续 | Background blob-1 / blob-2 | 各自缓动平移 ±60px | 32s / 38s ease-in-out alternate |
| 3 | 持续 | Header 网络徽章圆点 | 0→100% box-shadow 扩散脉冲 | 2.4s 循环 |
| 4 | hover | MarketCard | `translateY(-2px)` + `glass-hover` 发光环 | 200ms ease-out |
| 5 | hover | YES/NO 按钮 | 内部 inset 发光、文字加亮 | 150ms |
| 6 | 点击 | YES/NO 按钮 | scale 0.97 短压回弹 | 80→120ms |
| 7 | 入场 | BetModal 桌面 | 遮罩 fade + 卡片 `scale 0.96→1 + Y 8→0` | 280ms |
| 8 | 入场 | BetModal 移动 | 底部抽屉 `Y 100%→0` | 320ms |
| 9 | 变化 | 价格 / 概率 mono 数字 | `tabular-nums` + 颜色 100ms 渐变（无 shimmer）| 100ms |
| 10 | 倒计时 < 1h | ResolveCountdown 数字色 | `arc-glow ↔ heat` 缓慢相位 | 3s 循环 |
| 11 | 加载 | 卡片骨架 | 玻璃底 + 单条横向渐变 shimmer（仅骨架）| 1.6s 循环 |
| 12 | 路由切换 | 页面主体 | `opacity 0→1 + Y 8→0` | 220ms |

**禁止：** 永久旋转、爱心粒子、跟随鼠标的视差球、3D 卡片倾斜、首屏闪屏、Toast 飞行。

---

## 7. 可访问性

- **prefers-reduced-motion：** 全局 CSS 已收口（见 §3.2），所有动效退化为瞬时
- **对比度：** ink `#F0F2FF` on bg-0 `#050614` AAA；ink-2 大字号 AA；小字号场景禁用 ink-2 做关键信息
- **焦点环：** 所有可交互元素 `ring-2 ring-arc-glow ring-offset-2 ring-offset-bg-0`
- **语义结构：** `<header>` / `<main>` / `<footer>` / `<nav>` 不动；BetModal 用 `role="dialog" aria-modal="true" aria-labelledby`，初次聚焦关闭按钮，Esc 关闭
- **图标语义：** Logo SVG 加 `<title>ArcPredict</title>`；favicon SVG 同
- **色弱适配：** YES/NO 按钮一律带文字 "YES" / "NO" 标签，不仅靠颜色

---

## 8. 改造分期

| 期 | 内容 | 可验收交付 |
|---|---|---|
| **A · 底盘** | tailwind 新 token / globals.css / layout 元数据 / 新 ArcBackground / favicon SVG+ICO+apple-touch / Logo 组件 | 站点已深色 + 极光背景 + 新 logo + 新 favicon；老组件仍可工作（颜色暂错位无妨） |
| **B · 头/尾/丸** | SiteHeader / SiteFooter / NetworkBanner / WalletPill | 顶部完成 Synthra 同款玻璃感 |
| **C · 卡片** | BaseMarketCard / CryptoMarketCard / WorldCupMarketCard / MarketCard / MarketFilterBar / 卡片概率环 | 首页卡片区视觉到位，可截图 demo |
| **D · 弹窗与持仓** | BetModal（桌面 + 移动抽屉）/ PositionList / ResolvedList / FaucetCard / SeedDisclosure / ResolveCountdown | 完整投注闭环升级 |
| **E · 页面** | 首页 Hero / 详情页栅格重排 + 嵌入式 BetForm / 连接钱包页三步走 | 三个主路由焕新 |
| **F · 收尾** | OG 图、Twitter card、文案 meta、`prefers-reduced-motion` 校验、可访问性扫描 | 上线就绪 |

A 完成后整站可看；B–E 任意一期出问题都可独立回滚而不破坏其他期；F 是质量门。

---

## 9. 测试与验证

- **现有测试** `web/test/check_home_page.mjs` / `web/test/check_worldcup_data_layer.mjs` 不变（业务逻辑零变动）；如其中包含对颜色 / wordmark 字符串的断言需同步更新
- **视觉回归：** 每期完成后用 Playwright 截图 1280×800 + 390×844 两个分辨率的首页、详情页、连接页、BetModal 开启态，存档到 `web/test/snapshots/synthra-redesign/<期号>/`
- **手测清单：**
  - 钱包未连接 / 已连接 / 错误网络 三种 WalletPill 态
  - 加密 / 世界杯 类别切换 + 背景 variant 同步
  - BetModal 桌面弹窗 / 移动抽屉
  - Esc 关闭模态、Tab 键焦点环、prefers-reduced-motion 开启时无动效
  - favicon 在 Chrome / Safari / Firefox 标签栏均正确显示渐变 SVG
- **不新增单元测试：** 纯视觉重做，业务零变动

---

## 10. 不做的事（YAGNI）

- 不引入 framer-motion / lottie / GSAP（动效全部 CSS keyframes + tailwind transition 完成，零新依赖）
- 不引入 shadcn / radix
- 不重写业务逻辑（合约调用、过滤、状态保留）
- 不新增浅色主题切换（既定全面切深色，多主题是反向工作量）
- 不做粒子 / 鼠标视差 / 3D 倾斜（动效强度为平衡型）
- 不重做世界杯业务面板信息架构，只换皮

---

## 11. 一句话回顾

深色 Synthra 风 · Arc 蓝主光源 · 升起弧线 logo · 全量 6 期改造 · 业务零侵入。
