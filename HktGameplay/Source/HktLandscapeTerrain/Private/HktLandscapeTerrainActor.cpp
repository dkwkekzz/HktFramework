// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "HktLandscapeTerrainActor.h"
#include "HktLandscapeTerrainLog.h"

#include "Engine/World.h"
#include "Landscape.h"
#include "LandscapeLayerInfoObject.h"
#include "Materials/MaterialInterface.h"
#include "Components/SceneComponent.h"

#include "HktTerrainGenerator.h"        // FHktTerrainPreviewRegion 정의
#include "HktTerrainSubsystem.h"
#include "Settings/HktRuntimeGlobalSetting.h"

AHktLandscapeTerrainActor::AHktLandscapeTerrainActor()
{
	PrimaryActorTick.bCanEverTick = false;

	USceneComponent* Root = CreateDefaultSubobject<USceneComponent>(TEXT("Root"));
	SetRootComponent(Root);
}

// ── 라이프사이클 ────────────────────────────────────────────────────

void AHktLandscapeTerrainActor::BeginPlay()
{
	Super::BeginPlay();
	InitializeLandscape();
}

void AHktLandscapeTerrainActor::EndPlay(const EEndPlayReason::Type EndPlayReason)
{
	TeardownLandscape();
	Super::EndPlay(EndPlayReason);
}

void AHktLandscapeTerrainActor::RegenerateLandscape()
{
	TeardownLandscape();
	InitializeLandscape();
}

// ── 검증 ─────────────────────────────────────────────────────────────

void AHktLandscapeTerrainActor::ValidateGridParameters()
{
	// UE5 Landscape 허용값: {7, 15, 31, 63, 127, 255}
	static const int32 ValidQuadsPerSection[] = { 7, 15, 31, 63, 127, 255 };
	bool bValid = false;
	for (int32 V : ValidQuadsPerSection)
	{
		if (QuadsPerSection == V)
		{
			bValid = true;
			break;
		}
	}
	if (!bValid)
	{
		UE_LOG(LogHktLandscapeTerrain, Warning,
			TEXT("[%s] QuadsPerSection=%d 은 허용값 {7,15,31,63,127,255} 에 속하지 않아 63으로 클램프합니다."),
			*GetName(), QuadsPerSection);
		QuadsPerSection = 63;
	}

	if (SectionsPerComponent != 1 && SectionsPerComponent != 4)
	{
		UE_LOG(LogHktLandscapeTerrain, Warning,
			TEXT("[%s] SectionsPerComponent=%d 은 허용값 {1,4} 에 속하지 않아 1로 클램프합니다."),
			*GetName(), SectionsPerComponent);
		SectionsPerComponent = 1;
	}

	ComponentCountX = FMath::Clamp(ComponentCountX, 1, 32);
	ComponentCountY = FMath::Clamp(ComponentCountY, 1, 32);
}

// ── 정리 ─────────────────────────────────────────────────────────────

void AHktLandscapeTerrainActor::TeardownLandscape()
{
	if (ALandscape* Existing = SpawnedLandscape.Get())
	{
		Existing->Destroy();
	}
	SpawnedLandscape.Reset();
	HeightmapVertsX = 0;
	HeightmapVertsY = 0;
	// Generator 는 더 이상 보유하지 않는다 — UHktTerrainSubsystem 이 단일 출처.
}

// ── 생성 파이프라인 ─────────────────────────────────────────────────

