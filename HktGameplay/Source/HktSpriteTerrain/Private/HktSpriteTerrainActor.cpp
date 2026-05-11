// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "HktSpriteTerrainActor.h"
#include "HktSpriteTerrainLog.h"
#include "HktAdvTerrainTypes.h"
#include "HktTerrainSubsystem.h"
#include "Terrain/HktTerrainGeneratorConfig.h"
#include "Components/HierarchicalInstancedStaticMeshComponent.h"
#include "Engine/StaticMesh.h"
#include "Engine/World.h"
#include "GameFramework/PlayerController.h"
#include "GameFramework/Pawn.h"
#include "Materials/Material.h"
#include "Materials/MaterialInstanceDynamic.h"
#include "Materials/MaterialInterface.h"
#if WITH_EDITORONLY_DATA
#include "Materials/MaterialExpressionAppendVector.h"
#include "Materials/MaterialExpressionPerInstanceCustomData.h"
#endif

namespace
{
	constexpr int32 kNumCustomDataFloats = 16;
	constexpr int32 kChunkSize = FHktTerrainGeneratorConfig::ChunkSize;
	constexpr int32 kVoxelsPerChunk = kChunkSize * kChunkSize * kChunkSize;

	// Fallback mode 면별 음영 강도 — 단일 광원 NE 상부 가정.
	constexpr float kFaceShadeTop   = 1.00f;
	constexpr float kFaceShadeRight = 0.78f;
	constexpr float kFaceShadeLeft  = 0.58f;

	FORCEINLINE int32 VoxelIndex(int32 X, int32 Y, int32 Z)
	{
		// FHktTerrainGenerator 와 동일 인덱싱 — Z-major (X + SIZE*Y + SIZE^2*Z).
		return X + kChunkSize * (Y + kChunkSize * Z);
	}

	// ------------------------------------------------------------------------
	// 폴백 컬러 테이블 — HktAdvTerrainType ID(0..32) 별 의미 있는 색.
	// Sprite art 가 다 준비되기 전, AtlasTexture 미할당 시 voxel 의 3면을
	// 색깔로 식별하기 위한 dev fallback. 값은 sRGB FColor(R,G,B,A).
	// ------------------------------------------------------------------------
	static const FLinearColor& GetFallbackTypeColorLinear(uint16 TypeID)
	{
		// HktAdvTerrainType:: ID 매핑 (33 종). FLinearColor (0..1) 단위 — 면별 음영 곱셈 위해.
		static const FLinearColor Table[HktAdvTerrainType::TypeCount] = {
			FLinearColor(0.000f, 0.000f, 0.000f, 0.f),    // 0  Air (defensive — emit 안 됨)
			FLinearColor(0.314f, 0.667f, 0.235f),         // 1  Grass
			FLinearColor(0.451f, 0.294f, 0.176f),         // 2  Dirt
			FLinearColor(0.490f, 0.490f, 0.510f),         // 3  Stone
			FLinearColor(0.882f, 0.784f, 0.529f),         // 4  Sand
			FLinearColor(0.176f, 0.373f, 0.725f),         // 5  Water
			FLinearColor(0.941f, 0.941f, 0.961f),         // 6  Snow
			FLinearColor(0.667f, 0.863f, 0.941f),         // 7  Ice
			FLinearColor(0.549f, 0.510f, 0.471f),         // 8  Gravel
			FLinearColor(0.608f, 0.392f, 0.314f),         // 9  Clay
			FLinearColor(0.176f, 0.176f, 0.216f),         // 10 Bedrock
			FLinearColor(0.784f, 0.863f, 0.902f, 0.8f),   // 11 Glass
			FLinearColor(0.471f, 0.745f, 0.353f),         // 12 GrassFlower
			FLinearColor(0.373f, 0.451f, 0.294f),         // 13 StoneMossy
			FLinearColor(0.588f, 0.824f, 0.745f),         // 14 CrystalGrass
			FLinearColor(0.745f, 0.882f, 0.824f),         // 15 GrassEthereal
			FLinearColor(0.510f, 0.882f, 0.431f),         // 16 MossGlow
			FLinearColor(0.255f, 0.196f, 0.137f),         // 17 SoilDark
			FLinearColor(0.922f, 0.863f, 0.706f),         // 18 SandBleached
			FLinearColor(0.451f, 0.431f, 0.412f),         // 19 StoneFractured
			FLinearColor(0.863f, 0.843f, 0.765f),         // 20 BoneFragment
			FLinearColor(0.784f, 0.706f, 0.941f),         // 21 CrystalShard
			FLinearColor(0.431f, 0.294f, 0.176f),         // 22 Wood
			FLinearColor(0.235f, 0.510f, 0.196f),         // 23 Leaves
			FLinearColor(0.804f, 0.863f, 0.784f),         // 24 LeavesSnow
			FLinearColor(0.353f, 0.569f, 0.333f),         // 25 Cactus
			FLinearColor(0.706f, 0.471f, 0.392f),         // 26 Mushroom
			FLinearColor(1.000f, 0.510f, 0.863f),         // 27 MushroomGlow
			FLinearColor(0.157f, 0.157f, 0.196f),         // 28 OreCoal
			FLinearColor(0.725f, 0.490f, 0.353f),         // 29 OreIron
			FLinearColor(0.941f, 0.784f, 0.314f),         // 30 OreGold
			FLinearColor(0.706f, 0.902f, 1.000f),         // 31 OreCrystal
			FLinearColor(0.255f, 0.137f, 0.353f),         // 32 OreVoidstone
		};
		// 알 수 없는 TypeID 는 마젠타 — 누락된 등록을 시각적으로 즉시 식별.
		static const FLinearColor Unknown(1.f, 0.f, 1.f);
		return (TypeID < HktAdvTerrainType::TypeCount) ? Table[TypeID] : Unknown;
	}

