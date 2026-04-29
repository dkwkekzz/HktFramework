// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "HktVoxelSpriteTerrainActor.h"
#include "HktVoxelTerrainActor.h"
#include "HktVoxelTerrainLog.h"
#include "Data/HktVoxelRenderCache.h"
#include "Data/HktVoxelTypes.h"
#include "Components/HierarchicalInstancedStaticMeshComponent.h"
#include "Engine/StaticMesh.h"
#include "GameFramework/PlayerController.h"
#include "GameFramework/Pawn.h"
#include "Kismet/GameplayStatics.h"
#include "Materials/MaterialInstanceDynamic.h"
#include "Materials/MaterialInterface.h"

namespace
{
	constexpr int32 kNumCustomDataFloats = 16;
}

AHktVoxelSpriteTerrainActor::AHktVoxelSpriteTerrainActor()
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

void AHktVoxelSpriteTerrainActor::BeginPlay()
{
	Super::BeginPlay();

	UE_LOG(LogHktVoxelTerrain, Warning,
		TEXT("[Deprecated] AHktVoxelSpriteTerrainActor 는 PR-D 에서 AHktSpriteTerrainActor (HktSpriteTerrain 모듈) 로 대체되었다. ")
		TEXT("월드(%s)에 배치된 본 액터를 마이그레이션할 것 — 1 릴리스 후 제거 예정."),
		GetWorld() ? *GetWorld()->GetName() : TEXT("<null>"));

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
}

void AHktVoxelSpriteTerrainActor::EndPlay(const EEndPlayReason::Type EndPlayReason)
{
	if (HISMComponent)
	{
		HISMComponent->ClearInstances();
	}
	InstanceMap.Reset();
	InstanceCoordByIndex.Reset();
	LastCellByCoord.Reset();

	Super::EndPlay(EndPlayReason);
}

