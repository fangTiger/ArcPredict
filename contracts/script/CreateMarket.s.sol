// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {PredictionMarket} from "../src/PredictionMarket.sol";

/// @notice 创建预测市场的 Foundry 脚本
/// @dev 通过环境变量读取参数，并在链上调用 PredictionMarket.createMarket
contract CreateMarket is Script {
    error Int64OutOfRange();
    error Int32OutOfRange();
    error FeedExpoOutOfRange();
    error HumanThresholdMustBePositive();
    error ScaledThresholdOverflow();
    error TimestampOverflow();

    /// @notice 把人类可读阈值按 Pyth expo 缩放成合约所需单位
    /// @dev scale(70000, -8) == 70000_00000000
    function scale(int64 human, int32 feedExpo) internal pure returns (int64) {
        if (feedExpo > 0 || feedExpo < -18) revert FeedExpoOutOfRange();
        if (human <= 0) revert HumanThresholdMustBePositive();

        // casting to 'uint32' is safe because feedExpo 已校验在 [-18, 0]，取负后只会落在 [0, 18]
        // forge-lint: disable-next-line(unsafe-typecast)
        uint32 decimalsU32 = uint32(-feedExpo);
        // casting to 'uint256' is safe because decimalsU32 最大只会到 18
        // forge-lint: disable-next-line(unsafe-typecast)
        uint256 decimals = uint256(decimalsU32);
        // casting to 'int256' is safe because 10**18 远小于 int256 上限
        // forge-lint: disable-next-line(unsafe-typecast)
        int256 multiplier = int256(10 ** decimals);
        int256 scaled = int256(human) * multiplier;

        if (scaled > type(int64).max) revert ScaledThresholdOverflow();
        // casting to 'int64' is safe because 上面已校验 scaled <= type(int64).max，且 human > 0
        // forge-lint: disable-next-line(unsafe-typecast)
        return int64(scaled);
    }

    function run() external {
        uint256 ownerPrivateKey = vm.envUint("OWNER_PRIVATE_KEY");
        address marketAddress = vm.envAddress("PREDICTION_MARKET");
        bytes32 priceId = vm.envBytes32("PYTH_PRICE_ID");
        int64 humanThreshold = _toInt64(vm.envInt("HUMAN_THRESHOLD"));
        int32 feedExpo = _toInt32(vm.envInt("FEED_EXPO"));
        uint64 betDeadline = _hoursFromNow(vm.envUint("HOURS_TO_BET_DEADLINE"));
        uint64 resolveAfter = _hoursFromNow(vm.envUint("HOURS_TO_RESOLVE_AFTER"));
        string memory question = vm.envString("QUESTION");

        vm.startBroadcast(ownerPrivateKey);
        uint256 id = PredictionMarket(marketAddress).createMarket(
            priceId,
            scale(humanThreshold, feedExpo),
            feedExpo,
            betDeadline,
            resolveAfter,
            question
        );
        vm.stopBroadcast();

        console2.log("Created market id:", id);
    }

    function _toInt64(int256 value) internal pure returns (int64) {
        if (value < type(int64).min || value > type(int64).max) revert Int64OutOfRange();
        // casting to 'int64' is safe because 上面已校验 int64 边界
        // forge-lint: disable-next-line(unsafe-typecast)
        return int64(value);
    }

    function _toInt32(int256 value) internal pure returns (int32) {
        if (value < type(int32).min || value > type(int32).max) revert Int32OutOfRange();
        // casting to 'int32' is safe because 上面已校验 int32 边界
        // forge-lint: disable-next-line(unsafe-typecast)
        return int32(value);
    }

    function _hoursFromNow(uint256 hoursFromNow) internal view returns (uint64) {
        uint256 maxHours = (uint256(type(uint64).max) - block.timestamp) / 1 hours;
        if (hoursFromNow > maxHours) revert TimestampOverflow();
        // casting to 'uint64' is safe because 上面已校验目标时间戳不超过 type(uint64).max
        // forge-lint: disable-next-line(unsafe-typecast)
        return uint64(block.timestamp + hoursFromNow * 1 hours);
    }
}
