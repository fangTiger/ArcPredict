// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Test} from "forge-std/Test.sol";
import {stdJson} from "forge-std/StdJson.sol";
import {SeedWorldCupMarkets} from "../script/SeedWorldCupMarkets.s.sol";
import {EventMarket} from "../src/EventMarket.sol";

contract SeedWorldCupMarketsHarness is SeedWorldCupMarkets {
    function loadSeedPublic(string memory path) external view returns (WorldCupSeed memory) {
        return _loadSeed(path);
    }

    function normalizedKickoffPublic(uint256 originalKickoff, uint256 originalFirstKickoff, uint256 targetFirstKickoff)
        external
        pure
        returns (uint64)
    {
        return _normalizedKickoff(originalKickoff, originalFirstKickoff, targetFirstKickoff);
    }

    function eventIdPublic(string memory marketType, string memory seedId) external pure returns (bytes32) {
        return _eventId(marketType, seedId);
    }

    function createMarketsFromPathAsOwnerPublic(
        EventMarket eventMarket,
        string memory path,
        uint256 targetFirstKickoff,
        address marketOwner
    ) external {
        WorldCupSeed memory seed = _loadSeed(path);
        vm.startPrank(marketOwner);
        _createGroupMarkets(eventMarket, seed, targetFirstKickoff);
        _createFinal1x2Market(eventMarket, seed, targetFirstKickoff);
        _createWinnerMarket(eventMarket, seed.teamIds.length, targetFirstKickoff);
        vm.stopPrank();
    }
}

contract SeedWorldCupMarketsScriptTest is Test {
    using stdJson for string;

    uint256 internal constant OWNER_PRIVATE_KEY = 0xA11CE;
    string internal constant SEED_PATH = "script/data/worldcup-seed.json";
    uint256 internal constant START_TIME = 1_700_000_000;
    uint256 internal constant FIRST_KICKOFF_DELAY = 1 days;
    uint256 internal constant ORIGINAL_FIRST_KICKOFF = 1_668_960_000;

    SeedWorldCupMarketsHarness internal harness;
    EventMarket internal market;

    address internal owner;
    address internal feeRecipient = address(0xFEE);

    function setUp() public {
        owner = vm.addr(OWNER_PRIVATE_KEY);
        vm.deal(owner, 1 ether);
        vm.warp(START_TIME);

        harness = new SeedWorldCupMarketsHarness();
        market = new EventMarket(address(0xA11CE), owner, feeRecipient, address(0x0BEEF));
    }

    function test_LoadSeed_ReadsWorldCupSeedJson() external view {
        SeedWorldCupMarkets.WorldCupSeed memory seed = harness.loadSeedPublic(SEED_PATH);

        assertEq(seed.teamIds.length, 32);
        assertEq(seed.groupMatchIds.length, 48);
        assertEq(seed.kickoffTimes.length, 48);
        assertEq(seed.homeTeams.length, 48);
        assertEq(seed.awayTeams.length, 48);
        assertEq(seed.teamIds[0], "QAT");
        assertEq(seed.teamIds[31], "KOR");
        assertEq(seed.groupMatchIds[0], "group-a-1");
        assertEq(seed.groupMatchIds[47], "group-h-6");
        assertEq(seed.finalMatchId, "final-1");
        assertEq(seed.finalKickoffTime, 1_671_375_600);
        assertEq(seed.finalHomeTeam, "ARG");
        assertEq(seed.finalAwayTeam, "FRA");
    }

    function test_SeedJson_IncludesFinalArgVsFraPath() external view {
        string memory json = vm.readFile(SEED_PATH);

        assertTrue(json.keyExists(".finalMatchId"));
        assertEq(json.readString(".finalMatchId"), "final-1");
        assertEq(json.readString(".finalHomeTeam"), "ARG");
        assertEq(json.readString(".finalAwayTeam"), "FRA");
    }

    function test_NormalizedKickoff_PreservesRelativeOffset() external view {
        uint64 normalized = harness.normalizedKickoffPublic(
            ORIGINAL_FIRST_KICKOFF + 1 days, ORIGINAL_FIRST_KICKOFF, START_TIME + FIRST_KICKOFF_DELAY
        );

        assertEq(uint256(normalized), START_TIME + FIRST_KICKOFF_DELAY + 1 days);
    }

    function test_CreateMarketsFromSeed_CreatesGroup1x2SpreadAndWinnerMarkets() external {
        harness.createMarketsFromPathAsOwnerPublic(market, SEED_PATH, START_TIME + FIRST_KICKOFF_DELAY, owner);

        assertEq(market.marketCount(), 98);

        EventMarket.EventMarketDef memory first1x2 = market.getMarket(0);
        assertEq(first1x2.eventId, harness.eventIdPublic("1x2", "group-a-1"));
        assertEq(first1x2.outcomeCount, 3);
        assertEq(uint256(first1x2.betDeadline), START_TIME + FIRST_KICKOFF_DELAY - 5 minutes);
        assertEq(uint256(first1x2.resolveAfter), START_TIME + FIRST_KICKOFF_DELAY + 150 minutes);
        assertEq(first1x2.question, "QAT vs ECU 1X2");

        EventMarket.EventMarketDef memory firstSpread = market.getMarket(1);
        assertEq(firstSpread.eventId, harness.eventIdPublic("goals-25", "group-a-1"));
        assertEq(firstSpread.outcomeCount, 2);
        assertEq(firstSpread.question, "QAT vs ECU total goals over 2.5");

        EventMarket.EventMarketDef memory final1x2 = market.getMarket(96);
        assertEq(final1x2.eventId, harness.eventIdPublic("1x2", "final-1"));
        assertEq(final1x2.outcomeCount, 3);
        assertEq(final1x2.question, "ARG vs FRA 1X2");

        EventMarket.EventMarketDef memory winner = market.getMarket(97);
        assertEq(winner.eventId, harness.eventIdPublic("winner", "worldcup-2022"));
        assertEq(winner.outcomeCount, 32);
        assertEq(winner.question, "World Cup winner");
    }
}
