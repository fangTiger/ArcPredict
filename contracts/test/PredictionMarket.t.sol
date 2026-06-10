// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Test} from "forge-std/Test.sol";
import {PredictionMarket} from "../src/PredictionMarket.sol";
import {MockUSDC} from "./mocks/MockUSDC.sol";
import {MockPyth} from "./mocks/MockPyth.sol";

contract PredictionMarketTestBase is Test {
    PredictionMarket public market;
    MockUSDC public usdc;
    MockPyth public pyth;

    uint256 internal constant INITIAL_USDC_BALANCE = 1_000_000_000;
    uint256 internal constant INITIAL_NATIVE_BALANCE = 10 ether;
    bytes32 public constant PRICE_ID_BTC = bytes32(uint256(1));
    int32 public constant EXPO_8 = -8;

    address public owner = address(0xA001);
    address public feeRecipient = address(0xA002);
    address public alice = address(0xA101);
    address public bob = address(0xA102);
    address public carol = address(0xA103);

    function setUp() public {
        usdc = new MockUSDC();
        pyth = new MockPyth();

        vm.prank(owner);
        market = new PredictionMarket(address(usdc), address(pyth), owner, feeRecipient);

        address[3] memory users = [alice, bob, carol];
        for (uint256 i = 0; i < users.length; i++) {
            usdc.mint(users[i], INITIAL_USDC_BALANCE);

            vm.prank(users[i]);
            usdc.approve(address(market), type(uint256).max);

            vm.deal(users[i], INITIAL_NATIVE_BALANCE);
        }
    }

    function _makeMarket(int64 threshold, uint64 inHours) internal returns (uint256 id) {
        vm.prank(owner);
        id = market.createMarket(
            PRICE_ID_BTC,
            threshold,
            EXPO_8,
            uint64(block.timestamp + inHours * 1 hours),
            uint64(block.timestamp + inHours * 1 hours + 1 minutes),
            "Test market"
        );
    }
}

contract PredictionMarketSmokeTest is PredictionMarketTestBase {
    function test_TestBase_DefinesMarketConstants() public pure {
        assertEq(PRICE_ID_BTC, bytes32(uint256(1)));
        assertEq(EXPO_8, -8);
    }

    function test_Deployment_SetsImmutables() public view {
        assertEq(market.USDC(), address(usdc));
        assertEq(market.PYTH(), address(pyth));
        assertEq(market.owner(), owner);
        assertEq(market.feeRecipient(), feeRecipient);
        assertEq(market.feeBps(), 100);
        assertEq(market.marketCount(), 0);
    }

    function test_Constructor_RevertsOnZeroAddress() public {
        vm.expectRevert(PredictionMarket.ZeroAddress.selector);
        new PredictionMarket(address(0), address(pyth), owner, feeRecipient);
    }

    function test_SetUp_SeedsUsersAndApprovals() public view {
        _assertSeededUser(alice);
        _assertSeededUser(bob);
        _assertSeededUser(carol);
    }

    function _assertSeededUser(address user) internal view {
        assertEq(usdc.balanceOf(user), INITIAL_USDC_BALANCE);
        assertEq(usdc.allowance(user, address(market)), type(uint256).max);
        assertEq(user.balance, INITIAL_NATIVE_BALANCE);
    }
}

