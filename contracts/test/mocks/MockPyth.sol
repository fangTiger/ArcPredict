// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {IPyth, PythStructs} from "../../src/interfaces/IPyth.sol";

/// @dev 可控 Mock：通过 setter 设定下一次 parse 返回值或 revert。
contract MockPyth is IPyth {
    uint256 public fee = 1 wei;

    bool public shouldRevert;
    int64 public nextPrice;
    int32 public nextExpo;
    uint64 public nextPublishTime;
    uint64 public nextConf;

    function setFee(uint256 newFee) external {
        fee = newFee;
    }

    function setShouldRevert(bool value) external {
        shouldRevert = value;
    }

    function setNextPrice(int64 price, int32 expo, uint64 publishTime, uint64 conf) external {
        nextPrice = price;
        nextExpo = expo;
        nextPublishTime = publishTime;
        nextConf = conf;
    }

    function getUpdateFee(bytes[] calldata) external view returns (uint256) {
        return fee;
    }

    function parsePriceFeedUpdatesUnique(
        bytes[] calldata,
        bytes32[] calldata priceIds,
        uint64 minPublishTime,
        uint64 maxPublishTime
    ) external payable returns (PythStructs.PriceFeed[] memory feeds) {
        require(msg.value >= fee, "fee");

        if (shouldRevert) {
            revert("MockPyth: forced revert");
        }

        require(
            nextPublishTime >= minPublishTime && nextPublishTime <= maxPublishTime,
            "MockPyth: publishTime out of window"
        );

        feeds = new PythStructs.PriceFeed[](priceIds.length);

        for (uint256 i = 0; i < priceIds.length; i++) {
            PythStructs.Price memory price = PythStructs.Price({
                price: nextPrice,
                conf: nextConf,
                expo: nextExpo,
                publishTime: nextPublishTime
            });

            feeds[i] = PythStructs.PriceFeed({id: priceIds[i], price: price, emaPrice: price});
        }
    }
}
