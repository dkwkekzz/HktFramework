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
// 파이프라인: Arrange → Build → Process → Movement → Physics(엔티티+지형 충돌) → Cleanup
// ============================================================================

class HKTCORE_API FHktWorldDeterminismSimulator : public IHktDeterminismSimulator
{
public:
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
    TArray<FHktEntityId> FrameRemovedEntities;
    TArray<FHktEvent> DispatchedEvents;

    FHktEntityArrangeSystem EntityArrangeSystem;
    FHktVMBuildSystem       VMBuildSystem;
    FHktVMProcessSystem     VMProcessSystem;
    FHktTerrainSystem       TerrainSystem;
    FHktMovementSystem      MovementSystem;
    FHktPhysicsSystem       PhysicsSystem;
    FHktVMCleanupSystem     VMCleanupSystem;

    // 지형 상태
    FHktTerrainState TerrainState;
    TUniquePtr<FHktTerrainGenerator> TerrainGenerator;
    TArray<FHktVoxelDelta> PendingVoxelDeltas;
};
