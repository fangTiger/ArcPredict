# ArcPredict Synthra 风深色改造 · 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 ArcPredict 前端（`web/`）从浅色纸感重做成深色 Synthra 风（紫蓝渐变光晕 + 玻璃拟态 + 升起弧线 logo），业务逻辑零侵入。

**Architecture:** 单一深色主题，纯 CSS keyframes + Tailwind transition 完成动效（零新依赖）。改造分 6 期：A 底盘 → B 头尾丸 → C 卡片 → D 弹窗持仓 → E 页面 → F 收尾。期 A 完成后整站可运行；B–E 任意一期可独立回滚。

**Tech Stack:** Next.js 14 (App Router) · React 18 · TypeScript · Tailwind 3.4 · wagmi / viem · RainbowKit · Vitest · 既有自定义 Node 测试（`.mjs`）

**Source spec:** `docs/superpowers/specs/2026-06-14-arcpredict-synthra-redesign-design.md`

---

## 工作目录与命令约定

所有命令在 `web/` 下运行：

```bash
cd web
pnpm typecheck    # tsc --noEmit
pnpm lint         # next lint
pnpm build        # next build（每期最后一次完整验证）
pnpm dev          # 开发服务器，目视验证用，端口 3000
```

每次 commit 前必须 `pnpm typecheck` 通过。每期最后一个 task 跑一次 `pnpm build`。

---

## 文件结构总览

新增：

```
web/public/
  favicon.svg                   # 主 favicon，含 prefers-color-scheme 切换
  favicon.ico                   # 兜底 16/32 多分辨率
  apple-touch-icon.png          # 180×180
  og-image.png                  # 1200×630
web/components/
  Logo.tsx                      # 新组件：mark + wordmark，size="md|lg|xl"
  LogoMark.tsx                  # 新组件：纯 mark，可任意尺寸
  BetForm.tsx                   # 从 BetModal 抽出的表单主体，可嵌入与浮层共用
  HomeHero.tsx                  # 首页 hero 区
  ConnectChecklist.tsx          # 连接钱包页三步走
web/test/snapshots/synthra-redesign/
  A/ B/ C/ D/ E/ F/             # 每期 Playwright 截图存档
```

修改（共 23 个文件）：

```
web/tailwind.config.ts           # 全部颜色 token 替换
web/app/globals.css              # 深色变量 + glass / glass-hover / num-glow / 动效尊重
web/app/layout.tsx               # metadata + icons + className="dark"
web/app/page.tsx                 # 引入 HomeHero，网格容器与外壳深色化
web/app/connect/page.tsx         # 引入 ConnectChecklist，DetailRow 深色化
web/app/market/[id]/page.tsx     # 12 栅格重排，桌面端嵌入 BetForm
web/components/ArcBackground.tsx # 三层叠加：极深底 + 极光团 + Arc 同心圆
web/components/SiteHeader.tsx    # 玻璃顶 + 新 Logo
web/components/SiteFooter.tsx    # 透明 + hair 分隔 + hover 发光
web/components/NetworkBanner.tsx # 玻璃感横条
web/components/WalletPill.tsx    # 三态玻璃丸
web/components/BetModal.tsx      # 改为只负责浮层与抽屉，主体用 BetForm
web/components/BaseMarketCard.tsx        # glass + rounded-3xl + 装饰圆改渐变
web/components/CryptoMarketCard.tsx      # YES/NO 比例按钮 + num-glow 价格
web/components/WorldCupMarketCard.tsx    # 同上深色化
web/components/MarketCard.tsx            # event 变体深色化
web/components/MarketFilterBar.tsx       # pill 玻璃化 + 激活态发光
web/components/MarketDetailCard.tsx      # 详情页主卡深色化
web/components/ImpliedProbabilityChart.tsx # 渐变 stroke + drop-shadow 发光
web/components/EventInfoPanel.tsx        # 玻璃面板
web/components/WorldCupOutcomePanel.tsx  # 玻璃面板
web/components/PositionList.tsx          # glass + 状态徽标半透明
web/components/ResolvedList.tsx          # 同上
web/components/FaucetCard.tsx            # glass + 发光主 CTA
web/components/SeedDisclosure.tsx        # chevron + 玻璃折叠
web/components/ResolveCountdown.tsx      # mono num-glow + 临期颜色相位
```

---

# 期 A · 底盘

完成后：站点已是深色 + 极光背景 + 新 logo + 新 favicon。其他组件颜色暂时可能错位（用旧 token），无所谓。

---

## Task A1: Tailwind 颜色与字体 token 替换

**Files:**
- Modify: `web/tailwind.config.ts`

- [ ] **Step 1: 改写 tailwind.config.ts**

```ts
import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // 背景层
        'bg-0': '#050614',
        'bg-1': '#0A0B1E',
        'bg-2': '#12142B',
        // 文字层
        ink: '#F0F2FF',
        'ink-2': '#9BA3C7',
        'ink-3': '#5B6188',
        // 品牌主光源
        arc: '#1652F0',
        'arc-glow': '#4DA8FF',
        'arc-deep': '#0B2DB8',
        // 副渐变
        violet: '#6D5BFF',
        // 语义色（深色环境调亮）
        yes: '#34D399',
        no: '#F87171',
        heat: '#FF8A4C',
        // 分隔
        hair: 'rgba(155,163,199,0.12)',
        // 向后兼容：保留旧名 canvas/paper 暂指向新背景，期 B–E 中各组件会迁移走
        canvas: '#050614',
        paper: '#0A0B1E',
      },
      fontFamily: {
        sans: ['Geist', 'system-ui', 'sans-serif'],
        display: ['Instrument Serif', 'Georgia', 'serif'],
        mono: ['Geist Mono', 'monospace'],
      },
      backgroundImage: {
        aurora:
          'linear-gradient(135deg, #1652F0 0%, #6D5BFF 50%, #4DA8FF 100%)',
        'aurora-text':
          'linear-gradient(135deg, #4DA8FF 0%, #6D5BFF 100%)',
      },
    },
  },
  plugins: [],
};

export default config;
```

> 兼容性说明：`canvas` 暂时映射到 `#050614`，`paper` 暂时映射到 `#0A0B1E`。这样期 A 完成后老组件不会全白爆开。期 B 起逐组件迁移，期 E 结束时这两个别名可移除。

- [ ] **Step 2: 验证 typecheck 通过**

```bash
pnpm typecheck
```

Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add web/tailwind.config.ts
git commit -m "feat(theme): 切换 tailwind 颜色到深色 Synthra 调色板"
```

---

## Task A2: globals.css 深色变量与工具类

**Files:**
- Modify: `web/app/globals.css`

- [ ] **Step 1: 改写 globals.css**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

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
  text-wrap: pretty;
}

body {
  margin: 0;
  background: var(--bg-0);
  color: var(--ink);
}

.font-mono {
  font-family: 'Geist Mono', monospace;
  letter-spacing: 0;
}

/* 玻璃面板 */
.glass {
  background: rgba(18, 20, 43, 0.55);
  backdrop-filter: blur(20px) saturate(140%);
  -webkit-backdrop-filter: blur(20px) saturate(140%);
  border: 1px solid rgba(255, 255, 255, 0.06);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.06),
    0 24px 80px -32px rgba(22, 82, 240, 0.35);
}

.glass-hover {
  transition: border-color 200ms ease-out, box-shadow 200ms ease-out, transform 200ms ease-out;
}

.glass-hover:hover {
  border-color: rgba(77, 168, 255, 0.35);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.08),
    0 0 0 1px rgba(77, 168, 255, 0.35),
    0 0 60px -20px rgba(77, 168, 255, 0.55),
    0 24px 80px -32px rgba(22, 82, 240, 0.45);
}

/* 数字发光 */
.num-glow {
  text-shadow: 0 0 24px rgba(77, 168, 255, 0.25);
}

/* 极光团动画 */
@keyframes blob-drift-a {
  0%   { transform: translate(0px, 0px); }
  100% { transform: translate(60px, -40px); }
}
@keyframes blob-drift-b {
  0%   { transform: translate(0px, 0px); }
  100% { transform: translate(-50px, 50px); }
}
.blob-a { animation: blob-drift-a 32s ease-in-out infinite alternate; }
.blob-b { animation: blob-drift-b 38s ease-in-out infinite alternate; }

/* Logo mark 入场绘制 */
@keyframes mark-draw {
  from { stroke-dashoffset: 100; }
  to   { stroke-dashoffset: 0; }
}
@keyframes dot-pop {
  0%   { opacity: 0; transform: scale(0.6); }
  100% { opacity: 1; transform: scale(1); }
}
.mark-draw { stroke-dasharray: 100; animation: mark-draw 600ms cubic-bezier(0.2,0.8,0.2,1) both; }
.dot-pop { transform-origin: center; animation: dot-pop 200ms cubic-bezier(0.2,0.8,0.2,1) 400ms both; }

/* Header 网络徽章脉冲 */
@keyframes arc-ring-pulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(77, 168, 255, 0.45); }
  50%      { box-shadow: 0 0 0 8px rgba(77, 168, 255, 0); }
}
.arc-ring-pulse { animation: arc-ring-pulse 2.4s cubic-bezier(0.2, 0.8, 0.2, 1) infinite; }

/* 减弱动效偏好 */
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.001ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.001ms !important;
  }
}
```

- [ ] **Step 2: 验证 typecheck 与 dev server 起得来**

```bash
pnpm typecheck
```

Expected: PASS

```bash
pnpm dev
```

打开 http://localhost:3000，预期：页面背景已变深色，原内容颜色错乱（正常，后续期会修）。验证完后停掉 dev server。

- [ ] **Step 3: Commit**

```bash
git add web/app/globals.css
git commit -m "feat(theme): 深色根变量 + glass/blob/mark 工具类"
```

---

## Task A3: ArcBackground 三层叠加重做

**Files:**
- Modify: `web/components/ArcBackground.tsx`

- [ ] **Step 1: 改写 ArcBackground.tsx**

