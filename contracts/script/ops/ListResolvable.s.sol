// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Script} from "forge-std/Script.sol";
import {console2} from "forge-std/console2.sol";
import {PredictionMarket} from "../../src/PredictionMarket.sol";

/// @notice 列出当前已到可结算时间且仍未结算的市场
contract ListResolvable is Script {
    function run() external view {
        PredictionMarket predictionMarket = PredictionMarket(vm.envAddress("PREDICTION_MARKET"));
        _run(predictionMarket);
    }

    function _run(PredictionMarket predictionMarket) internal view {
        uint256[] memory resolvableIds = _collectResolvableIds(predictionMarket);

        console2.log(unicode"可结算市场数量", resolvableIds.length);

        for (uint256 i = 0; i < resolvableIds.length; ++i) {
            uint256 id = resolvableIds[i];
            PredictionMarket.Market memory market_ = predictionMarket.getMarket(id);

            console2.log(unicode"市场编号", id);
            console2.log(string.concat(unicode"问题: ", market_.question));
            console2.log(unicode"最早结算时间", uint256(market_.resolveAfter));
        }
    }

    function _collectResolvableIds(PredictionMarket predictionMarket)
        internal
        view
        returns (uint256[] memory ids)
    {
        uint256 count = predictionMarket.marketCount();
        uint256 resolvableCount;

        for (uint256 i = 0; i < count; ++i) {
            if (_isResolvable(predictionMarket.getMarket(i))) {
                ++resolvableCount;
            }
        }

        ids = new uint256[](resolvableCount);
        uint256 nextIndex;

        for (uint256 i = 0; i < count; ++i) {
            if (_isResolvable(predictionMarket.getMarket(i))) {
                ids[nextIndex] = i;
                ++nextIndex;
            }
        }
    }

    function _isResolvable(PredictionMarket.Market memory market_) internal view returns (bool) {
        return market_.outcome == PredictionMarket.Outcome.Unresolved && block.timestamp >= market_.resolveAfter;
    }
}
