// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Test} from "forge-std/Test.sol";
import {Script, console2} from "forge-std/Script.sol";
import {stdJson} from "forge-std/StdJson.sol";
import {AdminEventOracle} from "../src/AdminEventOracle.sol";
import {EventMarket} from "../src/EventMarket.sol";
import {IEventOracle} from "../src/interfaces/IEventOracle.sol";
import {MockUSDC} from "../test/mocks/MockUSDC.sol";

contract Phase7E2EChallengePaths is Script, Test {
    using stdJson for string;

    uint128 internal constant INITIAL_BALANCE = 10_000 * 1e6;
    uint128 internal constant BET_AMOUNT = 100 * 1e6;
    uint256 internal constant EXPECTED_MARKET_COUNT = 98;
    bytes32 internal constant FINAL_1_EVENT_ID = 0x2b902d6a9c3a763f380d5c1af8475ea4efa1142488ebc730dc7c1c8851b061b1;
    string internal constant DEFAULT_SEED_PATH = "script/data/worldcup-seed.json";
    uint256 internal constant DEFAULT_FIRST_KICKOFF_DELAY_SECONDS = 1 days;
    uint8 internal constant WINNER_OUTCOME_COUNT = 32;
    uint64 internal constant BET_DEADLINE_OFFSET = 5 minutes;
    uint64 internal constant RESOLVE_AFTER_OFFSET = 150 minutes;
    uint64 internal constant WINNER_RESOLVE_AFTER_OFFSET = 30 days;

    address internal constant OWNER = address(0xA11CE0);
    address internal constant FEE_RECIPIENT = address(0xFEE001);
    address internal constant BONUS_BANK = address(0xB0B001);

    uint256 internal constant ALICE_PK = 1;
    uint256 internal constant BOB_PK = 2;
    uint256 internal constant CHARLIE_PK = 3;

    error EmptySeed();
    error SeedArrayLengthMismatch();
    error InvalidSeedSchedule();
    error SeedTimestampTooLarge();

    struct WorldCupSeed {
        string[] teamIds;
        string[] groupMatchIds;
        uint256[] kickoffTimes;
        string[] homeTeams;
        string[] awayTeams;
        string finalMatchId;
        uint256 finalKickoffTime;
        string finalHomeTeam;
        string finalAwayTeam;
    }

    struct ChallengeScenario {
        MockUSDC usdc;
        AdminEventOracle oracle;
        EventMarket market;
        uint256 finalMarketId;
        uint64 finalStartTime;
        address alice;
        address bob;
        address charlie;
    }

    function run() external {
        WorldCupSeed memory seed = _loadSeed(DEFAULT_SEED_PATH);

        _runOwnerRevokePath(seed);
        _runOwnerConfirmPath(seed);
        _runFinalizeOnTimeoutPath(seed);
    }

    function _runOwnerRevokePath(WorldCupSeed memory seed) internal {
        console2.log(unicode"=== 10.4.1 owner 撤销路径 ===");
        ChallengeScenario memory scenario = _setupScenario(seed, unicode"owner 撤销");
        _placeThreeWayBets(scenario);
        _proposeAndChallenge(scenario, 2);

        vm.prank(OWNER);
        scenario.oracle.revokeProposal(FINAL_1_EVENT_ID);

        (uint8 pendingOutcome, bool pendingFinalized) = scenario.oracle.getResult(FINAL_1_EVENT_ID);
        assertEq(uint256(scenario.oracle.getEventStatus(FINAL_1_EVENT_ID)), uint256(IEventOracle.EventStatus.Pending));
        assertEq(pendingOutcome, 0);
        assertFalse(pendingFinalized);
        assertEq(scenario.usdc.balanceOf(address(scenario.oracle)), 0);
        assertEq(scenario.usdc.balanceOf(scenario.bob), INITIAL_BALANCE);
        assertEq(scenario.usdc.balanceOf(BONUS_BANK), INITIAL_BALANCE - scenario.oracle.BONUS());

        vm.prank(OWNER);
        scenario.oracle.proposeResult(FINAL_1_EVENT_ID, 0);
        vm.warp(block.timestamp + scenario.oracle.DISPUTE_WINDOW() + 1);
        scenario.oracle.finalizeResult(FINAL_1_EVENT_ID);

        _resolveAndClaim(
            scenario, 0, 10_198 * 1e6, 10_000 * 1e6, 9_900 * 1e6, 2 * 1e6, INITIAL_BALANCE - scenario.oracle.BONUS()
        );
    }

    function _runOwnerConfirmPath(WorldCupSeed memory seed) internal {
        console2.log(unicode"=== 10.4.2 owner 驳回路径 ===");
        ChallengeScenario memory scenario = _setupScenario(seed, unicode"owner 驳回");
        _placeThreeWayBets(scenario);
        _proposeAndChallenge(scenario, 0);

        vm.prank(OWNER);
        scenario.oracle.confirmProposal(FINAL_1_EVENT_ID);

        (uint8 outcome, bool finalized) = scenario.oracle.getResult(FINAL_1_EVENT_ID);
        assertEq(uint256(scenario.oracle.getEventStatus(FINAL_1_EVENT_ID)), uint256(IEventOracle.EventStatus.Finalized));
        assertEq(outcome, 0);
        assertTrue(finalized);
        assertEq(
            scenario.usdc.balanceOf(scenario.bob), INITIAL_BALANCE - BET_AMOUNT - scenario.oracle.CHALLENGE_STAKE()
        );
        assertEq(scenario.usdc.balanceOf(FEE_RECIPIENT), scenario.oracle.CHALLENGE_STAKE());
        assertEq(scenario.usdc.balanceOf(BONUS_BANK), INITIAL_BALANCE);

        _resolveAndClaim(scenario, 0, 10_198 * 1e6, 9_800 * 1e6, 9_900 * 1e6, 102 * 1e6, INITIAL_BALANCE);
    }

    function _runFinalizeOnTimeoutPath(WorldCupSeed memory seed) internal {
        console2.log(unicode"=== 10.4.3 owner 不响应 finalizeOnTimeout 路径 ===");
        ChallengeScenario memory scenario = _setupScenario(seed, unicode"owner 不响应");
        _placeThreeWayBets(scenario);
        _proposeAndChallenge(scenario, 0);

        vm.warp(block.timestamp + scenario.oracle.DISPUTE_WINDOW() + 1);
        scenario.oracle.finalizeOnTimeout(FINAL_1_EVENT_ID);

        (uint8 outcome, bool finalized) = scenario.oracle.getResult(FINAL_1_EVENT_ID);
        assertEq(uint256(scenario.oracle.getEventStatus(FINAL_1_EVENT_ID)), uint256(IEventOracle.EventStatus.Finalized));
        assertEq(outcome, 0);
        assertTrue(finalized);
        assertEq(scenario.usdc.balanceOf(scenario.bob), INITIAL_BALANCE - BET_AMOUNT);
        assertEq(scenario.usdc.balanceOf(FEE_RECIPIENT), 0);
        assertEq(scenario.usdc.balanceOf(BONUS_BANK), INITIAL_BALANCE);

        _resolveAndClaim(scenario, 0, 10_198 * 1e6, 9_900 * 1e6, 9_900 * 1e6, 2 * 1e6, INITIAL_BALANCE);
    }

    function _setupScenario(WorldCupSeed memory seed, string memory label)
        internal
        returns (ChallengeScenario memory scenario)
    {
        scenario.alice = vm.addr(ALICE_PK);
        scenario.bob = vm.addr(BOB_PK);
        scenario.charlie = vm.addr(CHARLIE_PK);

        uint256 startTimestamp = block.timestamp;
        uint64 targetFirstKickoff = _checkedTimestamp(startTimestamp + DEFAULT_FIRST_KICKOFF_DELAY_SECONDS);
        uint64 expectedFinalKickoff =
            _normalizedKickoff(seed.finalKickoffTime, seed.kickoffTimes[0], targetFirstKickoff);

        assertEq(_eventId("1x2", seed.finalMatchId), FINAL_1_EVENT_ID);

        scenario.usdc = new MockUSDC();
        scenario.oracle = new AdminEventOracle(address(scenario.usdc), OWNER, FEE_RECIPIENT, BONUS_BANK, 32);
        scenario.market = new EventMarket(address(scenario.usdc), OWNER, FEE_RECIPIENT, address(scenario.oracle));

        assertEq(scenario.oracle.DISPUTE_WINDOW(), 72 hours);
        assertEq(scenario.oracle.CHALLENGE_STAKE(), 100 * 1e6);
        assertEq(address(scenario.market.ORACLE()), address(scenario.oracle));
        assertEq(scenario.market.USDC(), address(scenario.usdc));

        vm.startPrank(OWNER);
        _createGroupMarkets(scenario.market, seed, targetFirstKickoff);
        _createFinal1x2Market(scenario.market, seed, targetFirstKickoff);
        _createWinnerMarket(scenario.market, seed.teamIds.length, targetFirstKickoff);
        vm.stopPrank();

        assertEq(scenario.market.marketCount(), EXPECTED_MARKET_COUNT);

        EventMarket.EventMarketDef memory finalMarket;
        (scenario.finalMarketId, finalMarket) = _findMarketByEventId(scenario.market, FINAL_1_EVENT_ID);
        scenario.finalStartTime = finalMarket.resolveAfter - RESOLVE_AFTER_OFFSET;

        assertEq(scenario.finalStartTime, expectedFinalKickoff);
        assertEq(finalMarket.outcomeCount, 3);

        _mint(scenario.usdc, scenario.alice);
        _mint(scenario.usdc, scenario.bob);
        _mint(scenario.usdc, scenario.charlie);
        _mint(scenario.usdc, BONUS_BANK);

        _approve(scenario.usdc, scenario.alice, address(scenario.market));
        _approve(scenario.usdc, scenario.bob, address(scenario.market));
        _approve(scenario.usdc, scenario.charlie, address(scenario.market));
        _approve(scenario.usdc, scenario.bob, address(scenario.oracle));
        _approve(scenario.usdc, BONUS_BANK, address(scenario.oracle));

        console2.log(unicode"路径:", label);
        console2.log(unicode"MockUSDC:", address(scenario.usdc));
        console2.log(unicode"AdminEventOracle:", address(scenario.oracle));
        console2.log(unicode"EventMarket:", address(scenario.market));
        console2.log(unicode"final-1 marketId:", scenario.finalMarketId);
        console2.log(unicode"final-1 startTime:", uint256(scenario.finalStartTime));
    }

    function _placeThreeWayBets(ChallengeScenario memory scenario) internal {
        vm.prank(scenario.alice);
        scenario.market.bet(scenario.finalMarketId, 0, BET_AMOUNT);
        vm.prank(scenario.bob);
        scenario.market.bet(scenario.finalMarketId, 1, BET_AMOUNT);
        vm.prank(scenario.charlie);
        scenario.market.bet(scenario.finalMarketId, 2, BET_AMOUNT);

        assertEq(scenario.usdc.balanceOf(scenario.alice), INITIAL_BALANCE - BET_AMOUNT);
        assertEq(scenario.usdc.balanceOf(scenario.bob), INITIAL_BALANCE - BET_AMOUNT);
        assertEq(scenario.usdc.balanceOf(scenario.charlie), INITIAL_BALANCE - BET_AMOUNT);
        assertEq(scenario.market.stakeByOutcome(scenario.finalMarketId, scenario.alice, 0), BET_AMOUNT);
        assertEq(scenario.market.stakeByOutcome(scenario.finalMarketId, scenario.bob, 1), BET_AMOUNT);
        assertEq(scenario.market.stakeByOutcome(scenario.finalMarketId, scenario.charlie, 2), BET_AMOUNT);

        EventMarket.EventMarketDef memory afterBetMarket = scenario.market.getMarket(scenario.finalMarketId);
        assertEq(afterBetMarket.outcomePools[0], BET_AMOUNT);
        assertEq(afterBetMarket.outcomePools[1], BET_AMOUNT);
        assertEq(afterBetMarket.outcomePools[2], BET_AMOUNT);
    }

    function _proposeAndChallenge(ChallengeScenario memory scenario, uint8 proposedOutcome) internal {
        EventMarket.EventMarketDef memory finalMarket = scenario.market.getMarket(scenario.finalMarketId);
        vm.warp(uint256(finalMarket.resolveAfter) + 1);

        vm.prank(OWNER);
        scenario.oracle.proposeResult(FINAL_1_EVENT_ID, proposedOutcome);

        vm.prank(scenario.bob);
        scenario.oracle.challenge(FINAL_1_EVENT_ID);

        assertEq(
            uint256(scenario.oracle.getEventStatus(FINAL_1_EVENT_ID)), uint256(IEventOracle.EventStatus.Challenged)
        );
        assertEq(scenario.usdc.balanceOf(address(scenario.oracle)), scenario.oracle.CHALLENGE_STAKE());
        assertEq(
            scenario.usdc.balanceOf(scenario.bob), INITIAL_BALANCE - BET_AMOUNT - scenario.oracle.CHALLENGE_STAKE()
        );

        console2.log(unicode"proposed outcome:", proposedOutcome);
        console2.log(unicode"challenge stake in oracle:", scenario.usdc.balanceOf(address(scenario.oracle)));
    }

    function _resolveAndClaim(
        ChallengeScenario memory scenario,
        uint8 expectedOutcome,
        uint256 expectedAliceBalance,
        uint256 expectedBobBalance,
        uint256 expectedCharlieBalance,
        uint256 expectedFeeRecipientBalance,
        uint256 expectedBonusBankBalance
    ) internal {
        scenario.market.resolve(scenario.finalMarketId);

        EventMarket.EventMarketDef memory settledMarket = scenario.market.getMarket(scenario.finalMarketId);
        assertEq(settledMarket.settledOutcome, expectedOutcome);
        assertEq(settledMarket.protocolFee, 2 * 1e6);
        assertEq(settledMarket.winnerPool, 298 * 1e6);
        assertEq(scenario.market.pendingPayout(scenario.finalMarketId, scenario.alice), 298 * 1e6);

        vm.prank(scenario.alice);
        scenario.market.claim(scenario.finalMarketId);

        vm.expectRevert(EventMarket.NotAWinner.selector);
        vm.prank(scenario.bob);
        scenario.market.claim(scenario.finalMarketId);

        vm.expectRevert(EventMarket.NotAWinner.selector);
        vm.prank(scenario.charlie);
        scenario.market.claim(scenario.finalMarketId);

        assertEq(scenario.usdc.balanceOf(scenario.alice), expectedAliceBalance);
        assertEq(scenario.usdc.balanceOf(scenario.bob), expectedBobBalance);
        assertEq(scenario.usdc.balanceOf(scenario.charlie), expectedCharlieBalance);
        assertEq(scenario.usdc.balanceOf(FEE_RECIPIENT), expectedFeeRecipientBalance);
        assertEq(scenario.usdc.balanceOf(BONUS_BANK), expectedBonusBankBalance);
        assertEq(scenario.usdc.balanceOf(address(scenario.market)), 0);
        assertEq(scenario.usdc.balanceOf(address(scenario.oracle)), 0);

        console2.log(unicode"settled outcome:", expectedOutcome);
        console2.log(unicode"ALICE final balance:", scenario.usdc.balanceOf(scenario.alice));
        console2.log(unicode"BOB final balance:", scenario.usdc.balanceOf(scenario.bob));
        console2.log(unicode"CHARLIE final balance:", scenario.usdc.balanceOf(scenario.charlie));
        console2.log(unicode"feeRecipient balance:", scenario.usdc.balanceOf(FEE_RECIPIENT));
        console2.log(unicode"bonusBank balance:", scenario.usdc.balanceOf(BONUS_BANK));
        console2.log(unicode"market remaining balance:", scenario.usdc.balanceOf(address(scenario.market)));
    }

    function _mint(MockUSDC usdc, address user) internal {
        usdc.mint(user, INITIAL_BALANCE);
    }

    function _approve(MockUSDC usdc, address user, address spender) internal {
        vm.prank(user);
        usdc.approve(spender, type(uint256).max);
    }

    function _findMarketByEventId(EventMarket market, bytes32 eventId)
        internal
        view
        returns (uint256 marketId, EventMarket.EventMarketDef memory marketDef)
    {
        EventMarket.EventMarketDef[] memory page = market.getMarketsPaged(0, market.marketCount());
        for (uint256 i = 0; i < page.length; i++) {
            if (page[i].eventId == eventId) {
                return (i, page[i]);
            }
        }

        revert("final-1 market not found");
    }

    function _loadSeed(string memory path) internal view returns (WorldCupSeed memory seed) {
        // 读取仓库内固定 seed 文件，保持 Phase7E2E 与挑战路径脚本使用同一批市场数据。
        // forge-lint: disable-next-line(unsafe-cheatcode)
        string memory json = vm.readFile(path);
        seed.teamIds = json.readStringArray(".teamIds");
        seed.groupMatchIds = json.readStringArray(".groupMatchIds");
        seed.kickoffTimes = json.readUintArray(".kickoffTimes");
        seed.homeTeams = json.readStringArray(".homeTeams");
        seed.awayTeams = json.readStringArray(".awayTeams");
        seed.finalMatchId = json.readStringOr(".finalMatchId", "");
        seed.finalKickoffTime = json.readUintOr(".finalKickoffTime", 0);
        seed.finalHomeTeam = json.readStringOr(".finalHomeTeam", "");
        seed.finalAwayTeam = json.readStringOr(".finalAwayTeam", "");

        if (seed.teamIds.length == 0 || seed.groupMatchIds.length == 0) {
            revert EmptySeed();
        }
        if (
            seed.groupMatchIds.length != seed.kickoffTimes.length || seed.groupMatchIds.length != seed.homeTeams.length
                || seed.groupMatchIds.length != seed.awayTeams.length
        ) {
            revert SeedArrayLengthMismatch();
        }
    }

    function _createGroupMarkets(EventMarket market, WorldCupSeed memory seed, uint64 targetFirstKickoff) internal {
        uint256 originalFirstKickoff = seed.kickoffTimes[0];
        for (uint256 i = 0; i < seed.groupMatchIds.length; i++) {
            uint64 kickoff = _normalizedKickoff(seed.kickoffTimes[i], originalFirstKickoff, targetFirstKickoff);
            uint64 betDeadline = kickoff - BET_DEADLINE_OFFSET;
            uint64 resolveAfter = kickoff + RESOLVE_AFTER_OFFSET;
            string memory matchLabel = string.concat(seed.homeTeams[i], " vs ", seed.awayTeams[i]);

            market.createMarket(
                _eventId("1x2", seed.groupMatchIds[i]), 3, betDeadline, resolveAfter, string.concat(matchLabel, " 1X2")
            );
            market.createMarket(
                _eventId("goals-25", seed.groupMatchIds[i]),
                2,
                betDeadline,
                resolveAfter,
                string.concat(matchLabel, " total goals over 2.5")
            );
        }
    }

    function _createFinal1x2Market(EventMarket market, WorldCupSeed memory seed, uint64 targetFirstKickoff) internal {
        uint64 kickoff = _normalizedKickoff(seed.finalKickoffTime, seed.kickoffTimes[0], targetFirstKickoff);
        uint64 betDeadline = kickoff - BET_DEADLINE_OFFSET;
        uint64 resolveAfter = kickoff + RESOLVE_AFTER_OFFSET;
        string memory matchLabel = string.concat(seed.finalHomeTeam, " vs ", seed.finalAwayTeam);

        market.createMarket(
            _eventId("1x2", seed.finalMatchId), 3, betDeadline, resolveAfter, string.concat(matchLabel, " 1X2")
        );
    }

    function _createWinnerMarket(EventMarket market, uint256 teamCount, uint64 targetFirstKickoff) internal {
        if (teamCount != WINNER_OUTCOME_COUNT) {
            revert SeedArrayLengthMismatch();
        }

        market.createMarket(
            _eventId("winner", "worldcup-2022"),
            WINNER_OUTCOME_COUNT,
            _checkedTimestamp(targetFirstKickoff - BET_DEADLINE_OFFSET),
            _checkedTimestamp(targetFirstKickoff + WINNER_RESOLVE_AFTER_OFFSET),
            "World Cup winner"
        );
    }

    function _normalizedKickoff(uint256 originalKickoff, uint256 originalFirstKickoff, uint64 targetFirstKickoff)
        internal
        pure
        returns (uint64)
    {
        if (originalKickoff < originalFirstKickoff) {
            revert InvalidSeedSchedule();
        }

        uint256 shifted = uint256(targetFirstKickoff) + (originalKickoff - originalFirstKickoff);
        return _checkedTimestamp(shifted);
    }

    function _checkedTimestamp(uint256 timestampValue) internal pure returns (uint64) {
        if (timestampValue > type(uint64).max) {
            revert SeedTimestampTooLarge();
        }

        // 已先校验不超过 uint64 上限，这里的转换不会截断。
        // forge-lint: disable-next-line(unsafe-typecast)
        return uint64(timestampValue);
    }

    function _eventId(string memory marketType, string memory seedId) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked("worldcup:", marketType, ":", seedId));
    }
}