	// ------------------------------------------------------------------------
	// Fallback face material — 런타임 생성 unlit + PerInstanceCustomData → Emissive.
	//
	// 슬롯 9/10/11 (R, G, B) 을 읽어 그대로 emissive 출력. 셰이딩 0 (Unlit), TwoSided.
	// Editor 빌드에서만 자동 생성 — Shipping 은 엔진 기본 머티리얼로 폴백 (색 안 나옴,
	// fallback 자체가 dev 용도라 Shipping 에선 정식 art 사용 가정).
	// ------------------------------------------------------------------------
	static UMaterialInterface* GetFallbackFaceMaterial()
	{
		static TWeakObjectPtr<UMaterialInterface> Cached;
		if (Cached.IsValid())
		{
			return Cached.Get();
		}

#if WITH_EDITORONLY_DATA
		UMaterial* Mat = NewObject<UMaterial>(
			GetTransientPackage(), TEXT("M_HktSpriteTerrainFallbackFace"), RF_Transient);
		Mat->AddToRoot();
		Mat->MaterialDomain = MD_Surface;
		Mat->SetShadingModel(MSM_Unlit);
		Mat->BlendMode = BLEND_Opaque;
		Mat->TwoSided = true;
		Mat->bUsedWithInstancedStaticMeshes = true;
		Mat->bUsedWithStaticLighting = false;

		// CustomData slot 9 = R, 10 = G, 11 = B
		auto* CD_R = NewObject<UMaterialExpressionPerInstanceCustomData>(Mat);
		CD_R->DataIndex = 9;
		CD_R->ConstDefaultValue = 1.f;
		Mat->GetExpressionCollection().AddExpression(CD_R);

		auto* CD_G = NewObject<UMaterialExpressionPerInstanceCustomData>(Mat);
		CD_G->DataIndex = 10;
		CD_G->ConstDefaultValue = 1.f;
		Mat->GetExpressionCollection().AddExpression(CD_G);

		auto* CD_B = NewObject<UMaterialExpressionPerInstanceCustomData>(Mat);
		CD_B->DataIndex = 11;
		CD_B->ConstDefaultValue = 1.f;
		Mat->GetExpressionCollection().AddExpression(CD_B);

		// Append (R, G) → float2, 다시 Append (float2, B) → float3.
		auto* RG = NewObject<UMaterialExpressionAppendVector>(Mat);
		RG->A.Connect(0, CD_R);
		RG->B.Connect(0, CD_G);
		Mat->GetExpressionCollection().AddExpression(RG);

		auto* RGB = NewObject<UMaterialExpressionAppendVector>(Mat);
		RGB->A.Connect(0, RG);
		RGB->B.Connect(0, CD_B);
		Mat->GetExpressionCollection().AddExpression(RGB);

		Mat->GetEditorOnlyData()->EmissiveColor.Connect(0, RGB);

		Mat->PostEditChange();
		UE_LOG(LogHktSpriteTerrain, Log,
			TEXT("[SpriteTerrain] Fallback face material 생성 — "
				 "CustomData[9..11] → Emissive (Unlit/TwoSided/Opaque)."));

		Cached = Mat;
		return Mat;
#else
		// Shipping — 정식 art 가정. 폴백은 dev 전용이므로 그냥 기본 머티리얼 반환 (색 안 나옴).
		UE_LOG(LogHktSpriteTerrain, Warning,
			TEXT("[SpriteTerrain] Shipping 빌드에서 fallback material 미지원 — "
				 "AtlasTexture/TerrainMaterial 을 정식으로 할당하세요."));
		return UMaterial::GetDefaultMaterial(MD_Surface);
#endif
	}
}

