// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {console2} from "forge-std/Script.sol";
import {EventMarket} from "../src/EventMarket.sol";
import {SeedWorldCupMarkets} from "./SeedWorldCupMarkets.s.sol";

contract CreateWorldCupKnockoutMarkets is SeedWorldCupMarkets {
    function run() external override {
        uint256 ownerPrivateKey = vm.envUint("OWNER_PRIVATE_KEY");
        EventMarket eventMarket = EventMarket(vm.envAddress("EVENT_MARKET_ADDRESS"));
        string memory seedPath = vm.envOr("WORLDCUP_SEED_PATH", DEFAULT_SEED_PATH);
        uint256 firstKickoffDelay =
            vm.envOr("WORLDCUP_FIRST_KICKOFF_DELAY_SECONDS", DEFAULT_FIRST_KICKOFF_DELAY_SECONDS);

        WorldCupSeed memory seed = _loadSeed(seedPath);
        uint256 targetFirstKickoff =
            firstKickoffDelay == 0 ? seed.kickoffTimes[0] : block.timestamp + firstKickoffDelay;
        if (firstKickoffDelay > 0 && targetFirstKickoff <= block.timestamp + BET_DEADLINE_OFFSET) {
            revert FirstKickoffTooSoon();
        }

        vm.startBroadcast(ownerPrivateKey);
        uint256 createdMarkets = _createKnockout1x2Markets(eventMarket, seed, targetFirstKickoff, true);
        vm.stopBroadcast();

        console2.log(unicode"已创建世界杯淘汰赛市场数量:", createdMarkets);
    }
}
