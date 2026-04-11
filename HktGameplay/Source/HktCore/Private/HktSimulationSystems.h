// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"
#include "HktCoreDefs.h"
#include "HktCoreEvents.h"
#include "HktCoreEventLog.h"
#include "HktWorldState.h"
#include "VM/HktVMTypes.h"

// Forward Declarations
class FHktVMInterpreter;
class FHktVMRuntimePool;
struct FHktVMWorldStateProxy;
struct FHktTerrainState;
class FHktTerrainGenerator;

/** Private: Physics 이벤트 (시스템 내부용) */
struct FHktPhysicsEvent
{
    FHktEntityId EntityA = InvalidEntityId;
    FHktEntityId EntityB = InvalidEntityId;
    FVector ContactPoint = FVector::ZeroVector;
};

/** 1. Entity Arrange System: 제거된 소유자 정리 */
struct HKTCORE_API FHktEntityArrangeSystem
{
    EHktLogSource LogSource = EHktLogSource::Server;
    TArray<FHktEntityId> ScratchRemoveList;  // Reserve(MaxEntities)
    void Process(FHktWorldState& WorldState, const TArray<int64>& RemovedOwnerIds);
};

/** 2. VM Build System: 이벤트 -> VM 생성 */
struct HKTCORE_API FHktVMBuildSystem
{
    EHktLogSource LogSource = EHktLogSource::Server;
    void Process(
        const TArray<FHktEvent>& Events,
        int32 CurrentFrame,
        FHktVMRuntimePool& Pool,
        TArray<FHktVMHandle>& OutActiveVMs,
        FHktWorldState& WorldState,
        FHktVMWorldStateProxy& VMProxy,
        const FString& InsightsSource = FString()
    );
};

/** 3. VM Process System: 바이트코드 실행 */
struct HKTCORE_API FHktVMProcessSystem
{
    EHktLogSource LogSource = EHktLogSource::Server;
    FHktVMInterpreter* Interpreter = nullptr;
    TArray<FHktPendingEvent> ScratchEvents;  // Reserve(MaxPendingEvents)

    void Process(
        TArray<FHktVMHandle>& ActiveVMs,
        TArray<FHktVMHandle>& OutCompletedVMs,
        FHktVMRuntimePool& Pool,
        float DeltaSeconds,
        TArray<FHktPendingEvent>& PendingExternalEvents
    );
};

/** 3.2 Terrain System: 엔티티 위치 기반 청크 로드/언로드
 *
 * 모든 파라미터(VoxelSize, LoadRadius, MaxChunks, HeightMinZ/MaxZ)는
 * UHktRuntimeGlobalSetting → FHktTerrainGeneratorConfig 경로로 전달된다.
 * Process()가 Generator.GetConfig()에서 런타임 조회.
 */
struct HKTCORE_API FHktTerrainSystem
{

    TSet<FIntVector> RequiredChunks;  // 프레임 내 재사용 (할당 회피)
    FIntVector LastPivotChunk = FIntVector(MAX_int32);  // 이전 프레임의 피벗 청크 (변경 감지)

    void Process(
        const FHktWorldState& WorldState,
        FHktTerrainState& TerrainState,
        const FHktTerrainGenerator& Generator,
        const TArray<FHktEvent>* PendingEvents = nullptr
    );

    /** cm 위치 → 복셀 좌표 변환 (VoxelSize는 호출자가 TerrainState/Generator에서 획득) */
    static FIntVector CmToVoxel(int32 X, int32 Y, int32 Z, float VoxelSizeCm);
    static FIntVector CmToVoxel(float X, float Y, float Z, float VoxelSizeCm);

    /** 복셀 좌표 → cm 위치 변환 (복셀 중심) */
    static FIntVector VoxelToCm(int32 VX, int32 VY, int32 VZ, float VoxelSizeCm);
};

/** 3.4 Gravity System: 비접지(IsGrounded==0) 엔티티에 중력 누적
 *
 * MovementSystem 바로 직전에 실행된다. 중력은 "환경력"으로서 운동학과 분리돼 있어야
 * Movement 는 순수 적분만 담당할 수 있다. 지면 접촉 판정은 PhysicsSystem 이 소유한다.
 */
struct HKTCORE_API FHktGravitySystem
{
    EHktLogSource LogSource = EHktLogSource::Server;

