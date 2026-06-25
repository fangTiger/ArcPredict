# Change: Refresh ArcPredict Market Interface Style

## Why

ArcPredict now has richer market surfaces, but the visual language still leans too heavily on dark glass panels, glow effects, large rounded cards, particle motion, and gradient display type. The next product step is to make the website feel more like a practical prediction-market trading surface: dense, readable, calm, and credible.

The user specifically wants to reduce the AI-generated feel and use Polymarket as a style reference. We will borrow the product pattern, not the brand: clean market browsing, compact category strips, probability-first cards, restrained buttons, and low-decoration layout.

## What Changes

- Replace the current neon/glass/particle-led homepage tone with a light, neutral, trading-product visual system.
- Rework the homepage hierarchy around search/category rhythm, compact rich sections, and dense market cards.
- Redesign market cards to prioritize title, probability, volume/liquidity, status, and Yes/No actions with restrained colors.
- Rework detail-page panels to feel like a market profile and trading ticket rather than a large decorative dashboard.
- Add static style guard checks that prevent regressions to heavy glow, large decorative gradients, and particle Hero UI on the primary homepage surfaces.
- Preserve all existing data sources, betting behavior, AI Lens trigger behavior, event market support, and rich-section derivations.

## Impact

- Affected specs: new `market-interface-style`, related to existing `rich-market-surfaces`.
- Expected code impact:
  - `web/app/globals.css`
  - `web/tailwind.config.ts`
  - `web/app/page.tsx`
  - `web/app/market/[id]/page.tsx`
  - `web/components/SiteHeader.tsx`
  - `web/components/HomeHero.tsx`
  - `web/components/BaseMarketCard.tsx`
  - `web/components/CryptoMarketCard.tsx`
  - `web/components/WorldCupMarketCard.tsx`
  - `web/components/MarketFilterBar.tsx`
  - `web/components/MarketDiscoveryRail.tsx`
  - `web/components/ThemeMarketBoard.tsx`
  - `web/components/MarketDetailCard.tsx`
  - `web/components/ActivityTimeline.tsx`
  - `web/components/MarketStoryPanel.tsx`
  - `web/components/RelatedMarketsPanel.tsx`
  - relevant `web/test/**` and `web/components/__tests__/**`
- Out of scope:
  - Do not copy Polymarket branding, logo, exact text, or proprietary assets.
  - Do not add legal/compliance work.
  - Do not add new data providers, social feeds, comments, or external services.
  - Do not change contracts, oracle behavior, bet placement semantics, or wallet connection flow.
