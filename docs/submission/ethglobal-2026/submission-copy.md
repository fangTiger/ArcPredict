# ETHGlobal Submission Copy

## Short Description

USDC prediction markets on Arc for crypto prices and World Cup events.

## Description

ArcPredict is a browser-first prediction market built on Circle Arc testnet. Users connect a wallet, browse live crypto and World Cup markets, place USDC bets into parimutuel pools, track open positions, and claim payouts after settlement. The current app supports Pyth-backed binary crypto price markets such as BTC/ETH threshold predictions, plus multi-outcome event markets for World Cup-style 1X2, spread, and winner boards. The product is intentionally lean: no AMM, no transferable outcome tokens, and no backend indexer in the core path. It focuses on making testnet USDC prediction markets feel fast, visual, and usable.

## How It's Made

ArcPredict uses Solidity 0.8.24 contracts with Foundry tests and deployment scripts. `PredictionMarket` handles binary price markets settled by Pyth price updates, while `EventMarket` supports multi-outcome event markets through an `AdminEventOracle` with a 72-hour dispute window. Funds are handled as Arc testnet USDC using OpenZeppelin `SafeERC20`, with parimutuel payout math and protocol fee snapshots per market. The frontend is a Next.js 14 App Router app written in TypeScript, styled with Tailwind, and connected through wagmi, viem, RainbowKit, and TanStack Query. The app reads dashboard state directly from contracts, refreshes live market data, supports wallet betting modals, position views, filters, infinite loading, and a Synthra-inspired dark visual redesign. The hacky part is keeping the MVP mostly backendless while still supporting seeded markets, event adapters, and ops scripts for resolving due markets and topping up seed wallets.
