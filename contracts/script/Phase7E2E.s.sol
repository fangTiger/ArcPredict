// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Test} from "forge-std/Test.sol";
import {Script, console2} from "forge-std/Script.sol";
import {stdJson} from "forge-std/StdJson.sol";
import {AdminEventOracle} from "../src/AdminEventOracle.sol";
import {EventMarket} from "../src/EventMarket.sol";
import {IEventOracle} from "../src/interfaces/IEventOracle.sol";
import {MockUSDC} from "../test/mocks/MockUSDC.sol";

contract Phase7E2E is Script, Test {
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

    function run() external {
        address alice = vm.addr(ALICE_PK);
        address bob = vm.addr(BOB_PK);
        address charlie = vm.addr(CHARLIE_PK);
        uint256 startTimestamp = block.timestamp;
        WorldCupSeed memory seed = _loadSeed(DEFAULT_SEED_PATH);
        uint64 targetFirstKickoff = _checkedTimestamp(startTimestamp + DEFAULT_FIRST_KICKOFF_DELAY_SECONDS);
        uint64 expectedFinalKickoff =
            _normalizedKickoff(seed.finalKickoffTime, seed.kickoffTimes[0], targetFirstKickoff);

        bytes32 derivedFinalEventId = _eventId("1x2", seed.finalMatchId);
        assertEq(derivedFinalEventId, FINAL_1_EVENT_ID);

        console2.log("=== Step 1: deploy ===");
        MockUSDC usdc = new MockUSDC();
        AdminEventOracle oracle = new AdminEventOracle(address(usdc), OWNER, FEE_RECIPIENT, BONUS_BANK, 32);
        EventMarket market = new EventMarket(address(usdc), OWNER, FEE_RECIPIENT, address(oracle));

        assertEq(oracle.DISPUTE_WINDOW(), 72 hours);
        assertEq(oracle.CHALLENGE_STAKE(), 100 * 1e6);
        assertEq(address(market.ORACLE()), address(oracle));
        assertEq(market.USDC(), address(usdc));

        console2.log("MockUSDC:", address(usdc));
        console2.log("AdminEventOracle:", address(oracle));
        console2.log("EventMarket:", address(market));

        console2.log("=== Step 2: seed 98 markets ===");
        vm.startPrank(OWNER);
        _createGroupMarkets(market, seed, targetFirstKickoff);
        _createFinal1x2Market(market, seed, targetFirstKickoff);
        _createWinnerMarket(market, seed.teamIds.length, targetFirstKickoff);
        vm.stopPrank();

        assertEq(market.marketCount(), EXPECTED_MARKET_COUNT);

        (uint256 finalMarketId, EventMarket.EventMarketDef memory finalMarket) =
            _findMarketByEventId(market, FINAL_1_EVENT_ID);
        uint64 finalStartTime = finalMarket.resolveAfter - RESOLVE_AFTER_OFFSET;

        assertEq(finalMarket.eventId, FINAL_1_EVENT_ID);
        assertEq(finalMarket.outcomeCount, 3);
        assertEq(finalStartTime, expectedFinalKickoff);
        assertEq(finalMarket.resolveAfter, expectedFinalKickoff + RESOLVE_AFTER_OFFSET);

        console2.log("marketCount:", market.marketCount());
        console2.log("final-1 marketId:", finalMarketId);
        console2.logBytes32(FINAL_1_EVENT_ID);
        console2.log("final-1 startTime:", uint256(finalStartTime));
        console2.log("final-1 resolveAfter:", uint256(finalMarket.resolveAfter));

        console2.log("=== Step 3: fund + approve ===");
        _mintAndApprove(usdc, alice, address(market));
        _mintAndApprove(usdc, bob, address(market));
        _mintAndApprove(usdc, charlie, address(market));

        assertEq(usdc.balanceOf(alice), INITIAL_BALANCE);
        assertEq(usdc.balanceOf(bob), INITIAL_BALANCE);
        assertEq(usdc.balanceOf(charlie), INITIAL_BALANCE);

        console2.log("ALICE:", alice);
        console2.log("BOB:", bob);
        console2.log("CHARLIE:", charlie);
        console2.log("ALICE init:", usdc.balanceOf(alice));
        console2.log("BOB init:", usdc.balanceOf(bob));
        console2.log("CHARLIE init:", usdc.balanceOf(charlie));

        console2.log("=== Step 4: final-1 bets ===");
        vm.prank(alice);
        market.bet(finalMarketId, 0, BET_AMOUNT);
        vm.prank(bob);
        market.bet(finalMarketId, 1, BET_AMOUNT);
        vm.prank(charlie);
        market.bet(finalMarketId, 2, BET_AMOUNT);

        assertEq(usdc.balanceOf(alice), INITIAL_BALANCE - BET_AMOUNT);
        assertEq(usdc.balanceOf(bob), INITIAL_BALANCE - BET_AMOUNT);
        assertEq(usdc.balanceOf(charlie), INITIAL_BALANCE - BET_AMOUNT);
        assertEq(market.stakeByOutcome(finalMarketId, alice, 0), BET_AMOUNT);
        assertEq(market.stakeByOutcome(finalMarketId, bob, 1), BET_AMOUNT);
        assertEq(market.stakeByOutcome(finalMarketId, charlie, 2), BET_AMOUNT);

        uint128[] memory aliceStake = market.userStake(finalMarketId, alice);
        uint128[] memory bobStake = market.userStake(finalMarketId, bob);
        uint128[] memory charlieStake = market.userStake(finalMarketId, charlie);
        assertEq(aliceStake[0], BET_AMOUNT);
        assertEq(bobStake[1], BET_AMOUNT);
        assertEq(charlieStake[2], BET_AMOUNT);

        EventMarket.EventMarketDef memory afterBetMarket = market.getMarket(finalMarketId);
        assertEq(afterBetMarket.outcomePools[0], BET_AMOUNT);
        assertEq(afterBetMarket.outcomePools[1], BET_AMOUNT);
        assertEq(afterBetMarket.outcomePools[2], BET_AMOUNT);

        console2.log("stake outcome0:", uint256(afterBetMarket.outcomePools[0]));
        console2.log("stake outcome1:", uint256(afterBetMarket.outcomePools[1]));
        console2.log("stake outcome2:", uint256(afterBetMarket.outcomePools[2]));

        console2.log("=== Step 5: warp + propose ARG ===");
        vm.warp(uint256(finalStartTime) + RESOLVE_AFTER_OFFSET + 1);
        vm.prank(OWNER);
        oracle.proposeResult(FINAL_1_EVENT_ID, 0);

        IEventOracle.EventStatus proposedStatus = oracle.getEventStatus(FINAL_1_EVENT_ID);
        (uint8 proposedOutcome, bool finalizedBefore) = oracle.getResult(FINAL_1_EVENT_ID);
        assertEq(uint256(proposedStatus), uint256(IEventOracle.EventStatus.Proposed));
        assertEq(proposedOutcome, 0);
        assertFalse(finalizedBefore);

        console2.log("propose timestamp:", block.timestamp);
        console2.log("oracle proposed status:", uint256(proposedStatus));
        console2.log("oracle proposed outcome:", uint256(proposedOutcome));

        console2.log("=== Step 6: finalize + claim ===");
        vm.warp(block.timestamp + oracle.DISPUTE_WINDOW() + 1);
        oracle.finalizeResult(FINAL_1_EVENT_ID);
        market.resolve(finalMarketId);

        IEventOracle.EventStatus finalizedStatus = oracle.getEventStatus(FINAL_1_EVENT_ID);
        (uint8 finalizedOutcome, bool finalizedAfter) = oracle.getResult(FINAL_1_EVENT_ID);
        EventMarket.EventMarketDef memory settledMarket = market.getMarket(finalMarketId);
        uint256 totalPool = uint256(BET_AMOUNT) * 3;
        uint256 winningPool = BET_AMOUNT;
        uint256 losingPool = totalPool - winningPool;

        assertEq(uint256(finalizedStatus), uint256(IEventOracle.EventStatus.Finalized));
        assertEq(finalizedOutcome, 0);
        assertTrue(finalizedAfter);
        assertEq(settledMarket.settledOutcome, 0);
        assertEq(settledMarket.protocolFee, 2 * 1e6);
        assertEq(settledMarket.winnerPool, 298 * 1e6);
        assertEq(market.pendingPayout(finalMarketId, alice), 298 * 1e6);

        vm.prank(alice);
        market.claim(finalMarketId);

        vm.expectRevert(EventMarket.NotAWinner.selector);
        vm.prank(bob);
        market.claim(finalMarketId);

        vm.expectRevert(EventMarket.NotAWinner.selector);
        vm.prank(charlie);
        market.claim(finalMarketId);

        assertEq(usdc.balanceOf(alice), 10_198 * 1e6);
        assertEq(usdc.balanceOf(bob), 9_900 * 1e6);
        assertEq(usdc.balanceOf(charlie), 9_900 * 1e6);
        assertEq(usdc.balanceOf(FEE_RECIPIENT), 2 * 1e6);
        assertEq(usdc.balanceOf(address(market)), 0);

        uint256 aliceNet = usdc.balanceOf(alice) - INITIAL_BALANCE;
        uint256 bobLoss = INITIAL_BALANCE - usdc.balanceOf(bob);
        uint256 charlieLoss = INITIAL_BALANCE - usdc.balanceOf(charlie);

        assertEq(aliceNet, 198 * 1e6);
        assertEq(aliceNet + usdc.balanceOf(FEE_RECIPIENT), bobLoss + charlieLoss);

        console2.log("finalize timestamp:", block.timestamp);
        console2.log("oracle finalized status:", uint256(finalizedStatus));
        console2.log("oracle final result:", uint256(finalizedOutcome));
        console2.log("ALICE final balance:", usdc.balanceOf(alice));
        console2.log("BOB final balance:", usdc.balanceOf(bob));
        console2.log("CHARLIE final balance:", usdc.balanceOf(charlie));
        console2.log("feeRecipient balance:", usdc.balanceOf(FEE_RECIPIENT));
        console2.log("total pool:", totalPool);
        console2.log("winning pool:", winningPool);
        console2.log("losing pool:", losingPool);
        console2.log("alice payout:", uint256(298 * 1e6));
        console2.log("protocol fee:", uint256(settledMarket.protocolFee));
        console2.log("market remaining balance:", usdc.balanceOf(address(market)));
        console2.log("conservation lhs:", aliceNet + usdc.balanceOf(FEE_RECIPIENT));
        console2.log("conservation rhs:", bobLoss + charlieLoss);
    }

    function _mintAndApprove(MockUSDC usdc, address user, address spender) internal {
        usdc.mint(user, INITIAL_BALANCE);
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
        // 这里仅读取仓库内固定 seed 文件，用于本地脚本构造确定性测试数据。
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
