// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {stdJson} from "forge-std/StdJson.sol";
import {EventMarket} from "../src/EventMarket.sol";

contract SeedWorldCupMarkets is Script {
    using stdJson for string;

    string internal constant DEFAULT_SEED_PATH = "script/data/worldcup-seed.json";
    uint256 internal constant DEFAULT_FIRST_KICKOFF_DELAY_SECONDS = 1 days;
    uint8 internal constant WINNER_OUTCOME_COUNT = 32;
    uint64 internal constant BET_DEADLINE_OFFSET = 5 minutes;
    uint64 internal constant RESOLVE_AFTER_OFFSET = 150 minutes;
    uint64 internal constant WINNER_RESOLVE_AFTER_OFFSET = 30 days;

    error EmptySeed();
    error SeedArrayLengthMismatch();
    error InvalidSeedSchedule();
    error SeedTimestampTooLarge();
    error FirstKickoffTooSoon();

    struct WorldCupSeed {
        string[] teamIds;
        string[] groupMatchIds;
        uint256[] kickoffTimes;
        string[] homeTeams;
        string[] awayTeams;
        string finalMatchId;
        uint256 finalKickoffTime;
        string finalHomeTeam;
        string finalAwayTeam;
    }

    function run() external {
        uint256 ownerPrivateKey = vm.envUint("OWNER_PRIVATE_KEY");
        EventMarket eventMarket = EventMarket(vm.envAddress("EVENT_MARKET_ADDRESS"));
        string memory seedPath = vm.envOr("WORLDCUP_SEED_PATH", DEFAULT_SEED_PATH);
        uint256 firstKickoffDelay =
            vm.envOr("WORLDCUP_FIRST_KICKOFF_DELAY_SECONDS", DEFAULT_FIRST_KICKOFF_DELAY_SECONDS);

        WorldCupSeed memory seed = _loadSeed(seedPath);
        uint256 targetFirstKickoff = block.timestamp + firstKickoffDelay;
        if (targetFirstKickoff <= block.timestamp + BET_DEADLINE_OFFSET) {
            revert FirstKickoffTooSoon();
        }

        vm.startBroadcast(ownerPrivateKey);
        _createGroupMarkets(eventMarket, seed, targetFirstKickoff);
        _createFinal1x2Market(eventMarket, seed, targetFirstKickoff);
        _createWinnerMarket(eventMarket, seed.teamIds.length, targetFirstKickoff);
        vm.stopBroadcast();

        console2.log(
            unicode"已创建世界杯市场数量:", seed.groupMatchIds.length * 2 + _finalMarketCount(seed) + 1
        );
    }

    function _loadSeed(string memory path) internal view returns (WorldCupSeed memory seed) {
        string memory json = vm.readFile(path);
        seed.teamIds = json.readStringArray(".teamIds");
        seed.groupMatchIds = json.readStringArray(".groupMatchIds");
        seed.kickoffTimes = json.readUintArray(".kickoffTimes");
        seed.homeTeams = json.readStringArray(".homeTeams");
        seed.awayTeams = json.readStringArray(".awayTeams");
        seed.finalMatchId = json.readStringOr(".finalMatchId", "");
        seed.finalKickoffTime = json.readUintOr(".finalKickoffTime", 0);
        seed.finalHomeTeam = json.readStringOr(".finalHomeTeam", "");
        seed.finalAwayTeam = json.readStringOr(".finalAwayTeam", "");

        if (seed.teamIds.length == 0 || seed.groupMatchIds.length == 0) {
            revert EmptySeed();
        }
        if (
            seed.groupMatchIds.length != seed.kickoffTimes.length || seed.groupMatchIds.length != seed.homeTeams.length
                || seed.groupMatchIds.length != seed.awayTeams.length
        ) {
            revert SeedArrayLengthMismatch();
        }
    }

    function _createGroupMarkets(EventMarket eventMarket, WorldCupSeed memory seed, uint256 targetFirstKickoff)
        internal
    {
        uint256 originalFirstKickoff = seed.kickoffTimes[0];
        for (uint256 i = 0; i < seed.groupMatchIds.length; ++i) {
            uint64 kickoff = _normalizedKickoff(seed.kickoffTimes[i], originalFirstKickoff, targetFirstKickoff);
            uint64 betDeadline = kickoff - BET_DEADLINE_OFFSET;
            uint64 resolveAfter = kickoff + RESOLVE_AFTER_OFFSET;
            string memory matchLabel = string.concat(seed.homeTeams[i], " vs ", seed.awayTeams[i]);

            eventMarket.createMarket(
                _eventId("1x2", seed.groupMatchIds[i]), 3, betDeadline, resolveAfter, string.concat(matchLabel, " 1X2")
            );
            eventMarket.createMarket(
                _eventId("goals-25", seed.groupMatchIds[i]),
                2,
                betDeadline,
                resolveAfter,
                string.concat(matchLabel, " total goals over 2.5")
            );
        }
    }

    function _createFinal1x2Market(EventMarket eventMarket, WorldCupSeed memory seed, uint256 targetFirstKickoff)
        internal
    {
        if (_finalMarketCount(seed) == 0) {
            return;
        }

        uint64 kickoff = _normalizedKickoff(seed.finalKickoffTime, seed.kickoffTimes[0], targetFirstKickoff);
        uint64 betDeadline = kickoff - BET_DEADLINE_OFFSET;
        uint64 resolveAfter = kickoff + RESOLVE_AFTER_OFFSET;
        string memory matchLabel = string.concat(seed.finalHomeTeam, " vs ", seed.finalAwayTeam);

        eventMarket.createMarket(
            _eventId("1x2", seed.finalMatchId), 3, betDeadline, resolveAfter, string.concat(matchLabel, " 1X2")
        );
    }

    function _createWinnerMarket(EventMarket eventMarket, uint256 teamCount, uint256 targetFirstKickoff) internal {
        if (teamCount != WINNER_OUTCOME_COUNT) {
            revert SeedArrayLengthMismatch();
        }

        eventMarket.createMarket(
            _eventId("winner", "worldcup-2022"),
            WINNER_OUTCOME_COUNT,
            _checkedTimestamp(targetFirstKickoff - BET_DEADLINE_OFFSET),
            _checkedTimestamp(targetFirstKickoff + WINNER_RESOLVE_AFTER_OFFSET),
            "World Cup winner"
        );
    }

    function _normalizedKickoff(uint256 originalKickoff, uint256 originalFirstKickoff, uint256 targetFirstKickoff)
        internal
        pure
        returns (uint64)
    {
        if (originalKickoff < originalFirstKickoff) {
            revert InvalidSeedSchedule();
        }

        uint256 shifted = targetFirstKickoff + (originalKickoff - originalFirstKickoff);
        if (shifted > type(uint64).max) {
            revert SeedTimestampTooLarge();
        }
        // casting to uint64 是安全的，因为 shifted 已校验不超过 uint64 上限。
        // forge-lint: disable-next-line(unsafe-typecast)
        return uint64(shifted);
    }

    function _checkedTimestamp(uint256 timestampValue) internal pure returns (uint64) {
        if (timestampValue > type(uint64).max) {
            revert SeedTimestampTooLarge();
        }
        // casting to uint64 是安全的，因为 timestampValue 已校验不超过 uint64 上限。
        // forge-lint: disable-next-line(unsafe-typecast)
        return uint64(timestampValue);
    }

    function _eventId(string memory marketType, string memory seedId) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked("worldcup:", marketType, ":", seedId));
    }

    function _finalMarketCount(WorldCupSeed memory seed) internal pure returns (uint256) {
        return bytes(seed.finalMatchId).length == 0 ? 0 : 1;
    }
}
