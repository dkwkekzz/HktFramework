// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "HktSpriteTerrainActor.h"
#include "HktSpriteTerrainLog.h"
#include "HktAdvTerrainTypes.h"
#include "HktTerrainSubsystem.h"
#include "Terrain/HktTerrainGeneratorConfig.h"
#include "Components/HierarchicalInstancedStaticMeshComponent.h"
#include "DrawDebugHelpers.h"
#include "Engine/StaticMesh.h"
#include "Engine/World.h"
#include "GameFramework/PlayerController.h"
#include "GameFramework/Pawn.h"
#include "Materials/MaterialInstanceDynamic.h"
#include "Materials/MaterialInterface.h"

namespace
{
	constexpr int32 kNumCustomDataFloats = 16;
	constexpr int32 kChunkSize = FHktTerrainGeneratorConfig::ChunkSize;
	constexpr int32 kVoxelsPerChunk = kChunkSize * kChunkSize * kChunkSize;

	FORCEINLINE int32 VoxelIndex(int32 X, int32 Y, int32 Z)
	{
		// FHktTerrainGenerator 와 동일 인덱싱 — Z-major (X + SIZE*Y + SIZE^2*Z).
		return X + kChunkSize * (Y + kChunkSize * Z);
	}

	// ------------------------------------------------------------------------
	// 폴백 컬러 테이블 — HktAdvTerrainType ID(0..32) 별 의미 있는 색.
	// Fallback wireframe mode 에서 voxel 별 DrawDebugBox 색에 사용.
	// ------------------------------------------------------------------------
	static FColor GetFallbackTypeColor(uint16 TypeID)
	{
		// HktAdvTerrainType:: ID 매핑 (33 종).
		static const FColor Table[HktAdvTerrainType::TypeCount] = {
			FColor(  0,   0,   0,   0),    // 0  Air (defensive — emit 안 됨)
			FColor( 80, 170,  60, 255),    // 1  Grass
			FColor(115,  75,  45, 255),    // 2  Dirt
			FColor(125, 125, 130, 255),    // 3  Stone
			FColor(225, 200, 135, 255),    // 4  Sand
			FColor( 45,  95, 185, 255),    // 5  Water
			FColor(240, 240, 245, 255),    // 6  Snow
			FColor(170, 220, 240, 255),    // 7  Ice
			FColor(140, 130, 120, 255),    // 8  Gravel
			FColor(155, 100,  80, 255),    // 9  Clay
			FColor( 80,  80,  90, 255),    // 10 Bedrock (wireframe 가시성 위해 다소 밝게)
			FColor(200, 220, 230, 255),    // 11 Glass
			FColor(120, 190,  90, 255),    // 12 GrassFlower
			FColor( 95, 115,  75, 255),    // 13 StoneMossy
			FColor(150, 210, 190, 255),    // 14 CrystalGrass
			FColor(190, 225, 210, 255),    // 15 GrassEthereal
			FColor(130, 225, 110, 255),    // 16 MossGlow
			FColor( 90,  70,  50, 255),    // 17 SoilDark (wireframe 가시성 위해 다소 밝게)
			FColor(235, 220, 180, 255),    // 18 SandBleached
			FColor(115, 110, 105, 255),    // 19 StoneFractured
			FColor(220, 215, 195, 255),    // 20 BoneFragment
			FColor(200, 180, 240, 255),    // 21 CrystalShard
			FColor(150,  95,  60, 255),    // 22 Wood
			FColor( 60, 130,  50, 255),    // 23 Leaves
			FColor(205, 220, 200, 255),    // 24 LeavesSnow
			FColor( 90, 145,  85, 255),    // 25 Cactus
			FColor(180, 120, 100, 255),    // 26 Mushroom
			FColor(255, 130, 220, 255),    // 27 MushroomGlow
			FColor( 80,  80,  90, 255),    // 28 OreCoal
			FColor(185, 125,  90, 255),    // 29 OreIron
			FColor(240, 200,  80, 255),    // 30 OreGold
			FColor(180, 230, 255, 255),    // 31 OreCrystal
			FColor(120,  60, 160, 255),    // 32 OreVoidstone
		};
		// 알 수 없는 TypeID 는 마젠타 — 누락된 등록을 시각적으로 즉시 식별.
		static const FColor Unknown(255,   0, 255, 255);
		return (TypeID < HktAdvTerrainType::TypeCount) ? Table[TypeID] : Unknown;
	}
}

