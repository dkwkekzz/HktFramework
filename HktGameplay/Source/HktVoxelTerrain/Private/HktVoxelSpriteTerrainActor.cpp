// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "HktVoxelSpriteTerrainActor.h"
#include "HktVoxelTerrainActor.h"
#include "HktVoxelTerrainNDI.h"
#include "Data/HktVoxelRenderCache.h"
#include "Data/HktVoxelTypes.h"
#include "GameFramework/PlayerController.h"
#include "GameFramework/Pawn.h"
#include "Kismet/GameplayStatics.h"
#include "NiagaraComponent.h"
#include "NiagaraSystem.h"

AHktVoxelSpriteTerrainActor::AHktVoxelSpriteTerrainActor()
{
	PrimaryActorTick.bCanEverTick = true;
	PrimaryActorTick.TickGroup = TG_DuringPhysics;

	NiagaraComponent = CreateDefaultSubobject<UNiagaraComponent>(TEXT("NiagaraComponent"));
	RootComponent = NiagaraComponent;
	NiagaraComponent->bAutoActivate = false;
}

void AHktVoxelSpriteTerrainActor::BeginPlay()
{
	Super::BeginPlay();

	TerrainNDI = NewObject<UHktVoxelTerrainNDI>(this);

	if (TerrainNiagaraSystem && NiagaraComponent)
	{
		NiagaraComponent->SetAsset(TerrainNiagaraSystem);
		NiagaraComponent->Activate(true);
	}
}

void AHktVoxelSpriteTerrainActor::EndPlay(const EEndPlayReason::Type EndPlayReason)
{
	if (NiagaraComponent)
	{
		NiagaraComponent->Deactivate();
	}
	Super::EndPlay(EndPlayReason);
}

void AHktVoxelSpriteTerrainActor::Tick(float DeltaSeconds)
{
	Super::Tick(DeltaSeconds);

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

	if (TerrainNDI)
	{
		UHktVoxelTerrainNDI::FParamNames Names;
		Names.Positions = ParamName_Positions;
		Names.TypeIDs = ParamName_TypeIDs;
		Names.PaletteIndices = ParamName_PaletteIndices;
		Names.Flags = ParamName_Flags;

		TerrainNDI->PushSurfaceCells(NiagaraComponent, Cells, Names);
	}
}

void AHktVoxelSpriteTerrainActor::ScanVisibleTopSurface(TArray<FHktVoxelSurfaceCell>& OutCells) const
{
	OutCells.Reset();

	FHktVoxelRenderCache* Cache = ResolveRenderCache();
	if (!Cache)
	{
		return;
	}

	// ResolveRenderCache 성공 경로에선 CachedSourceActor가 유효
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

	// 청크당 top-most 1셀 — 중심 컬럼(16,16)에서 Z 내림차순 스캔.
	// NOTE: 청크 중심 컬럼 1개만 샘플링하므로 (16,16)에 수직 공기 구멍이 있으면
	// 잘못된 Z를 반환할 수 있다. 대부분의 지형은 층상 구조라 실용상 허용.
	// 전체 32² 컬럼 스캔 or majority-vote는 후속 최적화 대상.
	constexpr int32 ScanX = FHktVoxelChunk::SIZE / 2;
	constexpr int32 ScanY = FHktVoxelChunk::SIZE / 2;

	for (const FIntVector& Coord : Coords)
	{
		// 청크 AABB 중심 (XY만 사용 — iso 고정각이라 Z는 무시)
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

		for (int32 Z = FHktVoxelChunk::SIZE - 1; Z >= 0; --Z)
		{
			const FHktVoxel& V = Chunk->At(ScanX, ScanY, Z);
			if (V.IsEmpty())
			{
				continue;
			}

			FHktVoxelSurfaceCell Cell;
			Cell.WorldPos = FVector(
				Coord.X * ChunkWorldSize + (ScanX + 0.5f) * VoxelSize,
				Coord.Y * ChunkWorldSize + (ScanY + 0.5f) * VoxelSize,
				Coord.Z * ChunkWorldSize + (Z + 0.5f) * VoxelSize);
			Cell.TypeID = V.TypeID;
			Cell.PaletteIndex = V.PaletteIndex;
			Cell.Flags = V.Flags;
			OutCells.Add(Cell);
			break;
		}
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
	// 캐시된 핸들이 아직 유효하면 즉시 반환
	if (AHktVoxelTerrainActor* Cached = CachedSourceActor.Get())
	{
		return Cached->GetTerrainCache();
	}

	UWorld* World = GetWorld();
	if (!World)
	{
		return nullptr;
	}

	// 월드에 1개 존재 가정 — 없으면 no-op. 레벨 스트리밍으로 뒤늦게 스폰돼도
	// 다음 Tick에 재시도되므로 경고 로그는 생략.
	AActor* Found = UGameplayStatics::GetActorOfClass(World, AHktVoxelTerrainActor::StaticClass());
	AHktVoxelTerrainActor* VoxelActor = Cast<AHktVoxelTerrainActor>(Found);
	if (!VoxelActor)
	{
		return nullptr;
	}

	CachedSourceActor = VoxelActor;
	return VoxelActor->GetTerrainCache();
}
