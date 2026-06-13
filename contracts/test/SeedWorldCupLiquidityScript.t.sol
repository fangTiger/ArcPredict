// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Test} from "forge-std/Test.sol";
import {SeedWorldCupLiquidity} from "../script/SeedWorldCupLiquidity.s.sol";
import {EventMarket} from "../src/EventMarket.sol";
import {MockUSDC} from "./mocks/MockUSDC.sol";

contract SeedWorldCupLiquidityHarness is SeedWorldCupLiquidity {
    function splitSeedAmountPublic(uint256 value, uint8 outcomeCount, uint128 minBet) external pure returns (uint128) {
        return _splitSeedAmount(value, outcomeCount, minBet);
    }
}

contract SeedWorldCupLiquidityScriptTest is Test {
    uint256 internal constant OWNER_PRIVATE_KEY = 0xA11CE;
    uint256 internal constant SEED_PRIVATE_KEY = 0xB0B;
    bytes32 internal constant EVENT_ID = keccak256("worldcup-match-1");
    uint256 internal constant START_TIME = 1_700_000_000;

    SeedWorldCupLiquidityHarness internal harness;
    EventMarket internal market;
    MockUSDC internal usdc;

    address internal owner;
    address internal seedSigner;
    address internal feeRecipient = address(0xFEE);

    function setUp() public {
        owner = vm.addr(OWNER_PRIVATE_KEY);
        seedSigner = vm.addr(SEED_PRIVATE_KEY);
        vm.deal(owner, 1 ether);
        vm.deal(seedSigner, 1 ether);
        vm.warp(START_TIME);

        harness = new SeedWorldCupLiquidityHarness();
        usdc = new MockUSDC();
        market = new EventMarket(address(usdc), owner, feeRecipient, address(0x0BEEF));

        vm.prank(owner);
        market.createMarket(
            EVENT_ID,
            3,
            uint64(block.timestamp + 1 days),
            uint64(block.timestamp + 1 days + 150 minutes),
            "QAT vs ECU 1X2"
        );
    }

    function test_SplitSeedAmount_SplitsEqually() external view {
        assertEq(harness.splitSeedAmountPublic(900_000, 3, market.MIN_BET()), 300_000);
    }

    function test_SplitSeedAmount_LeavesRemainderInSeedWallet() external view {
        assertEq(harness.splitSeedAmountPublic(1_000_000, 3, market.MIN_BET()), 333_333);
    }

    function test_SplitSeedAmount_RevertsWhenPerOutcomeBelowMinimum() external {
        uint128 minBet = market.MIN_BET();

        vm.expectRevert(SeedWorldCupLiquidity.SeedAmountBelowMinimum.selector);
        harness.splitSeedAmountPublic(299_997, 3, minBet);
    }

    function test_SplitSeedAmount_RevertsWhenPerOutcomeTooLarge() external {
        uint128 minBet = market.MIN_BET();

        vm.expectRevert(SeedWorldCupLiquidity.SeedAmountTooLarge.selector);
        harness.splitSeedAmountPublic((uint256(type(uint128).max) + 1) * 2, 2, minBet);
    }

    function test_Run_SeedsEveryOutcomeEqually() external {
        uint256 seedAmount = 900_000;
        usdc.mint(seedSigner, seedAmount);

        vm.setEnv("SEED_PRIVATE_KEY", vm.toString(SEED_PRIVATE_KEY));
        vm.setEnv("EVENT_MARKET_ADDRESS", vm.toString(address(market)));
        vm.setEnv("USDC_ADDRESS", vm.toString(address(usdc)));
        vm.setEnv("MARKET_ID", "0");
        vm.setEnv("SEED_AMOUNT", vm.toString(seedAmount));

        harness.run();

        EventMarket.EventMarketDef memory seededMarket = market.getMarket(0);
        assertEq(seededMarket.outcomePools[0], 300_000);
        assertEq(seededMarket.outcomePools[1], 300_000);
        assertEq(seededMarket.outcomePools[2], 300_000);

        uint128[] memory stake = market.userStake(0, seedSigner);
        assertEq(stake[0], 300_000);
        assertEq(stake[1], 300_000);
        assertEq(stake[2], 300_000);
        assertEq(usdc.allowance(seedSigner, address(market)), type(uint256).max);
        assertEq(usdc.balanceOf(address(market)), seedAmount);
    }
}