contract CreateMarketTest is PredictionMarketTestBase {
    function test_MarketsGetter_RevertsOnInvalidMarketId() public {
        vm.expectRevert(PredictionMarket.InvalidMarketId.selector);
        market.markets(0);
    }

    function test_CreateMarket_HappyPath() public {
        vm.prank(owner);
        uint256 id = market.createMarket(
            PRICE_ID_BTC,
            70000_00000000,
            EXPO_8,
            uint64(block.timestamp + 1 days),
            uint64(block.timestamp + 1 days + 1 minutes),
            "BTC >= 70k"
        );
        assertEq(id, 0);
        assertEq(market.marketCount(), 1);

        PredictionMarket.Market memory m = market.getMarket(id);
        assertEq(m.pythPriceId, PRICE_ID_BTC);
        assertEq(m.threshold, 70000_00000000);
        assertEq(m.thresholdExpo, EXPO_8);
        assertEq(m.feeBpsSnapshot, 100);
        assertEq(m.feeRecipientSnapshot, feeRecipient);
        assertEq(uint8(m.outcome), uint8(PredictionMarket.Outcome.Unresolved));
    }

    function test_CreateMarket_NonOwnerReverts() public {
        vm.prank(alice);
        vm.expectRevert();
        market.createMarket(
            PRICE_ID_BTC,
            70000_00000000,
            EXPO_8,
            uint64(block.timestamp + 1 days),
            uint64(block.timestamp + 1 days + 1 minutes),
            "x"
        );
    }

    function test_CreateMarket_RevertsIfTimesInPast() public {
        vm.prank(owner);
        vm.expectRevert(PredictionMarket.TimesInPast.selector);
        market.createMarket(
            PRICE_ID_BTC,
            70000_00000000,
            EXPO_8,
            uint64(block.timestamp),
            uint64(block.timestamp + 1 minutes),
            "BTC >= 70k"
        );
    }

    function test_CreateMarket_RevertsIfInvalidTimeOrder() public {
        uint64 betDeadline = uint64(block.timestamp + 1 days);

        vm.prank(owner);
        vm.expectRevert(PredictionMarket.InvalidTimeOrder.selector);
        market.createMarket(PRICE_ID_BTC, 70000_00000000, EXPO_8, betDeadline, betDeadline, "BTC >= 70k");
    }

    function test_CreateMarket_RevertsIfQuestionTooLong() public {
        string memory question = _questionWithLength(market.MAX_QUESTION_LEN() + 1);

        vm.prank(owner);
        vm.expectRevert(PredictionMarket.QuestionTooLong.selector);
        market.createMarket(
            PRICE_ID_BTC,
            70000_00000000,
            EXPO_8,
            uint64(block.timestamp + 1 days),
            uint64(block.timestamp + 1 days + 1 minutes),
            question
        );
    }

    function test_CreateMarket_RevertsIfPriceIdZero() public {
        vm.prank(owner);
        vm.expectRevert(PredictionMarket.InvalidPriceId.selector);
        market.createMarket(
            bytes32(0),
            70000_00000000,
            EXPO_8,
            uint64(block.timestamp + 1 days),
            uint64(block.timestamp + 1 days + 1 minutes),
            "BTC >= 70k"
        );
    }

    function test_CreateMarket_RevertsIfMarketLimitReached() public {
        vm.store(address(market), bytes32(uint256(6)), bytes32(uint256(market.MAX_MARKETS())));

        vm.prank(owner);
        vm.expectRevert(PredictionMarket.MarketLimitReached.selector);
        market.createMarket(
            PRICE_ID_BTC,
            70000_00000000,
            EXPO_8,
            uint64(block.timestamp + 1 days),
            uint64(block.timestamp + 1 days + 1 minutes),
            "BTC >= 70k"
        );
    }

    function test_CreateMarket_SnapshotsFeeAcrossOwnerChange() public {
        vm.prank(owner);
        uint256 firstId = market.createMarket(
            PRICE_ID_BTC,
            70000_00000000,
            EXPO_8,
            uint64(block.timestamp + 1 days),
            uint64(block.timestamp + 1 days + 1 minutes),
            "BTC >= 70k"
        );

        vm.startPrank(owner);
        market.setFeeBps(300);
        market.setFeeRecipient(alice);
        uint256 secondId = market.createMarket(
            PRICE_ID_BTC,
            71000_00000000,
            EXPO_8,
            uint64(block.timestamp + 2 days),
            uint64(block.timestamp + 2 days + 1 minutes),
            "BTC >= 71k"
        );
        vm.stopPrank();

        PredictionMarket.Market memory firstMarket = market.getMarket(firstId);
        PredictionMarket.Market memory secondMarket = market.getMarket(secondId);

        assertEq(firstMarket.feeBpsSnapshot, 100);
        assertEq(firstMarket.feeRecipientSnapshot, feeRecipient);
        assertEq(secondMarket.feeBpsSnapshot, 300);
        assertEq(secondMarket.feeRecipientSnapshot, alice);
    }

    function test_SetFeeBps_OwnerCanUpdateFee() public {
        vm.prank(owner);
        market.setFeeBps(300);

        assertEq(market.feeBps(), 300);
    }

    function test_SetFeeBps_RevertsIfFeeTooHigh() public {
        uint16 tooHigh = market.MAX_FEE_BPS() + 1;

        vm.prank(owner);
        vm.expectRevert(PredictionMarket.FeeTooHigh.selector);
        market.setFeeBps(tooHigh);
    }

    function test_SetFeeBps_NonOwnerReverts() public {
        vm.prank(alice);
        vm.expectRevert();
        market.setFeeBps(300);
    }

    function test_SetFeeRecipient_OwnerCanUpdateRecipient() public {
        vm.prank(owner);
        market.setFeeRecipient(alice);

        assertEq(market.feeRecipient(), alice);
    }

    function test_SetFeeRecipient_RevertsIfZeroAddress() public {
        vm.prank(owner);
        vm.expectRevert(PredictionMarket.ZeroAddress.selector);
        market.setFeeRecipient(address(0));
    }

    function test_SetFeeRecipient_NonOwnerReverts() public {
        vm.prank(alice);
        vm.expectRevert();
        market.setFeeRecipient(bob);
    }

    function _questionWithLength(uint256 length) internal pure returns (string memory) {
        bytes memory questionBytes = new bytes(length);
        for (uint256 i = 0; i < length; i++) {
            questionBytes[i] = 0x61;
        }
        return string(questionBytes);
    }
}

