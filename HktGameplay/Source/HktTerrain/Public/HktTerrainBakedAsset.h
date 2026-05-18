// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"
#include "Engine/DataAsset.h"
#include "GameplayTagContainer.h"
#include "Terrain/HktTerrainGeneratorConfig.h"
#include "Terrain/HktTerrainVoxel.h"
#include "HktTerrainBakedAsset.generated.h"

/**
 * FHktTerrainBakedConfig — UPROPERTY 호환 베이크 설정 미러.
 *
 * `FHktTerrainGeneratorConfig`(HktCore 잔류, plain C++ POD)는 USTRUCT 가 아니므로
 * UPROPERTY 직렬화에 사용할 수 없다. UHktTerrainBakedAsset 이 .uasset 으로 영속화하기
 * 위해 동일 필드를 UPROPERTY 로 미러링한 USTRUCT 를 도입한다.
 *
 *  - FHktFixed32 는 raw int32 로 저장 (Q16.16 보존, 결정론 유지)
 *  - 시드/Epoch/탐색 영역 정보는 직접 저장
 *  - ToConfig()/FromConfig() 가 양방향 변환 담당
 */
USTRUCT(BlueprintType)
struct HKTTERRAIN_API FHktTerrainBakedConfig
{
	GENERATED_BODY()

	// ─── 시드 / 모드 ───

	UPROPERTY(EditAnywhere, Category = "Seed")
	int64 Seed = 42;

	UPROPERTY(EditAnywhere, Category = "Seed")
	int32 Epoch = 0;  // FHktTerrainGeneratorConfig::Epoch 는 uint32 — UPROPERTY 호환 위해 int32

	UPROPERTY(EditAnywhere, Category = "Mode")
	bool bAdvancedTerrain = false;

	UPROPERTY(EditAnywhere, Category = "Mode")
	bool bAdvEnableSubsurfaceOre = true;

	UPROPERTY(EditAnywhere, Category = "Mode")
	bool bAdvEnableSurfaceScatter = true;

	// ─── 지형 형태 (FHktFixed32 raw) ───

	UPROPERTY(EditAnywhere, Category = "Shape")
	int32 HeightScaleRaw = 64 * 65536;       // 64.0

	UPROPERTY(EditAnywhere, Category = "Shape")
	int32 HeightOffsetRaw = 32 * 65536;      // 32.0

	UPROPERTY(EditAnywhere, Category = "Shape")
	int32 TerrainFreqRaw = 524;              // 0.008 * 65536 ≈ 524

	UPROPERTY(EditAnywhere, Category = "Shape")
	int32 TerrainOctaves = 6;

	UPROPERTY(EditAnywhere, Category = "Shape")
	int32 LacunarityRaw = 2 * 65536;         // 2.0

	UPROPERTY(EditAnywhere, Category = "Shape")
	int32 PersistenceRaw = 32768;             // 0.5

	// ─── 산악 ───

	UPROPERTY(EditAnywhere, Category = "Mountain")
	int32 MountainFreqRaw = 262;             // 0.004 * 65536 ≈ 262

	UPROPERTY(EditAnywhere, Category = "Mountain")
	int32 MountainBlendRaw = 26214;          // 0.4 * 65536

	// ─── 수면 ───

	UPROPERTY(EditAnywhere, Category = "Water")
	int32 WaterLevelRaw = 30 * 65536;        // 30.0

	// ─── 동굴 ───

	UPROPERTY(EditAnywhere, Category = "Cave")
	bool bEnableCaves = true;

	UPROPERTY(EditAnywhere, Category = "Cave")
	int32 CaveFreqRaw = 1966;                 // 0.03 * 65536

	UPROPERTY(EditAnywhere, Category = "Cave")
	int32 CaveThresholdRaw = 39322;           // 0.6 * 65536

	// ─── 바이옴 ───

	UPROPERTY(EditAnywhere, Category = "Biome")
	int32 BiomeNoiseScaleRaw = 131;           // 0.002 * 65536

	UPROPERTY(EditAnywhere, Category = "Biome")
	int32 MountainBiomeThresholdRaw = 80 * 65536;

	// ─── 월드 단위 ───

