// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Test} from "forge-std/Test.sol";
import {EventMarket} from "../src/EventMarket.sol";
import {PredictionMarket} from "../src/PredictionMarket.sol";
import {IEventOracle} from "../src/interfaces/IEventOracle.sol";
import {MockPyth} from "./mocks/MockPyth.sol";
import {MockUSDC} from "./mocks/MockUSDC.sol";

contract MockEventOracle is IEventOracle {
    struct ResultRecord {
        uint8 outcomeIndex;
        bool finalized;
        EventStatus status;
    }

    mapping(bytes32 eventId => ResultRecord record) internal _results;

    function setResult(bytes32 eventId, uint8 outcomeIndex, bool finalized) external {
        _results[eventId] = ResultRecord({
            outcomeIndex: outcomeIndex,
            finalized: finalized,
            status: finalized ? EventStatus.Finalized : EventStatus.Proposed
        });
    }

    function clearResult(bytes32 eventId) external {
        delete _results[eventId];
    }

    function proposeResult(bytes32 eventId, uint8 outcomeIndex) external {
        _results[eventId] = ResultRecord({outcomeIndex: outcomeIndex, finalized: false, status: EventStatus.Proposed});
    }

    function challenge(bytes32 eventId) external {
        _results[eventId].status = EventStatus.Challenged;
    }

    function revokeProposal(bytes32 eventId) external {
        delete _results[eventId];
    }

    function confirmProposal(bytes32 eventId) external {
        _results[eventId].finalized = true;
        _results[eventId].status = EventStatus.Finalized;
    }

    function finalizeResult(bytes32 eventId) external {
        _results[eventId].finalized = true;
        _results[eventId].status = EventStatus.Finalized;
    }

    function finalizeOnTimeout(bytes32 eventId) external {
        _results[eventId].finalized = true;
        _results[eventId].status = EventStatus.Finalized;
    }

    function getResult(bytes32 eventId) external view returns (uint8 outcomeIndex, bool finalized) {
        ResultRecord storage record = _results[eventId];
        return (record.outcomeIndex, record.finalized);
    }

    function getEventStatus(bytes32 eventId) external view returns (EventStatus) {
        return _results[eventId].status;
    }
}

abstract contract EventMarketTestBase is Test {
    uint256 internal constant INITIAL_USDC_BALANCE = 1_000_000_000;
    bytes32 internal constant MATCH_EVENT_ID = keccak256("worldcup-match-1");
    bytes32 internal constant HANDICAP_EVENT_ID = keccak256("worldcup-handicap-1");
    bytes32 internal constant WINNER_EVENT_ID = keccak256("worldcup-winner-1");
    bytes32 internal constant OTHER_EVENT_ID = keccak256("worldcup-match-2");
    bytes32 internal constant PRICE_ID_BTC = bytes32(uint256(1));
    int32 internal constant EXPO_8 = -8;

    address internal owner = address(0xA001);
    address internal feeRecipient = address(0xA002);
    address internal alice = address(0xA101);
    address internal bob = address(0xA102);
    address internal carol = address(0xA103);
    address internal dave = address(0xA104);
    address internal erin = address(0xA105);

    EventMarket internal market;
    PredictionMarket internal predictionMarket;
    MockEventOracle internal oracle;
    MockPyth internal pyth;
    MockUSDC internal usdc;

    function setUp() public virtual {
        usdc = new MockUSDC();
        oracle = new MockEventOracle();
        pyth = new MockPyth();

        market = new EventMarket(address(usdc), owner, feeRecipient, address(oracle));
        predictionMarket = new PredictionMarket(address(usdc), address(pyth), owner, feeRecipient);

        address[5] memory users = [alice, bob, carol, dave, erin];
        for (uint256 i = 0; i < users.length; i++) {
            usdc.mint(users[i], INITIAL_USDC_BALANCE);

            vm.prank(users[i]);
            usdc.approve(address(market), type(uint256).max);

            vm.prank(users[i]);
            usdc.approve(address(predictionMarket), type(uint256).max);
        }
    }

    function _createMarket(bytes32 eventId, uint8 outcomeCount, uint64 betDelay, uint64 resolveDelay, string memory q)
        internal
        returns (uint256 id)
    {
        vm.prank(owner);
        id = market.createMarket(
            eventId, outcomeCount, uint64(block.timestamp + betDelay), uint64(block.timestamp + resolveDelay), q
        );
    }

    function _bet(address user, uint256 id, uint8 outcomeIndex, uint128 amount) internal {
        vm.prank(user);
        market.bet(id, outcomeIndex, amount);
    }

    function _resolveMarket(uint256 id, bytes32 eventId, uint8 outcomeIndex, bool finalized) internal {
        oracle.setResult(eventId, outcomeIndex, finalized);
        EventMarket.EventMarketDef memory marketDef = market.getMarket(id);
        vm.warp(marketDef.resolveAfter);
        market.resolve(id);
    }

    function _assertStakeVector(uint256 id, address user, uint128[] memory expected) internal view {
        uint128[] memory actual = market.userStake(id, user);
        assertEq(actual.length, expected.length);
        for (uint256 i = 0; i < expected.length; i++) {
            assertEq(actual[i], expected[i], "stake vector mismatch");
        }
    }

    function _questionWithLength(uint256 length) internal pure returns (string memory) {
        bytes memory questionBytes = new bytes(length);
        for (uint256 i = 0; i < length; i++) {
            questionBytes[i] = 0x61;
        }
        return string(questionBytes);
    }
}

