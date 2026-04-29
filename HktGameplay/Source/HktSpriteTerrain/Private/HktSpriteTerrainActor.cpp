// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "HktSpriteTerrainActor.h"
#include "HktSpriteTerrainLog.h"
#include "HktTerrainSubsystem.h"
#include "Terrain/HktTerrainGeneratorConfig.h"
#include "Components/HierarchicalInstancedStaticMeshComponent.h"
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
		// FHktTerrainGenerator 와 동일 인덱싱 가정 — Z-major (X + SIZE*Y + SIZE^2*Z).
		// HktVoxelChunk::At 과도 일치 (FHktVoxel 과 동일 4바이트 layout).
		return X + kChunkSize * (Y + kChunkSize * Z);
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

void AHktSpriteTerrainActor::BeginPlay()
{
	Super::BeginPlay();

	if (HISMComponent && QuadMesh)
	{
		HISMComponent->SetStaticMesh(QuadMesh);
		HISMComponent->NumCustomDataFloats = kNumCustomDataFloats;

		if (TerrainMaterial)
		{
			TerrainMID = UMaterialInstanceDynamic::Create(TerrainMaterial, this);
			if (TerrainMID)
			{
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
	}

	Loader = CreateTerrainChunkLoader(LoaderType);

	// BakedAsset 비동기 로드 트리거 — 미존재 시 폴백 경로로 동작.
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
	InstanceMap.Reset();
	InstanceCoordByIndex.Reset();
	LastCellByCoord.Reset();
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

	if (!HISMComponent || !QuadMesh || !Loader)
	{
		return;
	}

	UHktTerrainSubsystem* Sub = UHktTerrainSubsystem::Get(this);
	if (!Sub)
	{
		return;
	}

	// 스캔 빈도 제한 — iso 카메라라 초당 N회면 충분.
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

	SyncLoaderConfig(Sub);

	const FVector CameraPos = GetViewCenterWorldPos();
	Loader->Update(CameraPos, ChunkWorldSize);

	// === Unload — 즉시 인스턴스 제거 ===
	for (const FIntVector& Coord : Loader->GetChunksToUnload())
	{
		RemoveInstanceForCoord(Coord);
	}

	// === Load — 새 청크. AcquireChunk 로 voxel 받아 표면 추출 후 인스턴스 추가/갱신 ===
	for (const FHktChunkTierRequest& Req : Loader->GetChunksToLoad())
	{
		FHktSpriteTerrainSurfaceCell Cell;
		if (ExtractTopSurfaceCell(Sub, Req.Coord, Cell))
		{
			AddOrUpdateInstance(Cell);
		}
	}

	// Retier 는 본 액터에서 무시 — 단일 표현(평면 quad)이라 tier 분기 의미 없음.

	HISMComponent->MarkRenderStateDirty();
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

bool AHktSpriteTerrainActor::ExtractTopSurfaceCell(UHktTerrainSubsystem* Sub,
	const FIntVector& Coord, FHktSpriteTerrainSurfaceCell& OutCell) const
{
	TArray<FHktTerrainVoxel> Voxels;
	Voxels.SetNumUninitialized(kVoxelsPerChunk);
	if (!Sub->AcquireChunk(Coord, Voxels))
	{
		return false;
	}

	const float VoxelSize = Sub->GetEffectiveConfig().VoxelSizeCm;
	const float ChunkWorldSize = kChunkSize * VoxelSize;

	int32 BestZ = -1;
	int32 BestX = 0;
	int32 BestY = 0;
	const FHktTerrainVoxel* BestVoxel = nullptr;

	// Top-most 셀 — 청크 내 (X, Y) 별 최상단 비어있지 않은 voxel 1개.
	// 본 액터는 청크 1개 = 1 인스턴스이므로 (X, Y) 평균이 아닌 가장 높은 Z 의 셀 1개를 대표로 잡는다.
	for (int32 Y = 0; Y < kChunkSize; ++Y)
	{
		for (int32 X = 0; X < kChunkSize; ++X)
		{
			for (int32 Z = kChunkSize - 1; Z > BestZ; --Z)
			{
				const FHktTerrainVoxel& V = Voxels[VoxelIndex(X, Y, Z)];
				if (V.IsEmpty())
				{
					continue;
				}
				BestZ = Z;
				BestX = X;
				BestY = Y;
				BestVoxel = &V;
				break;
			}
		}
	}

	if (!BestVoxel)
	{
		return false;
	}

	OutCell.ChunkCoord = Coord;
	OutCell.WorldPos = FVector(
		Coord.X * ChunkWorldSize + (BestX + 0.5f) * VoxelSize,
		Coord.Y * ChunkWorldSize + (BestY + 0.5f) * VoxelSize,
		Coord.Z * ChunkWorldSize + (BestZ + 0.5f) * VoxelSize);
	OutCell.TypeID = BestVoxel->TypeID;
	OutCell.PaletteIndex = BestVoxel->PaletteIndex;
	OutCell.Flags = BestVoxel->Flags;
	return true;
}

void AHktSpriteTerrainActor::AddOrUpdateInstance(const FHktSpriteTerrainSurfaceCell& Cell)
{
	const FTransform Xform = MakeInstanceTransform(Cell);
	TArray<float> CustomData;
	CustomData.SetNumUninitialized(kNumCustomDataFloats);
	FillCustomData(Cell, CustomData);

	if (int32* ExistingIdx = InstanceMap.Find(Cell.ChunkCoord))
	{
		const int32 Idx = *ExistingIdx;
		const FHktSpriteTerrainSurfaceCell* Prev = LastCellByCoord.Find(Cell.ChunkCoord);
		const bool bTransformChanged =
			!Prev || !Prev->WorldPos.Equals(Cell.WorldPos, 0.01f);
		const bool bDataChanged =
			!Prev ||
			Prev->TypeID != Cell.TypeID ||
			Prev->PaletteIndex != Cell.PaletteIndex ||
			Prev->Flags != Cell.Flags;

		if (bTransformChanged)
		{
			HISMComponent->UpdateInstanceTransform(Idx, Xform, /*bWorldSpace=*/true,
				/*bMarkRenderStateDirty=*/false, /*bTeleport=*/true);
		}
		if (bDataChanged)
		{
			for (int32 S = 0; S < kNumCustomDataFloats; ++S)
			{
				HISMComponent->SetCustomDataValue(Idx, S, CustomData[S],
					/*bMarkRenderStateDirty=*/false);
			}
		}
	}
	else
	{
		const int32 NewIdx = HISMComponent->AddInstance(Xform, /*bWorldSpace=*/true);
		if (NewIdx != INDEX_NONE)
		{
			InstanceMap.Add(Cell.ChunkCoord, NewIdx);
			InstanceCoordByIndex.Add(NewIdx, Cell.ChunkCoord);
			for (int32 S = 0; S < kNumCustomDataFloats; ++S)
			{
				HISMComponent->SetCustomDataValue(NewIdx, S, CustomData[S],
					/*bMarkRenderStateDirty=*/false);
			}
		}
	}

	LastCellByCoord.Add(Cell.ChunkCoord, Cell);
}

void AHktSpriteTerrainActor::RemoveInstanceForCoord(const FIntVector& Coord)
{
	int32 RemoveIdx = INDEX_NONE;
	if (!InstanceMap.RemoveAndCopyValue(Coord, RemoveIdx))
	{
		return;
	}

	const int32 LastIdx = HISMComponent->GetInstanceCount() - 1;
	if (HISMComponent->RemoveInstance(RemoveIdx))
	{
		InstanceCoordByIndex.Remove(RemoveIdx);
		LastCellByCoord.Remove(Coord);

		// RemoveInstance 는 마지막 인스턴스를 빈 자리에 swap — 매핑 보정.
		if (RemoveIdx != LastIdx)
		{
			if (FIntVector* SwappedCoord = InstanceCoordByIndex.Find(LastIdx))
			{
				const FIntVector NewKey = *SwappedCoord;
				InstanceCoordByIndex.Remove(LastIdx);
				InstanceCoordByIndex.Add(RemoveIdx, NewKey);
				InstanceMap[NewKey] = RemoveIdx;
			}
		}
	}
}

FTransform AHktSpriteTerrainActor::MakeInstanceTransform(const FHktSpriteTerrainSurfaceCell& Cell) const
{
	// quad mesh = 1×1 unit. 실제 크기는 PerInstanceCustomData slot 7,8 (ScaleX/Y)로 결정.
	return FTransform(FQuat::Identity, Cell.WorldPos, FVector::OneVector);
}

void AHktSpriteTerrainActor::FillCustomData(
	const FHktSpriteTerrainSurfaceCell& Cell, TArray<float>& OutData) const
{
	check(OutData.Num() == kNumCustomDataFloats);

	const float ChunkWorldSize = CachedChunkWorldSize > 0.f
		? CachedChunkWorldSize
		: kChunkSize * 15.f;  // 폴백 — VoxelSizeCm 기본값
	const float HalfChunk = ChunkWorldSize * 0.5f;
	const bool bTranslucent = (Cell.Flags & FHktTerrainVoxel::FLAG_TRANSLUCENT) != 0;
	const float Alpha = bTranslucent ? 0.6f : 1.0f;

	OutData[0]  = static_cast<float>(Cell.TypeID);
	OutData[1]  = CellSizePx.X;
	OutData[2]  = CellSizePx.Y;
	OutData[3]  = 0.f;
	OutData[4]  = 0.f;
	OutData[5]  = 0.f;
	OutData[6]  = 0.f;
	OutData[7]  = HalfChunk;
	OutData[8]  = HalfChunk;
	OutData[9]  = 1.f;
	OutData[10] = 1.f;
	OutData[11] = 1.f;
	OutData[12] = Alpha;
	OutData[13] = static_cast<float>(Cell.PaletteIndex);
	OutData[14] = 0.f;
	OutData[15] = ComponentZBias;
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