	UPROPERTY(EditAnywhere, Category = "World")
	float VoxelSizeCm = 15.0f;

	UPROPERTY(EditAnywhere, Category = "World")
	int32 HeightMinZ = 0;

	UPROPERTY(EditAnywhere, Category = "World")
	int32 HeightMaxZ = 3;

	// ─── 시뮬 스트리밍 ───

	UPROPERTY(EditAnywhere, Category = "Streaming")
	int32 SimLoadRadiusXY = 2;

	UPROPERTY(EditAnywhere, Category = "Streaming")
	int32 SimLoadRadiusZ = 1;

	UPROPERTY(EditAnywhere, Category = "Streaming")
	int32 SimMaxChunksLoaded = 256;

	UPROPERTY(EditAnywhere, Category = "Streaming")
	int32 SimMaxChunkLoadsPerFrame = 4;

	// ─── Placement Story 결합 (I-0014) ───

	/**
	 * 본 baked 자산의 청크가 로드될 때 sim 이 emit 할 storyTag.
	 * 컨벤션: `Story.Placement.<WorldId>` (예: `Story.Placement.TranquilWilds`).
	 * 빈 태그면 폴백 `Event.Terrain.ChunkLoaded` 사용 — 기존 동작 보존.
	 * 클라 시뮬레이터는 emit 하지 않는다 (서버 권위 게이트, FHktTerrainSystem::Process 가드).
	 */
	UPROPERTY(EditAnywhere, Category = "Placement", meta = (Categories = "Story.Placement"))
	FGameplayTag PlacementStoryTag;

	/** USTRUCT → 순수 C++ Config 변환 (런타임 생성기 인자) */
	FHktTerrainGeneratorConfig ToConfig() const;

	/** 순수 C++ Config → USTRUCT (베이크 시점 캡처) */
	void FromConfig(const FHktTerrainGeneratorConfig& InConfig);
};

/**
 * FHktTerrainSpawnerSpec — 청크 단위로 베이크된 spawner 인스턴스 명세.
 *
 * 각 spawner 는 (위치, Story 인스턴스) 쌍으로 표현된다. 스폰 패턴(웨이브/매복/패트롤 등)은
 * 전부 `StoryTag` 가 가리키는 Schema 2 Story 바이트코드로 표현되며, 본 구조체는 위치/인덱싱/
 * archetype 별 정수 인자만 보유한다.
 *
 * 결정론 규칙:
 *   - 위치는 `FHktFixed32` raw (Q16.16) 로 저장. UE float 누설 금지.
 *   - 진입 인자는 4-슬롯 `int32 Params[4]` 평탄화 — `FHktEvent::Param0~3` 으로 그대로 흘려
 *     보낼 수 있는 형식. archetype 별 슬롯 의미는 `SpawnerParams::` 네임스페이스
 *     (HktStoryEventParams.h) 에서 별칭 정의.
 *   - `SlotHash` 는 `hash(ChunkCoord, SlotIndex)` 결과 — RNG seed 로 사용 시 재로드 시
 *     동일한 출현이 보장된다.
 *
 * V2 컴플라이언스: 별도 진입 메커니즘/EntryArgs 구조체를 도입하지 않는다 — chunk 로드 시점에
 * 본 스펙을 `HktEventBuilder::Spawner(...)` 로 변환해 기존 PendingGroupIntents 큐에 흘려보낸다.
 */
USTRUCT()
struct HKTTERRAIN_API FHktTerrainSpawnerSpec
{
	GENERATED_BODY()

	// ─── 결정론 위치 (FHktFixed32 raw, Q16.16) ───

	UPROPERTY()
	int32 PosXRaw = 0;

	UPROPERTY()
	int32 PosYRaw = 0;

	UPROPERTY()
	int32 PosZRaw = 0;

	// ─── 행동 ───

	/** 실행할 Story (반드시 schema 2). 미존재 시 베이크 실패. */
	UPROPERTY()
	FGameplayTag StoryTag;

	/**
	 * Story 진입 인자 — archetype 별 의미가 다른 4-슬롯 정수.
	 * FHktEvent::Param0/1/2/3 에 그대로 매핑된다 (TMap/heap 0).
	 * 의미 별칭은 SpawnerParams::* (HktStoryEventParams.h) 에 archetype 별로 정의.
	 */
	UPROPERTY()
	int32 Param0 = 0;

