// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Script} from "forge-std/Script.sol";
import {console2} from "forge-std/console2.sol";
import {PredictionMarket} from "../../src/PredictionMarket.sol";

/// @notice 列出全部市场的基础信息
contract ListMarkets is Script {
    function run() external view {
        PredictionMarket predictionMarket = PredictionMarket(vm.envAddress("PREDICTION_MARKET"));
        _run(predictionMarket);
    }

    function _run(PredictionMarket predictionMarket) internal view {
        PredictionMarket.Market[] memory listed = _loadMarkets(predictionMarket);

        console2.log(unicode"市场数量", listed.length);

        for (uint256 i = 0; i < listed.length; ++i) {
            PredictionMarket.Market memory market_ = listed[i];
            console2.log(unicode"市场编号", i);
            console2.log(unicode"结果状态", uint256(uint8(market_.outcome)));
            console2.log(string.concat(unicode"问题: ", market_.question));
            console2.log(unicode"是池", uint256(market_.yesPool));
            console2.log(unicode"否池", uint256(market_.noPool));
            console2.log(unicode"最早结算时间", uint256(market_.resolveAfter));
        }
    }

    function _loadMarkets(PredictionMarket predictionMarket)
        internal
        view
        returns (PredictionMarket.Market[] memory listed)
    {
        uint256 count = predictionMarket.marketCount();
        listed = new PredictionMarket.Market[](count);

        for (uint256 i = 0; i < count; ++i) {
            listed[i] = predictionMarket.getMarket(i);
        }
    }
}
