// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @title 赛事结算预言机统一接口
interface IEventOracle {
    enum EventStatus {
        Pending,
        Proposed,
        Challenged,
        Finalized
    }

    /// @notice 为指定赛事提交结果提案并开启异议期。
    /// @param eventId 赛事唯一标识。
    /// @param outcomeIndex 提议的结果索引。
    function proposeResult(bytes32 eventId, uint8 outcomeIndex) external;

    /// @notice 在异议期内对指定赛事结果提案发起挑战。
    /// @param eventId 赛事唯一标识。
    function challenge(bytes32 eventId) external;

    /// @notice 撤销已被挑战的结果提案，使赛事回到待提案状态。
    /// @param eventId 赛事唯一标识。
    function revokeProposal(bytes32 eventId) external;

    /// @notice 确认原结果提案并完成最终化。
    /// @param eventId 赛事唯一标识。
    function confirmProposal(bytes32 eventId) external;

    /// @notice 在无挑战且异议期结束后最终化结果。
    /// @param eventId 赛事唯一标识。
    function finalizeResult(bytes32 eventId) external;

    /// @notice 在挑战存在且处理超时后按原提案结果最终化。
    /// @param eventId 赛事唯一标识。
    function finalizeOnTimeout(bytes32 eventId) external;

    /// @notice 查询指定赛事当前记录的结果及是否已最终化。
    /// @param eventId 赛事唯一标识。
    /// @return outcomeIndex 当前记录的结果索引。
    /// @return finalized 结果是否已经最终化。
    function getResult(bytes32 eventId) external view returns (uint8 outcomeIndex, bool finalized);

    /// @notice 查询指定赛事当前状态。
    /// @param eventId 赛事唯一标识。
    /// @return 当前事件状态。
    function getEventStatus(bytes32 eventId) external view returns (EventStatus);
}