void AHktLandscapeTerrainActor::InitializeLandscape()
{
	UWorld* World = GetWorld();
	if (!World)
	{
		UE_LOG(LogHktLandscapeTerrain, Warning, TEXT("[%s] World 없음 — Landscape 생성을 건너뜁니다."), *GetName());
		return;
	}

	// 1. UHktTerrainSubsystem 단일 출처 — Voxel/Sprite Actor 와 동일 경로.
	//    Subsystem 부재 시 (ShouldCreateSubsystem 가 false 인 비-게임 World) 폴백 없이 종료.
	UHktTerrainSubsystem* Sub = UHktTerrainSubsystem::Get(World);
	if (!Sub)
	{
		UE_LOG(LogHktLandscapeTerrain, Warning,
			TEXT("[%s] UHktTerrainSubsystem 부재 — Landscape 생성을 건너뜁니다 (World 타입 확인)."), *GetName());
		return;
	}

	// 2. UHktRuntimeGlobalSetting 기반 fallback Config 주입 (idempotent).
	//    - PIE/Game: GameMode::InitGame 에서 먼저 주입했어도 SetFallbackConfig 는 동일값이면 no-op.
	//    - Editor (RegenerateLandscape): GameMode 가 없으므로 본 호출이 effective Config 를 채운다.
	const UHktRuntimeGlobalSetting* Settings = GetDefault<UHktRuntimeGlobalSetting>();
	if (!Settings)
	{
		UE_LOG(LogHktLandscapeTerrain, Error, TEXT("[%s] UHktRuntimeGlobalSetting CDO 접근 실패"), *GetName());
		return;
	}
	Sub->SetFallbackConfig(Settings->ToTerrainConfig());

	// 3. BakedAsset 이 지정되어 있다면 비동기 로드 시작 — Voxel/Sprite Actor 와 단일 출처 공유.
	//    SamplePreview 는 비동기 로드 완료를 기다리지 않는다(결정론 — 동일 Config 로 Generator
	//    가 동일 결과를 산출하므로 외형은 비트 단위 일치한다).
	if (!BakedAsset.IsNull())
	{
		Sub->LoadBakedAsset(BakedAsset);
	}

	// 4. Effective Config 조회 — VoxelSize/Min/Max 미러 동기화 (BakedAsset 우선, 부재 시 fallback).
	const FHktTerrainGeneratorConfig EffectiveCfg = Sub->GetEffectiveConfig();
	VoxelSize  = EffectiveCfg.VoxelSizeCm;
	HeightMinZ = EffectiveCfg.HeightMinZ;
	HeightMaxZ = EffectiveCfg.HeightMaxZ;

	// 5. 그리드 파라미터 검증 / 클램프
	ValidateGridParameters();

	// 6. Landscape 버텍스 그리드 크기 산출
	const int32 QuadsPerComponent = QuadsPerSection * SectionsPerComponent;
	HeightmapVertsX = ComponentCountX * QuadsPerComponent + 1;
	HeightmapVertsY = ComponentCountY * QuadsPerComponent + 1;
	const int32 NumSamples = HeightmapVertsX * HeightmapVertsY;

	// 7. 2D 하이트 + 바이옴 샘플링 — Subsystem 경유 (Effective Config 기반 결정론적 결과).
	//    Subsystem 내부에서 EnsureFallbackGenerator() 가 baked/fallback Config 우선순위를 적용한다.
	FHktTerrainPreviewRegion Region;
	Sub->SamplePreview(
		LandscapeOriginWorldVoxels.X,
		LandscapeOriginWorldVoxels.Y,
		HeightmapVertsX,
		HeightmapVertsY,
		Region);

	if (Region.Samples.Num() != NumSamples)
	{
		UE_LOG(LogHktLandscapeTerrain, Error,
			TEXT("[%s] SamplePreview 결과 크기 불일치: 기대 %d, 실제 %d"),
			*GetName(), NumSamples, Region.Samples.Num());
		return;
	}

	// 6. SurfaceHeightVoxels → uint16 하이트맵 변환
	//    WorldZ_cm = SurfaceHeightVoxels * VoxelSize
	//    WorldZ_lu = WorldZ_cm / LandscapeScale.Z
	//    HeightU16 = clamp(32768 + round(WorldZ_lu * 128), 0, 65535)
	const double SafeScaleZ = FMath::Max(LandscapeScale.Z, 0.01);
	TArray<uint16> HeightData;
	HeightData.SetNumUninitialized(NumSamples);

	int32 MinEncoded = TNumericLimits<int32>::Max();
	int32 MaxEncoded = TNumericLimits<int32>::Min();
	for (int32 i = 0; i < NumSamples; ++i)
	{
		const double WorldZ_cm = static_cast<double>(Region.Samples[i].SurfaceHeightVoxels) * VoxelSize;
		const double WorldZ_lu = WorldZ_cm / SafeScaleZ;
		const int32 Encoded = 32768 + FMath::RoundToInt(WorldZ_lu * 128.0);
		const int32 Clamped = FMath::Clamp(Encoded, 0, 65535);
		HeightData[i] = static_cast<uint16>(Clamped);

		if (Encoded < MinEncoded) MinEncoded = Encoded;
		if (Encoded > MaxEncoded) MaxEncoded = Encoded;
	}
	if (MinEncoded < 0 || MaxEncoded > 65535)
	{
		UE_LOG(LogHktLandscapeTerrain, Warning,
			TEXT("[%s] 하이트 인코딩 범위 초과 (Min=%d Max=%d) — LandscapeScale.Z 확대 권장"),
			*GetName(), MinEncoded, MaxEncoded);
	}

	// 7. 바이옴 → Landscape 레이어 가중치 맵 구성
	const int32 LayerCount = BiomeLayerMapping.Num();
	TArray<FLandscapeImportLayerInfo> ImportLayers;
	if (LayerCount > 0)
	{
		// 빠른 조회: BiomeId → 레이어 인덱스
		TMap<uint8, int32> BiomeToLayer;
		BiomeToLayer.Reserve(LayerCount);
		for (int32 Idx = 0; Idx < LayerCount; ++Idx)
		{
			BiomeToLayer.Add(BiomeLayerMapping[Idx].BiomeId, Idx);
		}

		TArray<TArray<uint8>> WeightByLayer;
		WeightByLayer.SetNum(LayerCount);
		for (TArray<uint8>& W : WeightByLayer)
		{
			W.SetNumZeroed(NumSamples);
		}

		for (int32 i = 0; i < NumSamples; ++i)
		{
			const uint8 Biome = Region.Samples[i].BiomeId;
			const int32* FoundIdx = BiomeToLayer.Find(Biome);
			const int32 TargetIdx = FoundIdx ? *FoundIdx : 0;   // 미매핑은 첫 레이어로 폴백
			WeightByLayer[TargetIdx][i] = 255;
		}

		ImportLayers.Reserve(LayerCount);
		for (int32 Idx = 0; Idx < LayerCount; ++Idx)
		{
			FLandscapeImportLayerInfo Info;
			Info.LayerName = BiomeLayerMapping[Idx].DebugName.IsNone()
				? FName(*FString::Printf(TEXT("Biome_%u"), BiomeLayerMapping[Idx].BiomeId))
				: BiomeLayerMapping[Idx].DebugName;
			Info.LayerInfo = BiomeLayerMapping[Idx].LayerInfo;
			Info.LayerData = MoveTemp(WeightByLayer[Idx]);
			ImportLayers.Add(MoveTemp(Info));
		}
	}

	// 8. ALandscape 스폰
	FActorSpawnParameters SpawnParams;
	SpawnParams.Owner = this;
	const FVector  SpawnLocation = GetActorLocation();
	const FRotator SpawnRotation = GetActorRotation();
	ALandscape* NewLandscape = World->SpawnActor<ALandscape>(
		ALandscape::StaticClass(), SpawnLocation, SpawnRotation, SpawnParams);
	if (!NewLandscape)
	{
		UE_LOG(LogHktLandscapeTerrain, Error, TEXT("[%s] ALandscape SpawnActor 실패"), *GetName());
		return;
	}
	NewLandscape->SetActorScale3D(LandscapeScale);
	if (LandscapeMaterial)
	{
		NewLandscape->LandscapeMaterial = LandscapeMaterial;
	}

	// 9. Import 호출 — HktMapStreamingSubsystem 과 동일한 런타임 패턴
	LandscapeGuid = FGuid::NewGuid();
	TMap<FGuid, TArray<uint16>> HeightDataPerLayer;
	TMap<FGuid, TArray<FLandscapeImportLayerInfo>> MaterialLayerDataPerLayer;
	HeightDataPerLayer.Add(LandscapeGuid, MoveTemp(HeightData));
	MaterialLayerDataPerLayer.Add(LandscapeGuid, MoveTemp(ImportLayers));

	// UE5.7 Import 시그니처: (Guid, MinX, MinY, MaxX, MaxY, NumSubsections, SubsectionSizeQuads, ...)
	// MaxX/MaxY = HeightmapVerts - 1 (버텍스 인덱스 기반), InImportLayers는 빈 뷰 전달.
	NewLandscape->Import(
		LandscapeGuid,
		0, 0,
		HeightmapVertsX - 1, HeightmapVertsY - 1,
		SectionsPerComponent, QuadsPerSection,
		HeightDataPerLayer, TEXT(""),
		MaterialLayerDataPerLayer,
		ELandscapeImportAlphamapType::Additive,
		TArrayView<const FLandscapeLayer>());

	SpawnedLandscape = NewLandscape;

	if (bLogGenerationStats)
	{
		UE_LOG(LogHktLandscapeTerrain, Log,
			TEXT("[%s] Landscape 생성 완료: Verts=%dx%d Components=%dx%d QuadsPerSection=%d Layers=%d Advanced=%s Source=%s"),
			*GetName(), HeightmapVertsX, HeightmapVertsY,
			ComponentCountX, ComponentCountY, QuadsPerSection,
			LayerCount,
			EffectiveCfg.bAdvancedTerrain ? TEXT("true") : TEXT("false"),
			Sub->GetBakedAsset() ? TEXT("Subsystem(BakedConfig)") : TEXT("Subsystem(Fallback)"));
	}
}
