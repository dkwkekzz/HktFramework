// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
#include "HktBiomeLandscapeLayer.h"
#include "HktTerrainBakedAsset.h"
#include "HktLandscapeTerrainActor.generated.h"

class ALandscape;
class UMaterialInterface;
class UHktTerrainSubsystem;

/**
 * AHktLandscapeTerrainActor
 *
 * AHktVoxelTerrainActor 의 Landscape 판 병렬 형제.
 *
 * 동작 (PR-E 이후):
 *   1. BeginPlay에서 UHktTerrainSubsystem 을 획득하고 UHktRuntimeGlobalSetting 기반
 *      fallback Config 를 주입 (GameMode 가 PIE/Game 에서 먼저 주입했어도 idempotent).
 *   2. BakedAsset 이 지정되어 있으면 Subsystem 에 비동기 로드 요청 — Voxel/Sprite Actor 와
 *      동일한 단일 출처를 공유.
 *   3. UHktTerrainSubsystem::SamplePreview 로 2D 하이트 + 바이옴 샘플링
 *      (bAdvancedTerrain true/false 모두 단일 API. 결정론: baked Config 와 fallback Config
 *      의 효과적 Config 가 동일하면 결과가 비트 단위 일치한다.)
 *   4. 샘플을 uint16 하이트맵과 바이옴 가중치 맵으로 변환
 *   5. ALandscape 를 월드에 스폰하고 ALandscape::Import(...) 런타임 호출로 지형 구성
 *
 * 동일한 TerrainSeed 를 사용하면 AHktVoxelTerrainActor 의 지형과 외형이 일치한다.
 */
UCLASS(ClassGroup = (HktLandscape))
class HKTLANDSCAPETERRAIN_API AHktLandscapeTerrainActor : public AActor
{
	GENERATED_BODY()

public:
	AHktLandscapeTerrainActor();

	// === Landscape 그리드 구성 ===

	/**
	 * 섹션당 쿼드 수. UE5 Landscape가 허용하는 값 집합에 속해야 한다: {7, 15, 31, 63, 127, 255}.
	 * 비정규 값은 BeginPlay에서 경고 후 63으로 클램프된다.
	 */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "HktLandscape|Grid")
	int32 QuadsPerSection = 63;

	/** 컴포넌트당 섹션 수. 유효 값: 1 또는 4. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "HktLandscape|Grid", meta = (ClampMin = 1, ClampMax = 4))
	int32 SectionsPerComponent = 1;

	/** X축 Landscape 컴포넌트 수 */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "HktLandscape|Grid", meta = (ClampMin = 1, ClampMax = 32))
	int32 ComponentCountX = 8;

	/** Y축 Landscape 컴포넌트 수 */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "HktLandscape|Grid", meta = (ClampMin = 1, ClampMax = 32))
	int32 ComponentCountY = 8;

	// === 월드 매핑 ===

	/** SamplePreviewRegion 시작 복셀 좌표 (하이트맵 좌하단 코너) */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "HktLandscape|World")
	FIntPoint LandscapeOriginWorldVoxels = FIntPoint(0, 0);

	/**
	 * Landscape 액터의 스케일. cm per landscape unit.
	 * XY를 VoxelSizeCm 과 일치시키면 1 landscape quad = 1 voxel 로 XY 정렬된다.
	 * 기본 100 은 UE 표준 1m/quad.
	 */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "HktLandscape|World")
	FVector LandscapeScale = FVector(100.0, 100.0, 100.0);

	// === 머티리얼 / 레이어 ===

	/** ALandscape::LandscapeMaterial 에 할당될 머티리얼. nullptr 이면 엔진 기본 */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "HktLandscape|Material")
	TObjectPtr<UMaterialInterface> LandscapeMaterial;

	/** 바이옴 ID → Landscape Paint Layer 매핑. 비어 있으면 하이트 전용 Import */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "HktLandscape|Material")
	TArray<FHktBiomeLandscapeLayer> BiomeLayerMapping;

	// === 베이크 자산 ===

	/**
	 * 베이크된 청크 자산 (옵션). 지정되어 있으면 BeginPlay 에서 Subsystem 에 비동기 로드 요청.
	 * Voxel/Sprite Terrain Actor 와 동일 자산을 공유하여 단일 출처를 유지한다.
	 *
	 * 결정론 보장: 미지정/로드 전에도 Generator 폴백이 동일 Config 로 동일 결과를 산출한다.
	 * 따라서 Landscape 의 외형은 baked 로드 완료 여부와 무관하게 일관된다.
	 */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "HktLandscape|Bake")
	TSoftObjectPtr<UHktTerrainBakedAsset> BakedAsset;

	// === 런타임 미러 (UHktRuntimeGlobalSetting 에서 초기화) ===

	/** 복셀 1개의 월드 크기 (cm). 전역 설정이 단일 출처. */
	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "HktLandscape|Runtime", Transient)
	float VoxelSize = 15.0f;

	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "HktLandscape|Runtime", Transient)
	int32 HeightMinZ = 0;

	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "HktLandscape|Runtime", Transient)
	int32 HeightMaxZ = 3;

	/** 생성 통계 로그 출력 여부 */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "HktLandscape|Debug")
	bool bLogGenerationStats = true;

	/**
	 * 에디터 전용 재생성 버튼.
	 * 기존 Landscape 를 파괴하고 현재 설정으로 다시 Import 한다.
	 * 시드나 그리드 파라미터 변경 후 PIE 없이 외형을 갱신할 때 사용.
	 */
	UFUNCTION(BlueprintCallable, CallInEditor, Category = "HktLandscape|Debug")
	void RegenerateLandscape();

	/** 생성된 Landscape 액터 (약참조). nullptr 가능. */
	ALandscape* GetSpawnedLandscape() const { return SpawnedLandscape.Get(); }

protected:
	virtual void BeginPlay() override;
	virtual void EndPlay(const EEndPlayReason::Type EndPlayReason) override;

private:
	/** BeginPlay / RegenerateLandscape 공유 코어 — 제너레이터 구성 후 스폰/Import 수행 */
	void InitializeLandscape();

	/** 기존 Landscape 액터 파괴 + 제너레이터 해제 */
	void TeardownLandscape();

	/** QuadsPerSection 이 {7,15,31,63,127,255} 에 속하는지 검증하고 아니면 63으로 클램프 */
	void ValidateGridParameters();

	// === 내부 상태 ===

	TWeakObjectPtr<ALandscape>       SpawnedLandscape;
	FGuid                            LandscapeGuid;
	int32                            HeightmapVertsX = 0;
	int32                            HeightmapVertsY = 0;
};
