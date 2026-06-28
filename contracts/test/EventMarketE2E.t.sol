// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Test} from "forge-std/Test.sol";
import {AdminEventOracle} from "../src/AdminEventOracle.sol";
import {EventMarket} from "../src/EventMarket.sol";
import {MockUSDC} from "./mocks/MockUSDC.sol";

contract EventMarketE2ETest is Test {
    uint256 internal constant INITIAL_USDC_BALANCE = 1_000_000_000;
    bytes32 internal constant MATCH_EVENT_ID = keccak256("event-e2e-1x2");
    bytes32 internal constant SPREAD_EVENT_ID = keccak256("event-e2e-goals-25");
    bytes32 internal constant WINNER_EVENT_ID = keccak256("event-e2e-winner");

    address internal owner = address(0xB001);
    address internal feeRecipient = address(0xB002);
    address internal bonusBank = address(0xB003);
    address internal alice = address(0xB101);
    address internal bob = address(0xB102);
    address internal carol = address(0xB103);

    MockUSDC internal usdc;
    AdminEventOracle internal oracle;
    EventMarket internal market;

    function setUp() public {
        usdc = new MockUSDC();
        oracle = new AdminEventOracle(address(usdc), owner, feeRecipient, bonusBank, 48);
        market = new EventMarket(address(usdc), owner, feeRecipient, address(oracle));

        address[4] memory seeded = [alice, bob, carol, bonusBank];
        for (uint256 i = 0; i < seeded.length; i++) {
            usdc.mint(seeded[i], INITIAL_USDC_BALANCE);
        }

        address[3] memory users = [alice, bob, carol];
        for (uint256 i = 0; i < users.length; i++) {
            vm.prank(users[i]);
            usdc.approve(address(market), type(uint256).max);
        }

        vm.prank(bonusBank);
        usdc.approve(address(oracle), type(uint256).max);
    }

    function test_e2e_1X2_MultiUserBet_OracleFinalize_WinnerClaims() public {
        vm.prank(owner);
        uint256 id = market.createMarket(
            MATCH_EVENT_ID,
            3,
            uint64(block.timestamp + 1 hours),
            uint64(block.timestamp + 2 hours),
            "Argentina vs France"
        );

        vm.prank(alice);
        market.bet(id, 0, 5_000_000);
        vm.prank(bob);
        market.bet(id, 2, 8_000_000);
        vm.prank(carol);
        market.bet(id, 1, 3_000_000);

        vm.warp(block.timestamp + 2 hours);
        vm.prank(owner);
        oracle.proposeResult(MATCH_EVENT_ID, 2);

        vm.warp(block.timestamp + oracle.DISPUTE_WINDOW());
        vm.prank(alice);
        oracle.finalizeResult(MATCH_EVENT_ID);

        market.resolve(id);

        EventMarket.EventMarketDef memory m = market.getMarket(id);
        assertEq(m.settledOutcome, 2);
        assertEq(m.protocolFee, 80_000);
        assertEq(m.winnerPool, 15_920_000);

        vm.prank(bob);
        market.claim(id);

        assertEq(usdc.balanceOf(bob), INITIAL_USDC_BALANCE + 7_920_000);
        assertEq(usdc.balanceOf(feeRecipient), 80_000);
    }

    function test_e2e_SpreadMarket_OverUnder_OracleFinalize_WinnerClaims() public {
        vm.prank(owner);
        uint256 id = market.createMarket(
            SPREAD_EVENT_ID,
            2,
            uint64(block.timestamp + 1 hours),
            uint64(block.timestamp + 2 hours),
            "Argentina vs France total goals over 2.5"
        );

        vm.prank(alice);
        market.bet(id, 0, 6_000_000);
        vm.prank(bob);
        market.bet(id, 1, 4_000_000);
        vm.prank(carol);
        market.bet(id, 0, 2_000_000);

        vm.warp(block.timestamp + 2 hours);
        vm.prank(owner);
        oracle.proposeResult(SPREAD_EVENT_ID, 0);

        vm.warp(block.timestamp + oracle.DISPUTE_WINDOW());
        vm.prank(carol);
        oracle.finalizeResult(SPREAD_EVENT_ID);

        market.resolve(id);

        EventMarket.EventMarketDef memory m = market.getMarket(id);
        assertEq(m.settledOutcome, 0);
        assertEq(m.protocolFee, 40_000);
        assertEq(m.winnerPool, 11_960_000);

        vm.prank(alice);
        market.claim(id);
        vm.prank(carol);
        market.claim(id);

        assertEq(usdc.balanceOf(alice), INITIAL_USDC_BALANCE + 2_970_000);
        assertEq(usdc.balanceOf(carol), INITIAL_USDC_BALANCE + 990_000);
        assertEq(usdc.balanceOf(feeRecipient), 40_000);
    }

    function test_e2e_WinnerMarket_48Users_FinalizeAndChampionClaims() public {
        vm.prank(owner);
        uint256 id = market.createMarket(
            WINNER_EVENT_ID,
            48,
            uint64(block.timestamp + 1 hours),
            uint64(block.timestamp + 3 hours),
            "World Cup Winner"
        );

        for (uint8 i = 0; i < 48; i++) {
            address user = address(uint160(0xC100 + i));
            usdc.mint(user, INITIAL_USDC_BALANCE);

            vm.prank(user);
            usdc.approve(address(market), type(uint256).max);

            vm.prank(user);
            market.bet(id, i, 1_000_000);
        }

        vm.warp(block.timestamp + 3 hours);
        vm.prank(owner);
        oracle.proposeResult(WINNER_EVENT_ID, 37);

        vm.warp(block.timestamp + oracle.DISPUTE_WINDOW());
        vm.prank(alice);
        oracle.finalizeResult(WINNER_EVENT_ID);

        market.resolve(id);

        EventMarket.EventMarketDef memory m = market.getMarket(id);
        assertEq(m.settledOutcome, 37);
        assertEq(m.protocolFee, 470_000);
        assertEq(m.winnerPool, 47_530_000);

        address championBacker = address(uint160(0xC100 + 37));
        vm.prank(championBacker);
        market.claim(id);

        assertEq(usdc.balanceOf(championBacker), INITIAL_USDC_BALANCE + 46_530_000);
        assertEq(usdc.balanceOf(feeRecipient), 470_000);
    }
}
