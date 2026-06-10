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
        uint256 indexed id,
        address indexed user,
        bool yes,
        uint128 amount,
        uint128 yesPoolAfter,
        uint128 noPoolAfter
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
        vm.expectRevert();
        market.resolve{value: 1 wei}(id, updateData);
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