contract EventMarketSmokeTest is EventMarketTestBase {
    function test_deployment_SetsImmutablesAndDefaults() public view {
        assertEq(market.USDC(), address(usdc));
        assertEq(address(market.ORACLE()), address(oracle));
        assertEq(market.owner(), owner);
        assertEq(market.feeRecipient(), feeRecipient);
        assertEq(market.feeBps(), 100);
        assertEq(market.marketCount(), 0);
        assertEq(market.MIN_BET(), 1e5);
        assertEq(market.UNRESOLVED_OUTCOME(), type(uint8).max);
        assertEq(market.INVALID_OUTCOME(), type(uint8).max - 1);
    }

    function test_constructor_RevertsOnZeroAddress() public {
        vm.expectRevert(EventMarket.ZeroAddress.selector);
        new EventMarket(address(0), owner, feeRecipient, address(oracle));

        vm.expectRevert(EventMarket.ZeroAddress.selector);
        new EventMarket(address(usdc), address(0), feeRecipient, address(oracle));

        vm.expectRevert(EventMarket.ZeroAddress.selector);
        new EventMarket(address(usdc), owner, address(0), address(oracle));

        vm.expectRevert(EventMarket.ZeroAddress.selector);
        new EventMarket(address(usdc), owner, feeRecipient, address(0));
    }
}

