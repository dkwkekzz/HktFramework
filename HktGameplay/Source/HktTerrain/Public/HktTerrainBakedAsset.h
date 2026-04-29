// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"
#include "Engine/DataAsset.h"
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

	/** USTRUCT → 순수 C++ Config 변환 (런타임 생성기 인자) */
	FHktTerrainGeneratorConfig ToConfig() const;

	/** 순수 C++ Config → USTRUCT (베이크 시점 캡처) */
	void FromConfig(const FHktTerrainGeneratorConfig& InConfig);
};

/**
 * FHktTerrainBakedChunk — 단일 청크의 압축된 복셀 데이터.
 *
 * `FHktTerrainVoxel`(4바이트) × 32768 = 128KB raw 가 oodle 압축되어 CompressedData 에 저장된다.
 * 디컴프레스 후 UncompressedSize 와 비교하여 무결성 검증.
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
	/** 베이크 자산 포맷 버전. 호환되지 않는 변경 시 +1 후 자산 재베이크 강제. */
	static constexpr int32 CurrentBakeVersion = 1;

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

private:
	/** 좌표 → Chunks 배열 인덱스 (메모리 매핑). 비직렬화. */
	TMap<FIntVector, int32> CoordToIndex;
};
