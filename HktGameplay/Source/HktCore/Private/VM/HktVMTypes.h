// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "HktStoryTypes.h"
#include "HktCoreDefs.h"

// ============================================================================
// VM 핸들 (Private/VM 전용)
// ============================================================================

/** VM 핸들 (RuntimePool 내 슬롯 인덱스 + Generation) */
struct FHktVMHandle
{
    uint32 Index : 24;
    uint32 Generation : 8;

    static constexpr FHktVMHandle Invalid() { return {0xFFFFFF, 0}; }
    bool IsValid() const { return Index != 0xFFFFFF; }

    bool operator==(const FHktVMHandle& Other) const
    {
        return Index == Other.Index && Generation == Other.Generation;
    }
};

// ============================================================================
// VM 상태 (Private/VM 전용)
// ============================================================================

enum class EVMStatus : uint8
{
    Ready,          // 실행 대기
    Running,        // 실행 중
    Yielded,        // yield 상태 (다음 틱에 재개)
    WaitingEvent,   // 이벤트 대기 중
    Completed,      // 정상 완료
    Failed,         // 오류로 중단
};

/**
 * EWaitEventType - VM이 대기하는 이벤트 타입
 */
enum class EWaitEventType : uint8
{
    None,
    Timer,
    Collision,
    MoveEnd,
    Grounded,       // 착지 대기 (점프 후 IsGrounded 전환)
};

/**
 * FHktPendingEvent - 외부에서 주입된 이벤트 (큐에 적재, Execute에서 일괄 처리)
 */
struct FHktPendingEvent
{
    EWaitEventType Type = EWaitEventType::None;
    FHktEntityId WatchedEntity = InvalidEntityId;
    FHktEntityId HitEntity = InvalidEntityId;  // Collision 전용
};
