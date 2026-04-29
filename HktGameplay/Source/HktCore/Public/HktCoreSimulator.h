// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "HktCoreEvents.h"
#include "HktWorldState.h"
#include "HktCoreEventLog.h"
#include "Terrain/HktTerrainGeneratorConfig.h"
#include "Terrain/HktTerrainDataSource.h"
#include "Templates/UniquePtr.h"

// ============================================================================
// FHktVMDebugInfo — VM 실행 상태 디버그 정보 (Public, 순수 데이터)
// ============================================================================

struct HKTCORE_API FHktVMDebugInfo
{
    int32 PC = 0;
    int32 Status = 0;       // EVMStatus as int32
    FString ProgramTag;     // FGameplayTag::ToString()
    int64 PlayerUid = 0;
    int32 CreationFrame = 0;
    int32 SelfEntity = -1;
    int32 TargetEntity = -1;
    int32 SourceEventId = 0;
};

// ============================================================================
// IHktDeterminismSimulator — 클라/서버 공통 코어 시뮬레이터 (내부 시뮬레이션만)
// ============================================================================

class HKTCORE_API IHktDeterminismSimulator
{
public:
    virtual ~IHktDeterminismSimulator() = default;

    virtual FHktSimulationDiff AdvanceFrame(const FHktSimulationEvent& InEvent) = 0;
    virtual const FHktWorldState& GetWorldState() const = 0;
    virtual FHktPlayerState ExportPlayerState(int64 OwnerUid) const = 0;
    virtual void RestoreWorldState(const FHktWorldState& InState) = 0;

    /** Diff 역적용 — 프레임 변경 되돌리기 (클라이언트 예측 롤백용) */
    virtual void UndoDiff(const FHktSimulationDiff& Diff) = 0;

    /** 지형 생성기 설정 — 설정 시 시뮬레이션이 복셀 지형을 인지하기 시작함 */
    virtual void SetTerrainConfig(const FHktTerrainGeneratorConfig& Config) {}

    /**
     * 지형 데이터 소스 직접 주입.
     *
     * `SetTerrainConfig` 가 등록된 팩토리(`HktTerrain::CreateDataSource`)로
     * 기본 `FHktTerrainGenerator` 를 만드는 반면, 본 API 는 호출자가 만든
     * 임의의 `IHktTerrainDataSource` (예: Subsystem 어댑터인 `FHktTerrainProvider`)
     * 를 그대로 보유하도록 한다.
     *
     * Use case (PR-C 액터 와이어링):
     *   1. `SetTerrainConfig(Cfg)` 가 GameMode 시점에 한 번 호출되어 폴백 Generator 가 활성화됨.
     *   2. `UHktTerrainSubsystem::LoadBakedAsset` 완료 콜백에서 Actor 가
     *      `MakeUnique<FHktTerrainProvider>(Sub, Cfg)` 를 만들어 본 API 로 교체 주입.
     *   3. 이후 시뮬레이션은 baked-first + 폴백 정책을 자동 적용받음.
     *
     * 절대 원칙: 인자가 nullptr 이면 지형 파이프라인 비활성화. 기존 소스는 안전 해제.
     */
    virtual void SetTerrainSource(TUniquePtr<IHktTerrainDataSource> InSource) {}
};

// ============================================================================
// Factory
// ============================================================================

/** 클라이언트/서버 공통: 결정론 시뮬레이터 (서버는 반환값을 IHktAuthoritySimulator*로 캐스트하여 사용) */
HKTCORE_API TUniquePtr<IHktDeterminismSimulator> CreateDeterminismSimulator(EHktLogSource InLogSource);
