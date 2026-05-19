// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"
#include "HktCoreDefs.h"
#include "HktCoreEvents.h"
#include "HktCoreEventLog.h"
#include "HktWorldState.h"
#include "VM/HktVMTypes.h"
#include "Terrain/HktTerrainDataSource.h"

// Forward Declarations
class FHktVMInterpreter;
class FHktVMRuntimePool;
struct FHktVMWorldStateProxy;
struct FHktTerrainState;

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

/** 3. VM Process System: 바이트코드 실행
 *
 * 시간 기반 Wait(Timer 등)는 hkt.Sim.FramesPerSecond CVar 단위 정수 프레임 카운트로 표현된다.
 * DeltaSeconds 입력은 받지 않는다 — 결정론.
 */
struct HKTCORE_API FHktVMProcessSystem
{
    EHktLogSource LogSource = EHktLogSource::Server;
    FHktVMInterpreter* Interpreter = nullptr;
    TArray<FHktPendingEvent> ScratchEvents;  // Reserve(MaxPendingEvents)

    void Process(
        TArray<FHktVMHandle>& ActiveVMs,
        TArray<FHktVMHandle>& OutCompletedVMs,
        FHktVMRuntimePool& Pool,
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
    /**
     * 서버 권위 시뮬레이터인지 (I-0014).
     *
     * Placement Story 는 서버 권위 시뮬레이션 1회만 실행되어야 한다 — 클라는 결과(spawned entity)
     * 를 WorldView 로 받는다. 클라가 미드조인 시 본 게이트가 ChunkLoaded / Spawner 이벤트의
     * 재발화를 차단하여 중복 spawn / 결정론 충돌을 막는다.
     *
     * 청크 LoadChunk 자체는 voxel 데이터 캐싱 목적이라 양쪽 모두 수행 — 본 플래그는 이벤트
     * emission 만 게이팅한다. 시뮬레이터 생성 시 LogSource 기반으로 1회 세팅.
     */
    bool bIsAuthoritative = true;

    TSet<FIntVector> RequiredChunks;  // 프레임 내 재사용 (할당 회피)
    FIntVector LastPivotChunk = FIntVector(MAX_int32);  // 이전 프레임의 피벗 청크 (변경 감지)

    /**
     * 이번 Process() 호출에서 새로 로드된 청크들의 spawner 메타로부터 생성된
     * dispatch 이벤트 (TerrainSpawner.design.md §7). 호출자 (Simulator.ProcessBatch)
     * 가 `Event.NewEvents` 와 합쳐 VMBuildSystem 입력으로 흘려보낸다.
     *
     * 매 Process() 진입 시 Reset — 프레임 내 누적 없음.
     */
    TArray<FHktEvent> EmittedSpawnerEvents;

    /** Process() 내부 scratch — 청크당 spawner 뷰 누적 버퍼 (할당 회피) */
    TArray<FHktTerrainSpawnerView> ScratchSpawnerViews;

    /** Process() 내부 scratch — 청크당 voxel attribution 뷰 (I-0014 Phase A, 할당 회피) */
    TArray<FHktVoxelAttributionView> ScratchVoxelAttributions;

    void Process(
        const FHktWorldState& WorldState,
        FHktTerrainState& TerrainState,
        const IHktTerrainDataSource& Source,
        const TArray<FHktEvent>* PendingEvents = nullptr
    );

    /** cm 위치 → 복셀 좌표 변환 (VoxelSize는 호출자가 TerrainState/Source에서 획득) */
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

    /** 고정 프레임 시뮬레이션 (hkt.Sim.FramesPerSecond). DeltaSeconds 입력은 받지 않는다 — 결정론. */
    void Process(
        FHktWorldState& WorldState,
        FHktVMWorldStateProxy& VMProxy
    );
};

/** 3.5 Movement System: 순수 운동학 적분 (active-mover 추적 기반)
 *
 * 책임:
 *   - 힘/질량/속도 적분으로 기대 위치 계산
 *   - VMProxy.ActiveMoverSlots 만 순회 (운동 관련 프로퍼티가 한 번이라도 쓰인 슬롯)
 *   - 비활성 슬롯은 PreMovePositions[Slot] = 현재 Pos 로 prefill (Physics 불변식)
 *   - 완전 정지(idle) 슬롯은 처리 후 ActiveMoverMask/Slots 에서 즉시 prune
 *   - MoveEnd 이벤트 emit, RotYaw 갱신
 *
 * 책임 아님 (PhysicsSystem 이관):
 *   - 지형 벽 슬라이드
 *   - step-height / 천장 검사
 *   - 지면 스냅 / IsGrounded 갱신
 *
 * 고정 프레임 시뮬레이션. DeltaSeconds 입력은 받지 않는다 — 결정론.
 * 모든 시간 종속 적분은 hkt.Sim.FramesPerSecond CVar (HktSimulationTick.h) 로부터 파생된다.
 *
 * Invariant: `VMProxy.ActiveMoverMask[Slot]==1` ⇔ Slot ∈ ActiveMoverSlots (정확히 1회).
 * mark/prune 양쪽에서 swap-pop 으로 유지된다.
 */
struct HKTCORE_API FHktMovementSystem
{
    /** 도착 판정 임계(거리²). 2D/3D 모두 동일 — `DistSq <= ArrivalThresholdSq` 면 스냅.
     *  결정론: 서버/클라가 동일 값을 써야 함. 본질적으로 시뮬레이션 상수이므로 헤더 고정.
     *  단위: cm². 기본 16 = 4cm 안쪽 도착 처리. */
    static constexpr float ArrivalThresholdSq = 16.0f;