AHktSpriteTerrainActor::AHktSpriteTerrainActor()
{
	PrimaryActorTick.bCanEverTick = true;
	PrimaryActorTick.TickGroup = TG_DuringPhysics;

	HISMComponent = CreateDefaultSubobject<UHierarchicalInstancedStaticMeshComponent>(TEXT("HISM"));
	RootComponent = HISMComponent;
	HISMComponent->SetMobility(EComponentMobility::Movable);
	HISMComponent->NumCustomDataFloats = kNumCustomDataFloats;
	HISMComponent->SetCollisionEnabled(ECollisionEnabled::NoCollision);
	HISMComponent->SetCanEverAffectNavigation(false);
	HISMComponent->bDisableCollision = true;
	HISMComponent->SetGenerateOverlapEvents(false);
	HISMComponent->bAffectDistanceFieldLighting = false;
	HISMComponent->bAffectDynamicIndirectLighting = false;
	HISMComponent->CastShadow = false;
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
}

void AHktSpriteTerrainActor::BeginPlay()
{
	Super::BeginPlay();

	// Mode 결정 — AtlasTexture 가 비었고 bUseFallbackColors=true 면 fallback (wireframe).
	bUsingFallback = (!AtlasTexture && bUseFallbackColors);

	if (bUsingFallback)
	{
		// HISM 비활성화 — fallback 은 DrawDebugBox 만 사용.
		if (HISMComponent)
		{
			HISMComponent->SetVisibility(false);
		}
		UE_LOG(LogHktSpriteTerrain, Log,
			TEXT("[SpriteTerrain] Fallback mode 활성 — voxel 마다 매 Tick DrawDebugBox 12-line cube 렌더."));
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
	if (HISMComponent)
	{
		HISMComponent->ClearInstances();
	}
	ChunkInstanceIndices.Reset();
	InstanceChunkByIdx.Reset();
	LoadedSurfaceCells.Reset();
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

	if (!Loader)
	{
		return;
	}

	UHktTerrainSubsystem* Sub = UHktTerrainSubsystem::Get(this);
	if (!Sub)
	{
		return;
	}

	// === Per-frame: fallback wireframe 그리기 (스캔 throttle 무관 — 매 프레임 갱신 필요) ===
	if (bUsingFallback && CachedVoxelSize > 0.f)
	{
		DrawFallbackWireframes(CachedVoxelSize);
	}

	// === 스캔 빈도 제한 — chunk load/unload 만 throttle ===
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
	CachedVoxelSize      = Sub->GetEffectiveConfig().VoxelSizeCm;

	// Sprite mode baseline 변경 감지.
	if (!bUsingFallback && HISMComponent && QuadMesh)
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
			if (LoadedSurfaceCells.Contains(Req.Coord)) continue;
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
			AddInstancesForChunk(Req.Coord, SurfaceCellsScratch);
		}
	}

	if (!bUsingFallback && HISMComponent)
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

	// BakedAsset 이 있으면 영역의 Z 범위로 클램프 — 베이크되지 않은 Z 청크 요청을 차단해
	// `Chunk … 베이크 미존재 — 런타임 생성 폴백` Warning 의 근본 원인을 제거.
	if (UHktTerrainBakedAsset* Baked = Sub->GetBakedAsset())
	{
		LoaderCfg.HeightMinZ = FMath::Max(LoaderCfg.HeightMinZ, Baked->RegionMin.Z);
		LoaderCfg.HeightMaxZ = FMath::Min(LoaderCfg.HeightMaxZ, Baked->RegionMax.Z);
	}
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

	const FHktTerrainGeneratorConfig EffCfg = Sub->GetEffectiveConfig();
	const float VoxelSize = EffCfg.VoxelSizeCm;
	const float ChunkWorldSize = kChunkSize * VoxelSize;

	// 월드 최상단 청크 위쪽은 하늘(전부 air) 로 간주. AcquireChunk 호출하지 않음 —
	// 베이크 영역 밖 좌표라 Subsystem 이 Warning 폴백 경로로 빠지는 것을 차단.
	// BakedAsset 이 있으면 영역 Z 도 함께 고려해 더 보수적으로 컷.
	int32 AboveZCap = EffCfg.HeightMaxZ;
	if (UHktTerrainBakedAsset* Baked = Sub->GetBakedAsset())
	{
		AboveZCap = FMath::Min(AboveZCap, Baked->RegionMax.Z);
	}

	auto EnsureAboveChunkLoaded = [&]() -> bool
	{
		const FIntVector AboveCoord(Coord.X, Coord.Y, Coord.Z + 1);
		if (AboveCoord.Z > AboveZCap)
		{
			// 하늘 — air 로 간주, AcquireChunk 생략.
			bAboveChunkValid = false;
			AboveChunkCachedCoord = AboveCoord;
			return false;
		}
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
	const TArray<FHktSpriteTerrainSurfaceCell>& Cells)
{
	if (Cells.Num() == 0) { return; }

	if (bUsingFallback)
	{
		// Fallback wireframe mode — 인스턴스 없이 cell 캐시만. Tick 이 매 프레임 DrawDebugBox.
		LoadedSurfaceCells.Add(Coord, Cells);
		return;
	}

	// Sprite mode — Y-billboard HISM 에 인스턴스 추가.
	if (!HISMComponent) { return; }

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
}