```tsx
'use client';

import { useEffect, useState } from 'react';

export type ArcBackgroundVariant = 'default' | 'pitch';

const ARC_BACKGROUND_VARIANT_ATTR = 'data-arc-background-variant';

function normalizeVariant(value: string | null | undefined): ArcBackgroundVariant {
  return value === 'pitch' ? 'pitch' : 'default';
}

export function ArcBackground({ variant }: { variant?: ArcBackgroundVariant }) {
  const [resolvedVariant, setResolvedVariant] = useState<ArcBackgroundVariant>('default');

  useEffect(() => {
    if (typeof document === 'undefined') return undefined;
    const root = document.documentElement;

    if (variant) {
      root.setAttribute(ARC_BACKGROUND_VARIANT_ATTR, variant);
      setResolvedVariant(variant);
      return () => {
        root.setAttribute(ARC_BACKGROUND_VARIANT_ATTR, 'default');
      };
    }

    const sync = () => {
      setResolvedVariant(normalizeVariant(root.getAttribute(ARC_BACKGROUND_VARIANT_ATTR)));
    };
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(root, { attributes: true, attributeFilter: [ARC_BACKGROUND_VARIANT_ATTR] });
    return () => observer.disconnect();
  }, [variant]);

  if (variant) return null;

  return (
    <>
      {/* Layer A · 极深底色（兜底，避免 blob 加载延迟时露白） */}
      <div className="pointer-events-none fixed inset-0 z-0 bg-bg-0" aria-hidden="true" />

      {/* Layer B · 极光团 */}
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden" aria-hidden="true">
        <div
          className="blob-a absolute"
          style={{
            top: '-200px',
            left: '-300px',
            width: '1200px',
            height: '1200px',
            background:
              'radial-gradient(circle, rgba(22,82,240,0.45) 0%, rgba(109,91,255,0) 60%)',
            filter: 'blur(120px)',
          }}
        />
        <div
          className="blob-b absolute"
          style={{
            bottom: '-200px',
            right: '-200px',
            width: '900px',
            height: '900px',
            background:
              'radial-gradient(circle, rgba(77,168,255,0.35) 0%, rgba(109,91,255,0) 60%)',
            filter: 'blur(140px)',
          }}
        />
      </div>

      {/* variant=pitch 的草坪网格（深色版） */}
      {resolvedVariant === 'pitch' ? (
        <div
          className="pointer-events-none fixed inset-0 z-0 opacity-100"
          aria-hidden="true"
          style={{
            backgroundImage:
              'linear-gradient(90deg, rgba(155,163,199,0.04) 0, rgba(155,163,199,0.04) 1px, transparent 1px, transparent 32px), linear-gradient(0deg, rgba(155,163,199,0.04) 0, rgba(155,163,199,0.04) 1px, transparent 1px, transparent 32px)',
            backgroundSize: '32px 32px',
          }}
        />
      ) : null}

      {/* Layer C · Arc 同心圆 + 1/4 弧线（品牌符号保留） */}
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden" aria-hidden="true">
        <svg
          viewBox="0 0 900 900"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="absolute -right-[200px] -top-[200px] h-[900px] w-[900px]"
        >
          <defs>
            <linearGradient id="arc-stroke-tr" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#4DA8FF" />
              <stop offset="100%" stopColor="#6D5BFF" />
            </linearGradient>
          </defs>
          <circle cx="450" cy="450" r="440" stroke="url(#arc-stroke-tr)" strokeWidth="1" strokeOpacity="0.15" />
          <circle cx="450" cy="450" r="360" stroke="url(#arc-stroke-tr)" strokeWidth="1" strokeOpacity="0.12" />
          <circle cx="450" cy="450" r="280" stroke="url(#arc-stroke-tr)" strokeWidth="1" strokeOpacity="0.09" />
          <circle cx="450" cy="450" r="200" stroke="url(#arc-stroke-tr)" strokeWidth="1" strokeOpacity="0.07" />
          <circle cx="450" cy="450" r="120" stroke="url(#arc-stroke-tr)" strokeWidth="1" strokeOpacity="0.05" />
        </svg>
        <svg
          viewBox="0 0 700 700"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="absolute -bottom-[300px] -left-[300px] h-[700px] w-[700px]"
        >
          <defs>
            <linearGradient id="arc-stroke-bl" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#6D5BFF" />
              <stop offset="100%" stopColor="#4DA8FF" />
            </linearGradient>
          </defs>
          <circle cx="350" cy="350" r="340" stroke="url(#arc-stroke-bl)" strokeWidth="1" strokeOpacity="0.10" />
          <circle cx="350" cy="350" r="260" stroke="url(#arc-stroke-bl)" strokeWidth="1" strokeOpacity="0.08" />
          <circle cx="350" cy="350" r="180" stroke="url(#arc-stroke-bl)" strokeWidth="1" strokeOpacity="0.06" />
        </svg>
      </div>
    </>
  );
}
```

- [ ] **Step 2: 验证 typecheck 与 dev**

```bash
pnpm typecheck
```

Expected: PASS

```bash
pnpm dev
```

打开 http://localhost:3000，预期：背景出现紫蓝极光团缓慢漂浮，右上左下有极淡 Arc 同心圆。

- [ ] **Step 3: Commit**

```bash
git add web/components/ArcBackground.tsx
git commit -m "feat(bg): ArcBackground 三层叠加（极深底 + 极光团 + 渐变同心圆）"
```

---

## Task A4: Logo 与 LogoMark 组件

**Files:**
- Create: `web/components/LogoMark.tsx`
- Create: `web/components/Logo.tsx`

- [ ] **Step 1: 创建 LogoMark.tsx**

```tsx
import type { CSSProperties } from 'react';

export function LogoMark({
  size = 24,
  animate = true,
  className = '',
  style,
}: {
  size?: number;
  animate?: boolean;
  className?: string;
  style?: CSSProperties;
}) {
  // 几何：viewBox 24×24，圆心 (4,4) 半径 14，
  // path 从 (4,18) 到 (18,4)，sweep=1（向右下凸出的升起弧）。
  // 末端发光点 cx=18 cy=4。
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={style}
      aria-hidden="true"
    >
      <title>ArcPredict</title>
      <defs>
        <linearGradient id="arc-main" x1="0" y1="1" x2="1" y2="0">
          <stop offset="0%" stopColor="#1652F0" />
          <stop offset="100%" stopColor="#4DA8FF" />
        </linearGradient>
        <linearGradient id="arc-glow" x1="0" y1="1" x2="1" y2="0">
          <stop offset="0%" stopColor="#1652F0" />
          <stop offset="50%" stopColor="#6D5BFF" />
          <stop offset="100%" stopColor="#4DA8FF" />
        </linearGradient>
        <filter id="dot-halo" x="-150%" y="-150%" width="400%" height="400%">
          <feGaussianBlur stdDeviation="2" />
        </filter>
      </defs>

      {/* Layer 1: 模糊光晕弧 */}
      <path
        d="M 4 18 A 14 14 0 0 1 18 4"
        stroke="url(#arc-glow)"
        strokeWidth="2.25"
        strokeLinecap="round"
        fill="none"
        opacity="0.6"
        style={{ filter: 'blur(3px)' }}
      />

      {/* Layer 2: 主弧线 */}
      <path
        d="M 4 18 A 14 14 0 0 1 18 4"
        stroke="url(#arc-main)"
        strokeWidth="2.25"
        strokeLinecap="round"
        fill="none"
        className={animate ? 'mark-draw' : undefined}
      />

      {/* Layer 3: 末端发光点 */}
      <circle cx="18" cy="4" r="5" fill="#4DA8FF" opacity="0.35" filter="url(#dot-halo)" className={animate ? 'dot-pop' : undefined} />
      <circle cx="18" cy="4" r="2.5" fill="#4DA8FF" className={animate ? 'dot-pop' : undefined} />
      <circle cx="18" cy="4" r="1" fill="#FFFFFF" className={animate ? 'dot-pop' : undefined} />
    </svg>
  );
}
```

- [ ] **Step 2: 创建 Logo.tsx**

```tsx
import { LogoMark } from './LogoMark';

type Size = 'md' | 'lg' | 'xl';

const sizeMap: Record<Size, { mark: number; text: string }> = {
  md: { mark: 24, text: 'text-[22px]' },
  lg: { mark: 32, text: 'text-[30px]' },
  xl: { mark: 64, text: 'text-[56px]' },
};

export function Logo({
  size = 'md',
  animate = true,
  withWordmark = true,
}: {
  size?: Size;
  animate?: boolean;
  withWordmark?: boolean;
}) {
  const cfg = sizeMap[size];
  return (
    <span className="inline-flex items-start gap-[10px]" aria-label="ArcPredict">
      <LogoMark size={cfg.mark} animate={animate} />
      {withWordmark ? (
        <span className={`font-display leading-none text-ink ${cfg.text}`}>
          Arc<span className="bg-aurora-text bg-clip-text text-transparent">Predict</span>
        </span>
      ) : null}
    </span>
  );
}
```

- [ ] **Step 3: 验证 typecheck**

