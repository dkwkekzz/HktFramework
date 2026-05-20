// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"
#include "Engine/DataAsset.h"
#include "GameplayTagContainer.h"
#include "Terrain/HktTerrainGeneratorConfig.h"
#include "Terrain/HktTerrainVoxel.h"
#include "HktTerrainVoxelTypes.h"
#include "HktTerrainBakedAsset.generated.h"

/**
 * FHktVoxelSpawnRule — 단일 voxel type 의 후보 spawner 1개.
 *
 * `FHktTerrainBakedConfig::VoxelSpawnRules` 가 본 구조체의 flat array 로 보유.
 * BakeRegion 이 voxel type 별로 그룹핑하여 weighted-pick 룩업 테이블을 빌드한다.
 * 동일 `VoxelType` 키에 *복수* 엔트리 등록 허용 — 그것이 다양성의 본질.
 *
 *   - `VoxelType == Air` 또는 `Weight <= 0` 인 엔트리는 무시.
 *   - `StoryTag` 가 invalid (`None`) 이면 "skip 슬롯" — 해당 weight 만큼 *아무것도
 *     spawn 하지 않을* 확률을 표현. attribution 미부여 → catalog 미등록.
 *
 * 결정론: BakeRegion 의 weighted-pick 은 voxel 좌표 한 곳 (`ComputeVoxelSlotHash31`)
 * 에서만 시드를 끌어 동일 voxel 재방문 시 동일 결과 (I-0017).
 */
USTRUCT(BlueprintType)
struct HKTTERRAIN_API FHktVoxelSpawnRule
{
	GENERATED_BODY()

	/** 대상 voxel 타입. Air = 무시. 동일 타입을 가진 여러 엔트리를 등록할 수 있다. */
	UPROPERTY(EditAnywhere, Category = "Placement")
	EHktTerrainType VoxelType = EHktTerrainType::Air;

	/**
	 * 발화할 spawner story tag (예: `Story.Flow.Spawner.Natural.Tree`).
	 * `None` (invalid) 이면 skip 슬롯 — weight 만큼 *spawn 없음* 확률을 차지.
	 */
	UPROPERTY(EditAnywhere, Category = "Placement", meta = (Categories = "Story.Flow.Spawner"))
	FGameplayTag StoryTag;

