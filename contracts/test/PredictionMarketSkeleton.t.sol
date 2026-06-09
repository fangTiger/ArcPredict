// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Test} from "forge-std/Test.sol";
import {PredictionMarket} from "../src/PredictionMarket.sol";

contract PredictionMarketSkeletonTest is Test {
    address internal usdc = makeAddr("usdc");
    address internal pyth = makeAddr("pyth");
    address internal initialOwner = makeAddr("initialOwner");
    address internal initialFeeRecipient = makeAddr("initialFeeRecipient");

    PredictionMarket internal market;

    function setUp() public {
        market = _deploy(usdc, pyth, initialOwner, initialFeeRecipient);
    }

    function test_Constructor_SetsCoreState() external view {
        assertEq(market.USDC(), usdc);
        assertEq(market.PYTH(), pyth);
        assertEq(market.owner(), initialOwner);
        assertEq(market.feeRecipient(), initialFeeRecipient);
        assertEq(uint256(market.feeBps()), 100);
        assertEq(market.marketCount(), 0);
    }

    function test_Constructor_RevertsOnZeroDependencyOrFeeRecipient() external {
        vm.expectRevert(PredictionMarket.ZeroAddress.selector);
        _deploy(address(0), pyth, initialOwner, initialFeeRecipient);

        vm.expectRevert(PredictionMarket.ZeroAddress.selector);
        _deploy(usdc, address(0), initialOwner, initialFeeRecipient);

        vm.expectRevert(PredictionMarket.ZeroAddress.selector);
        _deploy(usdc, pyth, initialOwner, address(0));
    }

    function test_Constructor_RevertsOnZeroOwner_PerOpenZeppelinV5Behavior() external {
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableInvalidOwner.selector, address(0)));
        _deploy(usdc, pyth, address(0), initialFeeRecipient);
    }

    function test_Constants_AreSpecValues() external view {
        assertEq(market.MAX_MARKETS(), 1000);
        assertEq(uint256(market.MIN_BET()), 1e5);
        assertEq(uint256(market.MAX_FEE_BPS()), 500);
        assertEq(uint256(market.ORACLE_WINDOW()), 5 minutes);
        assertEq(uint256(market.FORCE_INVALID_DELAY()), 7 days);
        assertEq(market.MAX_QUESTION_LEN(), 200);
    }

    function test_OutcomeEnum_OrdinalsMatchSpec() external pure {
        assertEq(uint8(PredictionMarket.Outcome.Unresolved), 0);
        assertEq(uint8(PredictionMarket.Outcome.Yes), 1);
        assertEq(uint8(PredictionMarket.Outcome.No), 2);
        assertEq(uint8(PredictionMarket.Outcome.Invalid), 3);
    }

    function test_MarketStruct_AllFieldsCanBeConstructedAndRead() external pure {
        PredictionMarket.Market memory marketData = _buildMarketStruct();

        assertEq(marketData.pythPriceId, keccak256("btc-usd"));
        assertEq(marketData.threshold, 102_500_000);
        assertEq(marketData.thresholdExpo, -8);
        assertEq(marketData.betDeadline, 1_800_000_100);
        assertEq(marketData.resolveAfter, 1_800_000_200);
        assertEq(marketData.yesPool, 1_500_000);
        assertEq(marketData.noPool, 900_000);
        assertEq(marketData.winnerPool, 2_376_000);
        assertEq(marketData.protocolFee, 24_000);
        assertEq(uint256(marketData.feeBpsSnapshot), 100);
        assertEq(marketData.feeRecipientSnapshot, address(0xBEEF));
        assertEq(uint8(marketData.outcome), uint8(PredictionMarket.Outcome.Yes));
        assertEq(marketData.settlePrice, 103_210_000);
        assertEq(marketData.settleTime, 1_800_000_260);
        assertEq(marketData.question, "BTC settles above threshold?");
    }

    function _deploy(address usdc_, address pyth_, address owner_, address feeRecipient_)
        internal
        returns (PredictionMarket deployed)
    {
        deployed = new PredictionMarket(usdc_, pyth_, owner_, feeRecipient_);
    }

    function _buildMarketStruct() internal pure returns (PredictionMarket.Market memory marketData) {
        marketData = PredictionMarket.Market(
            keccak256("btc-usd"),
            102_500_000,
            -8,
            1_800_000_100,
            1_800_000_200,
            1_500_000,
            900_000,
            2_376_000,
            24_000,
            100,
            address(0xBEEF),
            PredictionMarket.Outcome.Yes,
            103_210_000,
            1_800_000_260,
            "BTC settles above threshold?"
        );
    }
}
