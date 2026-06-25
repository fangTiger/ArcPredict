# Design: Polymarket-Inspired ArcPredict Interface Refresh

## Style Reference

Primary reference: Polymarket homepage and market browsing surfaces, inspected on 2026-06-25. Useful patterns:

- A top search / browse rhythm with compact category chips.
- Featured and standard market cards arranged as a practical trading feed.
- Market cards emphasize title, category, probability, Yes/No actions, and volume.
- Visual style is restrained: mostly neutral surfaces, thin borders, compact rows, low decoration.

We will not reproduce Polymarket branding. ArcPredict keeps its own name, Arc Testnet context, market categories, and on-chain affordances.

## Visual System

- Theme: light market terminal.
- Background: neutral off-white page with white/elevated panels and subtle grey borders.
- Primary accent: Arc blue used for active filters, links, focus rings, and selected states.
- Semantic colors: green for Yes / positive side, red for No / negative side, amber only for urgency.
- Radius: standard 8px; larger 10-12px only for major panels and modals.
- Shadows: minimal, mostly none; use borders and background contrast instead of glow.
- Motion: no particle hero, no drifting blobs, no decorative pulsing except essential status indicators. Hover should be color/border shift only.
- Typography: keep existing font stack for compatibility, but remove display-serif hero treatment from primary market browsing surfaces.

## Homepage Layout

The homepage should feel like a market browser, not a landing page.

1. Header becomes a dense product nav:
   - left: logo;
   - middle: search-like browse field or compact market finder affordance;
   - right: network and wallet.
2. Hero becomes a compact market summary strip:
   - title and category context;
   - open markets, pending markets, network;
   - category quick links.
3. Rich sections become compact panels:
   - Today board looks like a featured market row/card, not a glossy hero.
   - Trending / Closing Soon / Recently Resolved become list panels with dense rows.
4. Filter bar becomes a horizontal browse strip similar to prediction-market category tabs.
5. Market grid cards become denser and flatter.

## Card System

Market cards SHALL:

- Use white or neutral panel backgrounds with thin borders.
- Avoid decorative SVG rings, glass blur, neon shadows, and huge display titles.
- Place category/status metadata above the title.
- Keep title readable at compact sizes.
- Show probability and pool/liquidity close to actions.
- Use Yes/No buttons as the most prominent interactive controls.
- Preserve separate detail link and betting buttons.

## Detail Page

Detail pages should read like a market profile plus trading ticket:

- Main market panel is flat, bordered, and compact.
- Trading ticket can remain sticky on desktop.
- Story / related / activity panels should use the same compact panel language.
- Existing SettlementTimeline and AILensPanel remain available and user-triggered.

## Tests And Verification

Add static visual guard checks rather than screenshot-only assertions:

- Primary homepage components SHALL not import or render `HeroParticleCanvas`.
- Primary market cards SHALL not rely on `.glass`, `.num-glow`, heavy SVG decoration, or large `rounded-3xl` shells.
- Tailwind tokens SHALL include light neutral background/ink values.
- Homepage SHALL still include rich sections, filters, market grid, and position stripe.
- Market card tests SHALL continue to verify buttons are not nested inside detail links.

Use Playwright/browser verification after implementation to inspect desktop and mobile rendering.