void AHktSpriteTerrainActor::RemoveInstancesForChunk(const FIntVector& Coord)
{
	if (bUsingFallback)
	{
		LoadedSurfaceCells.Remove(Coord);
		return;
	}

	if (!HISMComponent) { return; }

	TArray<int32> Indices;
	if (!ChunkInstanceIndices.RemoveAndCopyValue(Coord, Indices))
	{
		return;
	}
	// 큰 idx 부터 제거 — swap-with-last 가 작은 idx 를 흔들지 않음.
	Indices.Sort();
	for (int32 i = Indices.Num() - 1; i >= 0; --i)
	{
		const int32 RemoveIdx = Indices[i];
		const int32 LastIdx = HISMComponent->GetInstanceCount() - 1;
		if (!HISMComponent->RemoveInstance(RemoveIdx))
		{
			InstanceChunkByIdx.Remove(RemoveIdx);
			continue;
		}
		InstanceChunkByIdx.Remove(RemoveIdx);
		if (RemoveIdx != LastIdx)
		{
			if (FIntVector* MovedChunk = InstanceChunkByIdx.Find(LastIdx))
			{
				const FIntVector ChunkOfMoved = *MovedChunk;
				InstanceChunkByIdx.Remove(LastIdx);
				InstanceChunkByIdx.Add(RemoveIdx, ChunkOfMoved);
				if (TArray<int32>* MovedList = ChunkInstanceIndices.Find(ChunkOfMoved))
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

void AHktSpriteTerrainActor::DrawFallbackWireframes(float VoxelSize) const
{
	UWorld* World = GetWorld();
	if (!World || VoxelSize <= 0.f)
	{
		return;
	}

	const FVector HalfExtent(VoxelSize * 0.5f);
	const float HalfV = VoxelSize * 0.5f;

	for (const TPair<FIntVector, TArray<FHktSpriteTerrainSurfaceCell>>& Pair : LoadedSurfaceCells)
	{
		for (const FHktSpriteTerrainSurfaceCell& Cell : Pair.Value)
		{
			// WorldPos = voxel 바닥-중앙 → 박스 중심은 그 위로 HalfV.
			const FVector Center = Cell.WorldPos + FVector(0.f, 0.f, HalfV);
			const FColor  C      = GetFallbackTypeColor(Cell.TypeID);
			DrawDebugBox(World, Center, HalfExtent, C,
				/*bPersistent=*/false, /*Lifetime=*/-1.f,
				/*DepthPriority=*/0, FallbackWireThickness);
		}
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
