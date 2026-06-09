// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Test} from "forge-std/Test.sol";
import {IPyth, PythStructs} from "../src/interfaces/IPyth.sol";

contract IPythInterfaceTest is Test {
    function test_ParsePriceFeedUpdatesUniqueSelector_MatchesSpec() external pure {
        bytes4 selector = IPyth.parsePriceFeedUpdatesUnique.selector;
        bytes4 expected = bytes4(keccak256("parsePriceFeedUpdatesUnique(bytes[],bytes32[],uint64,uint64)"));

        assertEq(selector, expected);
    }

    function test_PythStructsPriceFeed_ExposesExpectedFields() external pure {
        PythStructs.Price memory price = PythStructs.Price({price: 123, conf: 456, expo: -8, publishTime: 789});
        PythStructs.PriceFeed memory priceFeed =
            PythStructs.PriceFeed({id: bytes32(uint256(1)), price: price, emaPrice: price});

        assertEq(priceFeed.id, bytes32(uint256(1)));
        assertEq(int256(priceFeed.price.price), 123);
        assertEq(uint256(priceFeed.price.conf), 456);
        assertEq(int256(priceFeed.price.expo), -8);
        assertEq(priceFeed.price.publishTime, 789);
        assertEq(int256(priceFeed.emaPrice.price), 123);
    }
}