    /** `PropertyId::MaxSpeed` 미설정(<=0) 시 사용되는 fallback 속력 (cm/s). */
    static constexpr float DefaultMaxSpeed = 600.0f;

    EHktLogSource LogSource = EHktLogSource::Server;

    void Process(
        FHktWorldState& WorldState,
        FHktVMWorldStateProxy& VMProxy,
        TArray<FHktPendingEvent>& OutMoveEndEvents,
        TArray<FIntVector>& OutPreMovePositions  // Slot 인덱스로 접근 — Physics 가 revert/슬라이드에 사용
    );
};

/** 4. Physics System — 2-phase 충돌 해소
 *
 * Phase 1: Entity-Entity Collision
 *   - CellMap 공간 해싱 broad phase (정렬된 셀 순회로 결정론 보장)
 *   - 캡슐-캡슐 narrow phase + mass 기반 반작용
 *   - CollisionLayer/Mask 양방향 매칭, 투사체 소유자 보호
 *
 * Phase 2: Terrain Floor Snap
 *   - 엔터티 발 복셀이 solid이면 위로 스캔하여 표면에 스냅
 *   - 발 아래 복셀이 solid이면 IsGrounded = 1
 *   - Grounded 상태 전환 시 이벤트 emit
 *
 * hkt.Debug.TerrainCollisionEntity 로 특정 엔터티의 상세 로그 활성화.
 */
struct HKTCORE_API FHktPhysicsSystem
{
    EHktLogSource LogSource = EHktLogSource::Server;

    /** 셀 진입 정보: 어떤 엔터티가 어떤 속도로 이 셀에 들어왔는지 */
    struct FCellEntry
    {
        FHktEntityId EntityId;
        FVector Velocity;  // ExpectedPos - PreMovePos
    };

    /** 복셀 좌표 → 진입 엔터티 목록 */
    TMap<FIntVector, TArray<FCellEntry>> CellMap;

    /** 엔터티 쌍 중복 검사 방지용 (프레임 간 재사용) */
    TSet<uint64> TestedPairs;

    /** 고정 프레임 시뮬레이션 (hkt.Sim.FramesPerSecond). DeltaSeconds 입력은 받지 않는다 — 결정론. */
    void Process(
        FHktWorldState& WorldState,
        FHktVMWorldStateProxy& VMProxy,
        TArray<FHktPhysicsEvent>& OutPhysicsEvents,
        TArray<FHktPendingEvent>& OutGroundedEvents,
        const TArray<FIntVector>& PreMovePositions,
        const FHktTerrainState* TerrainState
    );
};

/** 5. VM Cleanup System: 종료된 VM 해제 */
struct HKTCORE_API FHktVMCleanupSystem
{
    EHktLogSource LogSource = EHktLogSource::Server;
    void Process(TArray<FHktVMHandle>& CompletedVMs, FHktVMRuntimePool& Pool, FHktWorldState& WorldState, FHktVMWorldStateProxy& VMProxy);
};
