// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Test} from "forge-std/Test.sol";
import {PythStructs} from "../src/interfaces/IPyth.sol";
import {MockPyth} from "./mocks/MockPyth.sol";

contract MockPythTest is Test {
    MockPyth internal mockPyth;
    bytes[] internal updateData;
    bytes32[] internal priceIds;

    function setUp() public {
        vm.deal(address(this), 1 ether);

        mockPyth = new MockPyth();

        updateData = new bytes[](1);
        updateData[0] = hex"1234";

        priceIds = new bytes32[](2);
        priceIds[0] = bytes32(uint256(1));
        priceIds[1] = bytes32(uint256(2));
    }

    function test_DefaultFee_IsOneWei_AndSetFeeUpdatesGetUpdateFee() external {
        assertEq(mockPyth.fee(), 1 wei);
        assertEq(mockPyth.getUpdateFee(updateData), 1 wei);

        mockPyth.setFee(777);

        assertEq(mockPyth.fee(), 777);
        assertEq(mockPyth.getUpdateFee(updateData), 777);
    }

    function test_ParsePriceFeedUpdatesUnique_ReturnsFeedForEachPriceId() external {
        mockPyth.setFee(5);
        mockPyth.setNextPrice(123_456, -8, 150, 42);

        PythStructs.PriceFeed[] memory feeds =
            mockPyth.parsePriceFeedUpdatesUnique{value: 5}(updateData, priceIds, 100, 200);

        assertEq(feeds.length, priceIds.length);

        for (uint256 i = 0; i < priceIds.length; i++) {
            assertEq(feeds[i].id, priceIds[i]);
            assertEq(feeds[i].price.price, 123_456);
            assertEq(feeds[i].price.conf, 42);
            assertEq(feeds[i].price.expo, -8);
            assertEq(feeds[i].price.publishTime, 150);
            assertEq(feeds[i].emaPrice.price, 123_456);
            assertEq(feeds[i].emaPrice.conf, 42);
            assertEq(feeds[i].emaPrice.expo, -8);
            assertEq(feeds[i].emaPrice.publishTime, 150);
        }
    }

    function test_ParsePriceFeedUpdatesUnique_RevertsWhenFeeIsTooLow() external {
        mockPyth.setFee(2);

        vm.expectRevert(bytes("fee"));
        mockPyth.parsePriceFeedUpdatesUnique{value: 1}(updateData, priceIds, 0, 100);
    }

    function test_ParsePriceFeedUpdatesUnique_RevertsWhenForced() external {
        mockPyth.setShouldRevert(true);
        uint256 currentFee = mockPyth.fee();

        vm.expectRevert(bytes("MockPyth: forced revert"));
        mockPyth.parsePriceFeedUpdatesUnique{value: currentFee}(updateData, priceIds, 0, 100);
    }

    function test_ParsePriceFeedUpdatesUnique_RevertsWhenPublishTimeOutOfWindow() external {
        mockPyth.setNextPrice(1, -8, 99, 1);
        uint256 currentFee = mockPyth.fee();

        vm.expectRevert(bytes("MockPyth: publishTime out of window"));
        mockPyth.parsePriceFeedUpdatesUnique{value: currentFee}(updateData, priceIds, 100, 200);
    }
}
