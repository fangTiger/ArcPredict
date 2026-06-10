// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {StdInvariant} from "forge-std/StdInvariant.sol";
import {Test} from "forge-std/Test.sol";
import {PredictionMarket} from "../src/PredictionMarket.sol";
import {MockPyth} from "./mocks/MockPyth.sol";
import {MockUSDC} from "./mocks/MockUSDC.sol";

contract InvariantHandler is Test {
    uint256 internal constant ACTOR_COUNT = 4;
    uint256 internal constant INITIAL_USDC_BALANCE = 1_000_000_000_000;
    uint256 internal constant MAX_BET_AMOUNT = 250_000_000_000;

    PredictionMarket public market;
    MockUSDC public usdc;
    MockPyth public pyth;
    address[ACTOR_COUNT] public actors;

    uint256 public totalPaid;

    constructor(PredictionMarket market_, MockUSDC usdc_, MockPyth pyth_) {
        market = market_;
        usdc = usdc_;
        pyth = pyth_;

        actors[0] = address(0xB101);
        actors[1] = address(0xB102);
        actors[2] = address(0xB103);
        actors[3] = address(0xB104);

        for (uint256 i = 0; i < ACTOR_COUNT; i++) {
            address actor = actors[i];
            usdc.mint(actor, INITIAL_USDC_BALANCE);

            vm.prank(actor);
            usdc.approve(address(market), type(uint256).max);

            vm.deal(actor, 10 ether);
        }
    }

    function actorCount() external pure returns (uint256) {
        return ACTOR_COUNT;
    }

    function fuzz_bet(uint256 actorSeed, uint256 marketSeed, uint256 amountSeed, uint8 sideSeed) external {
        uint256 count = market.marketCount();
        if (count == 0) return;

        uint256 marketId = marketSeed % count;
        address actor = actors[actorSeed % ACTOR_COUNT];
        PredictionMarket.Market memory m = market.getMarket(marketId);

        if (m.outcome != PredictionMarket.Outcome.Unresolved) return;
        if (block.timestamp >= m.betDeadline) return;

        uint256 maxAmount = usdc.balanceOf(actor);
        if (maxAmount < market.MIN_BET()) return;
        if (maxAmount > MAX_BET_AMOUNT) {
            maxAmount = MAX_BET_AMOUNT;
        }

        uint128 amount = uint128(bound(amountSeed, market.MIN_BET(), maxAmount));

        vm.prank(actor);
        market.bet(marketId, sideSeed % 2 == 0, amount);
    }

    function fuzz_resolve(uint256 marketSeed, int64 price) external {
        uint256 count = market.marketCount();
        if (count == 0) return;

        uint256 marketId = marketSeed % count;
        PredictionMarket.Market memory m = market.getMarket(marketId);
        if (m.outcome != PredictionMarket.Outcome.Unresolved) return;

        uint256 resolveAt = uint256(m.resolveAfter) + 1;
        if (block.timestamp < resolveAt) {
            vm.warp(resolveAt);
        }

        pyth.setNextPrice(price, m.thresholdExpo, m.resolveAfter, 0);

        bytes[] memory updateData = new bytes[](1);
        market.resolve{value: pyth.fee()}(marketId, updateData);
    }

    function fuzz_claim(uint256 actorSeed, uint256 marketSeed) external {
        uint256 count = market.marketCount();
        if (count == 0) return;

        uint256 marketId = marketSeed % count;
        address actor = actors[actorSeed % ACTOR_COUNT];
        PredictionMarket.Market memory m = market.getMarket(marketId);

        if (m.outcome == PredictionMarket.Outcome.Unresolved) return;
        if (market.claimed(marketId, actor)) return;

        (uint128 yesAmount, uint128 noAmount) = market.userStake(marketId, actor);
        if (yesAmount == 0 && noAmount == 0) return;

        if (m.outcome == PredictionMarket.Outcome.Yes && yesAmount == 0) return;
        if (m.outcome == PredictionMarket.Outcome.No && noAmount == 0) return;

        uint256 beforeBalance = usdc.balanceOf(actor);

        vm.prank(actor);
        market.claim(marketId);

        totalPaid += usdc.balanceOf(actor) - beforeBalance;
    }
}