contract BetTest is PredictionMarketTestBase {
    event Bet(
        uint256 indexed id, address indexed user, bool yes, uint128 amount, uint128 yesPoolAfter, uint128 noPoolAfter
    );

    function test_Bet_HappyPath_Yes() public {
        uint256 id = _makeMarket(70000_00000000, 24);

        vm.expectEmit(true, true, false, true);
        emit Bet(id, alice, true, 10_000_000, 10_000_000, 0);

        vm.prank(alice);
        market.bet(id, true, 10_000_000);

        (uint128 yes, uint128 no) = market.userStake(id, alice);
        assertEq(yes, 10_000_000);
        assertEq(no, 0);

        PredictionMarket.Market memory m = market.getMarket(id);
        assertEq(m.yesPool, 10_000_000);
        assertEq(m.noPool, 0);

        assertEq(usdc.balanceOf(alice), INITIAL_USDC_BALANCE - 10_000_000);
        assertEq(usdc.balanceOf(address(market)), 10_000_000);
    }

    function test_Bet_HappyPath_No() public {
        uint256 id = _makeMarket(70000_00000000, 24);

        vm.expectEmit(true, true, false, true);
        emit Bet(id, bob, false, 8_000_000, 0, 8_000_000);

        vm.prank(bob);
        market.bet(id, false, 8_000_000);

        (uint128 yes, uint128 no) = market.userStake(id, bob);
        assertEq(yes, 0);
        assertEq(no, 8_000_000);

        PredictionMarket.Market memory m = market.getMarket(id);
        assertEq(m.yesPool, 0);
        assertEq(m.noPool, 8_000_000);

        assertEq(usdc.balanceOf(bob), INITIAL_USDC_BALANCE - 8_000_000);
        assertEq(usdc.balanceOf(address(market)), 8_000_000);
    }

    function test_Bet_AccumulatesSameUser() public {
        uint256 id = _makeMarket(70000_00000000, 24);

        vm.prank(alice);
        market.bet(id, true, 3_000_000);

        vm.prank(alice);
        market.bet(id, true, 7_000_000);

        (uint128 yes, uint128 no) = market.userStake(id, alice);
        assertEq(yes, 10_000_000);
        assertEq(no, 0);

        PredictionMarket.Market memory m = market.getMarket(id);
        assertEq(m.yesPool, 10_000_000);
        assertEq(m.noPool, 0);
    }

    function test_Bet_RevertsIfInvalidMarketId() public {
        vm.prank(alice);
        vm.expectRevert(PredictionMarket.InvalidMarketId.selector);
        market.bet(99, true, 10_000_000);
    }

    function test_Bet_RevertsIfBelowMinBet() public {
        uint256 id = _makeMarket(70000_00000000, 24);

        vm.prank(alice);
        vm.expectRevert(PredictionMarket.BelowMinBet.selector);
        market.bet(id, true, 1);
    }

    function test_Bet_RevertsAfterDeadline() public {
        uint256 id = _makeMarket(70000_00000000, 24);

        vm.warp(block.timestamp + 24 hours);

        vm.prank(alice);
        vm.expectRevert(PredictionMarket.BettingClosed.selector);
        market.bet(id, true, 1_000_000);
    }

    function test_UserStake_RevertsIfInvalidMarketId() public {
        vm.expectRevert(PredictionMarket.InvalidMarketId.selector);
        market.userStake(99, alice);
    }
}