contract EventMarketCreateMarketTest is EventMarketTestBase {
    function test_create_1X2Market_3Outcomes() public {
        uint256 id = _createMarket(MATCH_EVENT_ID, 3, 1 days, 1 days + 1 minutes, "Argentina vs France 1X2");

        assertEq(id, 0);
        assertEq(market.marketCount(), 1);

        EventMarket.EventMarketDef memory m = market.getMarket(id);
        assertEq(m.eventId, MATCH_EVENT_ID);
        assertEq(m.outcomeCount, 3);
        assertEq(m.betDeadline, block.timestamp + 1 days);
        assertEq(m.resolveAfter, block.timestamp + 1 days + 1 minutes);
        assertEq(m.outcomePools.length, 3);
        assertEq(m.outcomePools[0], 0);
        assertEq(m.outcomePools[1], 0);
        assertEq(m.outcomePools[2], 0);
        assertEq(m.winnerPool, 0);
        assertEq(m.protocolFee, 0);
        assertEq(m.feeBpsSnapshot, 100);
        assertEq(m.feeRecipientSnapshot, feeRecipient);
        assertEq(m.settledOutcome, market.UNRESOLVED_OUTCOME());
        assertEq(m.settleTime, 0);
        assertEq(m.question, "Argentina vs France 1X2");
    }

    function test_create_BinaryHandicap_2Outcomes() public {
        uint256 id = _createMarket(HANDICAP_EVENT_ID, 2, 2 days, 2 days + 5 minutes, "France -0.5 handicap");
        EventMarket.EventMarketDef memory m = market.getMarket(id);

        assertEq(id, 0);
        assertEq(m.outcomeCount, 2);
        assertEq(m.outcomePools.length, 2);
    }

    function test_create_Winner_32Outcomes() public {
        uint256 id = _createMarket(WINNER_EVENT_ID, 32, 3 days, 4 days, "World Cup winner");
        EventMarket.EventMarketDef memory m = market.getMarket(id);

        assertEq(id, 0);
        assertEq(m.outcomeCount, 32);
        assertEq(m.outcomePools.length, 32);
        assertEq(m.settledOutcome, market.UNRESOLVED_OUTCOME());
    }

    function test_createMarket_SnapshotsFeeAcrossOwnerChange() public {
        uint256 firstId = _createMarket(MATCH_EVENT_ID, 3, 1 days, 1 days + 1 minutes, "Match 1");

        vm.startPrank(owner);
        market.setFeeBps(300);
        market.setFeeRecipient(alice);
        vm.stopPrank();

        uint256 secondId = _createMarket(OTHER_EVENT_ID, 2, 2 days, 2 days + 1 minutes, "Match 2");

        EventMarket.EventMarketDef memory firstMarket = market.getMarket(firstId);
        EventMarket.EventMarketDef memory secondMarket = market.getMarket(secondId);

        assertEq(firstMarket.feeBpsSnapshot, 100);
        assertEq(firstMarket.feeRecipientSnapshot, feeRecipient);
        assertEq(secondMarket.feeBpsSnapshot, 300);
        assertEq(secondMarket.feeRecipientSnapshot, alice);
    }

    function test_createMarket_RevertsOnInvalidOutcomeCount() public {
        vm.prank(owner);
        vm.expectRevert(EventMarket.InvalidOutcomeCount.selector);
        market.createMarket(
            MATCH_EVENT_ID, 1, uint64(block.timestamp + 1 days), uint64(block.timestamp + 2 days), "bad"
        );

        vm.prank(owner);
        vm.expectRevert(EventMarket.InvalidOutcomeCount.selector);
        market.createMarket(
            MATCH_EVENT_ID, 33, uint64(block.timestamp + 1 days), uint64(block.timestamp + 2 days), "bad"
        );
    }

    function test_createMarket_RevertsOnZeroEventId() public {
        vm.prank(owner);
        vm.expectRevert(EventMarket.InvalidEventId.selector);
        market.createMarket(bytes32(0), 3, uint64(block.timestamp + 1 days), uint64(block.timestamp + 2 days), "bad");
    }

    function test_createMarket_RevertsIfTimesInPast() public {
        vm.prank(owner);
        vm.expectRevert(EventMarket.TimesInPast.selector);
        market.createMarket(MATCH_EVENT_ID, 3, uint64(block.timestamp), uint64(block.timestamp + 1 minutes), "bad");
    }

    function test_createMarket_RevertsIfInvalidTimeOrder() public {
        uint64 betDeadline = uint64(block.timestamp + 1 days);

        vm.prank(owner);
        vm.expectRevert(EventMarket.InvalidTimeOrder.selector);
        market.createMarket(MATCH_EVENT_ID, 3, betDeadline, betDeadline, "bad");
    }

    function test_createMarket_RevertsIfQuestionTooLong() public {
        uint256 maxQuestionLen = market.MAX_QUESTION_LEN();

        vm.prank(owner);
        vm.expectRevert(EventMarket.QuestionTooLong.selector);
        market.createMarket(
            MATCH_EVENT_ID,
            3,
            uint64(block.timestamp + 1 days),
            uint64(block.timestamp + 2 days),
            _questionWithLength(maxQuestionLen + 1)
        );
    }

    function test_createMarket_RevertsIfMarketLimitReached() public {
        uint256 maxMarkets = market.MAX_MARKETS();

        for (uint64 i = 0; i < maxMarkets; i++) {
            bytes32 eventId = bytes32(uint256(i) + 1);
            _createMarket(eventId, 2, 1 days + i, 2 days + i, "cap");
        }

        vm.prank(owner);
        vm.expectRevert(EventMarket.MarketLimitReached.selector);
        market.createMarket(
            bytes32(uint256(10_001)),
            2,
            uint64(block.timestamp + 10 days),
            uint64(block.timestamp + 10 days + 1 minutes),
            "overflow"
        );
    }

    function test_setFeeBps_OwnerCanUpdateFee() public {
        vm.prank(owner);
        market.setFeeBps(300);
        assertEq(market.feeBps(), 300);
    }

    function test_setFeeBps_RevertsIfFeeTooHigh() public {
        uint16 tooHigh = market.MAX_FEE_BPS() + 1;

        vm.prank(owner);
        vm.expectRevert(EventMarket.FeeTooHigh.selector);
        market.setFeeBps(tooHigh);
    }

    function test_setFeeBps_NonOwnerReverts() public {
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, alice));
        vm.prank(alice);
        market.setFeeBps(300);
    }

    function test_setFeeRecipient_OwnerCanUpdateRecipient() public {
        vm.prank(owner);
        market.setFeeRecipient(alice);
        assertEq(market.feeRecipient(), alice);
    }

    function test_setFeeRecipient_RevertsIfZeroAddress() public {
        vm.prank(owner);
        vm.expectRevert(EventMarket.ZeroAddress.selector);
        market.setFeeRecipient(address(0));
    }

    function test_setFeeRecipient_NonOwnerReverts() public {
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, alice));
        vm.prank(alice);
        market.setFeeRecipient(bob);
    }

    function test_marketsGetter_AndPagedAccess() public {
        uint256 firstId = _createMarket(MATCH_EVENT_ID, 3, 1 days, 1 days + 1 minutes, "Match 1");
        _createMarket(HANDICAP_EVENT_ID, 2, 2 days, 2 days + 1 minutes, "Match 2");
        _createMarket(WINNER_EVENT_ID, 32, 3 days, 3 days + 1 minutes, "Winner");

        (
            bytes32 eventId,
            uint8 outcomeCount,
            uint64 betDeadline,
            uint64 resolveAfter,
            uint128[] memory outcomePools,
            uint128 winnerPool,
            uint128 protocolFee,
            uint16 feeBpsSnapshot,
            address feeRecipientSnapshot,
            uint8 settledOutcome,
            uint64 settleTime,
            string memory question
        ) = market.markets(firstId);

        assertEq(eventId, MATCH_EVENT_ID);
        assertEq(outcomeCount, 3);
        assertEq(betDeadline, block.timestamp + 1 days);
        assertEq(resolveAfter, block.timestamp + 1 days + 1 minutes);
        assertEq(outcomePools.length, 3);
        assertEq(winnerPool, 0);
        assertEq(protocolFee, 0);
        assertEq(feeBpsSnapshot, 100);
        assertEq(feeRecipientSnapshot, feeRecipient);
        assertEq(settledOutcome, market.UNRESOLVED_OUTCOME());
        assertEq(settleTime, 0);
        assertEq(question, "Match 1");

        EventMarket.EventMarketDef[] memory page = market.getMarketsPaged(1, 3);
        assertEq(page.length, 2);
        assertEq(page[0].eventId, HANDICAP_EVENT_ID);
        assertEq(page[1].eventId, WINNER_EVENT_ID);
    }

    function test_getMarketAndPagedAccess_RevertOnInvalidRangeOrId() public {
        vm.expectRevert(EventMarket.InvalidMarketId.selector);
        market.getMarket(0);

        vm.expectRevert(EventMarket.InvalidMarketId.selector);
        market.markets(0);

        _createMarket(MATCH_EVENT_ID, 3, 1 days, 1 days + 1 minutes, "Match 1");

        vm.expectRevert(EventMarket.InvalidMarketId.selector);
        market.getMarketsPaged(1, 0);

        vm.expectRevert(EventMarket.InvalidMarketId.selector);
        market.getMarketsPaged(0, 2);
    }
}

