// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Script, console2} from "forge-std/Script.sol";
import {EventMarket} from "../src/EventMarket.sol";

/// @notice 为指定 EventMarket 市场的所有 outcome 等额注入起始流动性。
contract SeedWorldCupLiquidity is Script {
    error NoOutcomes();
    error SeedAmountBelowMinimum();
    error SeedAmountTooLarge();

    function run() external {
        uint256 seedPrivateKey = vm.envUint("SEED_PRIVATE_KEY");
        EventMarket eventMarket = EventMarket(vm.envAddress("EVENT_MARKET_ADDRESS"));
        address usdcAddress = vm.envAddress("USDC_ADDRESS");
        uint256 marketId = vm.envUint("MARKET_ID");
        uint256 seedAmount = vm.envUint("SEED_AMOUNT");

        EventMarket.EventMarketDef memory marketDef = eventMarket.getMarket(marketId);
        uint128 perOutcome = _splitSeedAmount(seedAmount, marketDef.outcomeCount, eventMarket.MIN_BET());

        vm.startBroadcast(seedPrivateKey);
        IERC20(usdcAddress).approve(address(eventMarket), type(uint256).max);
        for (uint8 outcomeIndex = 0; outcomeIndex < marketDef.outcomeCount; ++outcomeIndex) {
            eventMarket.bet(marketId, outcomeIndex, perOutcome);
        }
        vm.stopBroadcast();

        console2.log(unicode"已注入 EventMarket 市场", marketId, unicode"每个 outcome 金额", perOutcome);
    }

    function _splitSeedAmount(uint256 value, uint8 outcomeCount, uint128 minBet) internal pure returns (uint128) {
        if (outcomeCount == 0) revert NoOutcomes();

        uint256 perOutcome = value / outcomeCount;
        if (perOutcome < minBet) revert SeedAmountBelowMinimum();
        if (perOutcome > type(uint128).max) revert SeedAmountTooLarge();
        // casting to uint128 是安全的，因为 perOutcome 已校验不超过 uint128 上限。
        // forge-lint: disable-next-line(unsafe-typecast)
        return uint128(perOutcome);
    }
}
