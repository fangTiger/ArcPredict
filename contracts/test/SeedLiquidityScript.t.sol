// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Test} from "forge-std/Test.sol";
import {SeedLiquidity} from "../script/SeedLiquidity.s.sol";
import {PredictionMarket} from "../src/PredictionMarket.sol";
import {MockPyth} from "./mocks/MockPyth.sol";
import {MockUSDC} from "./mocks/MockUSDC.sol";

contract SeedLiquidityHarness is SeedLiquidity {
    function toUint128AmountPublic(uint256 value) external pure returns (uint128) {
        return _toUint128Amount(value);
    }
}

contract SeedLiquidityScriptTest is Test {
    uint256 internal constant OWNER_PRIVATE_KEY = 0xA11CE;
    uint256 internal constant SEED_PRIVATE_KEY = 0xB0B;
    bytes32 internal constant PRICE_ID_BTC = bytes32(uint256(1));
    int32 internal constant EXPO_8 = -8;
    int64 internal constant THRESHOLD = 70_000_00000000;

    SeedLiquidityHarness internal harness;
    PredictionMarket internal market;
    MockUSDC internal usdc;
    MockPyth internal pyth;

    address internal owner;
    address internal feeRecipient = address(0xFEE);
    address internal seedSigner;

    function setUp() public {
        owner = vm.addr(OWNER_PRIVATE_KEY);
        seedSigner = vm.addr(SEED_PRIVATE_KEY);

        vm.deal(owner, 1 ether);
        vm.deal(seedSigner, 1 ether);
        vm.warp(1_700_000_000);

        harness = new SeedLiquidityHarness();
        usdc = new MockUSDC();
        pyth = new MockPyth();
        market = new PredictionMarket(address(usdc), address(pyth), owner, feeRecipient);

        vm.prank(owner);
        market.createMarket(
            PRICE_ID_BTC,
            THRESHOLD,
            EXPO_8,
            uint64(block.timestamp + 1 days),
            uint64(block.timestamp + 1 days + 1 minutes),
            "BTC >= 70k"
        );
    }

    function test_ToUint128Amount_AllowsUint128Max() external view {
        assertEq(harness.toUint128AmountPublic(type(uint128).max), type(uint128).max);
    }

    function test_ToUint128Amount_RevertsAboveUint128Max() external {
        vm.expectRevert(SeedLiquidity.SeedAmountTooLarge.selector);
        harness.toUint128AmountPublic(uint256(type(uint128).max) + 1);
    }

    function test_Run_UsesSeedSignerInsteadOfOwnerSigner() external {
        uint128 amount = 5_000_000;
        uint256 mintedAmount = uint256(amount) * 3;

        usdc.mint(seedSigner, mintedAmount);

        vm.setEnv("OWNER_PRIVATE_KEY", vm.toString(OWNER_PRIVATE_KEY));
        vm.setEnv("SEED_PRIVATE_KEY", vm.toString(SEED_PRIVATE_KEY));
        vm.setEnv("PREDICTION_MARKET", vm.toString(address(market)));
        vm.setEnv("USDC_ADDRESS", vm.toString(address(usdc)));
        vm.setEnv("MARKET_ID", "0");
        vm.setEnv("SEED_AMOUNT", vm.toString(uint256(amount)));

        harness.run();

        PredictionMarket.Market memory seededMarket = market.getMarket(0);
        assertEq(seededMarket.yesPool, amount);
        assertEq(seededMarket.noPool, amount);

        (uint128 yesStake, uint128 noStake) = market.userStake(0, seedSigner);
        assertEq(yesStake, amount);
        assertEq(noStake, amount);

        assertEq(usdc.allowance(seedSigner, address(market)), type(uint256).max);
        assertEq(usdc.balanceOf(seedSigner), mintedAmount - uint256(amount) * 2);
        assertEq(usdc.balanceOf(address(market)), uint256(amount) * 2);
    }

}
