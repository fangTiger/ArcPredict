# Handoff Task Package: refresh-market-interface-style

- ChangeId: `refresh-market-interface-style`
- TaskId: `style-refresh-vertical`
- AgentId: `worker-codex-style-refresh-001`
- SliceId: `market-interface-style-vertical`
- Executor: Implementation Codex (`worker-codex`, configured `gpt-5.4` + `xhigh`)
- IntegrationOwner: Architecture Codex
- ReviewOwner: Review Codex (`review-codex`, configured `gpt-5.4` + `xhigh`)
- GitBaseline: `2030189408f6b3f74f35c4b8f962f3394719be99`
- SessionStatePath: `.codex/session-state.md`
- Patch artifact / worktree path: shared project workspace; handback via changed files + evidence

## Context

The previous change `add-rich-market-surfaces` is committed as `2030189 feat(web): enrich market discovery surfaces` and archived into `openspec/specs/rich-market-surfaces/spec.md`.

The user now wants ArcPredict to feel less AI-generated and closer to Polymarket's restrained prediction-market browsing style. The goal is not to copy Polymarket branding. Borrow only the product rhythm: compact market browser, category/topic strips, flat market cards, Yes/No actions, clear probability and volume hierarchy.

## Reference Notes

- Polymarket homepage text/source shows top Browse filters such as New, Trending, Popular, Liquid, Ending Soon and topic strips such as Sports, Crypto, Tech, AI.
- Public screenshots show a mostly neutral surface, dense market cards, compact category tabs, probability chips, Yes/No buttons, and volume metadata.
- ArcPredict should remain ArcPredict: Arc Testnet, on-chain positions, AI Lens controls, World Cup/Macro/On-chain categories and wallet flow stay intact.

## OpenSpec

- Proposal: `openspec/changes/refresh-market-interface-style/proposal.md`
- Design: `openspec/changes/refresh-market-interface-style/design.md`
- Tasks: `openspec/changes/refresh-market-interface-style/tasks.md`
- Spec delta: `openspec/changes/refresh-market-interface-style/specs/market-interface-style/spec.md`
- Validation already passed: `openspec validate refresh-market-interface-style --strict --no-interactive`

## Graphify Context

- Structure query: `graphify query "web homepage market cards visual style layout dependencies"`
  - Relevant hits: `MarketFilterBar.tsx`, `WorldCupMarketCard.tsx`, `check_home_page.mjs`, `check_market_components.mjs`, `check_market_filter.mjs`.
- Impact query: `graphify query "web globals css market card home detail visual impact callers tests dependencies"`
  - Relevant hits: `CryptoMarketCard.tsx`, `WorldCupMarketCard.tsx`, `BaseMarketCard.tsx`, `MarketDetailCard.tsx`, `MarketCard.tsx`.
- Degradation note: graph coverage predates some newly added rich-section components, so use source/tests in addition to Graphify.

## Editable Files

- `openspec/changes/refresh-market-interface-style/tasks.md`
- `web/app/globals.css`
- `web/tailwind.config.ts`
- `web/app/page.tsx`
- `web/app/market/[id]/page.tsx`
- `web/components/SiteHeader.tsx`
- `web/components/WalletPill.tsx`
- `web/components/HomeHero.tsx`
- `web/components/HeroParticleCanvas.tsx` only if removal or non-primary retirement is needed
- `web/components/ArcBackground.tsx`
- `web/components/BaseMarketCard.tsx`
- `web/components/CryptoMarketCard.tsx`
- `web/components/WorldCupMarketCard.tsx`
- `web/components/WorldCupOutcomePanel.tsx`
- `web/components/MarketFilterBar.tsx`
- `web/components/MarketDiscoveryRail.tsx`
- `web/components/ThemeMarketBoard.tsx`
- `web/components/MarketDetailCard.tsx`
- `web/components/MarketStoryPanel.tsx`
- `web/components/ActivityTimeline.tsx`
- `web/components/RelatedMarketsPanel.tsx`
- `web/components/MarketCategoryIcon.tsx`
- `web/components/PositionStripe.tsx`
- `web/components/PositionList.tsx`
- `web/components/ResolvedList.tsx`
- `web/components/SettlementTimeline.tsx`
- `web/components/AILensCompact.tsx`
- `web/components/AILensPanel.tsx`
- `web/components/BetForm.tsx`
- `web/components/EventBetModal.tsx`
- `web/components/BetModal.tsx`
- `web/test/check_market_interface_style.mjs`
- `web/test/check_home_hero.mjs`
- `web/test/check_home_page.mjs`
- `web/test/check_market_components.mjs`
- `web/test/check_market_filter.mjs`
- `web/test/check_site_chrome.mjs`
- relevant `web/components/__tests__/**` for changed components