contract ResolveTest is PredictionMarketTestBase {
    event Resolved(
        uint256 indexed id,
        PredictionMarket.Outcome outcome,
        int64 settlePrice,
        uint64 settleTime,
        uint128 winnerPool,
        uint128 protocolFee
    );

    receive() external payable {}

    function _setupAndBet() internal returns (uint256 id) {
        id = _makeMarket(70000_00000000, 24);

        vm.prank(alice);
        market.bet(id, true, 100_000_000);

        vm.prank(bob);
        market.bet(id, false, 50_000_000);
    }

    function _resolve(uint256 id, int64 price, uint64 ts) internal {
        pyth.setNextPrice(price, EXPO_8, ts, 0);

        bytes[] memory updateData = new bytes[](1);

        vm.warp(ts + 1);
        vm.deal(address(this), 1 ether);
        market.resolve{value: 1 wei}(id, updateData);
    }

    function test_Resolve_RevertsBeforeResolveAfter() public {
        uint256 id = _setupAndBet();

        bytes[] memory updateData = new bytes[](1);

        vm.deal(address(this), 1 ether);
        vm.expectRevert(PredictionMarket.NotResolvableYet.selector);
        market.resolve{value: 1 wei}(id, updateData);
    }

    function test_Resolve_RevertsIfAlreadyResolved() public {
        uint256 id = _setupAndBet();
        PredictionMarket.Market memory mBefore = market.getMarket(id);

        _resolve(id, 75000_00000000, mBefore.resolveAfter);

        bytes[] memory updateData = new bytes[](1);

        vm.expectRevert(PredictionMarket.AlreadyResolved.selector);
        market.resolve(id, updateData);
    }

    function test_Resolve_RevertsIfInsufficientPythFee() public {
        uint256 id = _setupAndBet();
        PredictionMarket.Market memory mBefore = market.getMarket(id);

        pyth.setFee(2 wei);

        bytes[] memory updateData = new bytes[](1);

        vm.warp(mBefore.resolveAfter + 1);
        vm.deal(address(this), 1 ether);
        vm.expectRevert(PredictionMarket.InsufficientPythFee.selector);
        market.resolve{value: 1 wei}(id, updateData);
    }

    function test_Resolve_BubblesGenericRevertWhenPythParseReverts() public {
        uint256 id = _setupAndBet();
        PredictionMarket.Market memory mBefore = market.getMarket(id);

        pyth.setShouldRevert(true);

        bytes[] memory updateData = new bytes[](1);

        vm.warp(mBefore.resolveAfter + 1);
        vm.deal(address(this), 1 ether);
        vm.expectRevert(bytes("MockPyth: forced revert"));
        market.resolve{value: 1 wei}(id, updateData);

        PredictionMarket.Market memory mAfterRevert = market.getMarket(id);
        assertEq(uint8(mAfterRevert.outcome), uint8(PredictionMarket.Outcome.Unresolved));
        assertEq(mAfterRevert.settlePrice, 0);
        assertEq(mAfterRevert.settleTime, 0);
        assertEq(mAfterRevert.winnerPool, 0);
        assertEq(mAfterRevert.protocolFee, 0);

        pyth.setShouldRevert(false);
        pyth.setNextPrice(75000_00000000, EXPO_8, mBefore.resolveAfter, 0);
        market.resolve{value: 1 wei}(id, updateData);

        PredictionMarket.Market memory mAfterRetry = market.getMarket(id);
        assertEq(uint8(mAfterRetry.outcome), uint8(PredictionMarket.Outcome.Yes));
        assertEq(mAfterRetry.settlePrice, 75000_00000000);
        assertEq(mAfterRetry.settleTime, mBefore.resolveAfter);
        assertEq(mAfterRetry.winnerPool, 149_500_000);
        assertEq(mAfterRetry.protocolFee, 500_000);
    }

    function test_Resolve_RefundsExtraPythFee() public {
        uint256 id = _setupAndBet();
        PredictionMarket.Market memory mBefore = market.getMarket(id);

        pyth.setFee(1 wei);
        pyth.setNextPrice(75000_00000000, EXPO_8, mBefore.resolveAfter, 0);

        bytes[] memory updateData = new bytes[](1);

        vm.warp(mBefore.resolveAfter + 1);
        vm.deal(address(this), 1 ether);

        uint256 balanceBefore = address(this).balance;
        market.resolve{value: 101 wei}(id, updateData);

        assertEq(address(this).balance, balanceBefore - 1 wei);
        assertEq(address(pyth).balance, 1 wei);
    }

    function test_Resolve_Yes_WhenPriceAboveThreshold() public {
        uint256 id = _setupAndBet();
        PredictionMarket.Market memory mBefore = market.getMarket(id);

        _resolve(id, 75000_00000000, mBefore.resolveAfter);

        PredictionMarket.Market memory m = market.getMarket(id);
        assertEq(uint8(m.outcome), uint8(PredictionMarket.Outcome.Yes));
        assertEq(m.settlePrice, 75000_00000000);
        assertEq(m.protocolFee, 500_000);
        assertEq(m.winnerPool, 149_500_000);
        assertEq(usdc.balanceOf(feeRecipient), 500_000);
    }

    function test_Resolve_No_WhenPriceBelowThreshold() public {
        uint256 id = _setupAndBet();
        PredictionMarket.Market memory mBefore = market.getMarket(id);

        _resolve(id, 60000_00000000, mBefore.resolveAfter);

        PredictionMarket.Market memory m = market.getMarket(id);
        assertEq(uint8(m.outcome), uint8(PredictionMarket.Outcome.No));
        assertEq(m.protocolFee, 1_000_000);
        assertEq(m.winnerPool, 149_000_000);
    }

    function test_Resolve_YesAtExactThreshold() public {
        uint256 id = _setupAndBet();
        PredictionMarket.Market memory mBefore = market.getMarket(id);

        _resolve(id, 70000_00000000, mBefore.resolveAfter);

        assertEq(uint8(market.getMarket(id).outcome), uint8(PredictionMarket.Outcome.Yes));
    }

    function test_Resolve_Invalid_OnZeroTotalPool() public {
        uint256 id = _makeMarket(70000_00000000, 24);
        PredictionMarket.Market memory mBefore = market.getMarket(id);

        _resolve(id, 75000_00000000, mBefore.resolveAfter);

        PredictionMarket.Market memory m = market.getMarket(id);
        assertEq(uint8(m.outcome), uint8(PredictionMarket.Outcome.Invalid));
        assertEq(m.settlePrice, 0);
        assertEq(m.settleTime, 0);
        assertEq(m.protocolFee, 0);
        assertEq(m.winnerPool, 0);
        assertEq(usdc.balanceOf(feeRecipient), 0);
    }

    function test_Resolve_Invalid_OnNegativePrice() public {
        uint256 id = _setupAndBet();
        PredictionMarket.Market memory mBefore = market.getMarket(id);

        _resolve(id, -1, mBefore.resolveAfter);

        PredictionMarket.Market memory m = market.getMarket(id);
        assertEq(uint8(m.outcome), uint8(PredictionMarket.Outcome.Invalid));
        assertEq(m.settlePrice, 0);
        assertEq(m.settleTime, 0);
        assertEq(m.protocolFee, 0);
        assertEq(m.winnerPool, 0);
        assertEq(usdc.balanceOf(feeRecipient), 0);
    }

    function test_Resolve_Invalid_OnExpoMismatch() public {
        uint256 id = _setupAndBet();
        uint64 resolveAfter = market.getMarket(id).resolveAfter;

        pyth.setNextPrice(75000_00000000, -6, resolveAfter, 0);

        bytes[] memory updateData = new bytes[](1);

        vm.warp(resolveAfter + 1);
        vm.deal(address(this), 1 ether);
        market.resolve{value: 1 wei}(id, updateData);

        PredictionMarket.Market memory m = market.getMarket(id);
        assertEq(uint8(m.outcome), uint8(PredictionMarket.Outcome.Invalid));
        assertEq(m.settlePrice, 0);
        assertEq(m.settleTime, 0);
        assertEq(m.protocolFee, 0);
        assertEq(m.winnerPool, 0);
        assertEq(usdc.balanceOf(feeRecipient), 0);
    }

    function test_Resolve_Invalid_OnOneSidedLosingPool() public {
        uint256 id = _makeMarket(70000_00000000, 24);

        vm.prank(alice);
        market.bet(id, false, 10_000_000);

        PredictionMarket.Market memory mBefore = market.getMarket(id);
        _resolve(id, 75000_00000000, mBefore.resolveAfter);

        PredictionMarket.Market memory m = market.getMarket(id);
        assertEq(uint8(m.outcome), uint8(PredictionMarket.Outcome.Invalid));
        assertEq(m.settlePrice, 0);
        assertEq(m.settleTime, 0);
        assertEq(m.protocolFee, 0);
        assertEq(m.winnerPool, 0);
        assertEq(usdc.balanceOf(feeRecipient), 0);
    }

    function test_Resolve_EmitsResolvedEvenOnInvalid() public {
        uint256 id = _makeMarket(70000_00000000, 24);
        PredictionMarket.Market memory mBefore = market.getMarket(id);

        pyth.setNextPrice(75000_00000000, EXPO_8, mBefore.resolveAfter, 0);

        bytes[] memory updateData = new bytes[](1);

        vm.warp(mBefore.resolveAfter + 1);
        vm.deal(address(this), 1 ether);
        vm.expectEmit(true, false, false, true);
        emit Resolved(id, PredictionMarket.Outcome.Invalid, 0, 0, 0, 0);
        market.resolve{value: 1 wei}(id, updateData);
    }

    function test_Bet_RevertsIfAlreadyResolved() public {
        uint256 id = _setupAndBet();
        PredictionMarket.Market memory mBefore = market.getMarket(id);

        _resolve(id, 75000_00000000, mBefore.resolveAfter);

        vm.prank(alice);
        vm.expectRevert(PredictionMarket.AlreadyResolved.selector);
        market.bet(id, true, 1_000_000);
    }
}