contract EventMarketBetTest is EventMarketTestBase {
    function test_bet_DistributesToCorrectPool() public {
        uint256 id = _createMarket(MATCH_EVENT_ID, 3, 1 days, 1 days + 1 minutes, "1X2");

        _bet(alice, id, 0, 4_000_000);
        _bet(bob, id, 2, 6_000_000);
        _bet(carol, id, 1, 3_000_000);
        _bet(alice, id, 2, 1_000_000);

        EventMarket.EventMarketDef memory m = market.getMarket(id);
        assertEq(m.outcomePools[0], 4_000_000);
        assertEq(m.outcomePools[1], 3_000_000);
        assertEq(m.outcomePools[2], 7_000_000);

        uint128[] memory aliceExpected = new uint128[](3);
        aliceExpected[0] = 4_000_000;
        aliceExpected[2] = 1_000_000;
        _assertStakeVector(id, alice, aliceExpected);

        uint128[] memory bobExpected = new uint128[](3);
        bobExpected[2] = 6_000_000;
        _assertStakeVector(id, bob, bobExpected);

        assertEq(market.stakeByOutcome(id, alice, 0), 4_000_000);
        assertEq(market.stakeByOutcome(id, alice, 2), 1_000_000);
        assertEq(market.stakeByOutcome(id, bob, 2), 6_000_000);
        assertEq(usdc.balanceOf(address(market)), 14_000_000);
    }

    function test_revertOnInvalidOutcomeIndex() public {
        uint256 id = _createMarket(MATCH_EVENT_ID, 3, 1 days, 1 days + 1 minutes, "1X2");

        vm.prank(alice);
        vm.expectRevert(EventMarket.InvalidOutcomeIndex.selector);
        market.bet(id, 3, 1_000_000);
    }

    function test_bet_RevertsIfInvalidMarketId() public {
        vm.prank(alice);
        vm.expectRevert(EventMarket.InvalidMarketId.selector);
        market.bet(99, 0, 1_000_000);
    }

    function test_bet_RevertsIfBelowMinBet() public {
        uint256 id = _createMarket(MATCH_EVENT_ID, 3, 1 days, 1 days + 1 minutes, "1X2");
        uint128 belowMinBet = market.MIN_BET() - 1;

        vm.prank(alice);
        vm.expectRevert(EventMarket.BelowMinBet.selector);
        market.bet(id, 0, belowMinBet);
    }

    function test_bet_RevertsAfterDeadline() public {
        uint256 id = _createMarket(MATCH_EVENT_ID, 3, 1 days, 1 days + 1 minutes, "1X2");

        vm.warp(block.timestamp + 1 days);
        vm.prank(alice);
        vm.expectRevert(EventMarket.BettingClosed.selector);
        market.bet(id, 0, 1_000_000);
    }

    function test_bet_RevertsIfResolved() public {
        uint256 id = _createMarket(MATCH_EVENT_ID, 3, 1 days, 1 days + 1 minutes, "1X2");
        _bet(alice, id, 0, 2_000_000);
        _resolveMarket(id, MATCH_EVENT_ID, 0, true);

        vm.prank(bob);
        vm.expectRevert(EventMarket.AlreadyResolved.selector);
        market.bet(id, 1, 1_000_000);
    }

    function test_userStake_RevertsIfInvalidMarketId() public {
        vm.expectRevert(EventMarket.InvalidMarketId.selector);
        market.userStake(99, alice);
    }
}