void AHktVoxelSpriteTerrainActor::Tick(float DeltaSeconds)
{
	Super::Tick(DeltaSeconds);

	if (!HISMComponent || !QuadMesh)
	{
		return;
	}

	// 스캔 빈도 제한 — 고정 카메라라 초당 N회면 충분
	const float Now = GetWorld() ? GetWorld()->GetTimeSeconds() : 0.f;
	const float MinInterval = (MaxScansPerSecond > 0.f) ? 1.f / MaxScansPerSecond : 0.f;
	if (Now - LastScanTime < MinInterval)
	{
		return;
	}
	LastScanTime = Now;

	TArray<FHktVoxelSurfaceCell> Cells;
	ScanVisibleTopSurface(Cells);

	const AHktVoxelTerrainActor* VoxelActor = CachedSourceActor.Get();
	const float ChunkWorldSize = VoxelActor ? VoxelActor->GetChunkWorldSize() : 0.f;
	if (ChunkWorldSize <= 0.f)
	{
		return;
	}

	// === Diff: 신규/변경 처리 ===
	TSet<FIntVector> SeenCoords;
	SeenCoords.Reserve(Cells.Num());

	TArray<float> CustomData;
	CustomData.SetNumUninitialized(kNumCustomDataFloats);

	for (const FHktVoxelSurfaceCell& Cell : Cells)
	{
		SeenCoords.Add(Cell.ChunkCoord);

		const FTransform Xform = MakeInstanceTransform(Cell);
		FillCustomData(Cell, ChunkWorldSize, CustomData);

		if (int32* ExistingIdx = InstanceMap.Find(Cell.ChunkCoord))
		{
			const int32 Idx = *ExistingIdx;
			const FHktVoxelSurfaceCell* Prev = LastCellByCoord.Find(Cell.ChunkCoord);
			const bool bTransformChanged =
				!Prev ||
				!Prev->WorldPos.Equals(Cell.WorldPos, 0.01f);
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

	// === Diff: 사라진 인스턴스 제거 ===
	// RemoveInstance는 마지막 인스턴스를 빈자리에 swap한다 — 매핑 갱신 필수.
	TArray<FIntVector> ToRemove;
	for (const TPair<FIntVector, int32>& Pair : InstanceMap)
	{
		if (!SeenCoords.Contains(Pair.Key))
		{
			ToRemove.Add(Pair.Key);
		}
	}

	for (const FIntVector& Coord : ToRemove)
	{
		const int32 RemoveIdx = InstanceMap.FindAndRemoveChecked(Coord);
		const int32 LastIdx = HISMComponent->GetInstanceCount() - 1;

		if (HISMComponent->RemoveInstance(RemoveIdx))
		{
			InstanceCoordByIndex.Remove(RemoveIdx);
			LastCellByCoord.Remove(Coord);

			// 마지막 인스턴스가 RemoveIdx 자리로 swap된 경우 매핑 보정.
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

	HISMComponent->MarkRenderStateDirty();
}

FTransform AHktVoxelSpriteTerrainActor::MakeInstanceTransform(const FHktVoxelSurfaceCell& Cell) const
{
	// quad mesh = 1×1 unit. 실제 크기는 PerInstanceCustomData slot 7,8 (ScaleX/Y, M_HktSpriteYBillboard
	// WPO에서 사용)로 결정되므로 인스턴스 자체 스케일은 1.
	return FTransform(FQuat::Identity, Cell.WorldPos, FVector::OneVector);
}

void AHktVoxelSpriteTerrainActor::FillCustomData(
	const FHktVoxelSurfaceCell& Cell, float ChunkWorldSize, TArray<float>& OutData) const
{
	check(OutData.Num() == kNumCustomDataFloats);

	const float HalfChunk = ChunkWorldSize * 0.5f;
	const bool bTranslucent = (Cell.Flags & FHktVoxel::FLAG_TRANSLUCENT) != 0;
	const float Alpha = bTranslucent ? 0.6f : 1.0f;

	OutData[0]  = static_cast<float>(Cell.TypeID);   // AtlasIdx
	OutData[1]  = CellSizePx.X;                      // CellW
	OutData[2]  = CellSizePx.Y;                      // CellH
	OutData[3]  = 0.f;                               // reserved
	OutData[4]  = 0.f;                               // OffX
	OutData[5]  = 0.f;                               // OffY
	OutData[6]  = 0.f;                               // RotR (iso 고정)
	OutData[7]  = HalfChunk;                         // ScaleX = ChunkWorld/2
	OutData[8]  = HalfChunk;                         // ScaleY
	OutData[9]  = 1.f;                               // Tint R
	OutData[10] = 1.f;                               // Tint G
	OutData[11] = 1.f;                               // Tint B
	OutData[12] = Alpha;                             // Tint A
	OutData[13] = static_cast<float>(Cell.PaletteIndex); // PaletteIndex
	OutData[14] = 0.f;                               // FlipV
	OutData[15] = 0.f;                               // ZBiasV
}

void AHktVoxelSpriteTerrainActor::ScanVisibleTopSurface(TArray<FHktVoxelSurfaceCell>& OutCells) const
{
	OutCells.Reset();

	FHktVoxelRenderCache* Cache = ResolveRenderCache();
	if (!Cache)
	{
		return;
	}

	const AHktVoxelTerrainActor* VoxelActor = CachedSourceActor.Get();
	if (!VoxelActor)
	{
		return;
	}

	const float ChunkWorldSize = VoxelActor->GetChunkWorldSize();
	const float VoxelSize = VoxelActor->VoxelSize;
	if (ChunkWorldSize <= 0.f || VoxelSize <= 0.f)
	{
		return;
	}

	const FVector ViewCenter = GetViewCenterWorldPos();
	const float IncludeRadiusSq = FMath::Square(IncludeRadiusUU);

	TArray<FIntVector> Coords;
	Cache->GetAllChunkCoords(Coords);

	OutCells.Reserve(Coords.Num());

	constexpr int32 S = FHktVoxelChunk::SIZE;

	for (const FIntVector& Coord : Coords)
	{
		const FVector2D ChunkCenterXY(
			(Coord.X + 0.5f) * ChunkWorldSize,
			(Coord.Y + 0.5f) * ChunkWorldSize);

		const float DX = ChunkCenterXY.X - ViewCenter.X;
		const float DY = ChunkCenterXY.Y - ViewCenter.Y;
		if (DX * DX + DY * DY > IncludeRadiusSq)
		{
			continue;
		}

		const FHktVoxelChunk* Chunk = Cache->GetChunk(Coord);
		if (!Chunk)
		{
			continue;
		}

		int32 BestZ = -1;
		int32 BestX = 0;
		int32 BestY = 0;
		const FHktVoxel* BestVoxel = nullptr;

		for (int32 Y = 0; Y < S; ++Y)
		{
			for (int32 X = 0; X < S; ++X)
			{
				for (int32 Z = S - 1; Z > BestZ; --Z)
				{
					const FHktVoxel& V = Chunk->At(X, Y, Z);
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
			continue;
		}

		FHktVoxelSurfaceCell Cell;
		Cell.ChunkCoord = Coord;
		Cell.WorldPos = FVector(
			Coord.X * ChunkWorldSize + (BestX + 0.5f) * VoxelSize,
			Coord.Y * ChunkWorldSize + (BestY + 0.5f) * VoxelSize,
			Coord.Z * ChunkWorldSize + (BestZ + 0.5f) * VoxelSize);
		Cell.TypeID = BestVoxel->TypeID;
		Cell.PaletteIndex = BestVoxel->PaletteIndex;
		Cell.Flags = BestVoxel->Flags;
		OutCells.Add(Cell);
	}
}

FVector AHktVoxelSpriteTerrainActor::GetViewCenterWorldPos() const
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

FHktVoxelRenderCache* AHktVoxelSpriteTerrainActor::ResolveRenderCache() const
{
	if (AHktVoxelTerrainActor* Cached = CachedSourceActor.Get())
	{
		return Cached->GetTerrainCache();
	}

	UWorld* World = GetWorld();
	if (!World)
	{
		return nullptr;
	}

	AActor* Found = UGameplayStatics::GetActorOfClass(World, AHktVoxelTerrainActor::StaticClass());
	AHktVoxelTerrainActor* VoxelActor = Cast<AHktVoxelTerrainActor>(Found);
	if (!VoxelActor)
	{
		return nullptr;
	}

	CachedSourceActor = VoxelActor;

	// const_cast — resolve는 const 경로지만 tick dependency 등록은 1회 세팅이며
	// 관측 가능한 상태 변화가 없다.
	AHktVoxelSpriteTerrainActor* MutableSelf = const_cast<AHktVoxelSpriteTerrainActor*>(this);
	MutableSelf->AddTickPrerequisiteActor(VoxelActor);

	if (!VoxelActor->IsHidden())
	{
		UE_LOG(LogTemp, Warning,
			TEXT("[HktVoxelSpriteTerrain] AHktVoxelTerrainActor also visible — Z-fighting ")
			TEXT("possible. Hide one actor (bHiddenInGame) for clean A/B or single render."));
	}

	return VoxelActor->GetTerrainCache();
}