## Forbidden Files

- `contracts/**`
- `.env*`, `contracts/.env*`, `web/.env*` except existing examples are not needed
- `web/package.json`, `web/pnpm-lock.yaml`, `web/next.config.*`, `web/tsconfig.json`, `web/postcss.config.*`
- `.codex/agents/**`, `.codex/skills/**`
- `openspec/specs/**` until final archive
- unrelated data ingestion, cron, oracle, deployment, address, ABI, or contract scripts

## Acceptance Criteria

- Homepage no longer looks like a neon AI landing page.
- Primary browsing surfaces use light neutral product UI, thin borders, low shadows, and compact rows/cards.
- Header and filters feel like a market browser: search/browse affordance plus compact category/topic strip.
- Home summary replaces decorative Hero: no `HeroParticleCanvas` on homepage primary Hero.
- Market cards are flat probability cards; Yes/No or outcome actions remain clear and clickable.
- Detail page keeps trading, SettlementTimeline, AILensPanel, market story, related markets and activity timeline, but uses the same compact panel language.
- No fake trend/history/social data is introduced.
- AI Lens is still user-triggered or existing preload only; no homepage auto POST.
- Mobile and desktop have no incoherent overlap or hidden primary actions.

## Out Of Scope

- Legal/compliance work.
- Copying Polymarket logo, exact brand, proprietary assets, or text.
- New data providers, comments, social feed, rankings, or external services.
- Contract/oracle/betting semantic changes.
- Wallet connection flow redesign beyond surface styling.

## Validation

Worker must provide RED/GREEN evidence and final verification:

- `cd web && node test/check_market_interface_style.mjs`
- `cd web && node test/check_home_hero.mjs`
- `cd web && node test/check_home_page.mjs`
- `cd web && node test/check_market_components.mjs`
- `cd web && node test/check_market_filter.mjs`
- `cd web && pnpm exec vitest run test/market-richness.test.ts test/theme-market-pages.test.ts components/__tests__/ThemeMarketBoard.test.tsx components/__tests__/MarketDiscoveryRail.test.tsx components/__tests__/MarketStoryPanel.test.tsx`
- `cd web && pnpm typecheck`
- `cd web && pnpm build`
- `openspec validate refresh-market-interface-style --strict --no-interactive`

Architecture Codex will additionally perform browser checks on desktop and mobile.

## Stop Conditions

- Any need to edit Forbidden files.
- Any change to contract, oracle, bet placement, wallet auth, Lens trigger semantics, or external services.
- Any inability to provide RED evidence for new style guard checks.
- Build/typecheck failures that cannot be resolved within editable scope.
- Visual result still dominated by neon/glass/particle/large-gradient language after implementation.

## PreExistingDirtyBaseline

- `openspec/changes/refresh-market-interface-style/**`
- `docs/plans/2026-06-25-market-interface-style-handoff.md`

These are proposal/handoff artifacts created by Architecture Codex before worker implementation.

## Handback Required

Implementation Codex must return:

- Changed files.
- RED evidence.
- GREEN evidence.
- Final verification commands and key outputs.
- Requirement coverage matrix.
- Unverified items and remaining risk.
- Any scope expansion request before editing outside allowlist.