AHktSpriteTerrainActor::AHktSpriteTerrainActor()
{
	PrimaryActorTick.bCanEverTick = true;
	PrimaryActorTick.TickGroup = TG_DuringPhysics;

	HISMComponent = CreateDefaultSubobject<UHierarchicalInstancedStaticMeshComponent>(TEXT("HISM"));
	RootComponent = HISMComponent;

	auto ConfigureHISM = [](UHierarchicalInstancedStaticMeshComponent* H)
	{
		H->SetMobility(EComponentMobility::Movable);
		H->NumCustomDataFloats = kNumCustomDataFloats;
		H->SetCollisionEnabled(ECollisionEnabled::NoCollision);
		H->SetCanEverAffectNavigation(false);
		H->bDisableCollision = true;
		H->SetGenerateOverlapEvents(false);
		H->bAffectDistanceFieldLighting = false;
		H->bAffectDynamicIndirectLighting = false;
		H->CastShadow = false;
	};
	ConfigureHISM(HISMComponent);

	HISMFallbackTop = CreateDefaultSubobject<UHierarchicalInstancedStaticMeshComponent>(TEXT("HISMFallbackTop"));
	HISMFallbackTop->SetupAttachment(RootComponent);
	ConfigureHISM(HISMFallbackTop);

	HISMFallbackLeft = CreateDefaultSubobject<UHierarchicalInstancedStaticMeshComponent>(TEXT("HISMFallbackLeft"));
	HISMFallbackLeft->SetupAttachment(RootComponent);
	ConfigureHISM(HISMFallbackLeft);

	HISMFallbackRight = CreateDefaultSubobject<UHierarchicalInstancedStaticMeshComponent>(TEXT("HISMFallbackRight"));
	HISMFallbackRight->SetupAttachment(RootComponent);
	ConfigureHISM(HISMFallbackRight);
}

void AHktSpriteTerrainActor::InitSpriteMode()
{
	if (!HISMComponent || !QuadMesh)
	{
		return;
	}
	HISMComponent->SetStaticMesh(QuadMesh);
	HISMComponent->NumCustomDataFloats = kNumCustomDataFloats;

	if (TerrainMaterial)
	{
		TerrainMID = UMaterialInstanceDynamic::Create(TerrainMaterial, this);
		if (TerrainMID)
		{
			// Param 이름 — M_HktSpriteYBillboard 규약 (HktSpriteCore 의 상수와 동일).
			if (AtlasTexture)
			{
				TerrainMID->SetTextureParameterValue(TEXT("Atlas"), AtlasTexture);
			}
			if (PaletteLUT)
			{
				TerrainMID->SetTextureParameterValue(TEXT("PaletteLUT"), PaletteLUT);
			}
			TerrainMID->SetVectorParameterValue(
				TEXT("AtlasSize"),
				FLinearColor(AtlasSizePx.X, AtlasSizePx.Y, CellSizePx.X, CellSizePx.Y));
			HISMComponent->SetMaterial(0, TerrainMID);
		}
	}
	else
	{
		UE_LOG(LogHktSpriteTerrain, Warning,
			TEXT("[SpriteTerrain] TerrainMaterial 미할당 — M_HktSpriteYBillboard 를 할당하세요."));
	}

	// Fallback HISMs 비활성화 — 인스턴스 추가 안 함.
	HISMFallbackTop->SetVisibility(false);
	HISMFallbackLeft->SetVisibility(false);
	HISMFallbackRight->SetVisibility(false);
}

