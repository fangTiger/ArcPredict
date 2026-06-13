// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {stdJson} from "forge-std/StdJson.sol";
import {AdminEventOracle} from "../src/AdminEventOracle.sol";
import {EventMarket} from "../src/EventMarket.sol";

contract DeployWorldCupTestnet is Script {
    using stdJson for string;

    uint256 internal constant EXPECTED_MARKET_COUNT = 98;
    bytes32 internal constant FINAL_1_EVENT_ID = 0x2b902d6a9c3a763f380d5c1af8475ea4efa1142488ebc730dc7c1c8851b061b1;
    string internal constant DEFAULT_SEED_PATH = "script/data/worldcup-seed.json";
    uint256 internal constant DEFAULT_FIRST_KICKOFF_DELAY_SECONDS = 1 days;
    uint8 internal constant WINNER_OUTCOME_COUNT = 32;
    uint64 internal constant BET_DEADLINE_OFFSET = 5 minutes;
    uint64 internal constant RESOLVE_AFTER_OFFSET = 150 minutes;
    uint64 internal constant WINNER_RESOLVE_AFTER_OFFSET = 30 days;
    uint64 internal constant TESTNET_FINAL_KICKOFF_DELAY = 15 minutes;

    error EmptySeed();
    error SeedArrayLengthMismatch();
    error InvalidSeedSchedule();
    error SeedTimestampTooLarge();
    error FirstKickoffTooSoon();
    error MarketCountMismatch(uint256 expected, uint256 actual);
    error MarketNotFound(bytes32 eventId);
    error UnexpectedOutcomeCount(uint256 marketId, uint8 expected, uint8 actual);
    error UnexpectedTimestamp(uint256 marketId, uint64 expected, uint64 actual);

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

    function run() external returns (AdminEventOracle adminEventOracle, EventMarket eventMarket) {
        uint256 ownerPrivateKey = vm.envUint("OWNER_PRIVATE_KEY");
        address usdc = vm.envAddress("USDC_ADDRESS");
        address feeRecipient = vm.envAddress("FEE_RECIPIENT");
        address bonusBank = vm.envAddress("BONUS_BANK_ADDRESS");
        address ownerEoa = vm.addr(ownerPrivateKey);
        string memory seedPath = vm.envOr("WORLDCUP_SEED_PATH", DEFAULT_SEED_PATH);
        uint256 firstKickoffDelay =
            vm.envOr("WORLDCUP_FIRST_KICKOFF_DELAY_SECONDS", DEFAULT_FIRST_KICKOFF_DELAY_SECONDS);
        WorldCupSeed memory seed = _loadSeed(seedPath);
        uint256 targetFirstKickoff = block.timestamp + firstKickoffDelay;

        if (targetFirstKickoff <= block.timestamp + BET_DEADLINE_OFFSET) {
            revert FirstKickoffTooSoon();
        }

        vm.startBroadcast(ownerPrivateKey);
        adminEventOracle = new AdminEventOracle(usdc, ownerEoa, feeRecipient, bonusBank, WINNER_OUTCOME_COUNT);
        eventMarket = new EventMarket(usdc, ownerEoa, feeRecipient, address(adminEventOracle));

        _createGroupMarkets(eventMarket, seed, targetFirstKickoff);
        uint64 finalKickoff = _createCompressedFinal1x2Market(eventMarket, seed);
        _createWinnerMarket(eventMarket, seed.teamIds.length, targetFirstKickoff);
        vm.stopBroadcast();

        uint256 marketCount = eventMarket.marketCount();
        if (marketCount != EXPECTED_MARKET_COUNT) {
            revert MarketCountMismatch(EXPECTED_MARKET_COUNT, marketCount);
        }

        (uint256 finalMarketId, EventMarket.EventMarketDef memory finalMarket) =
            _findMarketByEventId(eventMarket, FINAL_1_EVENT_ID);
        if (finalMarket.outcomeCount != 3) {
            revert UnexpectedOutcomeCount(finalMarketId, 3, finalMarket.outcomeCount);
        }

        uint64 finalStartTime = finalMarket.resolveAfter - RESOLVE_AFTER_OFFSET;
        if (finalStartTime != finalKickoff) {
            revert UnexpectedTimestamp(finalMarketId, finalKickoff, finalStartTime);
        }
        if (finalMarket.betDeadline != finalKickoff - BET_DEADLINE_OFFSET) {
            revert UnexpectedTimestamp(finalMarketId, finalKickoff - BET_DEADLINE_OFFSET, finalMarket.betDeadline);
        }
        if (finalMarket.resolveAfter != finalKickoff + RESOLVE_AFTER_OFFSET) {
            revert UnexpectedTimestamp(finalMarketId, finalKickoff + RESOLVE_AFTER_OFFSET, finalMarket.resolveAfter);
        }

        bytes32 winnerEventId = _eventId("winner", "worldcup-2022");
        (uint256 winnerMarketId,) = _findMarketByEventId(eventMarket, winnerEventId);

        console2.log(unicode"AdminEventOracle 地址", address(adminEventOracle));
        console2.log(unicode"EventMarket 地址", address(eventMarket));
        console2.log(unicode"owner 地址", ownerEoa);
        console2.log(unicode"USDC 地址", usdc);
        console2.log(unicode"feeRecipient 地址", feeRecipient);
        console2.log(unicode"bonusBank 地址", bonusBank);
        console2.log(unicode"市场数量", marketCount);
        console2.log(unicode"final-1 eventId");
        console2.logBytes32(FINAL_1_EVENT_ID);
        console2.log(unicode"final-1 marketId", finalMarketId);
        console2.log(unicode"final-1 startTime", uint256(finalStartTime));
        console2.log(unicode"final-1 resolveAfter", uint256(finalMarket.resolveAfter));
        console2.log(unicode"winner marketId", winnerMarketId);
    }

    function _loadSeed(string memory path) internal view returns (WorldCupSeed memory seed) {
        // 这里读取仓库内 seed 数据，支持通过环境变量覆盖路径以便测试网演练。
        // forge-lint: disable-next-line(unsafe-cheatcode)
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

    function _createCompressedFinal1x2Market(EventMarket eventMarket, WorldCupSeed memory seed)
        internal
        returns (uint64 kickoff)
    {
        if (_finalMarketCount(seed) == 0) {
            revert MarketNotFound(FINAL_1_EVENT_ID);
        }

        kickoff = _checkedTimestamp(block.timestamp + TESTNET_FINAL_KICKOFF_DELAY);
        uint64 betDeadline = kickoff - BET_DEADLINE_OFFSET;
        uint64 resolveAfter = kickoff + RESOLVE_AFTER_OFFSET;
        string memory matchLabel = string.concat(seed.finalHomeTeam, " vs ", seed.finalAwayTeam);

        eventMarket.createMarket(FINAL_1_EVENT_ID, 3, betDeadline, resolveAfter, string.concat(matchLabel, " 1X2"));
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

    function _findMarketByEventId(EventMarket eventMarket, bytes32 eventId)
        internal
        view
        returns (uint256 marketId, EventMarket.EventMarketDef memory marketDef)
    {
        EventMarket.EventMarketDef[] memory page = eventMarket.getMarketsPaged(0, eventMarket.marketCount());
        for (uint256 i = 0; i < page.length; ++i) {
            if (page[i].eventId == eventId) {
                return (i, page[i]);
            }
        }

        revert MarketNotFound(eventId);
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
        return _checkedTimestamp(shifted);
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
