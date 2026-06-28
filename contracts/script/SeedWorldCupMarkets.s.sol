// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {stdJson} from "forge-std/StdJson.sol";
import {EventMarket} from "../src/EventMarket.sol";

contract SeedWorldCupMarkets is Script {
    using stdJson for string;

    string internal constant DEFAULT_SEED_PATH = "script/data/worldcup-seed.json";
    uint256 internal constant DEFAULT_FIRST_KICKOFF_DELAY_SECONDS = 0;
    uint8 internal constant WINNER_OUTCOME_COUNT = 48;
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
        string[] knockoutMatchIds;
        uint256[] knockoutKickoffTimes;
        string[] knockoutHomeTeams;
        string[] knockoutAwayTeams;
        string finalMatchId;
        uint256 finalKickoffTime;
        string finalHomeTeam;
        string finalAwayTeam;
    }

    function run() external virtual {
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
        uint256 createdMarkets = _createGroupMarkets(eventMarket, seed, targetFirstKickoff);
        createdMarkets += _createFinal1x2Market(eventMarket, seed, targetFirstKickoff);
        createdMarkets += _createWinnerMarket(eventMarket, seed, targetFirstKickoff);
        createdMarkets += _createKnockout1x2Markets(eventMarket, seed, targetFirstKickoff);
        vm.stopBroadcast();

        console2.log(unicode"已创建世界杯市场数量:", createdMarkets);
    }

    function _loadSeed(string memory path) internal view returns (WorldCupSeed memory seed) {
        string memory json = vm.readFile(path);
        seed.teamIds = json.readStringArray(".teamIds");
        seed.groupMatchIds = json.readStringArray(".groupMatchIds");
        seed.kickoffTimes = json.readUintArray(".kickoffTimes");
        seed.homeTeams = json.readStringArray(".homeTeams");
        seed.awayTeams = json.readStringArray(".awayTeams");
        seed.knockoutMatchIds =
            json.keyExists(".knockoutMatchIds") ? json.readStringArray(".knockoutMatchIds") : new string[](0);
        seed.knockoutKickoffTimes =
            json.keyExists(".knockoutKickoffTimes") ? json.readUintArray(".knockoutKickoffTimes") : new uint256[](0);
        seed.knockoutHomeTeams =
            json.keyExists(".knockoutHomeTeams") ? json.readStringArray(".knockoutHomeTeams") : new string[](0);
        seed.knockoutAwayTeams =
            json.keyExists(".knockoutAwayTeams") ? json.readStringArray(".knockoutAwayTeams") : new string[](0);
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
                || seed.knockoutMatchIds.length != seed.knockoutKickoffTimes.length
                || seed.knockoutMatchIds.length != seed.knockoutHomeTeams.length
                || seed.knockoutMatchIds.length != seed.knockoutAwayTeams.length
        ) {
            revert SeedArrayLengthMismatch();
        }
    }

    function _createGroupMarkets(EventMarket eventMarket, WorldCupSeed memory seed, uint256 targetFirstKickoff)
        internal
        returns (uint256 createdMarkets)
    {
        uint256 originalFirstKickoff = seed.kickoffTimes[0];
        for (uint256 i = 0; i < seed.groupMatchIds.length; ++i) {
            uint64 kickoff = _normalizedKickoff(seed.kickoffTimes[i], originalFirstKickoff, targetFirstKickoff);
            uint64 betDeadline = kickoff - BET_DEADLINE_OFFSET;
            uint64 resolveAfter = kickoff + RESOLVE_AFTER_OFFSET;
            string memory matchLabel = string.concat(seed.homeTeams[i], " vs ", seed.awayTeams[i]);

            if (betDeadline <= block.timestamp) {
                continue;
            }

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
            createdMarkets += 2;
        }
    }

    function _createFinal1x2Market(EventMarket eventMarket, WorldCupSeed memory seed, uint256 targetFirstKickoff)
        internal
        returns (uint256 createdMarkets)
    {
        if (_finalMarketCount(seed) == 0) {
            return 0;
        }

        uint64 kickoff = _normalizedKickoff(seed.finalKickoffTime, seed.kickoffTimes[0], targetFirstKickoff);
        uint64 betDeadline = kickoff - BET_DEADLINE_OFFSET;
        uint64 resolveAfter = kickoff + RESOLVE_AFTER_OFFSET;
        string memory matchLabel = string.concat(seed.finalHomeTeam, " vs ", seed.finalAwayTeam);

        if (betDeadline <= block.timestamp) {
            return 0;
        }

        eventMarket.createMarket(
            _eventId("1x2", seed.finalMatchId), 3, betDeadline, resolveAfter, string.concat(matchLabel, " 1X2")
        );
        return 1;
    }

    function _createKnockout1x2Markets(EventMarket eventMarket, WorldCupSeed memory seed, uint256 targetFirstKickoff)
        internal
        returns (uint256 createdMarkets)
    {
        return _createKnockout1x2Markets(eventMarket, seed, targetFirstKickoff, false);
    }

    function _createKnockout1x2Markets(
        EventMarket eventMarket,
        WorldCupSeed memory seed,
        uint256 targetFirstKickoff,
        bool skipExisting
    ) internal returns (uint256 createdMarkets) {
        uint256 originalFirstKickoff = seed.kickoffTimes[0];
        bytes32[] memory existingEventIds = skipExisting ? _existingEventIds(eventMarket) : new bytes32[](0);

        for (uint256 i = 0; i < seed.knockoutMatchIds.length; ++i) {
            uint64 kickoff = _normalizedKickoff(seed.knockoutKickoffTimes[i], originalFirstKickoff, targetFirstKickoff);
            uint64 betDeadline = kickoff - BET_DEADLINE_OFFSET;
            uint64 resolveAfter = kickoff + RESOLVE_AFTER_OFFSET;
            bytes32 eventId = _eventId("1x2", seed.knockoutMatchIds[i]);
            string memory matchLabel = string.concat(seed.knockoutHomeTeams[i], " vs ", seed.knockoutAwayTeams[i]);

            if (betDeadline <= block.timestamp) {
                continue;
            }

            if (skipExisting && _containsEventId(existingEventIds, eventId)) {
                continue;
            }

            eventMarket.createMarket(eventId, 3, betDeadline, resolveAfter, string.concat(matchLabel, " 1X2"));
            ++createdMarkets;
        }
    }

    function _createWinnerMarket(EventMarket eventMarket, WorldCupSeed memory seed, uint256 targetFirstKickoff)
        internal
        returns (uint256 createdMarkets)
    {
        if (seed.teamIds.length != WINNER_OUTCOME_COUNT) {
            revert SeedArrayLengthMismatch();
        }

        uint256 winnerReferenceKickoff =
            _finalMarketCount(seed) == 0 ? seed.kickoffTimes[seed.kickoffTimes.length - 1] : seed.finalKickoffTime;
        uint64 kickoff = _normalizedKickoff(winnerReferenceKickoff, seed.kickoffTimes[0], targetFirstKickoff);
        uint64 betDeadline = kickoff - BET_DEADLINE_OFFSET;

        if (betDeadline <= block.timestamp) {
            return 0;
        }

        eventMarket.createMarket(
            _eventId("winner", "worldcup-2026"),
            WINNER_OUTCOME_COUNT,
            betDeadline,
            _checkedTimestamp(uint256(kickoff) + WINNER_RESOLVE_AFTER_OFFSET),
            "World Cup winner"
        );
        return 1;
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

    function _existingEventIds(EventMarket eventMarket) internal view returns (bytes32[] memory eventIds) {
        uint256 count = eventMarket.marketCount();
        EventMarket.EventMarketDef[] memory markets = eventMarket.getMarketsPaged(0, count);
        eventIds = new bytes32[](markets.length);

        for (uint256 i = 0; i < markets.length; ++i) {
            eventIds[i] = markets[i].eventId;
        }
    }

    function _containsEventId(bytes32[] memory eventIds, bytes32 eventId) internal pure returns (bool) {
        for (uint256 i = 0; i < eventIds.length; ++i) {
            if (eventIds[i] == eventId) {
                return true;
            }
        }

        return false;
    }

    function _finalMarketCount(WorldCupSeed memory seed) internal pure returns (uint256) {
        return bytes(seed.finalMatchId).length == 0 ? 0 : 1;
    }
}