void AHktSpriteTerrainActor::InitFallbackMode()
{
	if (!QuadMesh)
	{
		UE_LOG(LogHktSpriteTerrain, Warning,
			TEXT("[SpriteTerrain] QuadMesh 미할당 — fallback mode 인스턴스 추가 안 됨."));
		return;
	}

	UMaterialInterface* FallbackMat = GetFallbackFaceMaterial();

	auto SetupFace = [&](UHierarchicalInstancedStaticMeshComponent* H)
	{
		H->SetStaticMesh(QuadMesh);
		H->NumCustomDataFloats = kNumCustomDataFloats;
		if (FallbackMat)
		{
			H->SetMaterial(0, FallbackMat);
		}
	};
	SetupFace(HISMFallbackTop);
	SetupFace(HISMFallbackLeft);
	SetupFace(HISMFallbackRight);

	// Sprite HISM 비활성화.
	HISMComponent->SetVisibility(false);

	UE_LOG(LogHktSpriteTerrain, Log,
		TEXT("[SpriteTerrain] Fallback mode 활성 — voxel 의 3면 (top/-X/-Y) 을 axis-aligned quad 로 렌더."));
}

void AHktSpriteTerrainActor::BeginPlay()
{
	Super::BeginPlay();

	// Mode 결정 — AtlasTexture 가 비었고 bUseFallbackColors=true 면 fallback.
	bUsingFallback = (!AtlasTexture && bUseFallbackColors);

	if (bUsingFallback)
	{
		InitFallbackMode();
	}
	else
	{
		InitSpriteMode();
	}

	Loader = CreateTerrainChunkLoader(LoaderType);

	if (UHktTerrainSubsystem* Sub = UHktTerrainSubsystem::Get(this))
	{
		if (!BakedAsset.IsNull())
		{
			Sub->LoadBakedAsset(BakedAsset);
		}
	}
	else
	{
		UE_LOG(LogHktSpriteTerrain, Warning,
			TEXT("[SpriteTerrain] UHktTerrainSubsystem 없음 — Tick 무동작"));
	}
}

void AHktSpriteTerrainActor::EndPlay(const EEndPlayReason::Type EndPlayReason)
{
	if (HISMComponent)         { HISMComponent->ClearInstances(); }
	if (HISMFallbackTop)       { HISMFallbackTop->ClearInstances(); }
	if (HISMFallbackLeft)      { HISMFallbackLeft->ClearInstances(); }
	if (HISMFallbackRight)     { HISMFallbackRight->ClearInstances(); }

	ChunkInstanceIndices.Reset();
	InstanceChunkByIdx.Reset();
	ChunkInstanceIndices_FallbackTop.Reset();
	ChunkInstanceIndices_FallbackLeft.Reset();
	ChunkInstanceIndices_FallbackRight.Reset();
	InstanceChunkByIdx_FallbackTop.Reset();
	InstanceChunkByIdx_FallbackLeft.Reset();
	InstanceChunkByIdx_FallbackRight.Reset();
	bAboveChunkValid = false;

	if (Loader)
	{
		Loader->Clear();
		Loader.Reset();
	}

	Super::EndPlay(EndPlayReason);
}

void AHktSpriteTerrainActor::Tick(float DeltaSeconds)
{
	Super::Tick(DeltaSeconds);

	if (!QuadMesh || !Loader)
	{
		return;
	}

	UHktTerrainSubsystem* Sub = UHktTerrainSubsystem::Get(this);
	if (!Sub)
	{
		return;
	}

	// 스캔 빈도 제한.
	const float Now = GetWorld() ? GetWorld()->GetTimeSeconds() : 0.f;
	const float MinInterval = (MaxScansPerSecond > 0.f) ? 1.f / MaxScansPerSecond : 0.f;
	if (Now - LastScanTime < MinInterval)
	{
		return;
	}
	LastScanTime = Now;

	const float ChunkWorldSize = ComputeChunkWorldSize(Sub);
	if (ChunkWorldSize <= 0.f)
	{
		return;
	}
	CachedChunkWorldSize = ChunkWorldSize;
	const float VoxelSize = Sub->GetEffectiveConfig().VoxelSizeCm;

	// Sprite mode baseline 변경 감지 (slot 7/8/15 일괄 refresh).
	if (!bUsingFallback)
	{
		const float CurHalfW = CellSizePx.X * PixelToWorld * 0.5f;
		const float CurHalfH = CellSizePx.Y * PixelToWorld * 0.5f;
		const bool bBaselineChanged =
			!FMath::IsNearlyEqual(PrevComponentZBias, ComponentZBias) ||
			!FMath::IsNearlyEqual(PrevHalfWWorld,    CurHalfW)        ||
			!FMath::IsNearlyEqual(PrevHalfHWorld,    CurHalfH);
		if (bBaselineChanged)
		{
			RefreshAllSpriteInstanceBaseline();
			PrevComponentZBias = ComponentZBias;
			PrevHalfWWorld     = CurHalfW;
			PrevHalfHWorld     = CurHalfH;
		}
	}

	SyncLoaderConfig(Sub);

	const FVector CameraPos = GetViewCenterWorldPos();
	Loader->Update(CameraPos, ChunkWorldSize);

	for (const FIntVector& Coord : Loader->GetChunksToUnload())
	{
		RemoveInstancesForChunk(Coord);
	}

	for (const FHktChunkTierRequest& Req : Loader->GetChunksToLoad())
	{
		// 이미 로드된 청크 스킵.
		if (bUsingFallback)
		{
			if (ChunkInstanceIndices_FallbackTop.Contains(Req.Coord)) continue;
		}
		else
		{
			if (ChunkInstanceIndices.Contains(Req.Coord)) continue;
		}

		bAboveChunkValid = false;
		AboveChunkCachedCoord = FIntVector(INT_MIN, INT_MIN, INT_MIN);

		ExtractSurfaceCells(Sub, Req.Coord, SurfaceCellsScratch);
		if (SurfaceCellsScratch.Num() > 0)
		{
			AddInstancesForChunk(Req.Coord, SurfaceCellsScratch, VoxelSize);
		}
	}

	// 변경된 HISM 만 dirty.
	if (bUsingFallback)
	{
		HISMFallbackTop->MarkRenderStateDirty();
		HISMFallbackLeft->MarkRenderStateDirty();
		HISMFallbackRight->MarkRenderStateDirty();
	}
	else
	{
		HISMComponent->MarkRenderStateDirty();
	}
}

