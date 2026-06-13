# Graph Report - ArcPredict  (2026-06-12)

## Corpus Check
- 80 files · ~112,004 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 307 nodes · 319 edges · 22 communities detected
- Extraction: 87% EXTRACTED · 13% INFERRED · 0% AMBIGUOUS · INFERRED: 43 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Community 0|Community 0]]
- [[_COMMUNITY_Community 1|Community 1]]
- [[_COMMUNITY_Community 2|Community 2]]
- [[_COMMUNITY_Community 3|Community 3]]
- [[_COMMUNITY_Community 4|Community 4]]
- [[_COMMUNITY_Community 5|Community 5]]
- [[_COMMUNITY_Community 6|Community 6]]
- [[_COMMUNITY_Community 7|Community 7]]
- [[_COMMUNITY_Community 8|Community 8]]
- [[_COMMUNITY_Community 10|Community 10]]
- [[_COMMUNITY_Community 11|Community 11]]
- [[_COMMUNITY_Community 12|Community 12]]
- [[_COMMUNITY_Community 13|Community 13]]
- [[_COMMUNITY_Community 14|Community 14]]
- [[_COMMUNITY_Community 15|Community 15]]
- [[_COMMUNITY_Community 16|Community 16]]
- [[_COMMUNITY_Community 17|Community 17]]
- [[_COMMUNITY_Community 19|Community 19]]
- [[_COMMUNITY_Community 20|Community 20]]
- [[_COMMUNITY_Community 24|Community 24]]
- [[_COMMUNITY_Community 31|Community 31]]
- [[_COMMUNITY_Community 34|Community 34]]

## God Nodes (most connected - your core abstractions)
1. `assert()` - 27 edges
2. `test()` - 13 edges
3. `resolveDueMarkets()` - 8 edges
4. `MockIntersectionObserver` - 6 edges
5. `decodeMarketSnapshot()` - 5 edges
6. `decodeScannedMarket()` - 5 edges
7. `MockHermesClient` - 4 edges
8. `validateConfig()` - 4 edges
9. `main()` - 4 edges
10. `runScheduleOnce()` - 4 edges

## Surprising Connections (you probably didn't know these)
- `parseMarketId()` --calls--> `test()`  [INFERRED]
  web/app/market/[id]/page.tsx → contracts/script/ops/test/check_market_scan.ts
- `assertIncludesAll()` --calls--> `assert()`  [INFERRED]
  web/test/check_position_lists.mjs → web/test/check_providers_layout.mjs
- `assertExcludesAll()` --calls--> `assert()`  [INFERRED]
  web/test/check_position_lists.mjs → web/test/check_providers_layout.mjs
- `assertMatches()` --calls--> `test()`  [INFERRED]
  web/test/check_phase16_integration.mjs → contracts/script/ops/test/check_market_scan.ts
- `assertMatches()` --calls--> `test()`  [INFERRED]
  web/test/check_home_page.mjs → contracts/script/ops/test/check_market_scan.ts

## Communities

### Community 0 - "Community 0"
Cohesion: 0.08
Nodes (27): assertExcludesAll(), assertIncludesAll(), assertMatches(), assertNeedsApproveUsesFreshApproval(), assertReadHookHasChainId(), assertReadingAllowanceUsesFreshApproval(), assertSwitchChainReturns(), assertUseClient() (+19 more)

### Community 1 - "Community 1"
Cohesion: 0.2
Nodes (9): countKnownSnapshotMarkets(), decodeScannedMarket(), listSnapshotMarketIds(), main(), readMarketField(), runScheduleOnce(), toBigIntValue(), toNumberValue() (+1 more)

### Community 2 - "Community 2"
Cohesion: 0.15
Nodes (3): idsOfCrypto(), idsOfWorldCup(), filterMarkets()

### Community 3 - "Community 3"
Cohesion: 0.25
Nodes (10): getPriceUpdatesAtTimestamp(), readContract(), writeContract(), decodeMarketSnapshot(), isDueUnresolvedMarket(), main(), readMarketField(), resolveDueMarkets() (+2 more)

### Community 4 - "Community 4"
Cohesion: 0.18
Nodes (4): fillBucket(), makeMarket(), totalActive(), validateConfig()

### Community 5 - "Community 5"
Cohesion: 0.24
Nodes (4): existingSeedsFromFile(), parseGenerationArgs(), parsePositiveInteger(), parseSeedFileContent()

### Community 6 - "Community 6"
Cohesion: 0.2
Nodes (1): MockIntersectionObserver

### Community 7 - "Community 7"
Cohesion: 0.29
Nodes (5): formatAddressList(), formatReport(), main(), scanWallets(), shouldExitWithFailure()

### Community 8 - "Community 8"
Cohesion: 0.31
Nodes (5): CryptoMarketCard(), deriveAssetLabel(), formatOddsMultiple(), formatThresholdValue(), groupThousands()

