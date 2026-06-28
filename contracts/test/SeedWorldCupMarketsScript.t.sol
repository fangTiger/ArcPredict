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
        _createWinnerMarket(eventMarket, seed, targetFirstKickoff);
        _createKnockout1x2Markets(eventMarket, seed, targetFirstKickoff);
        vm.stopPrank();
    }

    function createKnockoutMarketsFromPathAsOwnerPublic(
        EventMarket eventMarket,
        string memory path,
        uint256 targetFirstKickoff,
        address marketOwner
    ) external {
        WorldCupSeed memory seed = _loadSeed(path);
        vm.startPrank(marketOwner);
        _createKnockout1x2Markets(eventMarket, seed, targetFirstKickoff, true);
        vm.stopPrank();
    }
}

contract SeedWorldCupMarketsScriptTest is Test {
    using stdJson for string;

    uint256 internal constant OWNER_PRIVATE_KEY = 0xA11CE;
    string internal constant SEED_PATH = "script/data/worldcup-seed.json";
    uint256 internal constant START_TIME = 1_700_000_000;
    uint256 internal constant FIRST_KICKOFF_DELAY = 1 days;
    uint256 internal constant ORIGINAL_FIRST_KICKOFF = 1_781_204_400;
    uint256 internal constant CURRENT_TOURNAMENT_TIME = 1_782_566_146;

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

        assertEq(seed.teamIds.length, 48);
        assertEq(seed.groupMatchIds.length, 72);
        assertEq(seed.kickoffTimes.length, 72);
        assertEq(seed.homeTeams.length, 72);
        assertEq(seed.awayTeams.length, 72);
        assertEq(seed.knockoutMatchIds.length, 16);
        assertEq(seed.knockoutKickoffTimes.length, 16);
        assertEq(seed.knockoutHomeTeams.length, 16);
        assertEq(seed.knockoutAwayTeams.length, 16);
        assertEq(seed.teamIds[0], "MEX");
        assertEq(seed.teamIds[47], "PAN");
        assertEq(seed.groupMatchIds[0], "group-a-1");
        assertEq(seed.groupMatchIds[71], "group-l-6");
        assertEq(seed.knockoutMatchIds[0], "r32-1");
        assertEq(seed.knockoutHomeTeams[0], "RSA");
        assertEq(seed.knockoutAwayTeams[0], "CAN");
        assertEq(seed.knockoutMatchIds[15], "r32-16");
        assertEq(seed.knockoutHomeTeams[15], "COL");
        assertEq(seed.knockoutAwayTeams[15], "GHA");
        assertEq(seed.finalMatchId, "final-1");
        assertEq(seed.finalKickoffTime, 1_784_487_600);
        assertEq(seed.finalHomeTeam, "MATCH_101_W");
        assertEq(seed.finalAwayTeam, "MATCH_102_W");
    }

    function test_SeedJson_Includes2026FinalPath() external view {
        string memory json = vm.readFile(SEED_PATH);

        assertTrue(json.keyExists(".finalMatchId"));
        assertEq(json.readString(".finalMatchId"), "final-1");
        assertEq(json.readString(".finalHomeTeam"), "MATCH_101_W");
        assertEq(json.readString(".finalAwayTeam"), "MATCH_102_W");
    }

    function test_NormalizedKickoff_PreservesRelativeOffset() external view {
        uint64 normalized = harness.normalizedKickoffPublic(
            ORIGINAL_FIRST_KICKOFF + 1 days, ORIGINAL_FIRST_KICKOFF, START_TIME + FIRST_KICKOFF_DELAY
        );

        assertEq(uint256(normalized), START_TIME + FIRST_KICKOFF_DELAY + 1 days);
    }

    function test_CreateMarketsFromSeed_CreatesGroup1x2SpreadAndWinnerMarkets() external {
        harness.createMarketsFromPathAsOwnerPublic(market, SEED_PATH, START_TIME + FIRST_KICKOFF_DELAY, owner);

        assertEq(market.marketCount(), 162);

        EventMarket.EventMarketDef memory first1x2 = market.getMarket(0);
        assertEq(first1x2.eventId, harness.eventIdPublic("1x2", "group-a-1"));
        assertEq(first1x2.outcomeCount, 3);
        assertEq(uint256(first1x2.betDeadline), START_TIME + FIRST_KICKOFF_DELAY - 5 minutes);
        assertEq(uint256(first1x2.resolveAfter), START_TIME + FIRST_KICKOFF_DELAY + 150 minutes);
        assertEq(first1x2.question, "MEX vs RSA 1X2");

        EventMarket.EventMarketDef memory firstSpread = market.getMarket(1);
        assertEq(firstSpread.eventId, harness.eventIdPublic("goals-25", "group-a-1"));
        assertEq(firstSpread.outcomeCount, 2);
        assertEq(firstSpread.question, "MEX vs RSA total goals over 2.5");

        EventMarket.EventMarketDef memory final1x2 = market.getMarket(144);
        assertEq(final1x2.eventId, harness.eventIdPublic("1x2", "final-1"));
        assertEq(final1x2.outcomeCount, 3);
        assertEq(final1x2.question, "MATCH_101_W vs MATCH_102_W 1X2");

        EventMarket.EventMarketDef memory winner = market.getMarket(145);
        assertEq(winner.eventId, harness.eventIdPublic("winner", "worldcup-2026"));
        assertEq(winner.outcomeCount, 48);
        assertEq(winner.question, "World Cup winner");

        EventMarket.EventMarketDef memory firstR32 = market.getMarket(146);
        assertEq(firstR32.eventId, harness.eventIdPublic("1x2", "r32-1"));
        assertEq(firstR32.outcomeCount, 3);
        assertEq(firstR32.question, "RSA vs CAN 1X2");

        EventMarket.EventMarketDef memory lastR32 = market.getMarket(161);
        assertEq(lastR32.eventId, harness.eventIdPublic("1x2", "r32-16"));
        assertEq(lastR32.outcomeCount, 3);
        assertEq(lastR32.question, "COL vs GHA 1X2");
    }

    function test_CreateMarketsFromSeed_SkipsExpiredRealKickoffs() external {
        vm.warp(CURRENT_TOURNAMENT_TIME);

        harness.createMarketsFromPathAsOwnerPublic(market, SEED_PATH, ORIGINAL_FIRST_KICKOFF, owner);

        assertEq(market.marketCount(), 30);

        EventMarket.EventMarketDef memory firstOpen1x2 = market.getMarket(0);
        assertEq(firstOpen1x2.eventId, harness.eventIdPublic("1x2", "group-j-5"));
        assertEq(firstOpen1x2.outcomeCount, 3);
        assertEq(firstOpen1x2.question, "ALG vs AUT 1X2");
        assertGt(firstOpen1x2.betDeadline, CURRENT_TOURNAMENT_TIME);

        EventMarket.EventMarketDef memory final1x2 = market.getMarket(12);
        assertEq(final1x2.eventId, harness.eventIdPublic("1x2", "final-1"));
        assertEq(final1x2.outcomeCount, 3);
        assertGt(final1x2.betDeadline, CURRENT_TOURNAMENT_TIME);

        EventMarket.EventMarketDef memory winner = market.getMarket(13);
        assertEq(winner.eventId, harness.eventIdPublic("winner", "worldcup-2026"));
        assertEq(winner.outcomeCount, 48);
        assertGt(winner.betDeadline, CURRENT_TOURNAMENT_TIME);

        EventMarket.EventMarketDef memory firstOpenR32 = market.getMarket(14);
        assertEq(firstOpenR32.eventId, harness.eventIdPublic("1x2", "r32-1"));
        assertEq(firstOpenR32.outcomeCount, 3);
        assertEq(firstOpenR32.question, "RSA vs CAN 1X2");
        assertGt(firstOpenR32.betDeadline, CURRENT_TOURNAMENT_TIME);
    }

    function test_CreateKnockoutMarketsFromSeed_SkipsAlreadyExistingMarkets() external {
        harness.createKnockoutMarketsFromPathAsOwnerPublic(market, SEED_PATH, ORIGINAL_FIRST_KICKOFF, owner);
        harness.createKnockoutMarketsFromPathAsOwnerPublic(market, SEED_PATH, ORIGINAL_FIRST_KICKOFF, owner);

        assertEq(market.marketCount(), 16);
        assertEq(market.getMarket(0).eventId, harness.eventIdPublic("1x2", "r32-1"));
        assertEq(market.getMarket(15).eventId, harness.eventIdPublic("1x2", "r32-16"));
    }
}