contract ForceInvalidTest is PredictionMarketTestBase {
    event Resolved(
        uint256 indexed id,
        PredictionMarket.Outcome outcome,
        int64 settlePrice,
        uint64 settleTime,
        uint128 winnerPool,
        uint128 protocolFee
    );

    function _resolve(uint256 id, int64 price, uint64 ts) internal {
        pyth.setNextPrice(price, EXPO_8, ts, 0);

        bytes[] memory updateData = new bytes[](1);

        vm.warp(ts + 1);
        vm.deal(address(this), 1 ether);
        market.resolve{value: 1 wei}(id, updateData);
    }

    function test_ForceInvalid_AfterDelay_AllowsAnyoneAndRefundsPrincipal() public {
        uint256 id = _makeMarket(70000_00000000, 24);

        vm.prank(alice);
        market.bet(id, true, 10_000_000);

        vm.prank(bob);
        market.bet(id, false, 10_000_000);

        PredictionMarket.Market memory mBefore = market.getMarket(id);
        vm.warp(mBefore.resolveAfter + market.FORCE_INVALID_DELAY() + 1);

        vm.expectEmit(true, false, false, true);
        emit Resolved(id, PredictionMarket.Outcome.Invalid, 0, 0, 0, 0);

        vm.prank(carol);
        market.forceInvalid(id);

        PredictionMarket.Market memory mAfter = market.getMarket(id);
        assertEq(uint8(mAfter.outcome), uint8(PredictionMarket.Outcome.Invalid));
        assertEq(mAfter.settlePrice, 0);
        assertEq(mAfter.settleTime, 0);
        assertEq(mAfter.winnerPool, 0);
        assertEq(mAfter.protocolFee, 0);

        assertEq(market.pendingPayout(id, alice), 10_000_000);
        assertEq(market.pendingPayout(id, bob), 10_000_000);

        uint256 aliceBefore = usdc.balanceOf(alice);
        vm.prank(alice);
        market.claim(id);
        assertEq(usdc.balanceOf(alice) - aliceBefore, 10_000_000);
        assertEq(market.pendingPayout(id, alice), 0);

        uint256 bobBefore = usdc.balanceOf(bob);
        vm.prank(bob);
        market.claim(id);
        assertEq(usdc.balanceOf(bob) - bobBefore, 10_000_000);
        assertEq(market.pendingPayout(id, bob), 0);
    }

    function test_ForceInvalid_AllowsAtExactDelayBoundary() public {
        uint256 id = _makeMarket(70000_00000000, 24);
        uint64 resolveAfter = market.getMarket(id).resolveAfter;

        vm.warp(resolveAfter + market.FORCE_INVALID_DELAY());

        vm.prank(carol);
        market.forceInvalid(id);

        PredictionMarket.Market memory mAfter = market.getMarket(id);
        assertEq(uint8(mAfter.outcome), uint8(PredictionMarket.Outcome.Invalid));
    }

    function test_ForceInvalid_RevertsBeforeDelay() public {
        uint256 id = _makeMarket(70000_00000000, 24);
        uint64 resolveAfter = market.getMarket(id).resolveAfter;

        vm.warp(resolveAfter + market.FORCE_INVALID_DELAY() - 1);
        vm.prank(carol);
        vm.expectRevert(PredictionMarket.NotForceInvalidatableYet.selector);
        market.forceInvalid(id);
    }

    function test_ForceInvalid_RevertsIfAlreadyResolved() public {
        uint256 id = _makeMarket(70000_00000000, 24);

        vm.prank(alice);
        market.bet(id, true, 10_000_000);

        vm.prank(bob);
        market.bet(id, false, 10_000_000);

        uint64 resolveAfter = market.getMarket(id).resolveAfter;
        _resolve(id, 75000_00000000, resolveAfter);

        vm.warp(resolveAfter + market.FORCE_INVALID_DELAY() + 1);
        vm.prank(carol);
        vm.expectRevert(PredictionMarket.AlreadyResolved.selector);
        market.forceInvalid(id);
    }

    function test_ForceInvalid_RevertsIfInvalidMarketId() public {
        vm.expectRevert(PredictionMarket.InvalidMarketId.selector);
        market.forceInvalid(99);
    }
}