void AHktSpriteTerrainActor::SyncLoaderConfig(UHktTerrainSubsystem* Sub)
{
	const FHktTerrainGeneratorConfig Cfg = Sub->GetEffectiveConfig();

	FHktTerrainLoaderConfig LoaderCfg;
	LoaderCfg.PrimaryRadius   = StreamRadius;
	LoaderCfg.SecondaryRadius = (LoaderType == EHktTerrainLoaderType::Proximity)
		? ProximityFarRadius
		: StreamRadius;
	LoaderCfg.MaxLoadsPerFrame = MaxLoadsPerFrame;
	LoaderCfg.MaxLoadedChunks  = MaxLoadedChunks;
	LoaderCfg.HeightMinZ       = Cfg.HeightMinZ;
	LoaderCfg.HeightMaxZ       = Cfg.HeightMaxZ;
	Loader->Configure(LoaderCfg);
}

float AHktSpriteTerrainActor::ComputeChunkWorldSize(UHktTerrainSubsystem* Sub) const
{
	const float VoxelSizeCm = Sub->GetEffectiveConfig().VoxelSizeCm;
	return kChunkSize * VoxelSizeCm;
}

void AHktSpriteTerrainActor::ExtractSurfaceCells(UHktTerrainSubsystem* Sub,
	const FIntVector& Coord, TArray<FHktSpriteTerrainSurfaceCell>& OutCells)
{
	OutCells.Reset();

	if (ChunkVoxelScratch.Num() != kVoxelsPerChunk)
	{
		ChunkVoxelScratch.SetNumUninitialized(kVoxelsPerChunk);
	}
	if (!Sub->AcquireChunk(Coord, ChunkVoxelScratch))
	{
		return;
	}

	const float VoxelSize = Sub->GetEffectiveConfig().VoxelSizeCm;
	const float ChunkWorldSize = kChunkSize * VoxelSize;

	auto EnsureAboveChunkLoaded = [&]() -> bool
	{
		const FIntVector AboveCoord(Coord.X, Coord.Y, Coord.Z + 1);
		if (bAboveChunkValid && AboveChunkCachedCoord == AboveCoord)
		{
			return true;
		}
		if (AboveChunkVoxelScratch.Num() != kVoxelsPerChunk)
		{
			AboveChunkVoxelScratch.SetNumUninitialized(kVoxelsPerChunk);
		}
		bAboveChunkValid = Sub->AcquireChunk(AboveCoord, AboveChunkVoxelScratch);
		AboveChunkCachedCoord = AboveCoord;
		return bAboveChunkValid;
	};

	OutCells.Reserve(kChunkSize * kChunkSize);

	for (int32 LY = 0; LY < kChunkSize; ++LY)
	{
		for (int32 LX = 0; LX < kChunkSize; ++LX)
		{
			int32 TopZ = -1;
			const FHktTerrainVoxel* TopVoxel = nullptr;

			for (int32 LZ = kChunkSize - 1; LZ >= 0; --LZ)
			{
				const FHktTerrainVoxel& V = ChunkVoxelScratch[VoxelIndex(LX, LY, LZ)];
				if (V.IsEmpty()) { continue; }
				TopZ = LZ;
				TopVoxel = &V;
				break;
			}
			if (!TopVoxel) { continue; }

			// 노출 판정.
			bool bExposedAbove = (TopZ < kChunkSize - 1);
			if (!bExposedAbove)
			{
				if (EnsureAboveChunkLoaded())
				{
					const FHktTerrainVoxel& AboveV =
						AboveChunkVoxelScratch[VoxelIndex(LX, LY, 0)];
					bExposedAbove = AboveV.IsEmpty();
				}
				else
				{
					bExposedAbove = true;
				}
			}
			if (!bExposedAbove) { continue; }

			FHktSpriteTerrainSurfaceCell Cell;
			Cell.ChunkCoord = Coord;
			Cell.LocalCoord = FIntVector(LX, LY, TopZ);
			Cell.WorldPos = FVector(
				Coord.X * ChunkWorldSize + (LX + 0.5f) * VoxelSize,
				Coord.Y * ChunkWorldSize + (LY + 0.5f) * VoxelSize,
				Coord.Z * ChunkWorldSize +  TopZ        * VoxelSize);
			Cell.TypeID       = TopVoxel->TypeID;
			Cell.PaletteIndex = TopVoxel->PaletteIndex;
			Cell.Flags        = TopVoxel->Flags;
			OutCells.Add(Cell);
		}
	}
}