contract EventMarketResolveTest is EventMarketTestBase {
    function test_resolve_OnlyAfterOracleFinalized() public {
        uint256 id = _createMarket(MATCH_EVENT_ID, 3, 1 days, 1 days + 1 minutes, "1X2");
        _bet(alice, id, 2, 12_000_000);
        _bet(bob, id, 0, 8_000_000);

        EventMarket.EventMarketDef memory beforeResolve = market.getMarket(id);
        vm.warp(beforeResolve.resolveAfter);
        oracle.setResult(MATCH_EVENT_ID, 2, false);

        vm.expectRevert(EventMarket.OracleResultNotFinalized.selector);
        market.resolve(id);

        oracle.setResult(MATCH_EVENT_ID, 2, true);
        market.resolve(id);

        EventMarket.EventMarketDef memory afterResolve = market.getMarket(id);
        assertEq(afterResolve.settledOutcome, 2);
        assertEq(afterResolve.protocolFee, 80_000);
        assertEq(afterResolve.winnerPool, 19_920_000);
        assertEq(afterResolve.settleTime, beforeResolve.resolveAfter);
        assertEq(usdc.balanceOf(feeRecipient), 80_000);
    }

    function test_resolve_InvalidRefundOnZeroTotalPool() public {
        uint256 id = _createMarket(MATCH_EVENT_ID, 3, 1 days, 1 days + 1 minutes, "1X2");

        _resolveMarket(id, MATCH_EVENT_ID, 1, true);

        EventMarket.EventMarketDef memory m = market.getMarket(id);
        assertEq(m.settledOutcome, market.INVALID_OUTCOME());
        assertEq(m.winnerPool, 0);
        assertEq(m.protocolFee, 0);
        assertEq(usdc.balanceOf(feeRecipient), 0);
    }

    function test_resolve_InvalidRefundOnZeroWinningPool() public {
        uint256 id = _createMarket(MATCH_EVENT_ID, 3, 1 days, 1 days + 1 minutes, "1X2");
        _bet(alice, id, 0, 3_000_000);
        _bet(bob, id, 1, 4_000_000);

        _resolveMarket(id, MATCH_EVENT_ID, 2, true);

        EventMarket.EventMarketDef memory m = market.getMarket(id);
        assertEq(m.settledOutcome, market.INVALID_OUTCOME());
        assertEq(m.winnerPool, 0);
        assertEq(m.protocolFee, 0);
        assertEq(usdc.balanceOf(feeRecipient), 0);
    }

    function test_resolve_InvalidRefundOnOracleOutcomeOutOfRange() public {
        uint256 id = _createMarket(MATCH_EVENT_ID, 3, 1 days, 1 days + 1 minutes, "1X2");
        _bet(alice, id, 0, 3_000_000);
        _bet(bob, id, 2, 5_000_000);

        EventMarket.EventMarketDef memory m = market.getMarket(id);
        vm.warp(m.resolveAfter);
        oracle.setResult(MATCH_EVENT_ID, 8, true);

        market.resolve(id);

        EventMarket.EventMarketDef memory afterResolve = market.getMarket(id);
        assertEq(afterResolve.settledOutcome, market.INVALID_OUTCOME());
        assertEq(afterResolve.winnerPool, 0);
        assertEq(afterResolve.protocolFee, 0);
        assertEq(usdc.balanceOf(feeRecipient), 0);

        vm.prank(alice);
        market.claim(id);

        vm.prank(bob);
        market.claim(id);

        assertEq(usdc.balanceOf(alice), INITIAL_USDC_BALANCE);
        assertEq(usdc.balanceOf(bob), INITIAL_USDC_BALANCE);
        assertTrue(market.claimed(id, alice));
        assertTrue(market.claimed(id, bob));

        vm.prank(alice);
        vm.expectRevert(EventMarket.AlreadyClaimed.selector);
        market.claim(id);

        vm.prank(bob);
        vm.expectRevert(EventMarket.AlreadyClaimed.selector);
        market.claim(id);
    }

    function test_resolve_RevertsBeforeResolveAfter() public {
        uint256 id = _createMarket(MATCH_EVENT_ID, 3, 1 days, 1 days + 1 minutes, "1X2");
        _bet(alice, id, 0, 3_000_000);
        oracle.setResult(MATCH_EVENT_ID, 0, true);

        vm.expectRevert(EventMarket.NotResolvableYet.selector);
        market.resolve(id);
    }

    function test_resolve_RevertsIfAlreadyResolved() public {
        uint256 id = _createMarket(MATCH_EVENT_ID, 3, 1 days, 1 days + 1 minutes, "1X2");
        _bet(alice, id, 0, 3_000_000);
        _resolveMarket(id, MATCH_EVENT_ID, 0, true);

        vm.expectRevert(EventMarket.AlreadyResolved.selector);
        market.resolve(id);
    }

    function test_resolve_RevertsIfInvalidMarketId() public {
        vm.expectRevert(EventMarket.InvalidMarketId.selector);
        market.resolve(99);
    }
}

