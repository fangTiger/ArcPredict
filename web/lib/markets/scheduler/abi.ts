import { parseAbi } from 'viem';

export const eventMarketAbi = parseAbi([
  'function createMarket(bytes32 eventId, uint8 outcomeCount, uint64 betDeadline, uint64 resolveAfter, string question) returns (uint256 id)',
  'function resolve(uint256 id)',
  'event MarketCreated(uint256 indexed id, bytes32 indexed eventId, uint8 outcomeCount, uint64 betDeadline, uint64 resolveAfter, uint16 feeBpsSnapshot, address feeRecipientSnapshot, string question)',
  'event Resolved(uint256 indexed id, uint8 settledOutcome, uint64 settleTime, uint128 winnerPool, uint128 protocolFee)',
  'function markets(uint256 id) view returns (bytes32 eventId, uint8 outcomeCount, uint64 betDeadline, uint64 resolveAfter, uint128[] outcomePools, uint128 winnerPool, uint128 protocolFee, uint16 feeBpsSnapshot, address feeRecipientSnapshot, uint8 settledOutcome, uint64 settleTime, string question)',
]);

export const adminOracleAbi = parseAbi([
  'function proposeResult(bytes32 eventId, uint8 outcomeIndex)',
  'function finalizeResult(bytes32 eventId)',
  'function getResult(bytes32 eventId) view returns (uint8 outcomeIndex, bool finalized)',
  'function getEventStatus(bytes32 eventId) view returns (uint8 status)',
  'event ResultProposed(bytes32 indexed eventId, uint8 outcomeIndex, uint64 proposedAt)',
  'event Finalized(bytes32 indexed eventId, uint8 outcomeIndex, uint64 finalizedAt)',
  'event Challenged(bytes32 indexed eventId, address challenger, uint64 challengedAt)',
]);

export const erc20Abi = parseAbi([
  'function approve(address spender, uint256 amount) returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function balanceOf(address account) view returns (uint256)',
]);

// AdminEventOracle.sol 中 IEventOracle.EventStatus 的枚举值。
export const ORACLE_STATUS = {
  Pending: 0,
  Proposed: 1,
  Challenged: 2,
  Finalized: 3,
} as const;

export type OracleStatusValue = typeof ORACLE_STATUS[keyof typeof ORACLE_STATUS];