	/** 결정론적 weighted-pick 가중치. 0 = 항목 무시. */
	UPROPERTY(EditAnywhere, Category = "Placement", meta = (ClampMin = "0"))
	int32 Weight = 1;
};

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

	// ─── Voxel Spawn Template 매핑 (I-0014 Phase B + 다양성 확장 v6) ───

	/**
	 * Voxel Type 별 Spawn 후보 목록 — *동일 voxel type 에서도 다양한 entity 가 출현*.
	 *
	 * 디자이너가 voxel type 별로 *복수* 의 후보 spawner story 를 weight 와 함께 선언.
	 * BakeRegion 이 매 surface column top voxel 마다 voxel 좌표 시드
	 * (`ComputeVoxelSlotHash31`) 로 결정론적 weighted-pick 을 수행하여 attribution 1점
	 * 을 결정. 런타임은 그 결과를 read-only 로 dispatch.
	 *
	 * 엔트리 의미:
	 *   - `VoxelType`   : 후보 적용 대상 voxel 타입 (EHktTerrainType — Grass / Sand / Snow ...).
	 *                     동일 타입에 *복수* 엔트리 등록 허용 — 그것이 다양성의 본질.
	 *   - `StoryTag`    : 발화할 spawner story tag. invalid (`None`) → "skip 슬롯" —
	 *                     해당 weight 만큼 *아무것도 spawn 하지 않을* 확률을 표현.
	 *   - `Weight`      : 결정론적 weighted-pick 가중치 (>=0, 0 이면 항목 무시).
	 *
	 * 예 — Grass 표면에 60% Oak / 20% Slime / 20% 빈 슬롯:
	 *   { VoxelType=Grass, Tag=Story.Flow.Spawner.Natural.Tree,  Weight=60 }
	 *   { VoxelType=Grass, Tag=Story.Flow.Spawner.Natural.Slime, Weight=20 }
	 *   { VoxelType=Grass, Tag=None,                              Weight=20 }
	 *
	 * 시드 정책 (I-0017): pick = `ComputeVoxelSlotHash31(worldX, worldY, worldZ) %
	 *                     totalWeight`. voxel 좌표 한 곳에서만 파생 → 동일 voxel 재방문
	 *                     시 동일 출현. SlotHash31 은 런타임 dispatch 의 Param2 와도
	 *                     동일 함수 (HktEventBuilder::ComputeVoxelSlotHash31) 를 사용.
	 *
	 * 빈 배열이면 BakeRegion 이 attribution 을 0 으로 산출 → 런타임 spawn 없음.
	 */
	UPROPERTY(EditAnywhere, Category = "Placement", meta = (Categories = "Story.Flow.Spawner"))
	TArray<FHktVoxelSpawnRule> VoxelSpawnRules;

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
 * v5 (I-0014 — voxel spawn attribution):
 *   - 본 청크가 표면 (top-most non-air voxel 보유) 이면 `bIsSurfaceChunk=true`. BakeRegion 의
 *     attribution 산출 패스가 본 플래그로 게이트.
 *   - `SpawnTemplateAttribution` 가 *surface voxel 한 점* 단위로 template id 참조를 보유. 키는
 *     5+5+5 bit 로 패킹된 local coord (0..31 per axis) — `PackLocalCoord` 헬퍼 사용. 값은
 *     `UHktTerrainBakedAsset::SpawnTemplateCatalog` 의 templateId.
 *     키/값 모두 int32 (UPROPERTY TMap 의 reflection 호환 — uint16 미지원).
 *   - 자연 발생 (대다수) 이 본 슬롯으로 단일화. 명시 배치 (보스/랜드마크) 는 별도 `Spawners[]` 유지.
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

	/** 본 청크가 표면 (지상 ↔ 지하 경계) 을 포함하면 true. attribution 산출 게이트. */
	UPROPERTY()
	bool bIsSurfaceChunk = false;

	// ─── v5 voxel attribution (I-0014) ───

	/**
	 * Sparse per-voxel template attribution. Key = `PackLocalCoord(x,y,z)` (5+5+5 bit, ≤32767),
	 * Value = `UHktTerrainBakedAsset::SpawnTemplateCatalog` 의 templateId (>=1).
	 * 비어 있으면 본 청크에 자연 발생 attribution 없음 — sim 은 spawn skip.
	 *
	 * 키/값 모두 int32 인 이유: UPROPERTY TMap reflection 은 unsigned 정수 중 uint8 만
	 * 표준 지원하므로 호환성 위해 int32 사용. 값 범위는 둘 다 0..65535 내에서 사용.
	 */
	UPROPERTY()
	TMap<int32, int32> SpawnTemplateAttribution;

	/** local voxel coord (0..31 per axis) → 5+5+5 bit packed int32 (양수 보장). */
	static constexpr int32 PackLocalCoord(int32 LocalX, int32 LocalY, int32 LocalZ)
	{
		return static_cast<int32>(
			(static_cast<uint32>(LocalX) & 0x1Fu) |
			((static_cast<uint32>(LocalY) & 0x1Fu) << 5) |
			((static_cast<uint32>(LocalZ) & 0x1Fu) << 10));
	}

	static constexpr void UnpackLocalCoord(int32 Packed, int32& OutX, int32& OutY, int32& OutZ)
	{
		const uint32 P = static_cast<uint32>(Packed);
		OutX = static_cast<int32>(P & 0x1Fu);
		OutY = static_cast<int32>((P >> 5) & 0x1Fu);
		OutZ = static_cast<int32>((P >> 10) & 0x1Fu);
	}
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
	 *  - v3: 청크별 surface 메타 — 런타임 placement 정책 패스 입력 (제거됨).
	 *  - v4: `PlacementStoryTag` — World 별 Placement Story 분기 (제거됨).
	 *  - v5: per-voxel `SpawnTemplateAttribution` 슬롯 + World 별 `SpawnTemplateCatalog` (I-0014).
	 *        Bake 시점에 `VoxelTypeSpawnTemplate` 매핑으로 attribution 자동 산출, 런타임 read-only.
	 *        v3/v4 의 surface 메타 (BiomeId / SurfaceVoxelZ / SlotHash) 및 PlacementStoryTag 는
	 *        본 버전에서 일괄 제거 — v4 이하 자산은 재베이크 필요.
	 *  - v6: `VoxelTypeSpawnTemplate` (TMap<int32, FGameplayTag>) 폐기 → `VoxelSpawnRules`
	 *        (TArray<FHktVoxelSpawnRule>) 로 교체. 동일 voxel type 에 *복수* 후보 + weight
	 *        를 허용 — BakeRegion 이 voxel 좌표 시드 (`ComputeVoxelSlotHash31`) 로 결정론적
	 *        weighted-pick 수행, attribution 1점 결정. v5 이하 자산은 재베이크 필요.
	 *  - v7: `FHktVoxelSpawnRule::VoxelTypeID` (int32) → `VoxelType` (EHktTerrainType
	 *        UENUM) 으로 교체. 디자이너가 정수 ID 대신 의미 있는 enum 이름으로 편집.
	 *        EHktTerrainType 은 HktTerrain/Public/HktTerrainVoxelTypes.h 단일 출처
	 *        (이전 HktVoxelTerrain 소속이었으나 의존 방향상 HktTerrain 으로 이동).
	 *        직렬화 호환성 없음 — v6 이하 자산은 재베이크 필요.
	 */
	static constexpr int32 CurrentBakeVersion = 7;

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

	/**
	 * Spawn template 카탈로그 (v5, I-0014).
	 *
	 * `FHktTerrainBakedChunk::SpawnTemplateAttribution` 의 templateId 를 실제 Story tag
	 * (예: `Story.Flow.Spawner.Natural.Oak`) 로 풀어내는 단방향 맵. 키는 int32
	 * (UPROPERTY TMap reflection 호환), 의미는 1..65535 의 templateId.
	 *
	 * World 별로 *닫혀 있어야* (I-0015 적용) 미참조 voxel / 죽은 id 가 빌드 시점에 검출
	 * 가능. BakeRegion 후처리에서 orphan catalog 엔트리 WARN.
	 *
	 * 비어 있으면 자연 발생 attribution 미사용 → 런타임 spawn 없음.
	 */
	UPROPERTY()
	TMap<int32, FGameplayTag> SpawnTemplateCatalog;

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
	 * 청크의 voxel attribution 슬롯 (v5). 슬롯이 비어 있거나 청크 미존재 시 false.
	 *
	 * 성공 시 `OutAttribution` 은 청크의 `SpawnTemplateAttribution` 참조를 반환 — 호출자는
	 * `PackLocalCoord` / `UnpackLocalCoord` 로 키/값을 해석. 카탈로그 lookup 은 별도.
	 *
	 * 본 메서드의 반환 형식이 TMap 참조인 이유: HktTerrain 내부 (Provider) 만 호출하므로
	 * 외부 누설 없음. HktCore 측 `FHktVoxelAttributionView` 변환은 Provider 가 담당.
	 */
	const TMap<int32, int32>* FindVoxelAttribution(const FIntVector& Coord) const;

private:
	/** 좌표 → Chunks 배열 인덱스 (메모리 매핑). 비직렬화. */
	TMap<FIntVector, int32> CoordToIndex;

	/**
	 * 청크 좌표 → Spawners 배열 인덱스 (다중매핑). 비직렬화.
	 * 한 청크가 N 개의 spawner 슬롯을 가질 수 있으므로 TMultiMap.
	 */
	TMultiMap<FIntVector, int32> ChunkCoordToSpawnerIndex;
};