### Community 10 - "Community 10"
Cohesion: 0.29
Nodes (1): MockHermesClient

### Community 11 - "Community 11"
Cohesion: 0.29
Nodes (1): StubHermes

### Community 12 - "Community 12"
Cohesion: 0.4
Nodes (4): assertExcludesAll(), assertIncludesAll(), assertUseClient(), firstEffectiveLine()

### Community 13 - "Community 13"
Cohesion: 0.4
Nodes (4): assertExcludesAll(), assertIncludesAll(), assertUseClient(), firstEffectiveLine()

### Community 14 - "Community 14"
Cohesion: 0.4
Nodes (2): buildCurvePoints(), clampProbability()

### Community 15 - "Community 15"
Cohesion: 0.4
Nodes (1): parseMarketId()

### Community 16 - "Community 16"
Cohesion: 0.5
Nodes (2): makeMarket(), makeRow()

### Community 17 - "Community 17"
Cohesion: 0.5
Nodes (3): assertIncludesAll(), assertUseClient(), firstEffectiveLine()

### Community 19 - "Community 19"
Cohesion: 0.6
Nodes (3): handleConfirm(), humanizeError(), placeBetAfterApprove()

### Community 20 - "Community 20"
Cohesion: 0.5
Nodes (2): runCli(), validatePhase16ManualQaDoc()

### Community 24 - "Community 24"
Cohesion: 0.67
Nodes (2): claim(), waitForClaimReceipt()

### Community 31 - "Community 31"
Cohesion: 0.67
Nodes (1): assertIncludesAll()

### Community 34 - "Community 34"
Cohesion: 1.0
Nodes (2): normalizeVariant(), syncVariant()

## Knowledge Gaps
- **Thin community `Community 6`** (10 nodes): `flushPromises()`, `Harness()`, `MockIntersectionObserver`, `.constructor()`, `.disconnect()`, `.emit()`, `.observe()`, `.unobserve()`, `setVisibility()`, `event-source.test.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 10`** (7 nodes): `loadTsModule()`, `MockHermesClient`, `.constructor()`, `.getLatestPriceUpdates()`, `.getPriceUpdatesAtTimestamp()`, `resolveTsSpecifier()`, `check_pyth_helper.mjs`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 11`** (7 nodes): `normalizeId()`, `StubHermes`, `.constructor()`, `.getLatestPriceUpdates()`, `stubWithResponse()`, `test()`, `check_hermes.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 14`** (6 nodes): `buildCurvePoints()`, `clampProbability()`, `deltaLabel()`, `formatProbability()`, `ImpliedProbabilityChart()`, `ImpliedProbabilityChart.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 15`** (5 nodes): `isInvalidMarketError()`, `loadSeedBetEvents()`, `parseMarketId()`, `shortAddress()`, `page.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 16`** (5 nodes): `loadTsModule()`, `makeMarket()`, `makeRow()`, `resolveTsSpecifier()`, `check_derive_position.mjs`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 20`** (5 nodes): `runCli()`, `expectFailure()`, `validatePhase16ManualQaDoc()`, `check_phase16_manual_qa.mjs`, `check_phase16_manual_qa_selftest.mjs`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 24`** (4 nodes): `claim()`, `humanizeError()`, `waitForClaimReceipt()`, `ResolvedList.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 31`** (3 nodes): `assertIncludesAll()`, `readRequiredText()`, `check_site_chrome.mjs`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 34`** (3 nodes): `normalizeVariant()`, `syncVariant()`, `ArcBackground.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `assert()` connect `Community 0` to `Community 17`, `Community 12`, `Community 13`, `Community 31`?**
  _High betweenness centrality (0.050) - this node is a cross-community bridge._
- **Why does `test()` connect `Community 0` to `Community 4`, `Community 15`?**
  _High betweenness centrality (0.047) - this node is a cross-community bridge._
- **Why does `validateConfig()` connect `Community 4` to `Community 0`, `Community 1`?**
  _High betweenness centrality (0.023) - this node is a cross-community bridge._
- **Are the 25 inferred relationships involving `assert()` (e.g. with `assertIncludesAll()` and `assertExcludesAll()`) actually correct?**
  _`assert()` has 25 INFERRED edges - model-reasoned connections that need verification._
- **Are the 12 inferred relationships involving `test()` (e.g. with `parseMarketId()` and `assertMatches()`) actually correct?**
  _`test()` has 12 INFERRED edges - model-reasoned connections that need verification._
- **Are the 3 inferred relationships involving `resolveDueMarkets()` (e.g. with `readContract()` and `getPriceUpdatesAtTimestamp()`) actually correct?**
  _`resolveDueMarkets()` has 3 INFERRED edges - model-reasoned connections that need verification._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.08 - nodes in this community are weakly interconnected._