contract PredictionMarketInvariantTest is StdInvariant, Test {
    uint256 internal constant ACTOR_COUNT = 4;
    bytes32 internal constant PRICE_ID = bytes32(uint256(1));
    int32 internal constant EXPO_8 = -8;

    PredictionMarket public market;
    MockUSDC public usdc;
    MockPyth public pyth;
    InvariantHandler public handler;

    address public owner = address(0xA001);
    address public feeRecipient = address(0xA002);

    function setUp() public {
        usdc = new MockUSDC();
        pyth = new MockPyth();

        vm.prank(owner);
        market = new PredictionMarket(address(usdc), address(pyth), owner, feeRecipient);

        for (uint256 i = 0; i < 6; i++) {
            vm.prank(owner);
            market.createMarket(
                PRICE_ID,
                int64(int256(60_000_00000000 + i * 1_000_00000000)),
                EXPO_8,
                uint64(block.timestamp + (i + 1) * 1 hours),
                uint64(block.timestamp + (i + 1) * 1 hours + 1 minutes),
                "Invariant market"
            );
        }

        handler = new InvariantHandler(market, usdc, pyth);
        vm.deal(address(handler), 10 ether);

        targetContract(address(handler));

        bytes4[] memory selectors = new bytes4[](3);
        selectors[0] = InvariantHandler.fuzz_bet.selector;
        selectors[1] = InvariantHandler.fuzz_resolve.selector;
        selectors[2] = InvariantHandler.fuzz_claim.selector;
        targetSelector(FuzzSelector({addr: address(handler), selectors: selectors}));
    }

    function invariant_FundsConservation_Strong() public view {
        uint256 contractBalance = usdc.balanceOf(address(market));
        uint256 ledgerOwed = 0;
        uint256 remainingOwed = 0;
        uint256 count = market.marketCount();

        for (uint256 marketId = 0; marketId < count; marketId++) {
            PredictionMarket.Market memory m = market.getMarket(marketId);

            if (
                m.outcome == PredictionMarket.Outcome.Unresolved
                    || m.outcome == PredictionMarket.Outcome.Invalid
            ) {
                ledgerOwed += uint256(m.yesPool) + uint256(m.noPool);
            } else {
                ledgerOwed += uint256(m.winnerPool);
            }

            if (m.outcome == PredictionMarket.Outcome.Unresolved) {
                remainingOwed += uint256(m.yesPool) + uint256(m.noPool);
            }

            for (uint256 actorIndex = 0; actorIndex < ACTOR_COUNT; actorIndex++) {
                remainingOwed += market.pendingPayout(marketId, handler.actors(actorIndex));
            }
        }

        assertEq(contractBalance + handler.totalPaid(), ledgerOwed);
        assertGe(contractBalance, remainingOwed);
    }

    function invariant_NoOverpayment() public view {
        uint256 expectedFeeBalance = 0;
        uint256 count = market.marketCount();

        for (uint256 marketId = 0; marketId < count; marketId++) {
            PredictionMarket.Market memory m = market.getMarket(marketId);

            if (m.outcome == PredictionMarket.Outcome.Yes || m.outcome == PredictionMarket.Outcome.No) {
                uint256 totalPool = uint256(m.yesPool) + uint256(m.noPool);
                uint256 losingPool =
                    m.outcome == PredictionMarket.Outcome.Yes ? uint256(m.noPool) : uint256(m.yesPool);
                uint256 expectedFee = losingPool * uint256(m.feeBpsSnapshot) / 10_000;

                expectedFeeBalance += expectedFee;

                assertEq(uint256(m.protocolFee), expectedFee);
                assertEq(uint256(m.winnerPool) + uint256(m.protocolFee), totalPool);
                assertLe(uint256(m.winnerPool), totalPool);
            } else {
                assertEq(uint256(m.winnerPool), 0);
                assertEq(uint256(m.protocolFee), 0);
            }
        }

        assertEq(usdc.balanceOf(feeRecipient), expectedFeeBalance);
    }

    function invariant_InvalidPendingPayoutEqualsStakeForActors() public view {
        uint256 count = market.marketCount();

        for (uint256 marketId = 0; marketId < count; marketId++) {
            PredictionMarket.Market memory m = market.getMarket(marketId);
            if (m.outcome != PredictionMarket.Outcome.Invalid) continue;

            for (uint256 actorIndex = 0; actorIndex < ACTOR_COUNT; actorIndex++) {
                address actor = handler.actors(actorIndex);
                (uint128 yesAmount, uint128 noAmount) = market.userStake(marketId, actor);
                uint256 stake = uint256(yesAmount) + uint256(noAmount);
                uint256 pending = market.pendingPayout(marketId, actor);

                if (market.claimed(marketId, actor)) {
                    assertEq(pending, 0);
                } else {
                    assertEq(pending, stake);
                }
            }
        }
    }
}