	UPROPERTY()
	int32 Param1 = 0;

	UPROPERTY()
	int32 Param2 = 0;

	UPROPERTY()
	int32 Param3 = 0;

	// ─── 인덱싱 / 검증 ───

	UPROPERTY()
	FIntVector ChunkCoord = FIntVector::ZeroValue;

	/** 결정론 ID: hash(ChunkCoord, SlotIndex). RNG seed/충돌 검증에 사용. */
	UPROPERTY()
	uint32 SlotHash = 0;

	/** 베이크 시점 biome (런타임 검증). */
	UPROPERTY()
	int32 BiomeId = 0;
};

/**
 * FHktTerrainBakedChunk — 단일 청크의 압축된 복셀 데이터.
 *
 * `FHktTerrainVoxel`(4바이트) × 32768 = 128KB raw 가 oodle 압축되어 CompressedData 에 저장된다.
 * 디컴프레스 후 UncompressedSize 와 비교하여 무결성 검증.
 *
 * v3 (TerrainSpawner.design.md §4-a 런타임 정책 패스):
 *   - 본 청크가 표면 (top-most non-air voxel 보유) 인 경우 BiomeId / SurfaceVoxelZ /
 *     SlotHash 를 캡처한다. sim 의 `TryGetChunkContext` 가 본 필드를 읽어 placement
 *     정책 Story 에 전달.
 *   - 비표면 청크는 bIsSurfaceChunk=false 로 두고 나머지 필드 무의미.
 */
USTRUCT()
struct HKTTERRAIN_API FHktTerrainBakedChunk
{
	GENERATED_BODY()

	UPROPERTY()
	FIntVector Coord = FIntVector::ZeroValue;

	/** Oodle 으로 압축된 FHktTerrainVoxel 시퀀스. */
	UPROPERTY()
	TArray<uint8> CompressedData;

	/** 압축 전 바이트 수 — 디컴프레스 시 검증 / 호출자 버퍼 할당에 사용. */
	UPROPERTY()
	int32 UncompressedSize = 0;

	// ─── v3 surface metadata (placement 정책 진입 인자) ───

	/** 본 청크가 표면 (지상 ↔ 지하 경계) 을 포함하면 true. ChunkLoaded 이벤트 발화 게이트. */
	UPROPERTY()
	bool bIsSurfaceChunk = false;

	/** 표면 칼럼의 biome (레거시: 200+EHktBiomeType, 고급: EHktAdvBiome). */
	UPROPERTY()
	uint8 BiomeId = 0;

	/** 표면 voxel Z (월드 voxel 좌표). bIsSurfaceChunk=false 시 무의미. */
	UPROPERTY()
	int32 SurfaceVoxelZ = 0;

	/** hash(ChunkCoord) — placement 정책의 결정론 RNG seed / lineageId 시드. */
	UPROPERTY()
	uint32 SlotHash = 0;
};

/**
 * UHktTerrainBakedAsset — 청크 단위 사전 생성 지형 데이터.
 *
 * Editor 에서 `UHktTerrainBakeLibrary::BakeRegion` 호출 시 산출되며, 런타임에는
 * `UHktTerrainSubsystem` 이 비동기 로드 후 청크별 인덱스로 매핑한다.
 *
 * 베이크 산출물에 누락 청크는 폴백 경로로 생성기에서 직접 생성된다 — 결과는
 * 동일해야 하므로 GeneratorConfig 를 함께 저장하여 폴백 시 동일 시드/파라미터 사용.
 */
