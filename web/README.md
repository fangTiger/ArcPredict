# ArcPredict Web

Next.js frontend for ArcPredict. The app renders Crypto prediction markets by default and can expose event-based World Cup markets behind a feature flag.

## Market Categories

ArcPredict currently has two market categories:

| Category | Contract path | Data source | Notes |
| --- | --- | --- | --- |
| Crypto | `PredictionMarket` | Pyth price oracle | Existing binary YES / NO markets, wallet, Faucet, bet and claim flow. |
| World Cup | `EventMarket` + `AdminEventOracle` | Static seed + optional TheSportsDB display score | N-outcome event markets. Live score is informational only and never drives settlement. |

Feature flags and API overrides:

- `NEXT_PUBLIC_WORLDCUP_ENABLED=false` hides the World Cup category and returns the UI to Crypto-only mode. Any other value, including unset, enables the category.
- `NEXT_PUBLIC_SPORTSDB_API_BASE` or `SPORTSDB_API_BASE` overrides the TheSportsDB base URL used by `web/lib/event-source.ts`.
- Local development can use `?wcScoreApiBase=<base-url>` and `?wcLiveScoreFixture=1` to exercise live-score UI without changing deployed env.

Operational details for owner result submission, disputes, bonus bank funding, score API fallback and emergency rollback are in `../docs/worldcup-category-runbook.md`.

## Commands

```bash
pnpm exec vitest run
pnpm typecheck
pnpm build
```

For World Cup score degradation coverage:

```bash
pnpm exec vitest run test/event-source.degradation.test.tsx
```
