// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"
#include "VM/HktVMTypes.h"
#include "HktVMContext.h"
#include "HktCoreEvents.h"
#include "HktSimulationLimits.h"

// Forward declarations
struct FHktVMProgram;

// ============================================================================
// FSpatialQueryResult - 공간 검색 결과 저장
// ============================================================================

struct FSpatialQueryResult
{
    TArray<FHktEntityId> Entities;
    int32 CurrentIndex = 0;

    FSpatialQueryResult() { Entities.Reserve(HktLimits::MaxPhysicsEvents); }

    void Reset()
    {
        Entities.Reset();  // 용량 유지 (Reserve된 메모리 보존)
        CurrentIndex = 0;
    }

    bool HasNext() const
    {
        return CurrentIndex < Entities.Num();
    }

    FHktEntityId Next()
    {
        if (HasNext())
        {
            return Entities[CurrentIndex++];
        }
        return InvalidEntityId;
    }
};

// ============================================================================
// FEventWaitState - 이벤트 대기 상태
// ============================================================================

struct FEventWaitState
{
    EWaitEventType Type = EWaitEventType::None;
    FHktEntityId WatchedEntity = InvalidEntityId;
    int32 RemainingFrames = 0;  // Timer용 — 30Hz 고정 프레임 단위

    void Reset()
    {
        Type = EWaitEventType::None;
        WatchedEntity = InvalidEntityId;
        RemainingFrames = 0;
    }
};

// ============================================================================
// FHktVMRuntime - 단일 VM의 실행 상태
// ============================================================================

struct HKTCORE_API FHktVMRuntime
{
    /** 실행 중인 프로그램 (공유, 불변) */
    const FHktVMProgram* Program = nullptr;

    /** VM 실행 컨텍스트 (WorldState 직접 읽기/쓰기) */
    FHktVMContext* Context = nullptr;

    /** 프로그램 카운터 */
    int32 PC = 0;

    /** 범용 레지스터 (R0-R15) */
    int32 Registers[MaxRegisters] = {0};

    /** 현재 상태 */
    EVMStatus Status = EVMStatus::Ready;

    /** 이 VM을 트리거한 플레이어 UID (SpawnEntity에서 OwnedPlayerUid 자동 설정용) */
    int64 PlayerUid = 0;

    /** 생성 프레임 */
    int32 CreationFrame = 0;

    /** Yield 후 대기 프레임 수 */
    int32 WaitFrames = 0;

    /** 이벤트 대기 상태 */
    FEventWaitState EventWait;

    /** 공간 검색 결과 (FindInRadius) */
    FSpatialQueryResult SpatialQuery;

    /** DispatchEvent opcode로 생성된 이벤트 큐 — 프레임 내 Build에서 소비 */
    TArray<FHktEvent> PendingDispatchedEvents;

#if ENABLE_HKT_INSIGHTS
    /** 디버그용: 이 VM을 생성한 이벤트 태그 */
    int32 SourceEventId = 0;
#endif

    // ========== 레지스터 헬퍼 ==========

    int32 GetReg(RegisterIndex Idx) const
    {
        check(Idx < MaxRegisters);
        return Registers[Idx];
    }

    void SetReg(RegisterIndex Idx, int32 Value)
    {
        check(Idx < MaxRegisters);
        Registers[Idx] = Value;
    }

    float GetRegFloat(RegisterIndex Idx) const
    {
        check(Idx < MaxRegisters);
        return *reinterpret_cast<const float*>(&Registers[Idx]);
    }

    void SetRegFloat(RegisterIndex Idx, float Value)
    {
        check(Idx < MaxRegisters);
        Registers[Idx] = *reinterpret_cast<const int32*>(&Value);
    }

    /** 엔티티 ID로 해석 */
    FHktEntityId GetRegEntity(RegisterIndex Idx) const
    {
        return static_cast<FHktEntityId>(Registers[Idx]);
    }

    void SetRegEntity(RegisterIndex Idx, FHktEntityId Entity)
    {
        Registers[Idx] = static_cast<int32>(Entity);
    }

    // ========== 상태 검사 ==========

    bool IsRunnable() const
    {
        return Status == EVMStatus::Ready || Status == EVMStatus::Running;
    }

    bool IsYielded() const { return Status == EVMStatus::Yielded; }
    bool IsWaitingEvent() const { return Status == EVMStatus::WaitingEvent; }
    bool IsCompleted() const { return Status == EVMStatus::Completed; }
    bool IsFailed() const { return Status == EVMStatus::Failed; }
    bool IsTerminated() const { return IsCompleted() || IsFailed(); }

    // ========== 디버그 ==========

    FString GetDebugString() const;
};

// ============================================================================
// FHktVMRuntimePool - SOA 레이아웃의 런타임 풀
// ============================================================================

class HKTCORE_API FHktVMRuntimePool
{
public:
    FHktVMRuntimePool();

    FHktVMHandle Allocate();
    void Free(FHktVMHandle Handle);

    FHktVMRuntime* Get(FHktVMHandle Handle);
    const FHktVMRuntime* Get(FHktVMHandle Handle) const;

    FHktVMContext* GetContext(FHktVMHandle Handle);
    const FHktVMContext* GetContext(FHktVMHandle Handle) const;

    bool IsValid(FHktVMHandle Handle) const;

    template<typename Func>
    void ForEachActive(Func&& Callback);

    int32 CountByStatus(EVMStatus Status) const;
    void Reset();

private:
    static constexpr int32 MaxVMs = 256;

    TArray<EVMStatus> Statuses;
    TArray<int32> PCs;
    TArray<int32> WaitFrameArr;
    TArray<uint8> Generations;
    TArray<FHktVMRuntime> Runtimes;
    TArray<FHktVMContext> Contexts;
    TArray<uint32> FreeSlots;
};

// ============================================================================
// Template 구현
// ============================================================================

template<typename Func>
void FHktVMRuntimePool::ForEachActive(Func&& Callback)
{
    for (int32 i = 0; i < Runtimes.Num(); ++i)
    {
        EVMStatus S = Statuses[i];
        if (S != EVMStatus::Completed && S != EVMStatus::Failed)
        {
            FHktVMHandle Handle;
            Handle.Index = i;
            Handle.Generation = Generations[i];
            Callback(Handle, Runtimes[i]);
        }
    }
}