contract EventMarketClaimTest is EventMarketTestBase {
    function test_claim_WinnerOnly_LosersGetZero() public {
        uint256 id = _createMarket(MATCH_EVENT_ID, 3, 1 days, 1 days + 1 minutes, "1X2");
        _bet(alice, id, 2, 12_000_000);
        _bet(bob, id, 1, 8_000_000);
        _bet(carol, id, 0, 5_000_000);

        _resolveMarket(id, MATCH_EVENT_ID, 2, true);

        assertEq(market.pendingPayout(id, alice), 24_870_000);
        assertEq(market.pendingPayout(id, bob), 0);

        vm.prank(bob);
        vm.expectRevert(EventMarket.NotAWinner.selector);
        market.claim(id);

        vm.prank(carol);
        vm.expectRevert(EventMarket.NotAWinner.selector);
        market.claim(id);

        vm.prank(alice);
        market.claim(id);

        assertTrue(market.claimed(id, alice));
        assertEq(market.pendingPayout(id, alice), 0);
        assertEq(usdc.balanceOf(alice), INITIAL_USDC_BALANCE + 12_870_000);
        assertEq(usdc.balanceOf(feeRecipient), 130_000);
    }

    function test_claim_InvalidRefundsAllOutcomeStakes() public {
        uint256 id = _createMarket(MATCH_EVENT_ID, 3, 1 days, 1 days + 1 minutes, "1X2");
        _bet(alice, id, 0, 3_000_000);
        _bet(alice, id, 1, 4_000_000);
        _bet(bob, id, 1, 2_000_000);

        _resolveMarket(id, MATCH_EVENT_ID, 2, true);

        assertEq(market.pendingPayout(id, alice), 7_000_000);
        assertEq(market.pendingPayout(id, bob), 2_000_000);

        vm.prank(alice);
        market.claim(id);

        vm.prank(bob);
        market.claim(id);

        assertEq(usdc.balanceOf(alice), INITIAL_USDC_BALANCE);
        assertEq(usdc.balanceOf(bob), INITIAL_USDC_BALANCE);
        assertTrue(market.claimed(id, alice));
        assertTrue(market.claimed(id, bob));
    }

    function test_claim_RevertsWhenNoStake() public {
        uint256 id = _createMarket(MATCH_EVENT_ID, 3, 1 days, 1 days + 1 minutes, "1X2");
        _bet(alice, id, 0, 2_000_000);
        _resolveMarket(id, MATCH_EVENT_ID, 0, true);

        vm.prank(bob);
        vm.expectRevert(EventMarket.NoPayoutAvailable.selector);
        market.claim(id);
    }

    function test_claim_RevertsWhenAlreadyClaimed() public {
        uint256 id = _createMarket(MATCH_EVENT_ID, 3, 1 days, 1 days + 1 minutes, "1X2");
        _bet(alice, id, 0, 2_000_000);
        _bet(bob, id, 2, 1_000_000);
        _resolveMarket(id, MATCH_EVENT_ID, 0, true);

        vm.prank(alice);
        market.claim(id);

        vm.prank(alice);
        vm.expectRevert(EventMarket.AlreadyClaimed.selector);
        market.claim(id);
    }

    function test_claim_RevertsBeforeResolve() public {
        uint256 id = _createMarket(MATCH_EVENT_ID, 3, 1 days, 1 days + 1 minutes, "1X2");
        _bet(alice, id, 0, 2_000_000);

        vm.prank(alice);
        vm.expectRevert(EventMarket.NotResolved.selector);
        market.claim(id);
    }

    function test_pendingPayout_RevertsOnInvalidMarketId() public {
        vm.expectRevert(EventMarket.InvalidMarketId.selector);
        market.pendingPayout(99, alice);
    }
}