void AHktSpriteTerrainActor::AddInstancesForChunk(const FIntVector& Coord,
	const TArray<FHktSpriteTerrainSurfaceCell>& Cells, float VoxelSize)
{
	if (Cells.Num() == 0) { return; }

	if (!bUsingFallback)
	{
		// === Sprite mode — 단일 Y-billboard HISM 에 voxel 1개당 instance 1개 ===
		TArray<int32>& Indices = ChunkInstanceIndices.FindOrAdd(Coord);
		Indices.Reserve(Indices.Num() + Cells.Num());

		TArray<float> CustomData;
		CustomData.SetNumUninitialized(kNumCustomDataFloats);

		for (const FHktSpriteTerrainSurfaceCell& Cell : Cells)
		{
			const FTransform Xform = MakeSpriteInstanceTransform(Cell);
			const int32 NewIdx = HISMComponent->AddInstance(Xform, /*bWorldSpace=*/true);
			if (NewIdx == INDEX_NONE) { continue; }
			FillSpriteCustomData(Cell, CustomData);
			for (int32 S = 0; S < kNumCustomDataFloats; ++S)
			{
				HISMComponent->SetCustomDataValue(NewIdx, S, CustomData[S], /*Dirty=*/false);
			}
			Indices.Add(NewIdx);
			InstanceChunkByIdx.Add(NewIdx, Coord);
		}
		return;
	}

	// === Fallback mode — voxel 1개당 3개 axis-aligned face quad ===
	//
	//  Top   (+Z normal): identity rotation, pos = (Wx, Wy - S/2, Wz + S)
	//  Left  (-X normal): pitch -90°,        pos = (Wx - S/2, Wy - S/2, Wz + S/2)
	//  Right (-Y normal): roll  +90°,        pos = (Wx, Wy - S/2, Wz)
	//
	//  QuadMesh 규약: 로컬 XY 평면, 하단-중앙 피벗 (-0.5..0.5 in X, 0..1 in Y, Z=0).
	//  Scale = VoxelSize (uniform).
	const float S = VoxelSize;

	TArray<int32>& TopIndices   = ChunkInstanceIndices_FallbackTop.FindOrAdd(Coord);
	TArray<int32>& LeftIndices  = ChunkInstanceIndices_FallbackLeft.FindOrAdd(Coord);
	TArray<int32>& RightIndices = ChunkInstanceIndices_FallbackRight.FindOrAdd(Coord);
	TopIndices.Reserve(TopIndices.Num()     + Cells.Num());
	LeftIndices.Reserve(LeftIndices.Num()   + Cells.Num());
	RightIndices.Reserve(RightIndices.Num() + Cells.Num());

	const FRotator RotTop   = FRotator::ZeroRotator;
	const FRotator RotLeft  = FRotator(-90.f, 0.f,   0.f);
	const FRotator RotRight = FRotator(  0.f, 0.f,  90.f);
	const FVector  ScaleV(S, S, S);

	auto SetFaceCustomData = [&](UHierarchicalInstancedStaticMeshComponent* H,
		int32 Idx, const FLinearColor& C)
	{
		// Fallback 머티리얼은 slot 9..11 (R, G, B) 만 읽어 Emissive 출력.
		H->SetCustomDataValue(Idx, 9,  C.R, /*Dirty=*/false);
		H->SetCustomDataValue(Idx, 10, C.G, /*Dirty=*/false);
		H->SetCustomDataValue(Idx, 11, C.B, /*Dirty=*/false);
		H->SetCustomDataValue(Idx, 12, C.A, /*Dirty=*/false);
	};

	for (const FHktSpriteTerrainSurfaceCell& Cell : Cells)
	{
		const FLinearColor Base = GetFallbackTypeColorLinear(Cell.TypeID);
		const FLinearColor TopCol   = Base * kFaceShadeTop;
		const FLinearColor LeftCol  = Base * kFaceShadeLeft;
		const FLinearColor RightCol = Base * kFaceShadeRight;

		// Top face: 수평, voxel 윗면에 lay
		const FTransform TopXform(RotTop,
			FVector(Cell.WorldPos.X, Cell.WorldPos.Y - S * 0.5f, Cell.WorldPos.Z + S),
			ScaleV);
		const int32 TopIdx = HISMFallbackTop->AddInstance(TopXform, /*bWorldSpace=*/true);
		if (TopIdx != INDEX_NONE)
		{
			SetFaceCustomData(HISMFallbackTop, TopIdx, TopCol);
			TopIndices.Add(TopIdx);
			InstanceChunkByIdx_FallbackTop.Add(TopIdx, Coord);
		}

		// Left face: -X 쪽 vertical
		const FTransform LeftXform(RotLeft,
			FVector(Cell.WorldPos.X - S * 0.5f, Cell.WorldPos.Y - S * 0.5f, Cell.WorldPos.Z + S * 0.5f),
			ScaleV);
		const int32 LeftIdx = HISMFallbackLeft->AddInstance(LeftXform, /*bWorldSpace=*/true);
		if (LeftIdx != INDEX_NONE)
		{
			SetFaceCustomData(HISMFallbackLeft, LeftIdx, LeftCol);
			LeftIndices.Add(LeftIdx);
			InstanceChunkByIdx_FallbackLeft.Add(LeftIdx, Coord);
		}

		// Right face: -Y 쪽 vertical
		const FTransform RightXform(RotRight,
			FVector(Cell.WorldPos.X, Cell.WorldPos.Y - S * 0.5f, Cell.WorldPos.Z),
			ScaleV);
		const int32 RightIdx = HISMFallbackRight->AddInstance(RightXform, /*bWorldSpace=*/true);
		if (RightIdx != INDEX_NONE)
		{
			SetFaceCustomData(HISMFallbackRight, RightIdx, RightCol);
			RightIndices.Add(RightIdx);
			InstanceChunkByIdx_FallbackRight.Add(RightIdx, Coord);
		}
	}
}

