// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "HktCoreSimulator.h"
#include "HktSimulationSystems.h"
#include "VM/HktVMWorldStateProxy.h"
#include "Terrain/HktTerrainState.h"
#include "Terrain/HktTerrainDataSource.h"

class FHktVMRuntimePool;
class FHktVMInterpreter;
struct FHktVMHandle;
struct FHktPendingEvent;

// ============================================================================
// FHktWorldDeterminismSimulator
//
// 파이프라인: Arrange → Build → VM Process → Gravity → Movement → Physics(지형+엔티티) → Cleanup
// ============================================================================

class HKTCORE_API FHktWorldDeterminismSimulator : public IHktDeterminismSimulator
{
public:
    // 고정 시뮬레이션 틱은 HktLimits::FramesPerSecond 로 단일화됨 (30Hz).
    // 시뮬레이션 시스템은 DeltaSeconds 를 입력으로 받지 않는다 — 결정론.

    FHktWorldDeterminismSimulator(EHktLogSource InLogSource);
    ~FHktWorldDeterminismSimulator();

    virtual FHktSimulationDiff AdvanceFrame(const FHktSimulationEvent& InEvent) override;
    virtual FHktPlayerState ExportPlayerState(int64 OwnerUid) const override;
    virtual const FHktWorldState& GetWorldState() const override { return WorldState; }
    virtual void RestoreWorldState(const FHktWorldState& InState) override;
    virtual void UndoDiff(const FHktSimulationDiff& Diff) override;
    virtual void SetTerrainConfig(const FHktTerrainGeneratorConfig& Config) override;
    virtual void SetTerrainSource(TUniquePtr<IHktTerrainDataSource> InSource) override;

private:
    void ProcessBatch(const FHktSimulationEvent& Event);

    /** ProcessBatch 말미에 현재 살아있는 VM들을 WorldState.ActiveVMSnapshots 로 직렬화. */
    void CaptureVMSnapshots();

    /** RestoreWorldState 직후 WorldState.ActiveVMSnapshots 에서 VMPool/ActiveVMs 재구성. */
    void RehydrateVMPool();

    EHktLogSource LogSource;
    FString SourceName;
    FHktWorldState WorldState;
    FHktVMWorldStateProxy VMProxy;

    TUniquePtr<FHktVMRuntimePool> VMPool;
    TUniquePtr<FHktVMInterpreter> Interpreter;

    TArray<FHktVMHandle> ActiveVMs;
    TArray<FHktVMHandle> CompletedVMs;
    TArray<FHktPhysicsEvent> GeneratedPhysicsEvents;
    TArray<FHktPendingEvent> PendingExternalEvents;
    TArray<FHktPendingEvent> GeneratedMoveEndEvents;
    TArray<FHktPendingEvent> GeneratedGroundedEvents;
    TArray<FHktEvent> DispatchedEvents;

    // Movement → Physics 사이 PreMove 스크래치 (slot 인덱스 기반).
    // Movement 가 적분 전 원 위치를 기록, Physics Phase 1 이 wall-slide/step revert 에 사용.
    TArray<FIntVector> FramePreMovePositions;

    FHktEntityArrangeSystem EntityArrangeSystem;
    FHktVMBuildSystem       VMBuildSystem;
    FHktVMProcessSystem     VMProcessSystem;
    FHktTerrainSystem       TerrainSystem;
    FHktGravitySystem       GravitySystem;
    FHktMovementSystem      MovementSystem;
    FHktPhysicsSystem       PhysicsSystem;
    FHktVMCleanupSystem     VMCleanupSystem;

    // 지형 상태
    FHktTerrainState TerrainState;
    TUniquePtr<IHktTerrainDataSource> TerrainSource;
    TArray<FHktVoxelDelta> PendingVoxelDeltas;
};
