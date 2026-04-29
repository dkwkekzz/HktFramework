// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"
#include "HktTerrainChunkLoader.generated.h"

/**
 * 청크 로딩 전략 추상화 — 모든 지형 렌더 경로(Voxel/Sprite/Landscape) 공용.
 *
 * 회전에 반응하지 않는 "뷰 독립 로더"를 전제로 하여 프러스텀-바이어스 → Retune
 * 피드백 루프를 구조적으로 제거한다. 새 방식이 필요할 때 IHktTerrainChunkLoader를
 * 구현하고 EHktTerrainLoaderType에 enum 값을 추가한 뒤 팩토리 switch만 갱신하면 된다.
 *
 * 본 인터페이스는 HktVoxelTerrain 의 IHktVoxelChunkLoader 를 일반화한 결과로,
 * Sprite/Landscape 렌더러에서도 동일 스트리밍 결과를 재사용할 수 있도록 HktTerrain 으로
 * 이관되었다.
 */

/** 청크 Tier — 로더가 정하는 품질 계층. 현재 2단계. */
enum class EHktTerrainChunkTier : uint8
{
	Near = 0,  // 풀 디테일 (LOD 0 메시, 풀 머티리얼, 그림자/콜리전 ON)
	Far  = 1,  // 간이 메시 (다운샘플 LOD, 스트립 머티리얼, 그림자/콜리전 OFF)
};

/** 단일 청크의 로드/리티어 요청. */
struct FHktChunkTierRequest
{
	FIntVector Coord = FIntVector::ZeroValue;
	EHktTerrainChunkTier Tier = EHktTerrainChunkTier::Near;
};

/**
 * 로더 파라미터 일괄 주입 구조체.
 * 의미는 구현별로 다르지만 호출자는 구체 타입을 모르고도 설정 가능.
 *  - Legacy   : PrimaryRadius = 단일 반경. SecondaryRadius 무시.
 *  - Proximity: PrimaryRadius = NearRadius, SecondaryRadius = FarRadius.
 */
struct FHktTerrainLoaderConfig
{
	float PrimaryRadius = 8000.f;
	float SecondaryRadius = 8000.f;
	int32 MaxLoadsPerFrame = 16;
	int32 MaxLoadedChunks = 2048;
	int32 HeightMinZ = 0;
	int32 HeightMaxZ = 3;
};

/**
 * IHktTerrainChunkLoader — 청크 로딩 전략 인터페이스.
 *
 * 원칙:
 *   1. 뷰 무관 — Update 인자에 회전/FOV 없음
 *   2. 카메라가 청크 경계를 넘을 때만 전체 재계산
 *   3. 결과는 Load/Unload/Retier 세 배열로 분리 배출
 */
class HKTTERRAIN_API IHktTerrainChunkLoader
{
public:
	virtual ~IHktTerrainChunkLoader() = default;

	/** 파라미터 주입 — UPROPERTY 변경이 즉시 반영되도록 매 Tick 호출. */
	virtual void Configure(const FHktTerrainLoaderConfig& Cfg) = 0;

	/** 스트리밍 업데이트. 호출 후 GetChunksToLoad/Unload/Retier로 결과 조회. */
	virtual void Update(const FVector& CameraPos, float ChunkWorldSize) = 0;

	virtual const TArray<FHktChunkTierRequest>& GetChunksToLoad() const = 0;
	virtual const TArray<FIntVector>& GetChunksToUnload() const = 0;
	virtual const TArray<FHktChunkTierRequest>& GetChunksToRetier() const = 0;

	/** 현재 로드된 청크 → Tier 매핑 (통계/디버그/VM 외부 로드 연동용) */
	virtual const TMap<FIntVector, EHktTerrainChunkTier>& GetLoadedChunks() const = 0;

	/** Tier별 로드된 청크 수. [0]=Near, [1]=Far */
	virtual void GetTierHistogram(int32 OutCounts[2]) const = 0;

	virtual void Clear() = 0;
};

/** 로더 종류 선택자 — UPROPERTY에 노출. BeginPlay 1회 생성이라 런타임 스왑은 지원하지 않는다. */
UENUM(BlueprintType)
enum class EHktTerrainLoaderType : uint8
{
	/** LOD 도입 전 동작 — 단일 반경 내 모든 청크를 풀 디테일로 로드. 안전한 폴백. */
	Legacy     UMETA(DisplayName = "Legacy (Single Radius)"),

	/** 근거리 풀 + 원거리 간이 2링. 회전 무관 / 피드백 루프 없음. */
	Proximity  UMETA(DisplayName = "Proximity (Near/Far Ring)"),
};

/** 로더 팩토리. */
HKTTERRAIN_API TUniquePtr<IHktTerrainChunkLoader> CreateTerrainChunkLoader(EHktTerrainLoaderType Type);