namespace
{
	/**
	 * 한 HISM 에서 청크의 모든 인스턴스 제거 + swap-with-last 매핑 보정.
	 * IndicesMap 에서 청크 키 제거 / InstanceChunkByIdxMap 에서 해당 idx 제거.
	 */
	static void RemoveChunkInstancesFromHISM(
		UHierarchicalInstancedStaticMeshComponent* HISM,
		TMap<FIntVector, TArray<int32>>& IndicesMap,
		TMap<int32, FIntVector>& InstanceChunkByIdxMap,
		const FIntVector& Coord)
	{
		TArray<int32> Indices;
		if (!IndicesMap.RemoveAndCopyValue(Coord, Indices))
		{
			return;
		}
		// 큰 idx 부터 제거 — swap-with-last 가 작은 idx 를 흔들지 않음.
		Indices.Sort();
		for (int32 i = Indices.Num() - 1; i >= 0; --i)
		{
			const int32 RemoveIdx = Indices[i];
			const int32 LastIdx = HISM->GetInstanceCount() - 1;
			if (!HISM->RemoveInstance(RemoveIdx))
			{
				InstanceChunkByIdxMap.Remove(RemoveIdx);
				continue;
			}
			InstanceChunkByIdxMap.Remove(RemoveIdx);
			if (RemoveIdx != LastIdx)
			{
				if (FIntVector* MovedChunk = InstanceChunkByIdxMap.Find(LastIdx))
				{
					const FIntVector ChunkOfMoved = *MovedChunk;
					InstanceChunkByIdxMap.Remove(LastIdx);
					InstanceChunkByIdxMap.Add(RemoveIdx, ChunkOfMoved);
					if (TArray<int32>* MovedList = IndicesMap.Find(ChunkOfMoved))
					{
						for (int32& Slot : *MovedList)
						{
							if (Slot == LastIdx) { Slot = RemoveIdx; break; }
						}
					}
				}
			}
		}
	}
}

