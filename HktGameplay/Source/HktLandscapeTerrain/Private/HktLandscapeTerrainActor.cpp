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
#include "HktTerrainStagedBaker.h"
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

	// 1. effective VoxelSize 결정 + (레거시) Subsystem 단일 출처 준비.
	//    스테이지드 베이커(저작 경로, I-0049)는 voxel bottom-up Subsystem 없이도 동작한다 —
	//    VoxelSize 만 좌표 정렬용으로 정적 접근자(Subsystem 부재 시 인자 폴백)로 조회한다.
	UHktTerrainSubsystem* Sub = nullptr;
	if (bUseStagedBaker)
	{
		VoxelSize = UHktTerrainSubsystem::GetEffectiveVoxelSizeCm(World, VoxelSize);
	}
	else
	{
		// 1a. UHktTerrainSubsystem 단일 출처 — Voxel/Sprite Actor 와 동일 경로.
		//     Subsystem 부재 시 (ShouldCreateSubsystem 가 false 인 비-게임 World) 폴백 없이 종료.
		Sub = UHktTerrainSubsystem::Get(World);
		if (!Sub)
		{
			UE_LOG(LogHktLandscapeTerrain, Warning,
				TEXT("[%s] UHktTerrainSubsystem 부재 — Landscape 생성을 건너뜁니다 (World 타입 확인)."), *GetName());
			return;
		}

		// 1b. UHktRuntimeGlobalSetting 기반 fallback Config 주입 (idempotent).
		const UHktRuntimeGlobalSetting* Settings = GetDefault<UHktRuntimeGlobalSetting>();
		if (!Settings)
		{
			UE_LOG(LogHktLandscapeTerrain, Error, TEXT("[%s] UHktRuntimeGlobalSetting CDO 접근 실패"), *GetName());
			return;
		}
		Sub->SetFallbackConfig(Settings->ToTerrainConfig());

		// 1c. BakedAsset 동기 로드 — GetEffectiveConfig() 가 베이크 시점과 동일 Config 를 반환하도록.
		if (!BakedAsset.IsNull())
		{
			Sub->LoadBakedAssetSync(BakedAsset);
		}

		// 1d. Effective Config 조회 — VoxelSize/Min/Max 미러 동기화 (BakedAsset 우선, 부재 시 fallback).
		const FHktTerrainGeneratorConfig EffectiveCfg = Sub->GetEffectiveConfig();
		VoxelSize  = EffectiveCfg.VoxelSizeCm;
		HeightMinZ = EffectiveCfg.HeightMinZ;
		HeightMaxZ = EffectiveCfg.HeightMaxZ;
	}

	// 2. Landscape 스케일을 effective VoxelSize 에 강제 정렬 — voxel/HktCore 정렬 불변식(invariant).
	//     하이트맵은 '정점 1개 = 월드 복셀 1개' 로 샘플링되므로(SamplePreview 가 복셀 단위로 스텝),
	//     1 quad 의 월드 폭(LandscapeScale.XY)도 반드시 VoxelSize 여야 voxel/HktCore 좌표계
	//     (world cm = voxel * VoxelSize)와 정확히 겹친다. XY 가 VoxelSize 와 다르면
	//     (예: 액터 기본 100 vs baked 25) 원점에서 멀어질수록 수평으로 어긋나 지형이 HktCore 지면
	//     위로 떠 보인다. Z 도 동일 스케일로 두어 큐브형 복셀 종횡비를 보존하고 voxel 지형과 1:1 일치시킨다.
	//     (높이 인코딩 자체는 Z 스케일에 불변이지만, XY 와 맞춰야 외형이 일치한다.)
	if (!FMath::IsNearlyEqual(LandscapeScale.X, static_cast<double>(VoxelSize)) ||
	    !FMath::IsNearlyEqual(LandscapeScale.Y, static_cast<double>(VoxelSize)) ||
	    !FMath::IsNearlyEqual(LandscapeScale.Z, static_cast<double>(VoxelSize)))
	{
		UE_LOG(LogHktLandscapeTerrain, Warning,
			TEXT("[%s] LandscapeScale(%s) 가 effective VoxelSize=%.1f 와 불일치 — voxel/HktCore 정렬을 위해 (%.1f,%.1f,%.1f) 로 강제합니다."),
			*GetName(), *LandscapeScale.ToString(), VoxelSize, VoxelSize, VoxelSize, VoxelSize);
		LandscapeScale = FVector(VoxelSize, VoxelSize, VoxelSize);
	}

	// 5. 그리드 파라미터 검증 / 클램프
	ValidateGridParameters();

	// 6. Landscape 버텍스 그리드 크기 산출
	const int32 QuadsPerComponent = QuadsPerSection * SectionsPerComponent;
	HeightmapVertsX = ComponentCountX * QuadsPerComponent + 1;
	HeightmapVertsY = ComponentCountY * QuadsPerComponent + 1;
	const int32 NumSamples = HeightmapVertsX * HeightmapVertsY;

	// 7. Region.Samples 산출 — 스테이지드 베이커(저작, heightfield-canonical) 또는
	//    SamplePreview(voxel bottom-up 투영). 어느 쪽이든 이후 인코딩/레이어/Import 경로는 공유.
	FHktTerrainPreviewRegion Region;
	if (bUseStagedBaker)
	{
		const FHktTerrainStagedBaker Baker(Theme);
		FHktTerrainBakeField Field;
		Baker.BakeRegion(
			LandscapeOriginWorldVoxels.X, LandscapeOriginWorldVoxels.Y,
			HeightmapVertsX, HeightmapVertsY, Field);

		if (Field.Elevation.Num() != NumSamples)
		{
			UE_LOG(LogHktLandscapeTerrain, Error,
				TEXT("[%s] StagedBaker 결과 크기 불일치: 기대 %d, 실제 %d"),
				*GetName(), NumSamples, Field.Elevation.Num());
			return;
		}

		// 정규화 고도 [0,1] → 표면 복셀 높이 [Base, Base+Relief]. 바이옴은 그대로 전달
		// (기존 uint16 인코딩 / Paint Layer 가중치 경로를 그대로 재사용).
		Region.MinWorldX = LandscapeOriginWorldVoxels.X;
		Region.MinWorldY = LandscapeOriginWorldVoxels.Y;
		Region.Width  = HeightmapVertsX;
		Region.Height = HeightmapVertsY;
		Region.Samples.SetNum(NumSamples);
		for (int32 i = 0; i < NumSamples; ++i)
		{
			Region.Samples[i].SurfaceHeightVoxels =
				StagedBaseVoxels + FMath::RoundToInt(Field.Elevation[i] * static_cast<float>(StagedReliefVoxels));
			Region.Samples[i].BiomeId = Field.BiomeId[i];
		}
	}
	else
	{
		// Subsystem 경유 — EnsureFallbackGenerator() 가 baked/fallback Config 우선순위를 적용한다.
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
			// LandscapeLayerBlend 머티리얼은 ULandscapeLayerInfoObject::LayerName 으로 웨이트맵을
			// 바인딩한다(엔진 LandscapeEdit.cpp::Import — FWeightmapLayerAllocationInfo 가 LayerInfo
			// 만 참조하며, FLandscapeImportLayerInfo::LayerName 은 바인딩에 쓰이지 않는다).
			// 따라서 매핑 DebugName 과 LayerInfo 의 LayerName 을 일치시켜야 페인트 레이어가
			// 머티리얼 레이어에 연결된다. (LayerName 은 에디터에서 read-only 라 스크립트로 못 박으므로
			// 여기서 강제 동기화한다.)
			if (Info.LayerInfo && Info.LayerInfo->GetLayerName() != Info.LayerName)
			{
				Info.LayerInfo->SetLayerName(Info.LayerName, /*bInModify=*/false);
			}
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
	//    주의: 두 GUID 개념이 다르다.
	//      - InGuid (첫 파라미터): Landscape 액터 자체의 GUID. check(InGuid.IsValid()) 때문에
	//        반드시 유효(non-zero)해야 한다 → FGuid::NewGuid().
	//      - 데이터 맵의 키: 에디트 레이어 GUID. Final/베이스 레이어는 엔진이 LandscapeEdit.cpp 에서
	//        FindChecked(FGuid()) 로 빈 기본 GUID 를 조회한다. 무작위 GUID 로 키잉하면 FindChecked
	//        가 키를 못 찾아 크래시한다. 따라서 맵 키는 반드시 빈 FGuid().
	LandscapeGuid = FGuid::NewGuid();
	const FGuid BaseLayerGuid = FGuid();   // 빈 GUID — Final/베이스 레이어
	TMap<FGuid, TArray<uint16>> HeightDataPerLayer;
	TMap<FGuid, TArray<FLandscapeImportLayerInfo>> MaterialLayerDataPerLayer;
	HeightDataPerLayer.Add(BaseLayerGuid, MoveTemp(HeightData));
	MaterialLayerDataPerLayer.Add(BaseLayerGuid, MoveTemp(ImportLayers));

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
		const TCHAR* Source = bUseStagedBaker
			? TEXT("StagedBaker")
			: ((Sub && Sub->GetBakedAsset()) ? TEXT("Subsystem(BakedConfig)") : TEXT("Subsystem(Fallback)"));
		UE_LOG(LogHktLandscapeTerrain, Log,
			TEXT("[%s] Landscape 생성 완료: Verts=%dx%d Components=%dx%d QuadsPerSection=%d Layers=%d Source=%s"),
			*GetName(), HeightmapVertsX, HeightmapVertsY,
			ComponentCountX, ComponentCountY, QuadsPerSection,
			LayerCount, Source);
	}
}
