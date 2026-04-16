// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "HktCoreSimulator.h"
#include "HktSimulationSystems.h"
#include "VM/HktVMWorldStateProxy.h"
#include "Terrain/HktTerrainState.h"
#include "Terrain/HktTerrainGenerator.h"

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
    // 고정 시뮬레이션 틱 (30Hz). 과거 FHktMovementSystem::FixedDeltaSeconds 에서 승격.
    static constexpr float FixedDeltaSeconds = 1.0f / 30.0f;

    FHktWorldDeterminismSimulator(EHktLogSource InLogSource);
    ~FHktWorldDeterminismSimulator();

    virtual FHktSimulationDiff AdvanceFrame(const FHktSimulationEvent& InEvent) override;
    virtual FHktPlayerState ExportPlayerState(int64 OwnerUid) const override;
    virtual const FHktWorldState& GetWorldState() const override { return WorldState; }
    virtual void RestoreWorldState(const FHktWorldState& InState) override;
    virtual void UndoDiff(const FHktSimulationDiff& Diff) override;
    virtual void SetTerrainConfig(const FHktTerrainGeneratorConfig& Config) override;

private:
    void ProcessBatch(const FHktSimulationEvent& Event);

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
    TUniquePtr<FHktTerrainGenerator> TerrainGenerator;
    TArray<FHktVoxelDelta> PendingVoxelDeltas;
};
