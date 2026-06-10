// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Test} from "forge-std/Test.sol";
import {ListMarkets} from "../script/ops/ListMarkets.s.sol";
import {ListResolvable} from "../script/ops/ListResolvable.s.sol";
import {PredictionMarket} from "../src/PredictionMarket.sol";
import {MockPyth} from "./mocks/MockPyth.sol";
import {MockUSDC} from "./mocks/MockUSDC.sol";

contract ListMarketsHarness is ListMarkets {
    function loadMarkets(address marketAddress) external view returns (PredictionMarket.Market[] memory) {
        return _loadMarkets(PredictionMarket(marketAddress));
    }
}

contract ListResolvableHarness is ListResolvable {
    function collectResolvableIds(address marketAddress) external view returns (uint256[] memory) {
        return _collectResolvableIds(PredictionMarket(marketAddress));
    }
}

contract OpsScriptsTest is Test {
    bytes32 internal constant PRICE_ID_BTC = bytes32(uint256(1));
    bytes32 internal constant PRICE_ID_ETH = bytes32(uint256(2));
    int32 internal constant EXPO_8 = -8;
    int64 internal constant THRESHOLD_BTC = 70_000_00000000;
    int64 internal constant THRESHOLD_ETH = 4_000_00000000;

    ListMarketsHarness internal listMarkets;
    ListResolvableHarness internal listResolvable;
    PredictionMarket internal market;
    MockUSDC internal usdc;
    MockPyth internal pyth;

    address internal constant FEE_RECIPIENT = address(0xFEE);

    function setUp() public {
        vm.warp(1_700_000_000);

        listMarkets = new ListMarketsHarness();
        listResolvable = new ListResolvableHarness();
        usdc = new MockUSDC();
        pyth = new MockPyth();
        market = new PredictionMarket(address(usdc), address(pyth), address(this), FEE_RECIPIENT);

        market.createMarket(
            PRICE_ID_BTC,
            THRESHOLD_BTC,
            EXPO_8,
            uint64(block.timestamp + 1 hours),
            uint64(block.timestamp + 2 hours),
            "BTC >= 70k"
        );
        market.createMarket(
            PRICE_ID_ETH,
            THRESHOLD_ETH,
            EXPO_8,
            uint64(block.timestamp + 3 hours),
            uint64(block.timestamp + 4 hours),
            "ETH >= 4k"
        );
    }

    function test_ListMarkets_RunDoesNotRevertAndLoadsAllMarkets() external {
        vm.setEnv("PREDICTION_MARKET", vm.toString(address(market)));

        PredictionMarket.Market[] memory listed = listMarkets.loadMarkets(address(market));

        assertEq(listed.length, 2);
        assertEq(listed[0].question, "BTC >= 70k");
        assertEq(listed[1].question, "ETH >= 4k");
        assertEq(listed[0].resolveAfter, uint64(1_700_000_000 + 2 hours));
        assertEq(listed[1].resolveAfter, uint64(1_700_000_000 + 4 hours));

        listMarkets.run();
    }

    function test_ListResolvable_RunDoesNotRevertWhenDueMarketExists() external {
        vm.warp(1_700_000_000 + 2 hours);
        vm.setEnv("PREDICTION_MARKET", vm.toString(address(market)));

        uint256[] memory resolvableIds = listResolvable.collectResolvableIds(address(market));

        assertEq(resolvableIds.length, 1);
        assertEq(resolvableIds[0], 0);

        listResolvable.run();
    }

    function test_ListResolvable_RunDoesNotRevertWhenNoDueMarketExists() external {
        vm.warp(1_700_000_000 + 90 minutes);
        vm.setEnv("PREDICTION_MARKET", vm.toString(address(market)));

        uint256[] memory resolvableIds = listResolvable.collectResolvableIds(address(market));

        assertEq(resolvableIds.length, 0);

        listResolvable.run();
    }

    function test_ListResolvable_ExcludesAlreadyResolvedDueMarket() external {
        vm.warp(1_700_000_000 + 2 hours);
        vm.setEnv("PREDICTION_MARKET", vm.toString(address(market)));

        pyth.setNextPrice(THRESHOLD_BTC, EXPO_8, uint64(block.timestamp), 0);
        market.resolve{value: pyth.fee()}(0, new bytes[](0));

        PredictionMarket.Market memory market0 = market.getMarket(0);
        assertEq(uint256(market0.outcome), uint256(PredictionMarket.Outcome.Invalid));

        uint256[] memory resolvableIds = listResolvable.collectResolvableIds(address(market));

        assertEq(resolvableIds.length, 0);

        listResolvable.run();
    }
}
