// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"
#include "Terrain/HktTerrainGeneratorConfig.h"
#include "Terrain/HktTerrainVoxel.h"
#include "Templates/UniquePtr.h"
#include "Templates/Function.h"

/**
 * IHktTerrainDataSource
 *
 * HktCore 의 시뮬레이션 측이 지형 데이터(청크 복셀, 설정 파라미터)를 소비할 때 사용하는
 * 읽기 전용 인터페이스. 구현체는 HktTerrain 모듈의 `FHktTerrainGenerator`(런타임 생성)
 * 또는 향후 PR-B 에서 추가될 `FHktTerrainProvider`(베이크 자산 우선 + 폴백) 다.
 *
 * 절대 원칙 (CLAUDE.md):
 *   - HktCore 는 지형 데이터 생성에 관여하지 않는다 — 인터페이스 통한 소비만 허용.
 *   - HktCore → HktTerrain 의존 금지. 따라서 인스턴스 생성은 팩토리 등록 패턴으로 우회.
 */
class HKTCORE_API IHktTerrainDataSource
{
public:
	virtual ~IHktTerrainDataSource() = default;

	/** 청크 좌표에 대한 32×32×32 = 32768개 복셀 데이터 채우기 (호출자가 OutVoxels 할당) */
	virtual void GenerateChunk(int32 ChunkX, int32 ChunkY, int32 ChunkZ, FHktTerrainVoxel* OutVoxels) const = 0;

	/** 시뮬레이션이 청크 스트리밍, 좌표 변환, VoxelSize 계산에 사용하는 Config */
	virtual const FHktTerrainGeneratorConfig& GetConfig() const = 0;
};

namespace HktTerrain
{
	/**
	 * 데이터 소스 팩토리.
	 *
	 * HktCore 는 IHktTerrainDataSource 의 구체 구현(FHktTerrainGenerator 등)을 알 수 없다.
	 * HktTerrain 모듈이 StartupModule 시점에 이 팩토리를 등록하고,
	 * HktCore 내부 `FHktWorldDeterminismSimulator::SetTerrainConfig` 가 호출하여
	 * Config 로 데이터 소스 인스턴스를 만든다.
	 *
	 * HktTerrain 모듈이 미로드(서버 only / shipping 등) 상태라면 nullptr 반환 →
	 * 호출자는 폴백 로그를 남기고 지형 파이프라인을 비활성화한다.
	 */
	using FDataSourceFactory = TFunction<TUniquePtr<IHktTerrainDataSource>(const FHktTerrainGeneratorConfig&)>;

	/** HktTerrain 모듈 전용 — StartupModule 에서 한 번 등록. */
	HKTCORE_API void RegisterDataSourceFactory(FDataSourceFactory Factory);

	/** HktTerrain 모듈 전용 — ShutdownModule 에서 호출하여 dangling 방지. */
	HKTCORE_API void UnregisterDataSourceFactory();

	/** 등록된 팩토리로 인스턴스 생성. 미등록 시 nullptr. */
	HKTCORE_API TUniquePtr<IHktTerrainDataSource> CreateDataSource(const FHktTerrainGeneratorConfig& Config);
}
