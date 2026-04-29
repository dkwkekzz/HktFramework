// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"
#include "Terrain/HktTerrainDataSource.h"
#include "Terrain/HktTerrainGeneratorConfig.h"
#include "Terrain/HktTerrainVoxel.h"
#include "UObject/WeakObjectPtr.h"

class UHktTerrainSubsystem;

/**
 * FHktTerrainProvider — Subsystem 어댑터를 IHktTerrainDataSource 로 노출.
 *
 * HktCore 의 시뮬레이션은 IHktTerrainDataSource 인터페이스로만 청크 데이터를 소비한다.
 * 이 Provider 는 UHktTerrainSubsystem 의 baked-first + fallback 정책을 구현하여
 *   - 평소: BakedAsset 디컴프레스 결과를 그대로 전달
 *   - 누락 영역: Generator 폴백 (Subsystem 이 경고 로그 + 캐시)
 * 라는 단일 진입점을 제공한다.
 *
 * 절대 원칙 (CLAUDE.md):
 *   - HktCore 는 이 클래스(혹은 다른 IHktTerrainDataSource 구현체)만 본다.
 *   - HktCore 는 UWorld/UObject 를 모르지만, Provider 는 Subsystem(=UWorldSubsystem)을
 *     WeakObjectPtr 로 보관해 World 종료 시 자동 invalidate 된다.
 *   - GenerateChunk() 호출은 const — 시뮬레이션 측에서 이 인터페이스로 쓰기는 발생하지 않는다.
 *
 * 등록 흐름:
 *   1. AHktVoxelTerrainActor / Game bootstrap 이 UHktTerrainSubsystem 를 가져옴
 *   2. FHktTerrainProvider 인스턴스를 생성하여 Simulator 에 주입 (PR-C 에서 wiring)
 *   3. PR-B 에서는 클래스만 추가 — 실제 wiring 은 PR-C 가 맡음
 */
class HKTTERRAIN_API FHktTerrainProvider : public IHktTerrainDataSource
{
public:
	FHktTerrainProvider(UHktTerrainSubsystem* InSubsystem,
	                    const FHktTerrainGeneratorConfig& InConfig);
	virtual ~FHktTerrainProvider() override = default;

	// IHktTerrainDataSource ---------------------------------------------------
	virtual void GenerateChunk(int32 ChunkX, int32 ChunkY, int32 ChunkZ,
	                           FHktTerrainVoxel* OutVoxels) const override;
	virtual const FHktTerrainGeneratorConfig& GetConfig() const override { return Config; }
	// -------------------------------------------------------------------------

	/** Subsystem 이 살아있는지 확인. nullptr 시 시뮬레이션은 폴백 경로(빈 청크)로 동작. */
	bool IsValid() const { return Subsystem.IsValid(); }

	/** Provider 가 보고 있는 Subsystem (디버그/통계 조회용). */
	UHktTerrainSubsystem* GetSubsystem() const { return Subsystem.Get(); }

private:
	TWeakObjectPtr<UHktTerrainSubsystem> Subsystem;
	FHktTerrainGeneratorConfig Config;
};