contract EventMarketViewTest is EventMarketTestBase {
    function test_eliminatedTeamHoldingRemainsUntilFinalSettlement() public {
        uint256 id = _createMarket(WINNER_EVENT_ID, 32, 1 days, 3 days, "World Cup winner");
        _bet(alice, id, 3, 2_000_000);
        _bet(bob, id, 10, 5_000_000);
        _bet(carol, id, 31, 9_000_000);

        EventMarket.EventMarketDef memory beforeResolve = market.getMarket(id);
        vm.warp(beforeResolve.resolveAfter);
        oracle.setResult(WINNER_EVENT_ID, 31, false);

        vm.expectRevert(EventMarket.OracleResultNotFinalized.selector);
        market.resolve(id);

        assertEq(market.stakeByOutcome(id, alice, 3), 2_000_000);
        assertEq(market.stakeByOutcome(id, bob, 10), 5_000_000);
        assertEq(market.stakeByOutcome(id, carol, 31), 9_000_000);

        oracle.setResult(WINNER_EVENT_ID, 31, true);
        market.resolve(id);

        vm.prank(alice);
        vm.expectRevert(EventMarket.NotAWinner.selector);
        market.claim(id);

        EventMarket.EventMarketDef memory afterResolve = market.getMarket(id);
        assertEq(afterResolve.outcomePools[3], 2_000_000);
        assertEq(afterResolve.outcomePools[10], 5_000_000);
        assertEq(afterResolve.outcomePools[31], 9_000_000);
    }

    function test_getDashboardLatest_ReturnsNewestFirst() public {
        uint256 firstId = _createMarket(MATCH_EVENT_ID, 3, 1 days, 1 days + 1 minutes, "Match 1");
        uint256 secondId = _createMarket(HANDICAP_EVENT_ID, 2, 2 days, 2 days + 1 minutes, "Match 2");
        uint256 thirdId = _createMarket(WINNER_EVENT_ID, 32, 3 days, 3 days + 1 minutes, "Winner");

        _bet(alice, thirdId, 7, 3_000_000);

        (EventMarket.DashboardRow[] memory rows, uint256 total) = market.getDashboardLatest(alice, 2);
        assertEq(total, 3);
        assertEq(rows.length, 2);
        assertEq(rows[0].id, thirdId);
        assertEq(rows[1].id, secondId);
        assertEq(rows[0].market.eventId, WINNER_EVENT_ID);
        assertEq(rows[1].market.eventId, HANDICAP_EVENT_ID);
        assertEq(rows[0].userOutcomeStakes[7], 3_000_000);
        assertEq(rows[0].claimed_, false);
        assertEq(firstId, 0);
    }

    function test_getDashboard_ReflectsClaimAndPendingPayout() public {
        uint256 id = _createMarket(MATCH_EVENT_ID, 3, 1 days, 1 days + 1 minutes, "1X2");
        _bet(alice, id, 0, 10_000_000);
        _bet(bob, id, 2, 4_000_000);
        _resolveMarket(id, MATCH_EVENT_ID, 0, true);

        (EventMarket.DashboardRow[] memory beforeClaimRows,) = market.getDashboard(alice, 0, 1);
        assertEq(beforeClaimRows.length, 1);
        assertEq(beforeClaimRows[0].userOutcomeStakes[0], 10_000_000);
        assertEq(beforeClaimRows[0].pendingPayout, 13_960_000);
        assertEq(beforeClaimRows[0].claimed_, false);

        vm.prank(alice);
        market.claim(id);

        (EventMarket.DashboardRow[] memory afterClaimRows,) = market.getDashboard(alice, 0, 1);
        assertEq(afterClaimRows[0].pendingPayout, 0);
        assertEq(afterClaimRows[0].claimed_, true);
    }

    function test_getDashboardLatest_HandlesZeroAndOversizedLimit() public {
        _createMarket(MATCH_EVENT_ID, 3, 1 days, 1 days + 1 minutes, "Match 1");
        _createMarket(HANDICAP_EVENT_ID, 2, 2 days, 2 days + 1 minutes, "Match 2");

        (EventMarket.DashboardRow[] memory zeroRows, uint256 total) = market.getDashboardLatest(alice, 0);
        assertEq(zeroRows.length, 0);
        assertEq(total, 2);

        (EventMarket.DashboardRow[] memory allRows, uint256 oversizedTotal) = market.getDashboardLatest(alice, 10);
        assertEq(allRows.length, 2);
        assertEq(oversizedTotal, 2);
    }

    function test_getDashboard_RevertsOnInvalidRange() public {
        _createMarket(MATCH_EVENT_ID, 3, 1 days, 1 days + 1 minutes, "Match 1");

        vm.expectRevert(EventMarket.InvalidMarketId.selector);
        market.getDashboard(alice, 1, 0);

        vm.expectRevert(EventMarket.InvalidMarketId.selector);
        market.getDashboard(alice, 0, 2);
    }

    function test_sharedUSDCWithPredictionMarket() public {
        uint256 eventMarketId = _createMarket(MATCH_EVENT_ID, 3, 1 days, 1 days + 1 minutes, "1X2");

        vm.prank(owner);
        uint256 predictionMarketId = predictionMarket.createMarket(
            PRICE_ID_BTC,
            70_000_00000000,
            EXPO_8,
            uint64(block.timestamp + 1 days),
            uint64(block.timestamp + 1 days + 1 minutes),
            "BTC >= 70k"
        );

        _bet(alice, eventMarketId, 0, 3_000_000);

        vm.prank(alice);
        predictionMarket.bet(predictionMarketId, true, 5_000_000);

        assertEq(market.USDC(), predictionMarket.USDC());
        assertEq(market.USDC(), address(usdc));
        assertEq(usdc.allowance(alice, address(market)), type(uint256).max);
        assertEq(usdc.allowance(alice, address(predictionMarket)), type(uint256).max);
        assertEq(usdc.balanceOf(address(market)), 3_000_000);
        assertEq(usdc.balanceOf(address(predictionMarket)), 5_000_000);
    }
}
