# Change: Align World Cup on-chain seed with 2026 format

## Why

The frontend World Cup seed has moved to the 2026 tournament format with 48 teams, 12 groups, 72 group matches, and a Round of 32. The on-chain `EventMarket` and deployment seed scripts still cap winner markets at 32 outcomes and still use the 2022 seed/event id, so a 2026 winner market cannot be created consistently end to end.

## What Changes

- Raise `EventMarket.createMarket`'s valid outcome range from `[2, 32]` to `[2, 48]`.
- Require the World Cup winner market to use 48 outcomes for the 2026 participant field.
- Update on-chain World Cup seed JSON and scripts to use 48 teams, 72 group matches, 146 seeded markets, and `worldcup-2026` winner event ids.
- Update Foundry tests to cover 48-outcome creation, E2E winner settlement, and the 2026 seed script counts.

## Impact

- Affected spec: `worldcup-category`
- Affected contracts: `contracts/src/EventMarket.sol`
- Affected scripts/data: World Cup deployment and E2E seed scripts under `contracts/script/`
- Affected tests: `contracts/test/EventMarket.t.sol`, `contracts/test/EventMarketE2E.t.sol`, `contracts/test/SeedWorldCupMarketsScript.t.sol`