contract PendingPayoutTest is PredictionMarketTestBase {
    // 通过 `forge inspect PredictionMarket storage-layout` 确认 claimed 的 base slot 为 5。
    bytes32 internal constant CLAIMED_BASE_SLOT = bytes32(uint256(5));

    function _setupAndBet() internal returns (uint256 id) {
        id = _makeMarket(70000_00000000, 24);

        vm.prank(alice);
        market.bet(id, true, 100_000_000);

        vm.prank(bob);
        market.bet(id, false, 50_000_000);
    }

    function _resolve(uint256 id, int64 price, uint64 ts) internal {
        pyth.setNextPrice(price, EXPO_8, ts, 0);

        bytes[] memory updateData = new bytes[](1);

        vm.warp(ts + 1);
        vm.deal(address(this), 1 ether);
        market.resolve{value: 1 wei}(id, updateData);
    }

    function _claimedSlot(uint256 id, address user) internal pure returns (bytes32) {
        bytes32 marketSlot = keccak256(abi.encode(id, CLAIMED_BASE_SLOT));
        return keccak256(abi.encode(user, marketSlot));
    }

    function test_PendingPayout_ReturnsZeroWhenUnresolved() public {
        uint256 id = _setupAndBet();

        assertEq(market.pendingPayout(id, alice), 0);
    }

    function test_PendingPayout_ReturnsExactNoWinnerPayout() public {
        uint256 id = _setupAndBet();
        uint64 resolveAfter = market.getMarket(id).resolveAfter;

        _resolve(id, 60_000_00000000, resolveAfter);

        assertEq(market.pendingPayout(id, alice), 0);
        assertEq(market.pendingPayout(id, bob), 149_000_000);
    }

    function test_PendingPayout_ReturnsExactYesWinnerPayout() public {
        uint256 id = _setupAndBet();
        uint64 resolveAfter = market.getMarket(id).resolveAfter;

        _resolve(id, 75_000_00000000, resolveAfter);

        assertEq(market.pendingPayout(id, alice), 149_500_000);
        assertEq(market.pendingPayout(id, bob), 0);
    }

    function test_PendingPayout_ReturnsZeroForUserWithoutStake() public {
        uint256 id = _setupAndBet();
        uint64 resolveAfter = market.getMarket(id).resolveAfter;

        _resolve(id, 75_000_00000000, resolveAfter);

        assertEq(market.pendingPayout(id, carol), 0);
    }

    function test_PendingPayout_ReturnsFullRefundOnInvalidOutcome() public {
        uint256 id = _makeMarket(70000_00000000, 24);

        vm.startPrank(alice);
        market.bet(id, true, 12_000_000);
        market.bet(id, false, 7_000_000);
        vm.stopPrank();

        uint64 resolveAfter = market.getMarket(id).resolveAfter;
        _resolve(id, -1, resolveAfter);

        assertEq(market.pendingPayout(id, alice), 19_000_000);
    }

    function test_PendingPayout_ReturnsZeroWhenAlreadyClaimed() public {
        uint256 id = _setupAndBet();
        uint64 resolveAfter = market.getMarket(id).resolveAfter;

        _resolve(id, 75_000_00000000, resolveAfter);
        assertEq(market.pendingPayout(id, alice), 149_500_000);

        vm.store(address(market), _claimedSlot(id, alice), bytes32(uint256(1)));

        assertEq(market.pendingPayout(id, alice), 0);
    }

    function test_PendingPayout_RevertsIfInvalidMarketId() public {
        vm.expectRevert(PredictionMarket.InvalidMarketId.selector);
        market.pendingPayout(99, alice);
    }
}

