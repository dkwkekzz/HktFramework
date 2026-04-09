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

/** 3.2 Terrain System: 엔티티 위치 기반 청크 로드/언로드 */
struct HKTCORE_API FHktTerrainSystem
{
    static constexpr int32 LoadRadiusXY = 2;    // 엔티티 주변 XY 2청크 반경 로드
    static constexpr int32 LoadRadiusZ = 1;     // 엔티티 주변 Z 1청크 반경 로드
    static constexpr int32 MaxChunksLoaded = 256;  // 시뮬레이션 메모리 제한
    static constexpr int32 MaxChunkLoadsPerFrame = 4;  // 프레임당 최대 로드 수 (스파이크 방지)
    static constexpr float VoxelSizeCm = 15.0f;    // HktVoxelCore와 동일

    TSet<FIntVector> RequiredChunks;  // 프레임 내 재사용 (할당 회피)
    FIntVector LastPivotChunk = FIntVector(MAX_int32);  // 이전 프레임의 피벗 청크 (변경 감지)

    void Process(
        const FHktWorldState& WorldState,
        FHktTerrainState& TerrainState,
        const FHktTerrainGenerator& Generator,
        const TArray<FHktEvent>* PendingEvents = nullptr
    );

    /** cm 위치 → 복셀 좌표 변환 */
    static FIntVector CmToVoxel(int32 X, int32 Y, int32 Z);
    static FIntVector CmToVoxel(float X, float Y, float Z);

    /** 복셀 좌표 → cm 위치 변환 (복셀 중심) */
    static FIntVector VoxelToCm(int32 VX, int32 VY, int32 VZ);
};

/** 3.5 Movement System: 힘→가속도 물리 기반 이동 (고정 프레임 1/30초) */
struct HKTCORE_API FHktMovementSystem
{
    static constexpr float FixedDeltaSeconds = 1.0f / 30.0f;
    static constexpr float MaxSpeed = 600.0f;       // cm/s 최대속도 제한
    static constexpr float Damping = 0.95f;          // 매 프레임 속도 감쇠

    void Process(
        FHktWorldState& WorldState,
        FHktVMWorldStateProxy& VMProxy,
        TArray<FHktPendingEvent>& OutMoveEndEvents,
        const FHktTerrainState* TerrainState = nullptr
    );
};

/** 4. Physics System: 공간 분할 및 충돌 감지 */
struct HKTCORE_API FHktPhysicsSystem
{
    static constexpr float CellSize = 1000.0f;

    struct FCellCoord
    {
        int32 X, Y;
        bool operator==(const FCellCoord& Other) const { return X == Other.X && Y == Other.Y; }
        friend uint32 GetTypeHash(const FCellCoord& C) { return HashCombine(GetTypeHash(C.X), GetTypeHash(C.Y)); }
    };

    TMap<FCellCoord, TArray<FHktEntityId>> GridMap;
    TSet<uint64> TestedPairs;  // 인접 셀 중복 검사 방지용 (프레임 간 재사용)

    static FCellCoord WorldToCell(const FVector& Pos);
    void RebuildGrid(const FHktWorldState& WorldState);

    void Process(
        FHktWorldState& WorldState,
        FHktVMWorldStateProxy& VMProxy,
        TArray<FHktPhysicsEvent>& OutPhysicsEvents
    );
};

/** 5. VM Cleanup System: 종료된 VM 해제 */
struct HKTCORE_API FHktVMCleanupSystem
{
    EHktLogSource LogSource = EHktLogSource::Server;
    void Process(TArray<FHktVMHandle>& CompletedVMs, FHktVMRuntimePool& Pool, FHktWorldState& WorldState, FHktVMWorldStateProxy& VMProxy);
};
