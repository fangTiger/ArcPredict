// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Test} from "forge-std/Test.sol";
import {IPyth, PythStructs} from "../src/interfaces/IPyth.sol";

contract IPythInterfaceTest is Test {
    uint256 internal constant HARNESS_FEE = 123456;

    IPyth internal pyth;

    function setUp() public {
        vm.deal(address(this), 1 ether);
        pyth = new IPythAdapterHarness(HARNESS_FEE);
    }

    function test_GetUpdateFeeSelector_MatchesSpec() external pure {
        bytes4 selector = IPyth.getUpdateFee.selector;
        bytes4 expected = bytes4(keccak256("getUpdateFee(bytes[])"));

        assertEq(selector, expected);
    }

    function test_ParsePriceFeedUpdatesUniqueSelector_MatchesSpec() external pure {
        bytes4 selector = IPyth.parsePriceFeedUpdatesUnique.selector;
        bytes4 expected = bytes4(keccak256("parsePriceFeedUpdatesUnique(bytes[],bytes32[],uint64,uint64)"));

        assertEq(selector, expected);
    }

    function test_GetUpdateFee_CanBeCalledFromViewContext_AndReturnsUint256() external view {
        bytes[] memory updateData = new bytes[](1);
        updateData[0] = hex"1234";

        uint256 fee = _readUpdateFeeFromView(updateData);
        assertEq(fee, HARNESS_FEE);
    }

    function test_ParsePriceFeedUpdatesUnique_PayableCall_ReturnsPriceFeeds() external {
        bytes[] memory updateData = new bytes[](1);
        updateData[0] = hex"abcd";
        bytes32[] memory priceIds = new bytes32[](2);
        priceIds[0] = bytes32(uint256(1));
        priceIds[1] = bytes32(uint256(2));

        PythStructs.PriceFeed[] memory priceFeeds =
            pyth.parsePriceFeedUpdatesUnique{value: 777}(updateData, priceIds, 100, 200);

        assertEq(priceFeeds.length, 2);
        assertEq(priceFeeds[0].id, priceIds[0]);
        assertEq(priceFeeds[0].price.publishTime, 100);
        assertEq(priceFeeds[1].id, priceIds[1]);
        assertEq(priceFeeds[1].emaPrice.publishTime, 200);
    }

    function test_PythStructsPrice_AbiEncoding_MatchesDeclaredFieldOrder() external pure {
        PythStructs.Price memory price = PythStructs.Price({price: 123, conf: 456, expo: -8, publishTime: 789});
        bytes memory encodedPrice = abi.encode(price);
        bytes memory expectedEncodedPrice = abi.encode(int64(123), uint64(456), int32(-8), uint256(789));

        assertEq(encodedPrice, expectedEncodedPrice);
    }

    function test_PythStructsPriceFeed_AbiEncoding_MatchesDeclaredFieldOrder() external pure {
        PythStructs.Price memory price = PythStructs.Price({price: 123, conf: 456, expo: -8, publishTime: 789});
        PythStructs.Price memory emaPrice =
            PythStructs.Price({price: 321, conf: 654, expo: -6, publishTime: 987});
        PythStructs.PriceFeed memory priceFeed =
            PythStructs.PriceFeed({id: bytes32(uint256(1)), price: price, emaPrice: emaPrice});
        bytes memory encodedPriceFeed = abi.encode(priceFeed);
        bytes memory expectedEncodedPriceFeed = abi.encode(bytes32(uint256(1)), price, emaPrice);

        assertEq(encodedPriceFeed, expectedEncodedPriceFeed);
    }

    function _readUpdateFeeFromView(bytes[] memory updateData) internal view returns (uint256) {
        return pyth.getUpdateFee(updateData);
    }
}

contract IPythAdapterHarness is IPyth {
    uint256 internal immutable FEE;

    constructor(uint256 initialFee) {
        FEE = initialFee;
    }

    function getUpdateFee(bytes[] calldata) external view returns (uint256) {
        return FEE;
    }

    function parsePriceFeedUpdatesUnique(
        bytes[] calldata,
        bytes32[] calldata priceIds,
        uint64 minPublishTime,
        uint64 maxPublishTime
    ) external payable returns (PythStructs.PriceFeed[] memory priceFeeds) {
        priceFeeds = new PythStructs.PriceFeed[](priceIds.length);

        for (uint256 i = 0; i < priceIds.length; i++) {
            PythStructs.Price memory price = PythStructs.Price({
                price: i == 0 ? int64(100) : int64(101),
                conf: i == 0 ? uint64(1) : uint64(2),
                expo: -8,
                publishTime: minPublishTime
            });
            PythStructs.Price memory emaPrice = PythStructs.Price({
                price: i == 0 ? int64(200) : int64(201),
                conf: i == 0 ? uint64(2) : uint64(3),
                expo: -8,
                publishTime: maxPublishTime
            });

            priceFeeds[i] = PythStructs.PriceFeed({id: priceIds[i], price: price, emaPrice: emaPrice});
        }
    }
}