contract ClaimTest is PredictionMarketTestBase {
    event Claimed(uint256 indexed id, address indexed user, uint256 payout);

    function _setupAndBet() internal returns (uint256 id) {
        id = _makeMarket(70000_00000000, 24);

        vm.prank(alice);
        market.bet(id, true, 100_000_000);

        vm.prank(bob);
        market.bet(id, false, 50_000_000);
    }

    function _resolve(uint256 id, int64 price, uint64 ts) internal {
        pyth.setNextPrice(price, EXPO_8, ts, 0);

        bytes[] memory updateData = new bytes[](1);

        vm.warp(ts + 1);
        vm.deal(address(this), 1 ether);
        market.resolve{value: 1 wei}(id, updateData);
    }

    function _resolveYes(uint256 id) internal {
        _resolve(id, 75_000_00000000, market.getMarket(id).resolveAfter);
    }

    function _resolveNo(uint256 id) internal {
        _resolve(id, 60_000_00000000, market.getMarket(id).resolveAfter);
    }

    function _resolveInvalid(uint256 id) internal {
        _resolve(id, -1, market.getMarket(id).resolveAfter);
    }

    function test_Claim_YesWinnerGetsExactPayoutAndMarksClaimed() public {
        uint256 id = _setupAndBet();
        _resolveYes(id);

        uint256 beforeBalance = usdc.balanceOf(alice);

        vm.expectEmit(true, true, false, true);
        emit Claimed(id, alice, 149_500_000);

        vm.prank(alice);
        market.claim(id);

        assertEq(usdc.balanceOf(alice) - beforeBalance, 149_500_000);
        assertTrue(market.claimed(id, alice));
        assertEq(market.pendingPayout(id, alice), 0);
    }

    function test_Claim_NoWinnerGetsExactPayout() public {
        uint256 id = _setupAndBet();
        _resolveNo(id);

        uint256 beforeBalance = usdc.balanceOf(bob);

        vm.prank(bob);
        market.claim(id);

        assertEq(usdc.balanceOf(bob) - beforeBalance, 149_000_000);
        assertEq(market.pendingPayout(id, bob), 0);
    }

    function test_Claim_InvalidRefundsCombinedYesAndNoStake() public {
        uint256 id = _makeMarket(70000_00000000, 24);

        vm.startPrank(alice);
        market.bet(id, true, 12_000_000);
        market.bet(id, false, 7_000_000);
        vm.stopPrank();

        _resolveInvalid(id);

        uint256 beforeBalance = usdc.balanceOf(alice);

        vm.prank(alice);
        market.claim(id);

        assertEq(usdc.balanceOf(alice) - beforeBalance, 19_000_000);
    }

    function test_Claim_InvalidRefundsSingleSidedStake() public {
        uint256 id = _makeMarket(70000_00000000, 24);

        vm.prank(alice);
        market.bet(id, false, 10_000_000);

        _resolveYes(id);

        uint256 beforeBalance = usdc.balanceOf(alice);

        vm.prank(alice);
        market.claim(id);

        assertEq(usdc.balanceOf(alice) - beforeBalance, 10_000_000);
    }

    function test_Claim_RevertsForLoserWithStake() public {
        uint256 id = _setupAndBet();
        _resolveYes(id);

        vm.prank(bob);
        vm.expectRevert(PredictionMarket.NotAWinner.selector);
        market.claim(id);
    }

    function test_Claim_RevertsForYesLoserWhenNoWins() public {
        uint256 id = _setupAndBet();
        _resolveNo(id);

        vm.prank(alice);
        vm.expectRevert(PredictionMarket.NotAWinner.selector);
        market.claim(id);
    }

    function test_Claim_RevertsForNoStakeUserAfterResolve() public {
        uint256 id = _setupAndBet();
        _resolveYes(id);

        vm.prank(carol);
        vm.expectRevert(PredictionMarket.NoPayoutAvailable.selector);
        market.claim(id);
    }

    function test_Claim_RevertsIfNotResolved() public {
        uint256 id = _makeMarket(70000_00000000, 24);

        vm.prank(alice);
        market.bet(id, true, 10_000_000);

        vm.prank(alice);
        vm.expectRevert(PredictionMarket.NotResolved.selector);
        market.claim(id);
    }

    function test_Claim_RevertsIfAlreadyClaimed() public {
        uint256 id = _setupAndBet();
        _resolveYes(id);

        vm.prank(alice);
        market.claim(id);

        vm.prank(alice);
        vm.expectRevert(PredictionMarket.AlreadyClaimed.selector);
        market.claim(id);
    }

    function test_Claim_PreventsReentrancy() public {
        ReentrantAttacker attacker = new ReentrantAttacker(market, usdc);
        uint256 id = _makeMarket(70000_00000000, 24);

        usdc.mint(address(attacker), 100_000_000);
        attacker.approveMax();
        attacker.placeBet(id, true, 100_000_000);

        vm.prank(bob);
        market.bet(id, false, 50_000_000);

        _resolveYes(id);

        assertEq(usdc.balanceOf(address(attacker)), 0);
        assertFalse(market.claimed(id, address(attacker)));
        assertEq(market.pendingPayout(id, address(attacker)), 149_500_000);

        attacker.attackClaim(id);

        assertTrue(attacker.reentered());
        assertFalse(attacker.reenterSucceeded());
        assertEq(attacker.reenterSelector(), PredictionMarket.AlreadyClaimed.selector);
        assertEq(usdc.balanceOf(address(attacker)), 149_500_000);
        assertTrue(market.claimed(id, address(attacker)));
        assertEq(market.pendingPayout(id, address(attacker)), 0);
    }

    function test_Claim_RevertsIfInvalidMarketId() public {
        vm.expectRevert(PredictionMarket.InvalidMarketId.selector);
        market.claim(99);
    }
}