UCLASS(BlueprintType)
class HKTTERRAIN_API UHktTerrainBakedAsset : public UDataAsset
{
	GENERATED_BODY()

public:
	/**
	 * 베이크 자산 포맷 버전. 호환되지 않는 변경 시 +1 후 자산 재베이크 강제.
	 *
	 *  - v1: 청크 복셀 + GeneratorConfig.
	 *  - v2: Spawners[] 추가 — Story 인스턴스 메타 (TerrainSpawner.design.md §3-b).
	 *  - v3: 청크별 surface 메타 (BiomeId/SurfaceVoxelZ/SlotHash/bIsSurfaceChunk) — 런타임
	 *        placement 정책 패스 입력 (TerrainSpawner.design.md §4-a 갱신).
	 *  - v4: `FHktTerrainBakedConfig::PlacementStoryTag` — World 별 Placement Story 분기 (I-0014).
	 *        v3 자산 로드 시 빈 태그 → 폴백 `Event.Terrain.ChunkLoaded` 사용 (기존 동작 호환).
	 */
	static constexpr int32 CurrentBakeVersion = 4;

	/** 베이크 시 캡처된 생성기 설정. 폴백 호출 시 동일 설정 재사용 → 결정론 유지. */
	UPROPERTY(EditAnywhere, Category = "Bake")
	FHktTerrainBakedConfig GeneratorConfig;

	/** 베이크된 청크 좌표 영역 [Min, Max]. 폴백 영역 추적/통계용. */
	UPROPERTY(EditAnywhere, Category = "Bake")
	FIntVector RegionMin = FIntVector::ZeroValue;

	UPROPERTY(EditAnywhere, Category = "Bake")
	FIntVector RegionMax = FIntVector::ZeroValue;

	UPROPERTY(VisibleAnywhere, Category = "Bake")
	int32 BakeVersion = CurrentBakeVersion;

	/** 모든 베이크 청크. 좌표 인덱스는 PostLoad 에서 빌드. */
	UPROPERTY()
	TArray<FHktTerrainBakedChunk> Chunks;

	/**
	 * 모든 베이크 spawner. 청크 좌표 인덱스는 PostLoad/RebuildIndex 에서 빌드.
	 * v1 자산에서 로드 시 빈 배열로 시작 → 재베이크 시 채워진다.
	 */
	UPROPERTY()
	TArray<FHktTerrainSpawnerSpec> Spawners;

	// UObject ----------------------------------------------------------------
	virtual void PostLoad() override;
	// ------------------------------------------------------------------------

	/** Coord → Chunks index 맵. 비직렬화(Transient) — PostLoad/Editor save 시 재구축. */
	void RebuildIndex();

	/** 좌표로 청크를 조회. 미존재 시 nullptr. */
	const FHktTerrainBakedChunk* FindChunk(const FIntVector& Coord) const;

	/**
	 * 청크 데이터를 디컴프레스해 OutVoxels(32768개) 에 채운다.
	 * @return 성공 여부. 자산 미스 / 디컴프레스 실패 / 크기 불일치 시 false.
	 */
	bool TryDecompressChunk(const FIntVector& Coord, FHktTerrainVoxel* OutVoxels) const;

	/** 좌표가 베이크 영역 내인지 (영역 메타만 체크 — 실제 데이터 존재는 FindChunk). */
	bool IsCoordInBakedRegion(const FIntVector& Coord) const;

	/**
	 * 청크 좌표의 모든 spawner 스펙을 OutSpawners 에 append 한다.
	 * 청크 미존재(spawner 없음) 시 OutSpawners 는 그대로 유지된다.
	 */
	void GetSpawnersForChunk(const FIntVector& Coord,
	                         TArray<const FHktTerrainSpawnerSpec*>& OutSpawners) const;

	/**
	 * 표면 청크 메타 조회 (v3+). 청크가 베이크 자산에 없거나 비표면이면 false.
	 * 성공 시 OutBiomeId / OutSurfaceVoxelZ / OutSlotHash 채워진다.
	 */
	bool TryGetSurfaceContext(const FIntVector& Coord,
	                          int32& OutBiomeId, int32& OutSurfaceVoxelZ, uint32& OutSlotHash) const;

private:
	/** 좌표 → Chunks 배열 인덱스 (메모리 매핑). 비직렬화. */
	TMap<FIntVector, int32> CoordToIndex;

	/**
	 * 청크 좌표 → Spawners 배열 인덱스 (다중매핑). 비직렬화.
	 * 한 청크가 N 개의 spawner 슬롯을 가질 수 있으므로 TMultiMap.
	 */
	TMultiMap<FIntVector, int32> ChunkCoordToSpawnerIndex;
};
