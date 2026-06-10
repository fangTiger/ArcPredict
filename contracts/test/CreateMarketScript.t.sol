// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Test} from "forge-std/Test.sol";
import {CreateMarket} from "../script/CreateMarket.s.sol";
import {PredictionMarket} from "../src/PredictionMarket.sol";
import {MockPyth} from "./mocks/MockPyth.sol";
import {MockUSDC} from "./mocks/MockUSDC.sol";

contract CreateMarketHarness is CreateMarket {
    function scalePublic(int64 human, int32 feedExpo) external pure returns (int64) {
        return scale(human, feedExpo);
    }

    function toInt64Public(int256 value) external pure returns (int64) {
        return _toInt64(value);
    }

    function toInt32Public(int256 value) external pure returns (int32) {
        return _toInt32(value);
    }

    function hoursFromNowPublic(uint256 hoursFromNow) external view returns (uint64) {
        return _hoursFromNow(hoursFromNow);
    }
}

contract CreateMarketScriptTest is Test {
    uint256 internal constant OWNER_PRIVATE_KEY = 0xA11CE;

    CreateMarketHarness internal harness;
    PredictionMarket internal market;
    MockUSDC internal usdc;
    MockPyth internal pyth;

    address internal owner;
    address internal feeRecipient = address(0xFEE);

    function setUp() public {
        owner = vm.addr(OWNER_PRIVATE_KEY);
        vm.deal(owner, 1 ether);

        harness = new CreateMarketHarness();
        usdc = new MockUSDC();
        pyth = new MockPyth();
        market = new PredictionMarket(address(usdc), address(pyth), owner, feeRecipient);
    }

    function test_Scale_ScalesHumanThresholdForNegativeExpo() external view {
        assertEq(harness.scalePublic(70000, -8), 7_000_000_000_000);
    }

    function test_Scale_ReturnsHumanValueWhenExpoIsZero() external view {
        assertEq(harness.scalePublic(1, 0), 1);
    }

    function test_Scale_RevertsIfExpoPositive() external {
        vm.expectRevert(CreateMarket.FeedExpoOutOfRange.selector);
        harness.scalePublic(1, 1);
    }

    function test_Scale_RevertsIfExpoTooNegative() external {
        vm.expectRevert(CreateMarket.FeedExpoOutOfRange.selector);
        harness.scalePublic(1, -19);
    }

    function test_Scale_RevertsIfHumanThresholdIsNotPositive() external {
        vm.expectRevert(CreateMarket.HumanThresholdMustBePositive.selector);
        harness.scalePublic(0, -8);
    }

    function test_Scale_RevertsIfScaledThresholdOverflowsInt64() external {
        vm.expectRevert(CreateMarket.ScaledThresholdOverflow.selector);
        harness.scalePublic(10, -18);
    }

    function test_ToInt64_AllowsBoundaryValues() external view {
        assertEq(harness.toInt64Public(type(int64).max), type(int64).max);
        assertEq(harness.toInt64Public(type(int64).min), type(int64).min);
    }

    function test_ToInt64_RevertsIfValueAboveRange() external {
        vm.expectRevert(CreateMarket.Int64OutOfRange.selector);
        harness.toInt64Public(int256(type(int64).max) + 1);
    }

    function test_ToInt64_RevertsIfValueBelowRange() external {
        vm.expectRevert(CreateMarket.Int64OutOfRange.selector);
        harness.toInt64Public(int256(type(int64).min) - 1);
    }

    function test_ToInt32_AllowsBoundaryValues() external view {
        assertEq(harness.toInt32Public(type(int32).max), type(int32).max);
        assertEq(harness.toInt32Public(type(int32).min), type(int32).min);
    }

    function test_ToInt32_RevertsIfValueAboveRange() external {
        vm.expectRevert(CreateMarket.Int32OutOfRange.selector);
        harness.toInt32Public(int256(type(int32).max) + 1);
    }

    function test_ToInt32_RevertsIfValueBelowRange() external {
        vm.expectRevert(CreateMarket.Int32OutOfRange.selector);
        harness.toInt32Public(int256(type(int32).min) - 1);
    }

    function test_HoursFromNow_ReturnsTimestampWithinRange() external {
        vm.warp(1_700_000_000);
        assertEq(harness.hoursFromNowPublic(24), uint64(block.timestamp + 24 hours));
    }

    function test_HoursFromNow_AllowsExactUint64UpperBound() external {
        vm.warp(type(uint64).max - 2 hours);
        assertEq(harness.hoursFromNowPublic(2), type(uint64).max);
    }

    function test_HoursFromNow_RevertsIfTimestampWouldOverflowUint64() external {
        vm.warp(type(uint64).max - 30 minutes);

        vm.expectRevert(CreateMarket.TimestampOverflow.selector);
        harness.hoursFromNowPublic(1);
    }

    function test_Run_CreatesMarketFromEnv() external {
        vm.warp(1_700_000_000);

        bytes32 priceId = bytes32(uint256(0x1234));
        vm.setEnv("OWNER_PRIVATE_KEY", vm.toString(OWNER_PRIVATE_KEY));
        vm.setEnv("PREDICTION_MARKET", vm.toString(address(market)));
        vm.setEnv("PYTH_PRICE_ID", vm.toString(priceId));
        vm.setEnv("HUMAN_THRESHOLD", "70000");
        vm.setEnv("FEED_EXPO", "-8");
        vm.setEnv("HOURS_TO_BET_DEADLINE", "24");
        vm.setEnv("HOURS_TO_RESOLVE_AFTER", "25");
        vm.setEnv("QUESTION", "BTC >= 70k");

        harness.run();

        assertEq(market.marketCount(), 1);

        PredictionMarket.Market memory created = market.getMarket(0);
        assertEq(created.pythPriceId, priceId);
        assertEq(created.threshold, 7_000_000_000_000);
        assertEq(created.thresholdExpo, -8);
        assertEq(created.betDeadline, uint64(block.timestamp + 24 hours));
        assertEq(created.resolveAfter, uint64(block.timestamp + 25 hours));
        assertEq(created.question, "BTC >= 70k");
    }
}