contract ViewTest is PredictionMarketTestBase {
    function _setupAndBet() internal returns (uint256 id) {
        id = _makeMarket(70000_00000000, 24);

        vm.prank(alice);
        market.bet(id, true, 100_000_000);

        vm.prank(bob);
        market.bet(id, false, 50_000_000);
    }

    function _resolve(uint256 id, int64 price, uint64 ts) internal {
        pyth.setNextPrice(price, EXPO_8, ts, 0);

        bytes[] memory updateData = new bytes[](1);

        vm.warp(ts + 1);
        vm.deal(address(this), 1 ether);
        market.resolve{value: 1 wei}(id, updateData);
    }

    function _resolveYes(uint256 id) internal {
        _resolve(id, 75_000_00000000, market.getMarket(id).resolveAfter);
    }

    function _makeFiveMarkets() internal {
        for (uint256 i = 0; i < 5; i++) {
            _makeMarket(int64(uint64(i + 1)), uint64(i + 1));
        }
    }

    function test_GetMarketsPaged_HalfOpenRangeReturnsExpectedMarkets() public {
        _makeFiveMarkets();

        PredictionMarket.Market[] memory ms = market.getMarketsPaged(1, 4);

        assertEq(ms.length, 3);
        assertEq(ms[0].threshold, 2);
        assertEq(ms[1].threshold, 3);
        assertEq(ms[2].threshold, 4);
    }

    function test_GetMarketsPaged_AllowsEmptyRange() public {
        _makeFiveMarkets();

        PredictionMarket.Market[] memory ms = market.getMarketsPaged(2, 2);

        assertEq(ms.length, 0);
    }

    function test_GetMarketsPaged_RevertsOnInvalidRange() public {
        _makeFiveMarkets();

        vm.expectRevert(PredictionMarket.InvalidMarketId.selector);
        market.getMarketsPaged(3, 2);

        vm.expectRevert(PredictionMarket.InvalidMarketId.selector);
        market.getMarketsPaged(0, 6);
    }

    function test_GetDashboardLatest_ReturnsNewestFirst() public {
        _makeFiveMarkets();

        (PredictionMarket.DashboardRow[] memory rows, uint256 total) = market.getDashboardLatest(alice, 3);

        assertEq(total, 5);
        assertEq(rows.length, 3);
        assertEq(rows[0].id, 4);
        assertEq(rows[1].id, 3);
        assertEq(rows[2].id, 2);
    }

    function test_GetDashboardLatest_ClampsLimitAndHandlesZeroLimit() public {
        _makeFiveMarkets();

        (PredictionMarket.DashboardRow[] memory allRows, uint256 total) = market.getDashboardLatest(alice, 10);
        assertEq(total, 5);
        assertEq(allRows.length, 5);
        assertEq(allRows[0].id, 4);
        assertEq(allRows[4].id, 0);

        (PredictionMarket.DashboardRow[] memory zeroRows, uint256 zeroTotal) = market.getDashboardLatest(alice, 0);
        assertEq(zeroTotal, 5);
        assertEq(zeroRows.length, 0);
    }

    function test_GetDashboardLatest_ReturnsEmptyWhenNoMarkets() public view {
        (PredictionMarket.DashboardRow[] memory rows, uint256 total) = market.getDashboardLatest(alice, 3);

        assertEq(total, 0);
        assertEq(rows.length, 0);
    }

    function test_GetDashboard_IncludesStakeClaimedAndPendingPayoutWhenUnresolved() public {
        uint256 id = _makeMarket(70000_00000000, 24);

        vm.prank(alice);
        market.bet(id, true, 10_000_000);

        (PredictionMarket.DashboardRow[] memory rows, uint256 total) = market.getDashboard(alice, 0, 1);

        assertEq(total, 1);
        assertEq(rows.length, 1);
        assertEq(rows[0].id, id);
        assertEq(rows[0].market.threshold, 70000_00000000);
        assertEq(rows[0].yesStake, 10_000_000);
        assertEq(rows[0].noStake, 0);
        assertFalse(rows[0].claimed_);
        assertEq(rows[0].pendingPayout, 0);
    }

    function test_GetDashboard_ReturnsResolvedPendingPayoutAndClaimState() public {
        uint256 id = _setupAndBet();
        _resolveYes(id);

        (PredictionMarket.DashboardRow[] memory beforeClaimRows, uint256 total) = market.getDashboard(alice, 0, 1);

        assertEq(total, 1);
        assertEq(beforeClaimRows.length, 1);
        assertEq(beforeClaimRows[0].id, id);
        assertEq(uint8(beforeClaimRows[0].market.outcome), uint8(PredictionMarket.Outcome.Yes));
        assertEq(beforeClaimRows[0].yesStake, 100_000_000);
        assertEq(beforeClaimRows[0].noStake, 0);
        assertFalse(beforeClaimRows[0].claimed_);
        assertEq(beforeClaimRows[0].pendingPayout, 149_500_000);

        vm.prank(alice);
        market.claim(id);

        (PredictionMarket.DashboardRow[] memory afterClaimRows, uint256 afterClaimTotal) =
            market.getDashboard(alice, 0, 1);

        assertEq(afterClaimTotal, 1);
        assertEq(afterClaimRows.length, 1);
        assertTrue(afterClaimRows[0].claimed_);
        assertEq(afterClaimRows[0].pendingPayout, 0);
    }

    function test_GetDashboard_RevertsOnInvalidRange() public {
        _makeFiveMarkets();

        vm.expectRevert(PredictionMarket.InvalidMarketId.selector);
        market.getDashboard(alice, 4, 3);

        vm.expectRevert(PredictionMarket.InvalidMarketId.selector);
        market.getDashboard(alice, 0, 6);
    }
}

contract ReentrantAttacker {
    PredictionMarket public immutable market;
    MockUSDC public immutable usdc;
    uint256 public attackId;
    bool public reentered;
    bool public reenterSucceeded;
    bytes4 public reenterSelector;

    constructor(PredictionMarket m, MockUSDC u) {
        market = m;
        usdc = u;
    }

    function approveMax() external {
        usdc.approve(address(market), type(uint256).max);
    }

    function placeBet(uint256 id, bool yes, uint128 amount) external {
        market.bet(id, yes, amount);
    }

    function attackClaim(uint256 id) external {
        attackId = id;
        reentered = false;
        reenterSucceeded = false;
        reenterSelector = bytes4(0);
        usdc.setReentrancyCallback(address(this), abi.encodeCall(this.reenter, ()));
        market.claim(id);
    }

    function reenter() external {
        require(msg.sender == address(usdc), "ReentrantAttacker: only usdc");
        reentered = true;

        (bool ok, bytes memory data) = address(market).call(abi.encodeCall(market.claim, (attackId)));
        reenterSucceeded = ok;

        if (data.length >= 4) {
            bytes4 selector;
            assembly {
                selector := mload(add(data, 32))
            }
            reenterSelector = selector;
        }
    }
}