void AHktSpriteTerrainActor::RemoveInstancesForChunk(const FIntVector& Coord)
{
	if (bUsingFallback)
	{
		RemoveChunkInstancesFromHISM(HISMFallbackTop,
			ChunkInstanceIndices_FallbackTop, InstanceChunkByIdx_FallbackTop, Coord);
		RemoveChunkInstancesFromHISM(HISMFallbackLeft,
			ChunkInstanceIndices_FallbackLeft, InstanceChunkByIdx_FallbackLeft, Coord);
		RemoveChunkInstancesFromHISM(HISMFallbackRight,
			ChunkInstanceIndices_FallbackRight, InstanceChunkByIdx_FallbackRight, Coord);
	}
	else
	{
		RemoveChunkInstancesFromHISM(HISMComponent,
			ChunkInstanceIndices, InstanceChunkByIdx, Coord);
	}
}

FTransform AHktSpriteTerrainActor::MakeSpriteInstanceTransform(const FHktSpriteTerrainSurfaceCell& Cell) const
{
	// Sprite mode — quad 는 1×1 단위, 머티리얼 WPO 가 Y-axis billboard + 카메라 정렬 처리.
	return FTransform(FQuat::Identity, Cell.WorldPos, FVector::OneVector);
}

void AHktSpriteTerrainActor::FillSpriteCustomData(
	const FHktSpriteTerrainSurfaceCell& Cell, TArray<float>& OutData) const
{
	check(OutData.Num() == kNumCustomDataFloats);

	const float HalfW = CellSizePx.X * PixelToWorld * 0.5f;
	const float HalfH = CellSizePx.Y * PixelToWorld * 0.5f;
	const bool bTranslucent = (Cell.Flags & FHktTerrainVoxel::FLAG_TRANSLUCENT) != 0;
	const float Alpha = bTranslucent ? 0.6f : 1.0f;

	// M_HktSpriteYBillboard CPD 규약.
	OutData[0]  = static_cast<float>(Cell.TypeID);
	OutData[1]  = CellSizePx.X;
	OutData[2]  = CellSizePx.Y;
	OutData[3]  = 0.f;
	OutData[4]  = 0.f;
	OutData[5]  = 0.f;
	OutData[6]  = 0.f;
	OutData[7]  = HalfW;
	OutData[8]  = HalfH;
	OutData[9]  = 1.f;
	OutData[10] = 1.f;
	OutData[11] = 1.f;
	OutData[12] = Alpha;
	OutData[13] = static_cast<float>(Cell.PaletteIndex);
	OutData[14] = 0.f;
	OutData[15] = ComponentZBias;
}

void AHktSpriteTerrainActor::RefreshAllSpriteInstanceBaseline()
{
	if (!HISMComponent || InstanceChunkByIdx.Num() == 0) { return; }

	const float HalfW = CellSizePx.X * PixelToWorld * 0.5f;
	const float HalfH = CellSizePx.Y * PixelToWorld * 0.5f;

	for (const TPair<int32, FIntVector>& Pair : InstanceChunkByIdx)
	{
		const int32 Idx = Pair.Key;
		HISMComponent->SetCustomDataValue(Idx, 7,  HalfW,          /*Dirty=*/false);
		HISMComponent->SetCustomDataValue(Idx, 8,  HalfH,          /*Dirty=*/false);
		HISMComponent->SetCustomDataValue(Idx, 15, ComponentZBias, /*Dirty=*/false);
	}
}

FVector AHktSpriteTerrainActor::GetViewCenterWorldPos() const
{
	if (const UWorld* World = GetWorld())
	{
		if (const APlayerController* PC = World->GetFirstPlayerController())
		{
			if (const APawn* Pawn = PC->GetPawn())
			{
				return Pawn->GetActorLocation();
			}
			FVector Pos; FRotator Rot;
			PC->GetPlayerViewPoint(Pos, Rot);
			return Pos;
		}
	}
	return FVector::ZeroVector;
}