    void Process(
        FHktWorldState& WorldState,
        FHktVMWorldStateProxy& VMProxy,
        float DeltaSeconds
    );
};

/** 3.5 Movement System: 순수 운동학 적분 (지형 질의 없음)
 *
 * 책임:
 *   - 힘/질량/속도 적분으로 기대 위치 계산
 *   - idle 엔티티 skip 최적화
 *   - MoveEnd 이벤트 emit, RotYaw 갱신
 *
 * 책임 아님 (PhysicsSystem 이관):
 *   - 지형 벽 슬라이드
 *   - step-height / 천장 검사
 *   - 지면 스냅 / IsGrounded 갱신
 *
 * 고정 프레임 1/30 초로 호출된다 (DeltaSeconds 파라미터).
 */
struct HKTCORE_API FHktMovementSystem
{
    EHktLogSource LogSource = EHktLogSource::Server;

    void Process(
        FHktWorldState& WorldState,
        FHktVMWorldStateProxy& VMProxy,
        TArray<FHktPendingEvent>& OutMoveEndEvents,
        TArray<FIntVector>& OutPreMovePositions,  // Slot 인덱스로 접근 — Physics 가 revert/슬라이드에 사용
        float DeltaSeconds
    );
};

/** 4. Physics System: 모든 제약 해결기 (지형 + 엔티티 간 충돌)
 *
 * Phase 1: 지형 제약 (PreMove 기준 축별 wall-slide → step-height → ceiling → floor snap)
 * Phase 2: 엔티티 쌍 해결 (soft push, 결정론적 entity-id 순서)
 * Phase 3: 잔여 지형 겹침 정리 (ResolveTerrainConstraints — 구 ProcessTerrainCollision)
 */
struct HKTCORE_API FHktPhysicsSystem
{
    static constexpr float CellSize = 1000.0f;
    EHktLogSource LogSource = EHktLogSource::Server;

    struct FCellCoord
    {
        int32 X, Y;
        bool operator==(const FCellCoord& Other) const { return X == Other.X && Y == Other.Y; }
        friend uint32 GetTypeHash(const FCellCoord& C) { return HashCombine(GetTypeHash(C.X), GetTypeHash(C.Y)); }
    };

    TMap<FCellCoord, TArray<FHktEntityId>> GridMap;
    TSet<uint64> TestedPairs;  // 인접 셀 중복 검사 방지용 (프레임 간 재사용)

    // Phase 2 결정론: entity id 오름차순으로 외곽 루프를 돌리기 위한 스크래치
    TArray<FHktEntityId> SortedEntitiesScratch;

    static FCellCoord WorldToCell(const FVector& Pos);
    void RebuildGrid(const FHktWorldState& WorldState);

    void Process(
        FHktWorldState& WorldState,
        FHktVMWorldStateProxy& VMProxy,
        TArray<FHktPhysicsEvent>& OutPhysicsEvents,
        TArray<FHktPendingEvent>& OutGroundedEvents,
        const TArray<FIntVector>& PreMovePositions,
        const FHktTerrainState* TerrainState,
        float DeltaSeconds
    );

private:
    /** Phase 1: 이동 후 위치에 대해 지형 제약(벽/계단/천장/지면) 해결 */
    void ResolveTerrainPhase1(
        FHktWorldState& WorldState,
        FHktVMWorldStateProxy& VMProxy,
        const TArray<FIntVector>& PreMovePositions,
        TArray<FHktPendingEvent>& OutGroundedEvents,
        const FHktTerrainState& TerrainState,
        float DeltaSeconds
    );

    /** Phase 3: 지형 잔여 겹침 정리 (구 ProcessTerrainCollision — 동작 그대로) */
    void ResolveTerrainConstraints(
        FHktWorldState& WorldState,
        FHktVMWorldStateProxy& VMProxy,
        const FHktTerrainState& TerrainState
    );
};

/** 5. VM Cleanup System: 종료된 VM 해제 */
struct HKTCORE_API FHktVMCleanupSystem
{
    EHktLogSource LogSource = EHktLogSource::Server;
    void Process(TArray<FHktVMHandle>& CompletedVMs, FHktVMRuntimePool& Pool, FHktWorldState& WorldState, FHktVMWorldStateProxy& VMProxy);
};