```bash
pnpm typecheck
```

Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add web/components/LogoMark.tsx web/components/Logo.tsx
git commit -m "feat(logo): 新增 Logo 与 LogoMark 组件（升起弧线 + 发光点）"
```

---

## Task A5: favicon 资产（SVG + ICO + apple-touch + og-image）

**Files:**
- Create: `web/public/favicon.svg`
- Create: `web/public/favicon.ico`（占位 — 见说明）
- Create: `web/public/apple-touch-icon.png`（占位 — 见说明）
- Create: `web/public/og-image.png`（占位 — 见说明）

- [ ] **Step 1: 创建 web/public 目录**

```bash
mkdir -p web/public
```

- [ ] **Step 2: 创建 favicon.svg**

```xml
<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
  <title>ArcPredict</title>
  <defs>
    <linearGradient id="g" x1="0" y1="1" x2="1" y2="0">
      <stop offset="0%" stop-color="#1652F0" />
      <stop offset="100%" stop-color="#4DA8FF" />
    </linearGradient>
    <filter id="halo" x="-150%" y="-150%" width="400%" height="400%">
      <feGaussianBlur stdDeviation="2" />
    </filter>
  </defs>
  <style>
    /* 浅色浏览器标签栏：实色避免发光丢失 */
    @media (prefers-color-scheme: light) {
      .stroke-line { stroke: #0B2DB8 !important; }
      .dot-halo, .dot-mid { fill: #0B2DB8 !important; }
      .dot-core { fill: #ffffff !important; }
    }
  </style>
  <path class="stroke-line" d="M 4 18 A 14 14 0 0 1 18 4"
        stroke="url(#g)" stroke-width="2.5" stroke-linecap="round" fill="none" />
  <circle class="dot-halo" cx="18" cy="4" r="5" fill="#4DA8FF" opacity="0.35" filter="url(#halo)" />
  <circle class="dot-mid"  cx="18" cy="4" r="2.5" fill="#4DA8FF" />
  <circle class="dot-core" cx="18" cy="4" r="1" fill="#FFFFFF" />
</svg>
```

- [ ] **Step 3: 生成 favicon.ico、apple-touch-icon.png、og-image.png**

这三个二进制资产需用工具生成。用以下任一方式：

**A) 用 ImageMagick + librsvg（macOS / Linux）：**

```bash
# 在 web/public/ 下执行
cd web/public

# favicon.ico 多分辨率（16/32/48）：先栅格化 SVG 到 PNG，再合成 ico
# 注意：librsvg 不渲染 @media，本地导出会用 light 分支配色，对 .ico 合适
for s in 16 32 48; do
  rsvg-convert -w $s -h $s favicon.svg -o tmp-$s.png
done
magick tmp-16.png tmp-32.png tmp-48.png favicon.ico
rm tmp-*.png

# apple-touch-icon.png：180×180，深色圆角方底 + 居中 mark
magick -size 180x180 xc:'#050614' \
  \( favicon.svg -resize 120x120 \) -gravity center -composite \
  \( +clone -alpha extract -draw "fill black polygon 0,0 0,40 40,0 fill white circle 40,40 40,0" \
    \( +clone -flip \) -compose Multiply -composite \
    \( +clone -flop \) -compose Multiply -composite \) \
  -alpha off -compose CopyOpacity -composite apple-touch-icon.png

# og-image.png：1200×630，深色底 + 极光渐变 + logo + 文案
magick -size 1200x630 \
  gradient:'#050614-#0A0B1E' \
  \( -size 1200x630 radial-gradient:'rgba(22,82,240,0.45)-transparent' \) -compose Over -composite \
  \( favicon.svg -resize 200x200 \) -gravity NorthWest -geometry +100+200 -composite \
  -font Geist -pointsize 84 -fill '#F0F2FF' -gravity Center -annotate +100+0 'ArcPredict' \
  -pointsize 36 -fill '#9BA3C7' -annotate +100+100 'On-chain prediction markets on Arc' \
  og-image.png
```

**B) 用 Node 脚本（sharp + svg2img）：**

```bash
cd web
pnpm add -D sharp
```

```js
// web/scripts/build-icons.mjs
import sharp from 'sharp';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const svg = readFileSync(resolve('public/favicon.svg'));

for (const size of [16, 32, 48, 64, 180]) {
  const buf = await sharp(svg).resize(size, size).png().toBuffer();
  writeFileSync(resolve(`public/icon-${size}.png`), buf);
}

// favicon.ico 合成（多分辨率打包成单文件）
const { default: pngToIco } = await import('png-to-ico');
const ico = await pngToIco(['public/icon-16.png', 'public/icon-32.png', 'public/icon-48.png']);
writeFileSync(resolve('public/favicon.ico'), ico);

// apple-touch-icon
await sharp({
  create: { width: 180, height: 180, channels: 4, background: '#050614' },
})
  .composite([{ input: 'public/icon-180.png', blend: 'over' }])
  .png()
  .toFile(resolve('public/apple-touch-icon.png'));

// og-image 1200×630：纯背景 + 居中 logo（无字体也能用）
await sharp({
  create: { width: 1200, height: 630, channels: 4, background: '#050614' },
})
  .composite([
    { input: 'public/icon-180.png', top: 225, left: 510 },
  ])
  .png()
  .toFile(resolve('public/og-image.png'));
```

```bash
pnpm add -D png-to-ico
node scripts/build-icons.mjs
```

> 选 A 或 B 任一可。任务可接受的最低交付：`favicon.ico` `apple-touch-icon.png` `og-image.png` 三个文件存在且分辨率分别为多分辨率 / 180×180 / 1200×630。后续期 F 可让设计师替换更精修的 og 图。

- [ ] **Step 4: 验证文件存在与尺寸**

```bash
file web/public/favicon.svg
file web/public/favicon.ico
file web/public/apple-touch-icon.png
file web/public/og-image.png
```

Expected: 输出包含 SVG / MS Windows icon / PNG image, 180 x 180 / PNG image, 1200 x 630。

- [ ] **Step 5: Commit**

```bash
git add web/public/
git commit -m "feat(brand): favicon SVG/ICO + apple-touch + og-image 品牌资产"
```

---

## Task A6: Layout 元数据更新

**Files:**
- Modify: `web/app/layout.tsx`

- [ ] **Step 1: 改写 layout.tsx**

```tsx
import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { ArcBackground } from '@/components/ArcBackground';
import './globals.css';
import { Providers } from './providers';

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
  openGraph: {
    title: 'ArcPredict',
    description: '在 Arc 上用 USDC 参与预测市场。',
    images: ['/og-image.png'],
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'ArcPredict',
    description: '在 Arc 上用 USDC 参与预测市场。',
    images: ['/og-image.png'],
  },
};

export const viewport: Viewport = {
  themeColor: '#050614',
  colorScheme: 'dark',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="zh-CN" className="dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700&family=Geist+Mono:wght@400;500&family=Instrument+Serif:ital@0;1&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="bg-bg-0 text-ink antialiased">
        <ArcBackground />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
```

- [ ] **Step 2: 验证 typecheck 与 build**

```bash
pnpm typecheck && pnpm build
```

Expected: 二者都 PASS。

- [ ] **Step 3: dev 起来肉眼验**

```bash
pnpm dev
```

打开 http://localhost:3000：背景深 + 极光，标签栏 favicon 出现新弧线 logo。停掉 dev。

- [ ] **Step 4: Commit**

```bash
git add web/app/layout.tsx
git commit -m "feat(layout): metadata 接入 icons/og/twitter，html 标记深色"
```

---

# 期 B · 头 / 尾 / 丸

完成后：站点顶部完成 Synthra 同款玻璃感、新 Logo、新 WalletPill。卡片仍是旧样式（无所谓）。

---

## Task B1: SiteHeader 玻璃顶 + 新 Logo

**Files:**
- Modify: `web/components/SiteHeader.tsx`

- [ ] **Step 1: 改写 SiteHeader.tsx**

```tsx
import Link from 'next/link';
import { Logo } from './Logo';
import { WalletPill } from './WalletPill';

export function SiteHeader({
  allPositionsHref,
  allPositionsActive = false,
}: {
  allPositionsHref?: string;
  allPositionsActive?: boolean;
}) {
  return (
    <header
      className="sticky top-0 z-50 border-b border-hair"
      style={{
        background: 'rgba(10,11,30,0.65)',
        backdropFilter: 'blur(20px) saturate(160%)',
        WebkitBackdropFilter: 'blur(20px) saturate(160%)',
      }}
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-2 px-5 sm:px-8 py-3.5 sm:gap-3">
        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          <Link href="/" className="inline-flex items-center" aria-label="ArcPredict 首页">
            <Logo size="md" />
          </Link>
          {allPositionsHref ? (
            <Link
              href={allPositionsHref}
              className={`inline-flex shrink-0 items-center rounded-full border px-2 py-1 text-[11px] transition sm:px-3 sm:py-1.5 sm:text-xs ${
                allPositionsActive
                  ? 'border-arc-glow/40 bg-arc/10 text-arc-glow'
                  : 'border-hair text-ink-2 hover:border-arc-glow/30 hover:text-ink'
              }`}
            >
              <span className="sm:hidden">持仓</span>
              <span className="hidden sm:inline">全部持仓</span>
            </Link>
          ) : null}
        </div>

        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          <span className="inline-flex items-center gap-2 rounded-full border border-hair px-2 sm:px-3 py-1.5 text-[13px] text-ink-2">
            <span className="arc-ring-pulse h-2 w-2 rounded-full bg-arc-glow" />
            <span className="hidden sm:inline">Arc Testnet</span>
            <span className="hidden md:inline font-mono text-[12px] text-ink">·5042002</span>
          </span>
          <WalletPill />
        </div>
      </div>
    </header>
  );
}
```

> 注意：旧的 `<style jsx>` 与 `arc-ring-dot` 类名已删除，脉冲改用 globals.css 中的 `.arc-ring-pulse` 全局类。

- [ ] **Step 2: 验证 typecheck**

```bash
pnpm typecheck
```

Expected: PASS

- [ ] **Step 3: dev 肉眼验**

打开 http://localhost:3000，预期：header 是半透明深色玻璃条，左侧新弧线 logo 加渐变 "Predict"，右侧网络徽章圆点发光脉冲。

- [ ] **Step 4: Commit**

```bash
git add web/components/SiteHeader.tsx
git commit -m "feat(header): 玻璃顶 + 新 Logo + 发光网络徽章"
```

---

## Task B2: SiteFooter 透明化

**Files:**
- Modify: `web/components/SiteFooter.tsx`

- [ ] **Step 1: 读取当前实现**

```bash
cat web/components/SiteFooter.tsx
```

- [ ] **Step 2: 改写 SiteFooter.tsx**

将容器外层改为：

```tsx
<footer className="relative z-10 border-t border-hair">
  <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 text-[13px] text-ink-3">
    {/* 保留原有内容结构，但把所有文字色从原值改为 text-ink-3，
        所有链接 hover 改为 hover:text-arc-glow，
        所有边框从 border-hair 保持。 */}
  </div>
</footer>
```

实际改动：把原文件内所有 `text-ink-2`、`text-ink`、`bg-paper` 等映射如下：

```
text-ink   → text-ink-2
text-ink-2 → text-ink-3
bg-paper   → 删除（透明）
hover:text-ink / hover:text-arc → hover:text-arc-glow
border-hair → border-hair（不变）
```

- [ ] **Step 3: 验证 typecheck**

```bash
pnpm typecheck
```

Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add web/components/SiteFooter.tsx
git commit -m "feat(footer): 透明化 + hair 分隔 + hover 发光"
```

---

## Task B3: NetworkBanner 玻璃感横条

**Files:**
- Modify: `web/components/NetworkBanner.tsx`

- [ ] **Step 1: 改写 NetworkBanner.tsx**

把容器从原 `bg-arc-tint border-b border-arc/15 text-arc-deep` 类改为：

```tsx
// 默认信息态
<div className="border-b border-arc/20 text-arc-glow"
     style={{ background: 'rgba(22,82,240,0.10)' }}>
  {/* 原内容 */}
</div>
```

错误态：

```tsx
<div className="border-b border-no/30 text-no"
     style={{ background: 'rgba(248,113,113,0.10)' }}>
```

删除所有 `bg-yellow` / `text-yellow` / `warn` 色（深色下黄色刺眼，统一改红/蓝）。

- [ ] **Step 2: 验证 typecheck**

```bash
pnpm typecheck
```

Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add web/components/NetworkBanner.tsx
git commit -m "feat(banner): NetworkBanner 玻璃感横条 + 蓝/红双态"
```

---

## Task B4: WalletPill 三态玻璃丸

**Files:**
- Modify: `web/components/WalletPill.tsx`

- [ ] **Step 1: 改写 WalletPill.tsx**

```tsx
'use client';

import type { Abi } from 'viem';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount, useChainId, useReadContract } from 'wagmi';
import ERC20Abi from '@/lib/abis/ERC20.json';
import { USDC_ADDRESS } from '@/lib/addresses';
import { arcTestnet } from '@/lib/chain';
import { truncateAddr } from '@/lib/format';

const erc20Abi = ERC20Abi as Abi;

const pillBase =
  'inline-flex items-center gap-2 rounded-full px-3 py-2 text-xs font-medium sm:px-4 sm:text-sm whitespace-nowrap transition duration-200';

const pillIdle = `${pillBase} glass glass-hover text-ink hover:text-ink`;
const pillConnected = `${pillBase} glass glass-hover text-ink font-mono`;
const pillWrong = `${pillBase} border border-no/40 text-no`;

export function WalletPill() {
  const { address } = useAccount();
  const chainId = useChainId();

  useReadContract({
    address: USDC_ADDRESS,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: { enabled: !!address, refetchInterval: 10_000 },
  });

  return (
    <ConnectButton.Custom>
      {({ account, mounted, authenticationStatus, openAccountModal, openConnectModal, openChainModal }) => {
        const ready = mounted && authenticationStatus !== 'loading';
        const connected = ready && !!account && !!address;
        const wrongChain = connected && chainId !== arcTestnet.id;

        if (!ready) {
          return <div className="pointer-events-none opacity-0" aria-hidden />;
        }

        if (wrongChain) {
          return (
            <button type="button" onClick={openChainModal} className={pillWrong}>
              <span className="arc-ring-pulse h-2 w-2 rounded-full bg-no" />
              <span>切换到 Arc</span>
            </button>
          );
        }

        if (!connected) {
          return (
            <button type="button" onClick={openConnectModal} className={pillIdle}>
              <span>连接钱包</span>
              <span aria-hidden>→</span>
            </button>
          );
        }

        return (
          <button type="button" onClick={openAccountModal} className={pillConnected}>
            <span>{truncateAddr(address!)}</span>
            <span className="arc-ring-pulse h-2 w-2 rounded-full bg-arc-glow" />
          </button>
        );
      }}
    </ConnectButton.Custom>
  );
}
```

- [ ] **Step 2: 验证 typecheck**

```bash
pnpm typecheck
```

Expected: PASS

- [ ] **Step 3: dev 肉眼验三态**

打开 http://localhost:3000：
1. 未连接 → "连接钱包" 玻璃丸
2. 点连接、错网络 → "切换到 Arc" 红色丸 + 红脉冲
3. 切到 Arc Testnet → 地址 mono + 蓝脉冲

- [ ] **Step 4: 期 B build 验证**

```bash
pnpm build
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add web/components/WalletPill.tsx
git commit -m "feat(wallet): WalletPill 三态玻璃丸（idle/connected/wrong）"
```

---

# 期 C · 卡片

完成后：首页卡片区视觉到位，可截图 demo。MarketFilterBar 也焕新。

---

## Task C1: BaseMarketCard 玻璃化

**Files:**
- Modify: `web/components/BaseMarketCard.tsx`

- [ ] **Step 1: 改写 BaseMarketCard.tsx**

```tsx
import type { ReactNode } from 'react';

export function BaseMarketCard({
  renderHeader,
  renderOutcomes,
  renderFooter,
  className = '',
}: {
  renderHeader: () => ReactNode;
  renderOutcomes: () => ReactNode;
  renderFooter: () => ReactNode;
  className?: string;
}) {
  return (
    <article
      className={`group relative overflow-hidden rounded-3xl glass glass-hover p-6 hover:-translate-y-0.5 ${className}`.trim()}
    >
      {/* 右上装饰渐变同心圆（代替旧蓝色描边） */}
      <svg
        className="pointer-events-none absolute right-0 top-0 h-[120px] w-[120px] opacity-70"
        viewBox="0 0 120 120"
        fill="none"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="bmc-gradient" x1="1" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#4DA8FF" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#6D5BFF" stopOpacity="0.05" />
          </linearGradient>
        </defs>
        <circle cx="120" cy="0" r="110" stroke="url(#bmc-gradient)" strokeWidth="1" />
        <circle cx="120" cy="0" r="80" stroke="url(#bmc-gradient)" strokeWidth="1" />
        <circle cx="120" cy="0" r="50" stroke="url(#bmc-gradient)" strokeWidth="1" />
      </svg>

      <div className="relative z-10">
        {renderHeader()}
        {renderOutcomes()}
        {renderFooter()}
      </div>
    </article>
  );
}
```

- [ ] **Step 2: 验证 typecheck**

```bash
pnpm typecheck
```

Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add web/components/BaseMarketCard.tsx
git commit -m "feat(card): BaseMarketCard 玻璃化 + 渐变装饰圆"
```

---

## Task C2: CryptoMarketCard 深色化（YES/NO 比例按钮 + num-glow）

**Files:**
- Modify: `web/components/CryptoMarketCard.tsx`

- [ ] **Step 1: 在卡片内做颜色 token 全量映射**

通读 `CryptoMarketCard.tsx`，按以下表替换：

```
text-ink-2 → text-ink-2 （不变）
text-ink   → text-ink   （不变）
bg-canvas  → 删除（透明，让玻璃底透出）
bg-paper   → 删除
border-hair → border-hair（不变）
text-arc   → text-arc-glow
text-arc-deep → text-arc-glow
bg-arc-tint → bg-arc/15
border-arc/25 → border-arc-glow/40
```

- [ ] **Step 2: 价格大字加 num-glow**

在 main price 文字 className 上追加 `num-glow`，例如：

```tsx
<div className="font-mono text-2xl text-ink num-glow">
  {/* current price */}
</div>
```

行权价同样加 `num-glow`。

- [ ] **Step 3: YES/NO 按钮按比例 + 半透明语义色**

把原 YES / NO 按钮替换为：

```tsx
{(() => {
  const pct = yesPercent(row); // 0–100
  const yesFlex = Math.max(20, Math.min(80, pct));
  const noFlex = 100 - yesFlex;
  return (
    <div className="mt-4 flex w-full gap-2">
      <button
        type="button"
        onClick={() => onBet(row, true)}
        style={{ flex: yesFlex }}
        className="rounded-2xl border border-yes/40 bg-yes/15 px-3 py-2.5 text-sm font-semibold text-yes transition hover:bg-yes/25 hover:shadow-[inset_0_0_24px_rgba(52,211,153,0.25)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yes/60"
      >
        YES · {pct}%
      </button>
      <button
        type="button"
        onClick={() => onBet(row, false)}
        style={{ flex: noFlex }}
        className="rounded-2xl border border-no/40 bg-no/15 px-3 py-2.5 text-sm font-semibold text-no transition hover:bg-no/25 hover:shadow-[inset_0_0_24px_rgba(248,113,113,0.25)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-no/60"
      >
        NO · {100 - pct}%
      </button>
    </div>
  );
})()}
```

> `yesPercent` 已存在于 `derivePosition.ts`；如不存在请创建并默认 50。

- [ ] **Step 4: 验证 typecheck**

```bash
pnpm typecheck
```

Expected: PASS

- [ ] **Step 5: 跑现有测试**

```bash
node test/check_home_page.mjs
```

Expected: PASS（业务逻辑没动）

- [ ] **Step 6: Commit**

```bash
git add web/components/CryptoMarketCard.tsx
git commit -m "feat(card): CryptoMarketCard 深色化 + YES/NO 比例按钮 + 价格发光"
```

---

## Task C3: WorldCupMarketCard 深色化

**Files:**
- Modify: `web/components/WorldCupMarketCard.tsx`

- [ ] **Step 1: 应用与 Task C2 相同的颜色映射规则**

```
bg-canvas / bg-paper → 删除（透明）
text-arc → text-arc-glow
border-arc/25 → border-arc-glow/40
bg-arc-tint → bg-arc/15
text-yes / text-no → 保留（已是语义色）
```

- [ ] **Step 2: 三选一面板（胜/平/负 或 阶段晋级）按比例 + 半透明**

参考 Task C2 的 YES/NO 按钮模式，扩展为三按钮。三按钮共用 flex 总和 100，按 implied probability 比例分配：

```tsx
<div className="mt-4 flex w-full gap-2">
  {OUTCOMES_3.map((opt) => (
    <button
      key={opt.key}
      type="button"
      onClick={() => onBet(row, opt.key)}
      style={{ flex: Math.max(15, opt.pct) }}
      className="rounded-2xl border border-arc-glow/30 bg-arc/10 px-3 py-2.5 text-sm font-semibold text-arc-glow transition hover:bg-arc/20 hover:shadow-[inset_0_0_24px_rgba(77,168,255,0.3)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-arc-glow/60"
    >
      {opt.label} · {opt.pct}%
    </button>
  ))}
</div>
```

> 若 `OUTCOMES_3` 不存在，按文件中现有的世界杯结果类型枚举构造一个本地常量数组。不改业务逻辑。

- [ ] **Step 3: 国旗发光环**

国旗包裹层加发光：

```tsx
<span className="inline-flex h-7 w-7 items-center justify-center rounded-full"
      style={{ boxShadow: '0 0 0 1px rgba(77,168,255,0.25), 0 0 12px -2px rgba(77,168,255,0.4)' }}>
  <span className={`fi fi-${countryCode}`} />
</span>
```

- [ ] **Step 4: 验证 typecheck**

```bash
pnpm typecheck
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add web/components/WorldCupMarketCard.tsx
git commit -m "feat(card): WorldCupMarketCard 深色化 + 三按钮发光"
```

---

## Task C4: MarketCard（event 变体）深色化

**Files:**
- Modify: `web/components/MarketCard.tsx`

- [ ] **Step 1: 应用 Task C2 颜色映射**

```
bg-paper / bg-canvas → 删除
text-arc / text-arc-deep → text-arc-glow
bg-arc-tint → bg-arc/15
border-arc/25 → border-arc-glow/40
```

- [ ] **Step 2: 验证 typecheck**

```bash
pnpm typecheck
```

Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add web/components/MarketCard.tsx
git commit -m "feat(card): MarketCard 深色化"
```

---

## Task C5: MarketFilterBar pill 玻璃化

**Files:**
- Modify: `web/components/MarketFilterBar.tsx`

- [ ] **Step 1: 改写 button className 常量**

定位文件顶部的 `baseButtonClassName` / `activeButtonClassName` / `inactiveButtonClassName`，替换：

```ts
const baseButtonClassName =
  'rounded-full border px-3.5 py-[7px] text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-arc-glow/60 focus-visible:ring-offset-2 focus-visible:ring-offset-bg-0';

const activeButtonClassName =
  `${baseButtonClassName} border-arc-glow/40 bg-arc/15 text-arc-glow shadow-[0_0_24px_-8px_rgba(77,168,255,0.6)]`;

const inactiveButtonClassName =
  `${baseButtonClassName} border-hair text-ink-2 hover:border-arc-glow/30 hover:text-ink hover:bg-arc/5`;
```

- [ ] **Step 2: 容器外壳**

如有外层 `bg-paper` 等容器底色，删掉；让 filter bar 直接浮在玻璃面板上。

- [ ] **Step 3: 验证 typecheck 与既有测试**

```bash
pnpm typecheck
node test/check_market_filter.mjs
```

Expected: 二者 PASS

- [ ] **Step 4: Commit**

```bash
git add web/components/MarketFilterBar.tsx
git commit -m "feat(filter): MarketFilterBar pill 玻璃化 + 激活态发光"
```

---

## Task C6: ImpliedProbabilityChart 渐变发光

**Files:**
- Modify: `web/components/ImpliedProbabilityChart.tsx`

- [ ] **Step 1: SVG defs 加渐变与 drop-shadow**

```tsx
<defs>
  <linearGradient id="ipc-stroke" x1="0" y1="0" x2="1" y2="0">
    <stop offset="0%" stopColor="#1652F0" />
    <stop offset="100%" stopColor="#4DA8FF" />
  </linearGradient>
</defs>
```

- [ ] **Step 2: 进度环 stroke**

把原描边色改为 `stroke="url(#ipc-stroke)"`，并在 `<circle>` 或 `<path>` 上加内联 `style={{ filter: 'drop-shadow(0 0 6px rgba(77,168,255,0.6))' }}`。

- [ ] **Step 3: 轨道（背景圆）色**

把原 `stroke="#E8E6DF"` 等浅色轨道改为 `stroke="rgba(155,163,199,0.12)"`（hair 的 RGBA）。

- [ ] **Step 4: 中央百分数文字**

加 `className="num-glow"` 到中央百分数 text。

- [ ] **Step 5: 验证 typecheck**

```bash
pnpm typecheck
```

Expected: PASS

- [ ] **Step 6: 期 C build 验证**

```bash
pnpm build
```

Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add web/components/ImpliedProbabilityChart.tsx
git commit -m "feat(chart): ImpliedProbabilityChart 渐变 stroke + drop-shadow 发光"
```

---

# 期 D · 弹窗与持仓

完成后：BetModal 桌面+移动抽屉、所有列表面板、辅件、详情页相关组件全部深色化。整套投注闭环视觉就绪。

---

## Task D1: 从 BetModal 抽出 BetForm（TDD）

**目的：** BetModal 既要做浮层入场动效、聚焦管理，又要做表单业务逻辑——耦合太重。详情页桌面端要嵌入式 BetForm（不弹窗）。抽出 BetForm 后两边复用。**业务行为必须保持完全相同**——这是 TDD 适用的情景。

**Files:**
- Create: `web/components/BetForm.tsx`
- Create: `web/components/__tests__/BetForm.test.tsx`
- Modify: `web/components/BetModal.tsx`

- [ ] **Step 1: 读懂 BetModal 现状**

```bash
cat web/components/BetModal.tsx | wc -l
```

记录行数；通读理解 props、内部 state（金额输入、step、approving、betting）、对外回调。

- [ ] **Step 2: 写 BetForm 失败测试**

```tsx
// web/components/__tests__/BetForm.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BetForm } from '../BetForm';
import type { DashboardRow } from '@/lib/derivePosition';

vi.mock('wagmi', () => ({
  useAccount: () => ({ address: '0x0000000000000000000000000000000000000000' }),
  useReadContract: () => ({ data: 0n, refetch: vi.fn() }),
  useWriteContract: () => ({ writeContractAsync: vi.fn() }),
  useWaitForTransactionReceipt: () => ({ data: undefined }),
  useSwitchChain: () => ({ switchChainAsync: vi.fn() }),
}));

const mockRow = {
  market: { id: 1n, question: 'BTC > $50k?', pythPriceId: '0xabc', threshold: 50000n, thresholdExpo: 0, deadline: 9999999999n, outcome: 0 },
  position: { yesShares: 0n, noShares: 0n },
  priceNow: { price: 49000n, expo: 0 },
} as unknown as DashboardRow;

describe('BetForm', () => {
  it('renders the form fields when given a row + side', () => {
    render(<BetForm row={mockRow} side={true} onSuccess={() => {}} />);
    expect(screen.getByPlaceholderText(/USDC/i)).toBeTruthy();
    expect(screen.getByRole('button', { name: /确认下注/i })).toBeTruthy();
  });

  it('shows YES style when side=true and NO style when side=false', () => {
    const { rerender } = render(<BetForm row={mockRow} side={true} onSuccess={() => {}} />);
    expect(screen.getByRole('button', { name: /确认下注/i }).className).toMatch(/yes/);
    rerender(<BetForm row={mockRow} side={false} onSuccess={() => {}} />);
    expect(screen.getByRole('button', { name: /确认下注/i }).className).toMatch(/no/);
  });
});
```

- [ ] **Step 3: 跑测试确认失败**

```bash
cd web && pnpm vitest run components/__tests__/BetForm.test.tsx
```

Expected: FAIL（BetForm 不存在）

- [ ] **Step 4: 创建 BetForm.tsx**

把 BetModal.tsx 中除「外壳容器、遮罩、关闭按钮、入场动效、聚焦管理」之外的所有业务逻辑（金额 state、approving / betting step、wagmi 调用、错误处理、CTA 按钮、回报预估）整体移到 BetForm。新文件骨架：

```tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import { maxUint256, type Abi } from 'viem';
import {
  useAccount,
  useReadContract,
  useSwitchChain,
  useWaitForTransactionReceipt,
  useWriteContract,
} from 'wagmi';
import ERC20Abi from '@/lib/abis/ERC20.json';
import PredictionMarketAbi from '@/lib/abis/PredictionMarket.json';
import { PREDICTION_MARKET_ADDRESS, USDC_ADDRESS } from '@/lib/addresses';
import { arcTestnet } from '@/lib/chain';
import type { DashboardRow } from '@/lib/derivePosition';
import { fmtUsdc, parseUsdc } from '@/lib/format';

type Props = {
  row: DashboardRow;
  side: boolean;
  onSuccess?: () => void;
  compact?: boolean; // 详情页嵌入模式收紧间距
};

type Step = 'idle' | 'approving' | 'betting' | 'success';

const erc20Abi = ERC20Abi as Abi;
const predictionMarketAbi = PredictionMarketAbi as Abi;
const MIN_BET_RAW = 100000n;

// 从原 BetModal 复制以下纯函数过来，原文件中删除：
// - safeParseUsdc(value: string)
// - humanizeError(error: unknown)

// （为保证粘贴正确，把这两个函数完整再贴一次）

function safeParseUsdc(value: string): bigint | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  try {
    const parsed = parseUsdc(trimmed);
    return parsed >= 0n ? parsed : null;
  } catch {
    return null;
  }
}

function humanizeError(error: unknown): string {
  const maybeError = error as {
    code?: number;
    shortMessage?: string;
    message?: string;
    cause?: { message?: string };
  };
  const raw = maybeError.shortMessage ?? maybeError.message ?? maybeError.cause?.message ?? 'unknown error';
  const lower = raw.toLowerCase();
  if (maybeError.code === 4001 || lower.includes('reject') || lower.includes('denied')) return '已取消';
  if (lower.includes('timeout') || lower.includes('network') || lower.includes('fetch')) return '网络异常，请重试。';
  if (lower.includes('belowminbet')) return '最小下注为 0.1 USDC。';
  if (lower.includes('bettingclosed')) return '下注窗口已关闭。';
  if (lower.includes('alreadyresolved')) return '该市场已完成结算。';
  return raw;
}

export function BetForm({ row, side, onSuccess, compact = false }: Props) {
  // 把 BetModal 现有的所有 useState / useReadContract / handler / submit / render JSX 完整搬到这里。
  // - 删除浮层容器、遮罩、关闭按钮，只保留表单本身
  // - 主 CTA 按钮深色化：YES 用 yes 半透明 + 边框 + 发光，NO 用 no
  // - 输入框深色：bg-bg-2/60 border-hair text-ink placeholder:text-ink-3 num-glow
  // - 快捷金额按钮：rounded-full border-hair text-ink-2 hover:border-arc-glow/40 hover:text-ink
  // - 回报预估卡：rounded-2xl border-hair bg-bg-2/40 内含两行 mono 数字

  return (
    <div className={compact ? 'space-y-3' : 'space-y-4'}>
      {/* 见上方注释把原 modal body 内容贴回，并应用深色 token */}
    </div>
  );
}
```

> 实现时严格保留原 BetModal 中的：钱包未连接拦截、错误网络 switchChain、approve→bet 两阶段流程、min bet 校验、success 回调时机。这些都是业务行为，不能改。

- [ ] **Step 5: 跑 BetForm 测试通过**

```bash
pnpm vitest run components/__tests__/BetForm.test.tsx
```

Expected: PASS

- [ ] **Step 6: 改写 BetModal.tsx 只保留外壳**

```tsx
'use client';

import { useEffect, useRef } from 'react';
import { useMediaQuery } from '@/lib/use-media-query';
import type { DashboardRow } from '@/lib/derivePosition';
import { BetForm } from './BetForm';

type BetModalProps = {
  row: DashboardRow;
  side: boolean;
  onClose: () => void;
};

export function BetModal({ row, side, onClose }: BetModalProps) {
  const closeBtnRef = useRef<HTMLButtonElement>(null);
  const isMobile = useMediaQuery('(max-width: 639px)');

  useEffect(() => {
    closeBtnRef.current?.focus();
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="bet-modal-title"
      className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center"
      onClick={onClose}
    >
      <div
        className="absolute inset-0 backdrop-blur-md"
        style={{ background: 'rgba(5,6,20,0.7)' }}
        aria-hidden="true"
      />
      <div
        onClick={(e) => e.stopPropagation()}
        className={`relative z-10 glass w-full max-w-[480px] p-6 ${
          isMobile
            ? 'rounded-t-3xl animate-[modal-drawer-up_320ms_cubic-bezier(0.2,0.8,0.2,1)_both]'
            : 'rounded-3xl animate-[modal-pop_280ms_cubic-bezier(0.2,0.8,0.2,1)_both] mx-4'
        }`}
        style={{
          boxShadow:
            '0 0 0 1px rgba(77,168,255,0.25), 0 60px 120px -40px rgba(22,82,240,0.6), inset 0 1px 0 rgba(255,255,255,0.08)',
        }}
      >
        {isMobile ? (
          <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-ink-3/40" aria-hidden="true" />
        ) : null}

        <div className="mb-4 flex items-start justify-between">
          <h2 id="bet-modal-title" className="font-display text-xl text-ink">
            下注 · {side ? 'YES' : 'NO'}
          </h2>
          <button
            ref={closeBtnRef}
            type="button"
            onClick={onClose}
            aria-label="关闭"
            className="rounded-full p-1 text-ink-2 hover:text-ink hover:bg-bg-2/60 transition"
          >
            ✕
          </button>
        </div>

        <BetForm row={row} side={side} onSuccess={onClose} />
      </div>
    </div>
  );
}
```

- [ ] **Step 7: 在 globals.css 追加 modal keyframes**

把以下内容追加到 `web/app/globals.css` 末尾：

```css
@keyframes modal-pop {
  from { opacity: 0; transform: scale(0.96) translateY(8px); }
  to   { opacity: 1; transform: scale(1) translateY(0); }
}
@keyframes modal-drawer-up {
  from { transform: translateY(100%); }
  to   { transform: translateY(0); }
}
```

- [ ] **Step 8: 验证 typecheck 与所有测试**

```bash
pnpm typecheck
pnpm vitest run
```

Expected: 二者 PASS

- [ ] **Step 9: dev 肉眼验**

打开 http://localhost:3000，触发任一卡片 YES/NO 按钮。
- 桌面：弹窗居中、玻璃 + 发光环、Esc 关闭、Tab 焦点环
- 移动（DevTools 切到 390px）：底部抽屉滑入、顶部 drag-handle 可见

- [ ] **Step 10: Commit**

```bash
git add web/components/BetForm.tsx web/components/__tests__/BetForm.test.tsx web/components/BetModal.tsx web/app/globals.css
git commit -m "feat(modal): 抽出 BetForm，BetModal 改为玻璃浮层 + 移动抽屉"
```

---

## Task D2: PositionList 玻璃化 + 状态徽标

**Files:**
- Modify: `web/components/PositionList.tsx`

- [ ] **Step 1: 外层容器加 glass + rounded-3xl**

把根 div 外层 className 改为：

```tsx
<section className="glass rounded-3xl p-5 sm:p-6">
  {/* 标题：font-display text-xl text-ink */}
  {/* 副标题：text-sm text-ink-2 */}
</section>
```

- [ ] **Step 2: 行分隔与表头**

行包裹 `border-b border-hair last:border-b-0`，表头 `text-[11px] uppercase tracking-wider text-ink-3 font-mono`。

- [ ] **Step 3: 状态徽标**

盈利/亏损/未结算 三态徽标：

```tsx
const variants = {
  profit: 'bg-yes/15 text-yes border border-yes/30',
  loss:   'bg-no/15  text-no  border border-no/30',
  open:   'bg-arc/15 text-arc-glow border border-arc-glow/30',
} as const;
```

- [ ] **Step 4: 数字 mono + num-glow**

所有 USDC 金额、份额数字加 `font-mono num-glow`。

- [ ] **Step 5: 验证 typecheck**

```bash
pnpm typecheck
```

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add web/components/PositionList.tsx
git commit -m "feat(positions): PositionList 玻璃化 + 状态徽标半透明"
```

---

## Task D3: ResolvedList 玻璃化

**Files:**
- Modify: `web/components/ResolvedList.tsx`

- [ ] **Step 1: 按 Task D2 的模式套用**

容器 `glass rounded-3xl p-5 sm:p-6`，行 `border-b border-hair last:border-b-0`，表头 mono ink-3，数字 num-glow。结算结果徽标用 `bg-yes/15 text-yes` / `bg-no/15 text-no` / `bg-ink-3/15 text-ink-3`（已取消）。

- [ ] **Step 2: 验证 typecheck**

```bash
pnpm typecheck
```

Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add web/components/ResolvedList.tsx
git commit -m "feat(positions): ResolvedList 玻璃化"
```

---

## Task D4: FaucetCard 玻璃 + 发光主 CTA

**Files:**
- Modify: `web/components/FaucetCard.tsx`

- [ ] **Step 1: 容器玻璃化**

根容器 `glass rounded-3xl p-6`。

- [ ] **Step 2: 标题与说明文字**

标题 `font-display text-xl text-ink`，描述 `text-sm text-ink-2`。

- [ ] **Step 3: 余额展示**

`<span className="font-mono text-2xl text-ink num-glow">{balance}</span> <span className="text-ink-3">USDC</span>`

- [ ] **Step 4: 领水主 CTA**

```tsx
<button
  type="button"
  onClick={onClaim}
  disabled={pending}
  className="w-full rounded-2xl border border-arc-glow/40 bg-arc/15 px-4 py-3 text-base font-semibold text-arc-glow transition hover:bg-arc/25 hover:shadow-[inset_0_0_24px_rgba(77,168,255,0.35),0_0_40px_-12px_rgba(77,168,255,0.6)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-arc-glow/60 disabled:opacity-50 disabled:cursor-not-allowed"
>
  {pending ? '处理中…' : '领取测试 USDC'}
</button>
```

- [ ] **Step 5: 验证 typecheck**

```bash
pnpm typecheck
```

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add web/components/FaucetCard.tsx
git commit -m "feat(faucet): FaucetCard 玻璃化 + 发光主 CTA"
```

---

## Task D5: SeedDisclosure 玻璃折叠

**Files:**
- Modify: `web/components/SeedDisclosure.tsx`

- [ ] **Step 1: 容器与折叠头**

容器 `glass rounded-2xl`，折叠头 button：

```tsx
<button
  type="button"
  onClick={() => setOpen((v) => !v)}
  className="flex w-full items-center justify-between px-4 py-3 text-left text-sm text-ink-2 hover:text-ink transition"
>
  <span>{title}</span>
  <svg
    className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
</button>
```

- [ ] **Step 2: 折叠面板内容**

```tsx
{open ? (
  <div className="border-t border-hair px-4 py-3 text-sm text-ink-2 space-y-2">
    {children}
  </div>
) : null}
```

- [ ] **Step 3: 验证 typecheck**

```bash
pnpm typecheck
```

Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add web/components/SeedDisclosure.tsx
git commit -m "feat(seed): SeedDisclosure 玻璃折叠 + chevron 旋转"
```

---

## Task D6: ResolveCountdown 临期颜色相位

**Files:**
- Modify: `web/components/ResolveCountdown.tsx`
- Modify: `web/app/globals.css`（追加一段 keyframes）

- [ ] **Step 1: 数字 mono + num-glow**

把现有时间显示的 className 加上 `font-mono num-glow text-ink`。

- [ ] **Step 2: 临期 < 1h 加 .countdown-urgent 类**

在 ResolveCountdown 内根据剩余秒数：

```tsx
const urgent = secondsLeft < 3600 && secondsLeft > 0;
return (
  <span className={`font-mono num-glow ${urgent ? 'countdown-urgent' : 'text-ink'}`}>
    {fmtCountdown(secondsLeft)}
  </span>
);
```

- [ ] **Step 3: 在 globals.css 末尾追加 keyframes**

```css
@keyframes countdown-shift {
  0%, 100% { color: #4DA8FF; text-shadow: 0 0 24px rgba(77,168,255,0.4); }
  50%      { color: #FF8A4C; text-shadow: 0 0 24px rgba(255,138,76,0.5); }
}
.countdown-urgent {
  animation: countdown-shift 3s ease-in-out infinite;
}
```

- [ ] **Step 4: 验证 typecheck**

```bash
pnpm typecheck
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add web/components/ResolveCountdown.tsx web/app/globals.css
git commit -m "feat(countdown): ResolveCountdown 临期 arc-glow↔heat 颜色相位"
```

---

## Task D7: MarketDetailCard / EventInfoPanel / WorldCupOutcomePanel 玻璃化

**Files:**
- Modify: `web/components/MarketDetailCard.tsx`
- Modify: `web/components/EventInfoPanel.tsx`
- Modify: `web/components/WorldCupOutcomePanel.tsx`

- [ ] **Step 1: 三个文件统一应用以下映射**

```
外层容器 → glass rounded-3xl p-6
text-ink (主) / text-ink-2 (副) / text-ink-3 (辅) 不变
bg-paper / bg-canvas → 删除
border-hair 不变
text-arc / text-arc-deep → text-arc-glow
价格/概率/份额数字 → 加 font-mono num-glow
分隔线 → border-hair
```

- [ ] **Step 2: 验证 typecheck**

```bash
pnpm typecheck
```

Expected: PASS

- [ ] **Step 3: 期 D build 验证**

```bash
pnpm build
```

Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add web/components/MarketDetailCard.tsx web/components/EventInfoPanel.tsx web/components/WorldCupOutcomePanel.tsx
git commit -m "feat(detail): 详情页主卡与赛事面板玻璃化"
```

---

# 期 E · 页面级布局

完成后：三个主路由（首页 / 详情页 / 连接钱包页）完成结构性焕新。

---

## Task E1: HomeHero 组件 + 首页 page.tsx 接入

**Files:**
- Create: `web/components/HomeHero.tsx`
- Modify: `web/app/page.tsx`

- [ ] **Step 1: 创建 HomeHero.tsx**

```tsx
import Link from 'next/link';
import { LogoMark } from './LogoMark';

type Props = {
  stats?: {
    activeMarkets: number;
    totalVolumeUsdc: string; // 已格式化字符串，如 "$48,210"
    pendingResolution: number;
  };
};

export function HomeHero({ stats }: Props) {
  return (
    <section className="relative overflow-hidden px-4 sm:px-6 lg:px-8 pt-16 sm:pt-24 pb-12">
      {/* 背后超大 logo mark blur */}
      <div className="pointer-events-none absolute -right-20 -top-10 opacity-15" aria-hidden="true">
        <LogoMark size={480} animate={false} style={{ filter: 'blur(2px)' }} />
      </div>

      <div className="relative mx-auto max-w-7xl">
        <h1 className="font-display text-[44px] sm:text-[64px] lg:text-[84px] leading-[1.05] text-ink max-w-3xl">
          <span className="bg-aurora-text bg-clip-text text-transparent">链上预测</span>
          <br />
          <span className="text-ink">看见概率</span>
        </h1>
        <p className="mt-6 max-w-xl text-base sm:text-lg text-ink-2">
          在 Arc 上用 USDC 参与加密价格与世界杯双轨预测市场。完全链上、无中介、零信任。
        </p>

        <div className="mt-8 flex flex-wrap items-center gap-3">
          <Link
            href="#markets"
            className="inline-flex items-center gap-2 rounded-2xl border border-arc-glow/40 bg-arc/15 px-5 py-3 text-base font-semibold text-arc-glow transition hover:bg-arc/25 hover:shadow-[inset_0_0_24px_rgba(77,168,255,0.35),0_0_40px_-12px_rgba(77,168,255,0.6)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-arc-glow/60"
          >
            立即参与 <span aria-hidden>→</span>
          </Link>
          <Link
            href="/connect"
            className="inline-flex items-center gap-2 rounded-2xl border border-hair px-5 py-3 text-base text-ink-2 transition hover:border-arc-glow/30 hover:text-ink"
          >
            了解 Arc 网络
          </Link>
        </div>

        {stats ? (
          <div className="mt-12 grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-3xl">
            <Stat label="24h 活跃合约" value={stats.activeMarkets.toString()} />
            <Stat label="总投注金额" value={stats.totalVolumeUsdc} unit="USDC" />
            <Stat label="待结算" value={stats.pendingResolution.toString()} />
          </div>
        ) : null}
      </div>
    </section>
  );
}

function Stat({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <div className="rounded-2xl border border-hair px-4 py-3">
      <div className="text-xs text-ink-3 uppercase tracking-wider">{label}</div>
      <div className="mt-1 font-mono text-2xl text-ink num-glow">
        {value}{unit ? <span className="ml-1 text-sm text-ink-2">{unit}</span> : null}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 修改 web/app/page.tsx 接入 HomeHero**

在 `HomePageContent` 渲染部分，于 `<NetworkBanner />` 与 `<SiteHeader />` 之后、`<main>` 之前插入：

```tsx
<HomeHero
  stats={{
    activeMarkets: activeMarkets.length + upcomingWorldCupMarkets.length,
    totalVolumeUsdc: '—', // 当下没有可用真值，显示长破折号占位（不写假数）
    pendingResolution: rows.filter((r) => OUTCOMES[r.market.outcome] === 'Unresolved').length,
  }}
/>
```

> 文件顶部加上 `import { HomeHero } from '@/components/HomeHero';`。

`<main>` 的容器 className 调整：删除原有 `bg-paper` / `bg-canvas` 类（如果存在），保留 `mx-auto max-w-7xl px-4 pb-24 sm:px-6 lg:px-8`，再追加 `id="markets" relative z-10`。

- [ ] **Step 3: 网格容器**

确认市场卡片网格用 `grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5`。

- [ ] **Step 4: 持仓与已结算分栏**

底部 `PositionList` 与 `ResolvedList` 包成 `grid grid-cols-1 lg:grid-cols-2 gap-5`。

- [ ] **Step 5: 验证 typecheck 与测试**

```bash
pnpm typecheck
node test/check_home_page.mjs
```

Expected: 二者 PASS

- [ ] **Step 6: dev 肉眼验**

http://localhost:3000：Hero 出现、CTA 跳到 #markets、统计数字 mono 发光、滚动顺畅。

- [ ] **Step 7: Commit**

```bash
git add web/components/HomeHero.tsx web/app/page.tsx
git commit -m "feat(home): 新增 HomeHero + 首页网格深色化"
```

---

## Task E2: 市场详情页 12 栅格重排 + 桌面嵌入式 BetForm

**Files:**
- Modify: `web/app/market/[id]/page.tsx`

- [ ] **Step 1: 读懂当前详情页结构**

```bash
cat web/app/market/\[id\]/page.tsx
```

记录：路由参数解析、合约读取、当前的纵向结构，列出复用的子组件。

- [ ] **Step 2: 新布局骨架**

在保留全部业务逻辑前提下，把渲染层改为：

```tsx
return (
  <>
    <NetworkBanner />
    <SiteHeader />
    <main className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
      {/* 顶条：返回 + 资产名 + 频次 + 倒计时 */}
      <div className="mb-6 flex items-center justify-between gap-4">
        <Link href="/" className="inline-flex items-center gap-2 text-sm text-ink-2 hover:text-ink transition">
          <span aria-hidden>←</span> 返回
        </Link>
        {/* 右侧分享/复制按钮（可选，先放占位 button） */}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* 左：主玻璃卡（详情、图表、面板） */}
        <div className="lg:col-span-8 space-y-6">
          <MarketDetailCard row={row} />
          <ImpliedProbabilityChart series={series} />
          <SeedDisclosure title="解析机制">
            {/* 既有 seed 说明 */}
          </SeedDisclosure>
          {isWorldCup ? <EventInfoPanel info={eventInfo} /> : null}
          {isWorldCup ? <WorldCupOutcomePanel outcomes={outcomes} /> : null}
        </div>

        {/* 右：桌面端嵌入 BetForm；移动端 sticky bottom CTA */}
        <aside className="lg:col-span-4 space-y-6">
          <div className="hidden lg:block glass rounded-3xl p-6 sticky top-24">
            {position ? <PositionSummary position={position} /> : null}
            <h3 className="mt-2 mb-4 font-display text-xl text-ink">立即下注</h3>
            <BetForm row={row} side={selectedSide} compact />
          </div>
        </aside>
      </div>

      {/* 移动端 sticky bottom CTA */}
      <div className="lg:hidden fixed bottom-0 inset-x-0 z-30 p-4 backdrop-blur-md"
           style={{ background: 'rgba(5,6,20,0.85)', borderTop: '1px solid rgba(155,163,199,0.12)' }}>
        <button
          type="button"
          onClick={() => setShowMobileBet(true)}
          className="w-full rounded-2xl border border-arc-glow/40 bg-arc/15 px-4 py-3 text-base font-semibold text-arc-glow transition hover:bg-arc/25"
        >
          立即下注
        </button>
      </div>
      {showMobileBet ? (
        <BetModal row={row} side={selectedSide} onClose={() => setShowMobileBet(false)} />
      ) : null}
    </main>
    <SiteFooter />
  </>
);
```

> 顶部 import 增加：`import { BetForm } from '@/components/BetForm';` `import { BetModal } from '@/components/BetModal';` `import Link from 'next/link';` 以及任何复用的现有组件。

> `selectedSide` 用一个本地 state，默认 `true`（YES）；右侧嵌入卡上方加两个小 tab 让用户切 YES/NO。

```tsx
const [selectedSide, setSelectedSide] = useState(true);
// 在 BetForm 上方渲染
<div className="mb-4 grid grid-cols-2 gap-2">
  <button onClick={() => setSelectedSide(true)} className={selectedSide ? 'rounded-xl border border-yes/40 bg-yes/15 py-2 text-yes' : 'rounded-xl border border-hair py-2 text-ink-2 hover:text-ink'}>YES</button>
  <button onClick={() => setSelectedSide(false)} className={!selectedSide ? 'rounded-xl border border-no/40 bg-no/15 py-2 text-no' : 'rounded-xl border border-hair py-2 text-ink-2 hover:text-ink'}>NO</button>
</div>
```

`PositionSummary` 是详情页内 inline 小组件（如不存在，就 inline 写 4 行：你的份额 / 平均成本 / 当前估值 / 浮盈），不必新建文件。

- [ ] **Step 3: 验证 typecheck**

```bash
pnpm typecheck
```

Expected: PASS

- [ ] **Step 4: 验证 build**

```bash
pnpm build
```

Expected: PASS

- [ ] **Step 5: dev 桌面 + 移动肉眼验**

桌面：左 8 / 右 4 栅格；右侧 BetForm 始终在视野中（sticky top-24）；输入后能下注。
移动：纵向；底部固定按钮；点击唤起抽屉。

- [ ] **Step 6: Commit**

```bash
git add web/app/market/\[id\]/page.tsx
git commit -m "feat(detail): 详情页 12 栅格重排 + 桌面嵌入 BetForm + 移动 sticky CTA"
```

---

## Task E3: ConnectChecklist 组件 + connect 页接入

**Files:**
- Create: `web/components/ConnectChecklist.tsx`
- Modify: `web/app/connect/page.tsx`

- [ ] **Step 1: 创建 ConnectChecklist.tsx**

```tsx
'use client';

import { useAccount, useChainId } from 'wagmi';
import { arcTestnet } from '@/lib/chain';
import { WalletPill } from './WalletPill';

type Props = {
  onAddNetwork: () => void;
  isAddPending: boolean;
  faucetHref?: string;
};

export function ConnectChecklist({ onAddNetwork, isAddPending, faucetHref = '/faucet' }: Props) {
  const { address } = useAccount();
  const chainId = useChainId();

  const step1Done = !!address;
  const step2Done = step1Done && chainId === arcTestnet.id;
  const step3Done = false; // 用户领水成功后会跳走，无需在前端硬判定

  return (
    <ol className="space-y-3">
      <Step
        n={1}
        label="连接钱包"
        done={step1Done}
        active={!step1Done}
        action={<WalletPill />}
      />
      <Step
        n={2}
        label="添加 Arc 网络"
        done={step2Done}
        active={step1Done && !step2Done}
        action={
          <button
            type="button"
            onClick={onAddNetwork}
            disabled={isAddPending || !step1Done}
            className="rounded-xl border border-arc-glow/40 bg-arc/15 px-4 py-2 text-sm font-semibold text-arc-glow transition hover:bg-arc/25 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {isAddPending ? '处理中…' : '一键添加'}
          </button>
        }
      />
      <Step
        n={3}
        label="领取测试 USDC"
        done={step3Done}
        active={step2Done && !step3Done}
        action={
          <a
            href={faucetHref}
            className="rounded-xl border border-hair px-4 py-2 text-sm text-ink-2 transition hover:border-arc-glow/30 hover:text-ink"
          >
            前往领水
          </a>
        }
      />
    </ol>
  );
}

function Step({
  n, label, done, active, action,
}: {
  n: number;
  label: string;
  done: boolean;
  active: boolean;
  action: React.ReactNode;
}) {
  const stateClass = done
    ? 'border-yes/30 bg-yes/5'
    : active
      ? 'border-arc-glow/40 bg-arc/5 shadow-[0_0_40px_-16px_rgba(77,168,255,0.6)]'
      : 'border-hair';
  const bulletClass = done
    ? 'bg-yes/20 text-yes border-yes/40'
    : active
      ? 'bg-arc/20 text-arc-glow border-arc-glow/40'
      : 'bg-bg-2 text-ink-3 border-hair';

  return (
    <li className={`flex items-center gap-3 rounded-2xl border px-4 py-3 transition ${stateClass}`}>
      <span className={`inline-flex h-7 w-7 items-center justify-center rounded-full border font-mono text-sm ${bulletClass}`}>
        {done ? '✓' : n}
      </span>
      <span className="flex-1 text-ink">{label}</span>
      <span>{action}</span>
    </li>
  );
}
```

- [ ] **Step 2: 改写 web/app/connect/page.tsx**

把现有结构改为：

```tsx
'use client';

import Link from 'next/link';
import { useState } from 'react';
import { LogoMark } from '@/components/LogoMark';
import { ConnectChecklist } from '@/components/ConnectChecklist';
import { NetworkBanner } from '@/components/NetworkBanner';
import { SiteFooter } from '@/components/SiteFooter';
import { SiteHeader } from '@/components/SiteHeader';
import { arcTestnet } from '@/lib/chain';

// 保留原 WalletProvider / describeWalletError / DetailRow（DetailRow 内部样式深色化）

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-xl border border-hair bg-bg-2/40 px-4 py-3 text-sm">
      <span className="text-ink-3">{label}</span>
      <span className="overflow-x-auto font-mono text-ink num-glow">{value}</span>
    </div>
  );
}

export default function ConnectPage() {
  const [status, setStatus] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);
  const [showRawParams, setShowRawParams] = useState(false);

  const params = {
    chainId: `0x${arcTestnet.id.toString(16)}`,
    chainName: arcTestnet.name,
    nativeCurrency: arcTestnet.nativeCurrency,
    rpcUrls: arcTestnet.rpcUrls.default.http,
    blockExplorerUrls: [arcTestnet.blockExplorers!.default.url],
  };

  const addArcNetwork = async () => {
    // 保留原实现，仅把 setStatus 文案保持中文
  };

  return (
    <>
      <NetworkBanner />
      <SiteHeader />
      <main className="relative z-10 mx-auto max-w-3xl px-4 py-16 sm:py-24">
        <div className="mb-10 flex flex-col items-center text-center">
          <LogoMark size={96} />
          <h1 className="mt-6 font-display text-4xl text-ink">ArcPredict</h1>
          <p className="mt-3 text-ink-2">欢迎进入 Arc 链上预测市场</p>
          <p className="text-ink-3 text-sm">连接钱包并切换到 Arc Testnet</p>
        </div>

        <div className="glass rounded-3xl p-6">
          <ConnectChecklist onAddNetwork={addArcNetwork} isAddPending={isPending} />
          {status ? (
            <div className="mt-4 rounded-xl border border-no/30 bg-no/10 px-4 py-3 text-sm text-no">{status}</div>
          ) : null}

          <button
            type="button"
            onClick={() => setShowRawParams((v) => !v)}
            className="mt-6 text-sm text-ink-3 hover:text-ink-2 transition"
          >
            展开网络参数 · 手动配置 {showRawParams ? '↑' : '↓'}
          </button>
          {showRawParams ? (
            <div className="mt-4 space-y-2">
              <DetailRow label="Chain ID" value={params.chainId} />
              <DetailRow label="Chain Name" value={params.chainName} />
              <DetailRow label="RPC URL" value={params.rpcUrls[0]} />
              <DetailRow label="Explorer" value={params.blockExplorerUrls[0]} />
            </div>
          ) : null}

          <div className="mt-6 text-center">
            <Link href="/" className="text-sm text-ink-2 hover:text-arc-glow transition">
              已配置好？回首页 →
            </Link>
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
```

> `addArcNetwork` 函数体保留原实现（与 ethereum.request 交互、describeWalletError 处理）。这里只展示骨架，避免重复粘贴 30 行业务代码。

- [ ] **Step 3: 验证 typecheck 与 build**

```bash
pnpm typecheck && pnpm build
```

Expected: 二者 PASS

- [ ] **Step 4: dev 肉眼验**

http://localhost:3000/connect：三步走面板出现；未连接时 step1 active 蓝色发光；连接后 step1 √ 绿、step2 active；切到 Arc 后 step2 √。

- [ ] **Step 5: Commit**

```bash
git add web/components/ConnectChecklist.tsx web/app/connect/page.tsx
git commit -m "feat(connect): 连接页三步走清单 + DetailRow 深色化"
```

---

# 期 F · 收尾

完成后：可访问性扫描通过、截图基线建立、清理向后兼容别名、README 更新（可选）。

---

## Task F1: prefers-reduced-motion 校验 + 焦点环全站扫描

**Files:**
- 验证型任务，可能修改若干组件补焦点环

- [ ] **Step 1: 在 macOS 系统设置启用减弱动效**

> 设置 → 辅助功能 → 显示 → 减弱动效（勾选）

- [ ] **Step 2: dev 跑一遍**

```bash
cd web && pnpm dev
```

访问首页、详情页、连接页：所有动效应该消失或瞬时完成。如发现某动效仍然运行，定位到该 CSS 并改用 `@media (prefers-reduced-motion: reduce)` 包裹的禁用规则（已在 globals.css 中有全局兜底，正常应自动禁用）。

- [ ] **Step 3: 焦点环全站 Tab 一遍**

每个可交互元素 Tab 一次，检查焦点环为 `ring-2 ring-arc-glow ring-offset-2 ring-offset-bg-0` 类型的发光蓝环。缺失的元素手动追加：

```tsx
className="… focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-arc-glow/60 focus-visible:ring-offset-2 focus-visible:ring-offset-bg-0"
```

逐个 grep 检查：

```bash
cd web
grep -rn "onClick" components/ app/ | grep -v "focus-visible" | head
```

对每个未带 focus-visible 的 onClick 元素逐一补样式。

- [ ] **Step 4: 验证 typecheck 与 build**

```bash
pnpm typecheck && pnpm build
```

Expected: PASS

- [ ] **Step 5: Commit（仅在确实有修改时）**

```bash
git add -A
git diff --cached --stat
git commit -m "fix(a11y): 补齐焦点环 + prefers-reduced-motion 校验"
```

如无修改，跳过本 commit。

---

## Task F2: 移除 canvas / paper 兼容别名

**Files:**
- Modify: `web/tailwind.config.ts`

- [ ] **Step 1: grep 是否还有遗留**

```bash
cd web
grep -rn "bg-canvas\|bg-paper\|text-canvas\|text-paper\|border-canvas\|border-paper" app/ components/
```

Expected: 应只剩注释或 0 命中。如还有引用，定位到对应文件并替换为对应深色 token：

```
bg-canvas → bg-bg-0
bg-paper  → bg-bg-1
text-canvas → text-bg-0
text-paper  → text-bg-1
border-canvas / border-paper → border-hair
```

- [ ] **Step 2: 删除 tailwind.config.ts 中的兼容别名**

定位 Task A1 中插入的：

```ts
// 向后兼容：保留旧名 canvas/paper 暂指向新背景，期 B–E 中各组件会迁移走
canvas: '#050614',
paper: '#0A0B1E',
```

删掉这三行 + 注释。

- [ ] **Step 3: 验证 typecheck 与 build**

```bash
pnpm typecheck && pnpm build
```

Expected: 二者 PASS（若 build 失败说明还有遗留 `canvas` / `paper` 使用，回到 Step 1）

- [ ] **Step 4: Commit**

```bash
git add web/tailwind.config.ts
git commit -m "chore(theme): 移除 canvas/paper 兼容别名"
```

---

## Task F3: 视觉回归截图基线

**Files:**
- Create: `web/test/screenshot.mjs`
- Create: 截图存档目录 `web/test/snapshots/synthra-redesign/`

- [ ] **Step 1: 确保已装 puppeteer 或 playwright**

```bash
cd web
pnpm list playwright || pnpm add -D playwright
npx playwright install chromium
```

- [ ] **Step 2: 创建截图脚本 web/test/screenshot.mjs**

```js
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';

const baseUrl = process.env.BASE_URL ?? 'http://localhost:3000';
const outDir = resolve('test/snapshots/synthra-redesign/final');

await mkdir(outDir, { recursive: true });

const browser = await chromium.launch();
const viewports = [
  { name: 'desktop', width: 1280, height: 800 },
  { name: 'mobile', width: 390, height: 844 },
];
const pages = [
  { name: 'home', path: '/' },
  { name: 'connect', path: '/connect' },
  // 详情页需要一个真实存在的 market id；运行时改成实际 id。
  // { name: 'detail', path: '/market/1' },
];

for (const vp of viewports) {
  const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
  for (const p of pages) {
    const page = await context.newPage();
    await page.goto(`${baseUrl}${p.path}`, { waitUntil: 'networkidle' });
    await page.screenshot({ path: `${outDir}/${vp.name}-${p.name}.png`, fullPage: true });
    await page.close();
  }
  await context.close();
}

await browser.close();
console.log(`Snapshots written to ${outDir}`);
```

- [ ] **Step 3: 起 dev server 后跑截图**

终端 A：

```bash
cd web && pnpm dev
```

终端 B：

```bash
cd web && node test/screenshot.mjs
```

Expected: `test/snapshots/synthra-redesign/final/` 下出现 `desktop-home.png` / `desktop-connect.png` / `mobile-home.png` / `mobile-connect.png`，每张能直接打开看且视觉符合 spec。

- [ ] **Step 4: 肉眼审 4 张截图**

打开每张图，对照设计 spec 检查：
- desktop-home：极光背景、Hero 大标题渐变、卡片 3 列、玻璃感
- desktop-connect：三步走清单
- mobile-home：单列卡片、玻璃 header
- mobile-connect：清单纵向

如发现不符之处，记下问题、回到对应期 task 修复，然后重新截图覆盖。

- [ ] **Step 5: Commit 基线截图**

```bash
git add web/test/screenshot.mjs web/test/snapshots/
git commit -m "test(visual): Synthra 改造 final 截图基线"
```

---

## Task F4: 全套 pnpm build + 测试 + 总收官 commit

**Files:**
- 无新文件，纯验证

- [ ] **Step 1: 跑完整套测试**

```bash
cd web
pnpm typecheck
pnpm lint
pnpm build
pnpm vitest run
node test/check_home_page.mjs
node test/check_market_filter.mjs
node test/check_worldcup_data_layer.mjs
node test/check_flag_bundle.mjs
```

Expected: 全 PASS

- [ ] **Step 2: 最终 dev 三页面走查**

http://localhost:3000 / http://localhost:3000/connect / http://localhost:3000/market/{真实id}：每个页面手工触发：
- 钱包未连接 / 连接 / 错网络 三态
- 类别切换（crypto ↔ worldcup）背景 variant 同步
- BetModal 桌面 / 移动抽屉
- Esc 关闭模态
- prefers-reduced-motion 系统开关切换

- [ ] **Step 3: 收官 commit（如果有未提交的尾巴）**

```bash
git status
```

如有未跟踪文件或未提交修改，分类 commit；否则跳过。

```bash
git log --oneline | head -30
```

确认期 A–F 所有 task 的 commit 都在历史里。

---

## 完成标志

- [ ] 期 A–F 全部 task 勾选完成
- [ ] 期 F4 全套测试 PASS
- [ ] 4 张基线截图存档
- [ ] 浏览器标签栏显示新 favicon
- [ ] 桌面 / 移动两套体验均无视觉/交互回归

