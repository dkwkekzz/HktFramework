// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"
#include "GameplayTagContainer.h"
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
/**
 * FHktTerrainSpawnerView — HktCore 측 POD 뷰.
 *
 * HktTerrain 의 `FHktTerrainSpawnerSpec`(USTRUCT) 을 HktCore 가 직접 참조하면
 * `HktCore → HktTerrain` 역의존이 발생하므로, 본 plain POD 로 데이터만 복사해서 전달한다.
 *
 *  - 위치는 `FHktFixed32` raw (Q16.16).
 *  - archetype 별 인자는 4-슬롯 정수 `Param0~3` — `FHktEvent::Param0~3` 으로 1:1 매핑.
 *  - TMap/heap 0 — 청크 로드 시점의 일제 dispatch 에서도 캐시 친화적.
 */
struct HKTCORE_API FHktTerrainSpawnerView
{
	// ─── 결정론 위치 (FHktFixed32 raw, Q16.16) ───
	int32 PosXRaw = 0;
	int32 PosYRaw = 0;
	int32 PosZRaw = 0;

	// ─── 행동 ───
	FGameplayTag StoryTag;
	int32 Param0 = 0;
	int32 Param1 = 0;
	int32 Param2 = 0;
	int32 Param3 = 0;

	// ─── 인덱싱 / 검증 ───
	int32 ChunkX = 0;
	int32 ChunkY = 0;
	int32 ChunkZ = 0;
	uint32 SlotHash = 0;
	int32 BiomeId = 0;
};

/**
 * FHktTerrainChunkContext — 청크 표면 메타데이터 (placement 정책 입력).
 *
 * `BakedAsset` 에서 캡처된 surface biome / surface voxel Z / SlotHash 를 sim 으로
 * 전달하는 plain POD. 표면을 포함하지 않는 청크 (지하·천공) 은 `bIsSurfaceChunk=false`.
 *
 * `FHktTerrainSystem::Process` 가 신규 surface 청크 로드 시 본 컨텍스트를 읽어
 * `HktEventBuilder::ChunkLoaded(...)` 로 변환 — placement 정책 Story 의 진입 인자.
 */
struct HKTCORE_API FHktTerrainChunkContext
{
	int32 BiomeId         = 0;
	int32 SurfaceVoxelZ   = 0;
	uint32 SlotHash       = 0;
	bool bIsSurfaceChunk  = false;
};

class HKTCORE_API IHktTerrainDataSource
{
public:
	virtual ~IHktTerrainDataSource() = default;

	/** 청크 좌표에 대한 32×32×32 = 32768개 복셀 데이터 채우기 (호출자가 OutVoxels 할당) */
	virtual void GenerateChunk(int32 ChunkX, int32 ChunkY, int32 ChunkZ, FHktTerrainVoxel* OutVoxels) const = 0;

	/** 시뮬레이션이 청크 스트리밍, 좌표 변환, VoxelSize 계산에 사용하는 Config */
	virtual const FHktTerrainGeneratorConfig& GetConfig() const = 0;

	/**
	 * 청크의 spawner 메타 데이터 — HktCore 는 본 인터페이스로만 spawner 정보를 소비한다.
	 * 구현체는 OutSpawners 에 append(append-only 시맨틱) 한다. 호출자는 미리 비울 책임.
	 *
	 * 기본 구현은 빈 결과(spawner 없음) — spawner 미지원 데이터 소스(예: 순수 Generator 폴백)
	 * 가 무조건 override 하지 않아도 컴파일/런타임 모두 안전하도록 한다.
	 */
	virtual void GetChunkSpawners(int32 ChunkX, int32 ChunkY, int32 ChunkZ,
	                              TArray<FHktTerrainSpawnerView>& OutSpawners) const
	{
		// no-op — 기본은 spawner 없음
	}

	/**
	 * 청크 표면 컨텍스트 조회 — placement 정책 패스 (TerrainSpawner.design.md §4-a) 입력.
	 *
	 * @return  표면 청크 메타가 있으면 true + OutCtx 채움. 비표면/미베이크/Generator
	 *          폴백 등은 false → sim 이 `ChunkLoaded` 이벤트 발화 skip.
	 *
	 * 기본 구현은 false — placement 미지원 데이터 소스도 컴파일 안전.
	 */
	virtual bool TryGetChunkContext(int32 ChunkX, int32 ChunkY, int32 ChunkZ,
	                                FHktTerrainChunkContext& OutCtx) const
	{
		return false;
	}
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
