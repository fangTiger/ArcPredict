// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Script, console2} from "forge-std/Script.sol";
import {PredictionMarket} from "../src/PredictionMarket.sol";

/// @notice 为指定市场双边注入种子流动性
/// @dev 该脚本只负责参数读取与 amount 边界校验，业务校验交给底层合约处理
contract SeedLiquidity is Script {
    error SeedAmountTooLarge();

    function run() external {
        uint256 seedPrivateKey = vm.envUint("SEED_PRIVATE_KEY");
        address marketAddress = vm.envAddress("PREDICTION_MARKET");
        address usdcAddress = vm.envAddress("USDC_ADDRESS");
        uint256 marketId = vm.envUint("MARKET_ID");
        uint128 amount = _toUint128Amount(vm.envUint("SEED_AMOUNT"));

        vm.startBroadcast(seedPrivateKey);
        IERC20(usdcAddress).approve(marketAddress, type(uint256).max);
        PredictionMarket(marketAddress).bet(marketId, true, amount);
        PredictionMarket(marketAddress).bet(marketId, false, amount);
        vm.stopBroadcast();

        console2.log("Seeded market", marketId, "with 2x", amount);
    }

    function _toUint128Amount(uint256 value) internal pure returns (uint128) {
        if (value > type(uint128).max) revert SeedAmountTooLarge();
        // casting to 'uint128' is safe because 上面已校验 value 不超过 uint128 上限
        // forge-lint: disable-next-line(unsafe-typecast)
        return uint128(value);
    }
}
